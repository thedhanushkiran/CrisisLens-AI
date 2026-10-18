"""
CrisisLens AI - Machine Learning Inference and Spatial Decision Support Service.

Provides:
- Feature A: Incident Severity Classification with confidence calibration & explanations
- Feature B: Spatial Incident Hotspot Clustering & Risk Density
- Feature C: Multi-Factor Resource & Dispatch Prioritization
- Fallback: Transparent rule-based triage when ML artifacts are unavailable
"""

import json
import logging
import math
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import joblib
import numpy as np
import pandas as pd
from sklearn.cluster import DBSCAN

from backend.app.ml.train import METRICS_PATH, MODEL_PATH
from backend.app.schemas import Category, TriageSuggestion, Urgency
from backend.app.services.triage import RuleBasedTriage

logger = logging.getLogger("crisislens.ml")

EARTH_RADIUS_KM = 6371.0


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Computes great-circle distance between two GPS coordinates in kilometers."""
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    return 2.0 * EARTH_RADIUS_KM * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))


class MLInferenceService:
    def __init__(self):
        self.model = None
        self.metrics = None
        self._load_artifacts()
        self.rule_fallback = RuleBasedTriage()

    def _load_artifacts(self):
        try:
            if os.path.exists(MODEL_PATH):
                self.model = joblib.load(MODEL_PATH)
                logger.info("Loaded trained incident severity model from %s", MODEL_PATH)
            else:
                logger.warning("ML model artifact not found at %s; will use rule-based fallback", MODEL_PATH)

            if os.path.exists(METRICS_PATH):
                with open(METRICS_PATH, "r", encoding="utf-8") as f:
                    self.metrics = json.load(f)
        except Exception:
            logger.exception("Failed to load ML artifacts; falling back to rule-based engine")
            self.model = None

    def get_metrics_report(self) -> Dict[str, Any]:
        if self.metrics:
            return self.metrics
        return {
            "status": "baseline_only",
            "message": "Serialized ML evaluation metrics not yet generated.",
            "limitations": [
                "Using rule-based triage fallback until model artifacts are trained.",
            ],
        }

    def predict_severity(
        self,
        description: str,
        categories: List[str],
        water_depth_m: float = 0.0,
        trapped_count: int = 0,
        vulnerable_count: int = 0,
    ) -> Dict[str, Any]:
        """
        Estimates incident severity using the trained model or transparent fallback.
        Returns predicted class, calibrated confidence probabilities, key factors,
        and human review flags.
        """
        text = description or ""
        categories_str = ",".join(categories) if categories else "Rescue"

        # Heuristic detection for tabular features if not explicitly provided
        has_elderly = 1 if any(w in text.casefold() for w in ["elderly", "senior", "grand", "cardiac", "72yo", "80yo"]) else 0
        has_child = 1 if any(w in text.casefold() for w in ["child", "baby", "infant", "toddler", "pediatric"]) else 0
        has_medical = 1 if any(w in text.casefold() for w in ["cardiac", "heart", "labor", "pregnant", "diabetic", "insulin", "bleed", "oxygen"]) else (1 if "Medical" in categories else 0)
        has_hazard = 1 if any(w in text.casefold() for w in ["electric", "spark", "transformer", "gas", "chemical", "explosion", "fire"]) else (1 if "Hazard" in categories else 0)

        if vulnerable_count == 0:
            vulnerable_count = has_elderly + has_child

        if self.model is not None:
            try:
                input_df = pd.DataFrame([{
                    "description": text,
                    "categories": categories_str,
                    "water_depth_m": float(water_depth_m),
                    "trapped_count": int(trapped_count),
                    "vulnerable_count": int(vulnerable_count),
                    "has_elderly": has_elderly,
                    "has_child": has_child,
                    "has_medical": has_medical,
                    "has_hazard": has_hazard,
                }])

                prediction = self.model.predict(input_df)[0]
                probabilities = self.model.predict_proba(input_df)[0]
                classes = list(self.model.classes_)
                prob_map = {classes[i]: float(np.round(probabilities[i], 4)) for i in range(len(classes))}

                max_prob = float(np.max(probabilities))
                uncertainty = "low" if max_prob >= 0.80 else ("moderate" if max_prob >= 0.60 else "high")

                # Build explainable contributing factors
                factors = []
                if has_medical:
                    factors.append("Medical compromise / acute care indicators identified")
                if has_hazard:
                    factors.append("Secondary environmental or electrical hazard present")
                if water_depth_m > 1.0:
                    factors.append(f"Substantial flood depth (>1.0m: {water_depth_m:.1f}m)")
                elif water_depth_m > 0.4:
                    factors.append(f"Moderate water inundation ({water_depth_m:.1f}m)")
                if trapped_count > 0:
                    factors.append(f"{trapped_count} civilian(s) trapped requiring extraction")
                if vulnerable_count > 0:
                    factors.append(f"{vulnerable_count} vulnerable individual(s) (elderly/child)")

                if not factors:
                    factors.append("Baseline urgency estimated from scenario vocabulary")

                return {
                    "predicted_severity": prediction,
                    "confidence": float(np.round(max_prob, 3)),
                    "class_probabilities": prob_map,
                    "uncertainty": uncertainty,
                    "contributing_factors": factors,
                    "is_human_decision": False,
                    "model_version": "RandomForest_v1.0" if "RandomForest" in str(self.model) else "TrainedModel_v1.0",
                    "requires_human_override": max_prob < 0.70 or prediction == "Critical",
                    "limitations_note": "Decision-support estimation only. Authorized personnel must confirm before tactical action.",
                }
            except Exception:
                logger.exception("Error during ML model inference, falling back to rule engine")

        # Fallback to rule engine
        cat_enums = []
        for c in categories:
            try:
                cat_enums.append(Category(c))
            except ValueError:
                pass
        suggestion = self.rule_fallback.suggest(description, cat_enums)

        return {
            "predicted_severity": suggestion.suggested_priority.value,
            "confidence": 0.65,
            "class_probabilities": {
                "Critical": 0.7 if suggestion.suggested_priority == Urgency.CRITICAL else 0.15,
                "Urgent": 0.7 if suggestion.suggested_priority == Urgency.URGENT else 0.15,
                "Moderate": 0.7 if suggestion.suggested_priority == Urgency.MODERATE else 0.15,
            },
            "uncertainty": suggestion.uncertainty,
            "contributing_factors": suggestion.reasons,
            "is_human_decision": False,
            "model_version": "RuleBased_Fallback",
            "requires_human_override": True,
            "limitations_note": "Transparent keyword-based heuristic fallback.",
        }

    def detect_hotspots(
        self,
        incident_points: List[Dict[str, Any]],
        eps_km: float = 2.5,
        min_samples: int = 2,
    ) -> List[Dict[str, Any]]:
        """
        Discovers spatial incident hotspots using DBSCAN on geographic coordinates.
        Computes cluster centroids, spread radius, density, and risk level.
        """
        valid_points = [
            p for p in incident_points
            if p.get("latitude") is not None and p.get("longitude") is not None
            and -90 <= p["latitude"] <= 90 and -180 <= p["longitude"] <= 180
        ]

        if len(valid_points) < min_samples:
            return []

        coords_deg = np.array([[p["latitude"], p["longitude"]] for p in valid_points])
        coords_rad = np.radians(coords_deg)

        kms_per_radian = EARTH_RADIUS_KM
        epsilon = eps_km / kms_per_radian

        db = DBSCAN(eps=epsilon, min_samples=min_samples, metric="haversine")
        labels = db.fit_predict(coords_rad)

        hotspots = []
        unique_labels = set(labels)

        for cluster_id in unique_labels:
            if cluster_id == -1:
                continue  # Noise points

            cluster_indices = np.where(labels == cluster_id)[0]
            cluster_members = [valid_points[i] for i in cluster_indices]
            cluster_coords = coords_deg[cluster_indices]

            centroid_lat = float(np.mean(cluster_coords[:, 0]))
            centroid_lng = float(np.mean(cluster_coords[:, 1]))

            # Maximum distance from centroid to member
            max_dist_km = 0.5
            for lat, lng in cluster_coords:
                d = haversine_km(centroid_lat, centroid_lng, lat, lng)
                if d > max_dist_km:
                    max_dist_km = d

            critical_count = sum(1 for m in cluster_members if m.get("urgency") == "Critical")
            urgent_count = sum(1 for m in cluster_members if m.get("urgency") == "Urgent")
            total_count = len(cluster_members)

            if critical_count >= 2 or total_count >= 4:
                risk_level = "High"
            elif critical_count >= 1 or urgent_count >= 2:
                risk_level = "Elevated"
            else:
                risk_level = "Moderate"

            hotspots.append({
                "cluster_id": f"HS-{cluster_id + 1:02d}",
                "centroid": {"latitude": round(centroid_lat, 6), "longitude": round(centroid_lng, 6)},
                "radius_km": round(max_dist_km, 2),
                "incident_count": total_count,
                "critical_count": critical_count,
                "urgent_count": urgent_count,
                "risk_level": risk_level,
                "incident_ids": [m.get("id") for m in cluster_members if m.get("id")],
                "time_window": "Active incident window (last 6-24 hours)",
                "data_coverage": f"Based on {total_count} geolocated incidents within {max_dist_km:.1f}km radius",
            })

        return sorted(hotspots, key=lambda h: (h["critical_count"], h["incident_count"]), reverse=True)

    def prioritize_resources(
        self,
        incident_lat: float,
        incident_lng: float,
        urgency: str,
        categories: List[str],
        water_depth_m: float,
        trapped_count: int,
        available_assets: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """
        Ranks available responder resources for a target incident based on:
        - Geographic travel distance (Haversine)
        - Vehicle type suitability for flood depth and casualty needs
        - Capacity match
        - Current status
        """
        ranked = []
        for asset in available_assets:
            asset_lat = asset.get("latitude") or 12.97
            asset_lng = asset.get("longitude") or 80.22
            dist_km = round(haversine_km(incident_lat, incident_lng, asset_lat, asset_lng), 2)
            est_minutes = max(2, int(round((dist_km / 25.0) * 60)))  # Average 25 km/h urban disaster speed

            asset_type = asset.get("type", "Truck")
            suitability_score = 50.0
            reasons = [f"Distance: {dist_km} km (~{est_minutes} min transit)"]

            # Flood depth suitability
            if water_depth_m > 0.8:
                if asset_type in ["Boat", "Skiff", "Amphibian"]:
                    suitability_score += 35
                    reasons.append(f"{asset_type} is optimal for deep water ({water_depth_m}m)")
                elif asset_type == "Truck":
                    suitability_score -= 20
                    reasons.append("Truck may encounter impassable high water")
            elif water_depth_m > 0.3:
                if asset_type in ["Amphibian", "Truck", "Boat"]:
                    suitability_score += 20
                    reasons.append(f"{asset_type} capable of shallow to moderate water clearance")

            # Medical suitability
            if "Medical" in categories:
                if asset_type == "Ambulance" or "Paramedic" in asset.get("equipment", []):
                    suitability_score += 30
                    reasons.append("Equipped with medical/paramedic stabilization equipment")

            # Distance proximity factor (closer is better)
            distance_penalty = min(35.0, dist_km * 2.5)
            suitability_score -= distance_penalty

            # Urgency boost
            if urgency == "Critical":
                suitability_score += 15

            final_score = max(5.0, min(100.0, round(suitability_score, 1)))

            ranked.append({
                "asset_id": asset.get("id"),
                "name": asset.get("name"),
                "type": asset_type,
                "status": asset.get("status", "Available"),
                "sector": asset.get("sector", "Central"),
                "distance_km": dist_km,
                "estimated_eta_minutes": est_minutes,
                "suitability_score": final_score,
                "match_reasons": reasons,
            })

        return sorted(ranked, key=lambda r: r["suitability_score"], reverse=True)


ml_service = MLInferenceService()
