"""
CrisisLens AI - Facilities API Endpoints.
"""

from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from backend.app.services.facilities import find_nearby_facilities, list_facilities

router = APIRouter(prefix="/api/v1/facilities", tags=["facilities"])


@router.get("")
def get_all_facilities(category: Optional[str] = Query(None, description="Category filter (Hospital, Shelter, SafeZone, EmergencyService)")):
    """Returns verified disaster response facilities."""
    return {
        "status": "success",
        "facilities": list_facilities(category),
    }


@router.get("/nearby")
def get_nearby_facilities(
    lat: float = Query(..., ge=-90.0, le=90.0, description="Origin latitude"),
    lng: float = Query(..., ge=-180.0, le=180.0, description="Origin longitude"),
    radius_km: float = Query(15.0, ge=0.5, le=100.0, description="Search radius in kilometers"),
    category: Optional[str] = Query(None, description="Category filter (Hospital, Shelter, SafeZone, EmergencyService)"),
):
    """
    Finds nearest emergency facilities to a given coordinate within a radius,
    sorted by geographic proximity with distance in kilometers.
    """
    results = find_nearby_facilities(lat=lat, lng=lng, radius_km=radius_km, category=category)
    return {
        "status": "success",
        "origin": {"latitude": lat, "longitude": lng},
        "radius_km": radius_km,
        "count": len(results),
        "facilities": results,
    }
