"""
CrisisLens AI - Unified Geocoding Service.
Supports live external geocoding providers (Mapbox, Google Maps, OpenStreetMap Nominatim)
with resilient local gazetteer fallback, LRU in-memory caching, and reverse geocoding.
"""

import logging
import time
from typing import Any, Dict, List, Optional
import httpx
from backend.app.config import get_settings

logger = logging.getLogger("crisislens.geocoding")

# Local Gazetteer for offline emergency operations & resilience
LOCAL_GAZETTEER = [
    {
        "name": "Velachery, Chennai",
        "display_name": "Velachery, Chennai South, Tamil Nadu, 600042, India",
        "lat": 12.9784,
        "lng": 80.2217,
        "type": "Subdivision",
        "provider": "local_catalog",
        "confidence": 0.95,
    },
    {
        "name": "Madipakkam, Chennai",
        "display_name": "Madipakkam, Tambaram Taluk, Chengalpattu, Tamil Nadu, India",
        "lat": 12.9642,
        "lng": 80.1983,
        "type": "Neighborhood",
        "provider": "local_catalog",
        "confidence": 0.95,
    },
    {
        "name": "Saidapet, Chennai",
        "display_name": "Saidapet, Chennai Corporation, Tamil Nadu, 600015, India",
        "lat": 13.0180,
        "lng": 80.2240,
        "type": "Locality",
        "provider": "local_catalog",
        "confidence": 0.95,
    },
    {
        "name": "Pallavaram, Chennai",
        "display_name": "Pallavaram, Tambaram Corporation, Chengalpattu, Tamil Nadu, India",
        "lat": 12.9675,
        "lng": 80.1491,
        "type": "Municipality",
        "provider": "local_catalog",
        "confidence": 0.95,
    },
    {
        "name": "Tambaram, Chennai",
        "display_name": "Tambaram, Chennai Metropolitan Area, Tamil Nadu, India",
        "lat": 12.9249,
        "lng": 80.1472,
        "type": "Municipality",
        "provider": "local_catalog",
        "confidence": 0.95,
    },
    {
        "name": "Guindy, Chennai",
        "display_name": "Guindy Industrial Estate, Chennai, Tamil Nadu, 600032, India",
        "lat": 13.0067,
        "lng": 80.2025,
        "type": "Industrial Hub",
        "provider": "local_catalog",
        "confidence": 0.95,
    },
    {
        "name": "Adyar, Chennai",
        "display_name": "Adyar, South Chennai, Tamil Nadu, 600020, India",
        "lat": 13.0012,
        "lng": 80.2565,
        "type": "Neighborhood",
        "provider": "local_catalog",
        "confidence": 0.95,
    },
    {
        "name": "Perungudi OMR, Chennai",
        "display_name": "Perungudi, Rajiv Gandhi Salai (OMR), Chennai, Tamil Nadu, India",
        "lat": 12.9698,
        "lng": 80.2443,
        "type": "IT Corridor",
        "provider": "local_catalog",
        "confidence": 0.95,
    },
    {
        "name": "Sholinganallur, Chennai",
        "display_name": "Sholinganallur Junction, OMR, Chennai, Tamil Nadu, India",
        "lat": 12.9010,
        "lng": 80.2279,
        "type": "IT Hub",
        "provider": "local_catalog",
        "confidence": 0.95,
    },
    {
        "name": "Chennai Central Railway Station",
        "display_name": "Puratchi Thalaivar Dr. M.G.R. Central Railway Station, Chennai, Tamil Nadu",
        "lat": 13.0827,
        "lng": 80.2707,
        "type": "Transit Terminal",
        "provider": "local_catalog",
        "confidence": 0.98,
    },
    {
        "name": "Chennai International Airport",
        "display_name": "Chennai International Airport (MAA), Meenambakkam, Tamil Nadu",
        "lat": 12.9941,
        "lng": 80.1709,
        "type": "Airport",
        "provider": "local_catalog",
        "confidence": 0.98,
    },
    {
        "name": "Marina Beach, Chennai",
        "display_name": "Marina Beach Promenade, Chennai, Tamil Nadu, India",
        "lat": 13.0500,
        "lng": 80.2824,
        "type": "Coastal Zone",
        "provider": "local_catalog",
        "confidence": 0.95,
    },
    {
        "name": "Chembarambakkam Lake",
        "display_name": "Chembarambakkam Reservoir, Kanchipuram District, Tamil Nadu",
        "lat": 13.0125,
        "lng": 80.0558,
        "type": "Reservoir Basin",
        "provider": "local_catalog",
        "confidence": 0.95,
    },
]

# Simple in-memory cache: query -> (timestamp, results)
_CACHE: Dict[str, tuple[float, List[Dict[str, Any]]]] = {}
CACHE_TTL = 3600  # 1 hour


def _get_from_cache(key: str) -> Optional[List[Dict[str, Any]]]:
    if key in _CACHE:
        ts, data = _CACHE[key]
        if time.time() - ts < CACHE_TTL:
            return data
        del _CACHE[key]
    return None


def _save_to_cache(key: str, data: List[Dict[str, Any]]) -> None:
    _CACHE[key] = (time.time(), data)


def search_location_live(query: str, limit: int = 5) -> Dict[str, Any]:
    """
    Search location using the configured geocoding provider.
    Priority:
    1. Mapbox API (if configured)
    2. Google Maps Geocoding API (if configured)
    3. OpenStreetMap Nominatim (live open service)
    4. Local Disaster Grid Gazetteer (offline/fallback)
    """
    settings = get_settings()
    q_norm = query.strip()
    cache_key = f"forward:{q_norm.casefold()}:{limit}"

    cached = _get_from_cache(cache_key)
    if cached is not None:
        return {
            "status": "success",
            "query": query,
            "provider": cached[0]["provider"] if cached else "cache",
            "from_cache": True,
            "results": cached,
        }

    # 1. Mapbox Geocoding API if key configured or selected
    if settings.mapbox_api_key or settings.geocoding_provider == "mapbox":
        mapbox_results = _geocode_mapbox(q_norm, settings.mapbox_api_key, limit, settings.geocoding_timeout_seconds)
        if mapbox_results:
            _save_to_cache(cache_key, mapbox_results)
            return {
                "status": "success",
                "query": query,
                "provider": "mapbox",
                "from_cache": False,
                "results": mapbox_results,
            }

    # 2. Google Maps Geocoding API if key configured or selected
    if settings.google_maps_api_key or settings.geocoding_provider == "google":
        google_results = _geocode_google(q_norm, settings.google_maps_api_key, limit, settings.geocoding_timeout_seconds)
        if google_results:
            _save_to_cache(cache_key, google_results)
            return {
                "status": "success",
                "query": query,
                "provider": "google",
                "from_cache": False,
                "results": google_results,
            }

    # 3. OpenStreetMap Nominatim (live open geocoding)
    if settings.geocoding_provider in ("nominatim", "auto"):
        nominatim_results = _geocode_nominatim(q_norm, limit, settings.geocoding_timeout_seconds)
        if nominatim_results:
            _save_to_cache(cache_key, nominatim_results)
            return {
                "status": "success",
                "query": query,
                "provider": "nominatim",
                "from_cache": False,
                "results": nominatim_results,
            }

    # 4. Fallback to Local Gazetteer
    local_results = _geocode_local(q_norm)
    _save_to_cache(cache_key, local_results)
    return {
        "status": "success",
        "query": query,
        "provider": "local_catalog",
        "from_cache": False,
        "results": local_results,
    }


def reverse_geocode_live(lat: float, lng: float) -> Dict[str, Any]:
    """
    Reverse geocode coordinates into a human-readable location and address.
    """
    settings = get_settings()
    cache_key = f"reverse:{round(lat, 4)}:{round(lng, 4)}"

    cached = _get_from_cache(cache_key)
    if cached is not None:
        return {
            "status": "success",
            "latitude": lat,
            "longitude": lng,
            "from_cache": True,
            "result": cached[0] if cached else None,
        }

    # 1. Mapbox Reverse Geocoding
    if settings.mapbox_api_key or settings.geocoding_provider == "mapbox":
        res = _reverse_mapbox(lat, lng, settings.mapbox_api_key, settings.geocoding_timeout_seconds)
        if res:
            _save_to_cache(cache_key, [res])
            return {"status": "success", "latitude": lat, "longitude": lng, "provider": "mapbox", "result": res}

    # 2. Google Reverse Geocoding
    if settings.google_maps_api_key or settings.geocoding_provider == "google":
        res = _reverse_google(lat, lng, settings.google_maps_api_key, settings.geocoding_timeout_seconds)
        if res:
            _save_to_cache(cache_key, [res])
            return {"status": "success", "latitude": lat, "longitude": lng, "provider": "google", "result": res}

    # 3. OpenStreetMap Nominatim Reverse
    if settings.geocoding_provider in ("nominatim", "auto"):
        res = _reverse_nominatim(lat, lng, settings.geocoding_timeout_seconds)
        if res:
            _save_to_cache(cache_key, [res])
            return {"status": "success", "latitude": lat, "longitude": lng, "provider": "nominatim", "result": res}

    # 4. Local proximity reverse match
    res = _reverse_local(lat, lng)
    _save_to_cache(cache_key, [res])
    return {"status": "success", "latitude": lat, "longitude": lng, "provider": "local_catalog", "result": res}


def _geocode_mapbox(query: str, api_key: str, limit: int, timeout: float) -> List[Dict[str, Any]]:
    if not api_key:
        return []
    url = f"https://api.mapbox.com/geocoding/v5/mapbox.places/{query}.json"
    params = {"access_token": api_key, "limit": limit}
    try:
        with httpx.Client(timeout=timeout) as client:
            resp = client.get(url, params=params)
            if resp.status_code == 200:
                features = resp.json().get("features", [])
                results = []
                for f in features:
                    center = f.get("center", [0, 0])
                    results.append({
                        "name": f.get("text", query),
                        "display_name": f.get("place_name", query),
                        "lat": center[1],
                        "lng": center[0],
                        "type": f.get("place_type", ["place"])[0],
                        "provider": "mapbox",
                        "confidence": f.get("relevance", 0.9),
                    })
                return results
    except Exception as exc:
        logger.warning("Mapbox forward geocoding failed: %s", exc)
    return []


def _reverse_mapbox(lat: float, lng: float, api_key: str, timeout: float) -> Optional[Dict[str, Any]]:
    if not api_key:
        return None
    url = f"https://api.mapbox.com/geocoding/v5/mapbox.places/{lng},{lat}.json"
    params = {"access_token": api_key, "limit": 1}
    try:
        with httpx.Client(timeout=timeout) as client:
            resp = client.get(url, params=params)
            if resp.status_code == 200:
                features = resp.json().get("features", [])
                if features:
                    f = features[0]
                    return {
                        "name": f.get("text", "Unknown"),
                        "display_name": f.get("place_name", "Unknown"),
                        "lat": lat,
                        "lng": lng,
                        "type": f.get("place_type", ["place"])[0],
                        "provider": "mapbox",
                        "confidence": 0.95,
                    }
    except Exception as exc:
        logger.warning("Mapbox reverse geocoding failed: %s", exc)
    return None


def _geocode_google(query: str, api_key: str, limit: int, timeout: float) -> List[Dict[str, Any]]:
    if not api_key:
        return []
    url = "https://maps.googleapis.com/maps/api/geocode/json"
    params = {"address": query, "key": api_key}
    try:
        with httpx.Client(timeout=timeout) as client:
            resp = client.get(url, params=params)
            if resp.status_code == 200:
                raw_results = resp.json().get("results", [])
                results = []
                for item in raw_results[:limit]:
                    loc = item.get("geometry", {}).get("location", {})
                    results.append({
                        "name": item.get("formatted_address", query).split(",")[0],
                        "display_name": item.get("formatted_address", query),
                        "lat": loc.get("lat", 0.0),
                        "lng": loc.get("lng", 0.0),
                        "type": item.get("types", ["locality"])[0],
                        "provider": "google",
                        "confidence": 0.95,
                    })
                return results
    except Exception as exc:
        logger.warning("Google forward geocoding failed: %s", exc)
    return []


def _reverse_google(lat: float, lng: float, api_key: str, timeout: float) -> Optional[Dict[str, Any]]:
    if not api_key:
        return None
    url = "https://maps.googleapis.com/maps/api/geocode/json"
    params = {"latlng": f"{lat},{lng}", "key": api_key}
    try:
        with httpx.Client(timeout=timeout) as client:
            resp = client.get(url, params=params)
            if resp.status_code == 200:
                raw_results = resp.json().get("results", [])
                if raw_results:
                    item = raw_results[0]
                    return {
                        "name": item.get("formatted_address", "").split(",")[0],
                        "display_name": item.get("formatted_address", ""),
                        "lat": lat,
                        "lng": lng,
                        "type": item.get("types", ["locality"])[0],
                        "provider": "google",
                        "confidence": 0.95,
                    }
    except Exception as exc:
        logger.warning("Google reverse geocoding failed: %s", exc)
    return None


def _geocode_nominatim(query: str, limit: int, timeout: float) -> List[Dict[str, Any]]:
    url = "https://nominatim.openstreetmap.org/search"
    params = {"q": query, "format": "json", "addressdetails": 1, "limit": limit}
    headers = {"User-Agent": "CrisisLens-TacticalDisasterResponse/1.0 (Emergency Triage Platform)"}
    try:
        with httpx.Client(timeout=timeout) as client:
            resp = client.get(url, params=params, headers=headers)
            if resp.status_code == 200:
                items = resp.json()
                results = []
                for item in items:
                    results.append({
                        "name": item.get("name") or item.get("display_name", "").split(",")[0],
                        "display_name": item.get("display_name", query),
                        "lat": float(item.get("lat", 0.0)),
                        "lng": float(item.get("lon", 0.0)),
                        "type": item.get("type", "place"),
                        "provider": "nominatim",
                        "confidence": 0.9,
                    })
                return results
    except Exception as exc:
        logger.info("OpenStreetMap Nominatim lookup failed or timed out: %s", exc)
    return []


def _reverse_nominatim(lat: float, lng: float, timeout: float) -> Optional[Dict[str, Any]]:
    url = "https://nominatim.openstreetmap.org/reverse"
    params = {"lat": lat, "lon": lng, "format": "json", "addressdetails": 1}
    headers = {"User-Agent": "CrisisLens-TacticalDisasterResponse/1.0 (Emergency Triage Platform)"}
    try:
        with httpx.Client(timeout=timeout) as client:
            resp = client.get(url, params=params, headers=headers)
            if resp.status_code == 200:
                item = resp.json()
                addr = item.get("address", {})
                name = addr.get("suburb") or addr.get("neighbourhood") or addr.get("road") or item.get("name") or "Location"
                return {
                    "name": name,
                    "display_name": item.get("display_name", f"{lat:.4f}, {lng:.4f}"),
                    "lat": lat,
                    "lng": lng,
                    "type": item.get("type", "place"),
                    "provider": "nominatim",
                    "confidence": 0.9,
                }
    except Exception as exc:
        logger.info("OpenStreetMap reverse lookup failed: %s", exc)
    return None


def _geocode_local(query: str) -> List[Dict[str, Any]]:
    q_norm = query.casefold().strip()
    matches = []

    for item in LOCAL_GAZETTEER:
        if q_norm in item["name"].casefold() or q_norm in item["display_name"].casefold():
            matches.append(dict(item))

    if not matches:
        # Fallback to general metropolitan center
        matches = [
            {
                "name": f"Area near: '{query}'",
                "display_name": f"Approximate disaster response sector for '{query}', Chennai Metropolitan Area",
                "lat": 12.9784,
                "lng": 80.2217,
                "type": "Approximate Sector",
                "provider": "local_catalog",
                "confidence": 0.5,
            }
        ]

    return matches


def _reverse_local(lat: float, lng: float) -> Dict[str, Any]:
    import math

    def _dist(l1: float, g1: float, l2: float, g2: float) -> float:
        return math.sqrt((l1 - l2) ** 2 + (g1 - g2) ** 2)

    closest = None
    min_dist = float("inf")
    for item in LOCAL_GAZETTEER:
        d = _dist(lat, lng, item["lat"], item["lng"])
        if d < min_dist:
            min_dist = d
            closest = item

    if closest and min_dist < 0.05:  # within ~5 km
        return {
            "name": closest["name"],
            "display_name": f"Near {closest['display_name']}",
            "lat": lat,
            "lng": lng,
            "type": closest["type"],
            "provider": "local_catalog",
            "confidence": max(0.6, 1.0 - min_dist * 10),
        }

    return {
        "name": f"Sector ({lat:.4f}, {lng:.4f})",
        "display_name": f"Tactical Grid Point at {lat:.4f}° N, {lng:.4f}° E",
        "lat": lat,
        "lng": lng,
        "type": "Grid Coordinate",
        "provider": "local_catalog",
        "confidence": 0.7,
    }
