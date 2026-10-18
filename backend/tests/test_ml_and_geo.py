"""
Automated unit & integration tests for CrisisLens AI Machine Learning and Geospatial APIs.
"""

import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


def test_facilities_list():
    response = client.get("/api/v1/facilities")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert len(data["facilities"]) >= 10
    categories = {f["category"] for f in data["facilities"]}
    assert "Hospital" in categories
    assert "Shelter" in categories
    assert "SafeZone" in categories


def test_facilities_nearby():
    # Near Velachery (12.9784, 80.2217)
    response = client.get("/api/v1/facilities/nearby?lat=12.9784&lng=80.2217&radius_km=10")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["count"] > 0
    # Ensure sorted by distance
    distances = [f["distance_km"] for f in data["facilities"]]
    assert distances == sorted(distances)
    # Check that fields exist
    first = data["facilities"][0]
    assert "distance_km" in first
    assert "eta_minutes" in first
    assert "status" in first


def test_facilities_nearby_category_filter():
    response = client.get("/api/v1/facilities/nearby?lat=12.9784&lng=80.2217&radius_km=25&category=Hospital")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    for f in data["facilities"]:
        assert f["category"] == "Hospital"


def test_geo_route():
    payload = {
        "origin_lat": 12.9784,
        "origin_lng": 80.2217,
        "destination_lat": 12.9698,
        "destination_lng": 80.2443,
        "avoid_hazards": True,
    }
    response = client.post("/api/v1/geo/route", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["distance_km"] > 0
    assert data["duration_minutes"] > 0
    assert len(data["geometry"]) >= 5
    assert len(data["steps"]) >= 2
    assert "disclaimer" in data


def test_geo_route_invalid_coordinates():
    payload = {
        "origin_lat": 120.0,  # Invalid latitude
        "origin_lng": 80.22,
        "destination_lat": 12.96,
        "destination_lng": 80.24,
    }
    response = client.post("/api/v1/geo/route", json=payload)
    assert response.status_code == 422


def test_geo_geocode_search():
    response = client.get("/api/v1/geo/geocode?q=Velachery")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert len(data["results"]) >= 1
    assert "Velachery" in data["results"][0]["name"]


def test_ml_predict_severity_critical():
    payload = {
        "description": "Elderly cardiac patient with chest pain trapped on terrace as water rises to 1.6 meters. Medical extraction needed.",
        "categories": ["Medical", "Rescue"],
        "water_depth_m": 1.6,
        "trapped_count": 5,
        "vulnerable_count": 2,
    }
    response = client.post("/api/v1/ml/predict-severity", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["predicted_severity"] in ["Critical", "Urgent"]
    assert 0.0 <= data["confidence"] <= 1.0
    assert "Critical" in data["class_probabilities"]
    assert len(data["contributing_factors"]) >= 1
    assert "requires_human_override" in data


def test_ml_predict_severity_moderate():
    payload = {
        "description": "Relief camp requesting 50 additional blankets and 10 food packets for sheltered families.",
        "categories": ["FoodWater", "Shelter"],
        "water_depth_m": 0.1,
        "trapped_count": 0,
        "vulnerable_count": 2,
    }
    response = client.post("/api/v1/ml/predict-severity", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["predicted_severity"] in ["Moderate", "Urgent"]
    assert 0.0 <= data["confidence"] <= 1.0


def test_ml_metrics():
    response = client.get("/api/v1/ml/metrics")
    assert response.status_code == 200
    data = response.json()
    assert "holdout_metrics" in data or "limitations" in data
    if "holdout_metrics" in data:
        assert "macro_f1" in data["holdout_metrics"]
        assert "confusion_matrix" in data["holdout_metrics"]


def test_ml_hotspots():
    response = client.get("/api/v1/ml/hotspots?eps_km=3.0&min_samples=2")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "hotspots" in data
    assert "clustering_algorithm" in data
    assert data["cluster_count"] >= 1
    hotspot = data["hotspots"][0]
    assert "centroid" in hotspot
    assert "radius_km" in hotspot
    assert "risk_level" in hotspot


def test_ml_prioritize_dispatch():
    payload = {
        "incident_lat": 12.9784,
        "incident_lng": 80.2217,
        "urgency": "Critical",
        "categories": ["Rescue", "Medical"],
        "water_depth_m": 1.4,
        "trapped_count": 4,
    }
    response = client.post("/api/v1/ml/prioritize-dispatch", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert len(data["ranked_recommendations"]) >= 1
    top_asset = data["ranked_recommendations"][0]
    assert "suitability_score" in top_asset
    assert "distance_km" in top_asset
    assert "estimated_eta_minutes" in top_asset
    assert len(top_asset["match_reasons"]) >= 1


def test_geo_reverse_geocode():
    # Near Velachery: 12.9784, 80.2217
    response = client.get("/api/v1/geo/reverse?lat=12.9784&lng=80.2217")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "result" in data
    res = data["result"]
    assert res is not None
    assert "name" in res
    assert "display_name" in res
    assert "provider" in data or "provider" in res


def test_geo_geocode_with_provider_and_cache():
    response = client.get("/api/v1/geo/geocode?q=Saidapet&limit=3")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "provider" in data
    assert len(data["results"]) >= 1
    # Check cache hit on repeat
    response2 = client.get("/api/v1/geo/geocode?q=Saidapet&limit=3")
    assert response2.status_code == 200
    data2 = response2.json()
    assert data2["from_cache"] is True
