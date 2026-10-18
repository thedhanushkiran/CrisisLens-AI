"""
CrisisLens AI - Geospatial & Routing API Endpoints.
"""

from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from backend.app.services.geocoding import search_location_live, reverse_geocode_live
from backend.app.services.routing import calculate_route

router = APIRouter(prefix="/api/v1/geo", tags=["geospatial"])


class RouteRequest(BaseModel):
    origin_lat: float = Field(..., ge=-90.0, le=90.0)
    origin_lng: float = Field(..., ge=-180.0, le=180.0)
    destination_lat: float = Field(..., ge=-90.0, le=90.0)
    destination_lng: float = Field(..., ge=-180.0, le=180.0)
    avoid_hazards: bool = Field(True)


@router.post("/route")
def get_evacuation_route(payload: RouteRequest):
    """
    Calculates navigable route between origin and destination coordinates,
    returning distance in km, duration in minutes, waypoint polyline coordinates,
    turn directions, and hazard proximity warnings.
    """
    return calculate_route(
        orig_lat=payload.origin_lat,
        orig_lng=payload.origin_lng,
        dest_lat=payload.destination_lat,
        dest_lng=payload.destination_lng,
        avoid_hazards=payload.avoid_hazards,
    )


@router.get("/geocode")
def geocode_search(
    q: str = Query(..., min_length=2, max_length=120, description="Address or landmark query"),
    limit: int = Query(5, ge=1, le=20, description="Maximum number of results to return"),
):
    """
    Live address and landmark search supporting Mapbox, Google Maps, OpenStreetMap Nominatim,
    and local disaster response gazetteer.
    """
    return search_location_live(query=q, limit=limit)


@router.get("/reverse")
def reverse_geocode(
    lat: float = Query(..., ge=-90.0, le=90.0, description="Latitude"),
    lng: float = Query(..., ge=-180.0, le=180.0, description="Longitude"),
):
    """
    Reverse geocodes geographic coordinates to identify the street, sector, or landmark.
    """
    return reverse_geocode_live(lat=lat, lng=lng)
