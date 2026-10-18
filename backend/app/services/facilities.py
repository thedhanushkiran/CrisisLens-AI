"""
Emergency Facilities Service for CrisisLens AI.

Manages emergency infrastructure: Hospitals, Evacuation Shelters,
Safe Zones, and Emergency Service Stations.
Calculates geographic proximity and status.
"""

from typing import Any, Dict, List, Optional
import math
from backend.app.ml.service import haversine_km

FACILITY_DATABASE: List[Dict[str, Any]] = [
    # Hospitals
    {
        "id": "HOSP-01",
        "name": "Apollo Speciality Hospital OMR",
        "category": "Hospital",
        "latitude": 12.9698,
        "longitude": 80.2443,
        "address": "05/639, Old Mahabalipuram Rd, Perungudi, Chennai",
        "phone": "+91 44 2496 1111",
        "status": "Operational",
        "emergency_capacity": "85/100 ICU Beds",
        "has_trauma_center": True,
        "has_emergency_power": True,
        "flood_status": "Elevated & Dry",
        "verified": True,
    },
    {
        "id": "HOSP-02",
        "name": "Government Royapettah Hospital & Trauma Center",
        "category": "Hospital",
        "latitude": 13.0538,
        "longitude": 80.2612,
        "address": "1, Westcott Rd, Royapettah, Chennai",
        "phone": "+91 44 2848 3051",
        "status": "Operational",
        "emergency_capacity": "140/200 Beds Available",
        "has_trauma_center": True,
        "has_emergency_power": True,
        "flood_status": "Ground clearance +1m",
        "verified": True,
    },
    {
        "id": "HOSP-03",
        "name": "Dr. Kamakshi Memorial Hospital",
        "category": "Hospital",
        "latitude": 12.9518,
        "longitude": 80.2018,
        "address": "1 Radial Road, Pallikaranai, Chennai",
        "phone": "+91 44 6630 0300",
        "status": "Operational",
        "emergency_capacity": "45/70 Critical Beds",
        "has_trauma_center": True,
        "has_emergency_power": True,
        "flood_status": "Access via Radial Flyover only",
        "verified": True,
    },
    {
        "id": "HOSP-04",
        "name": "MIOT International Multispeciality Hospital",
        "category": "Hospital",
        "latitude": 13.0238,
        "longitude": 80.1878,
        "address": "4/112 Mount Poonamallee Rd, Manapakkam, Chennai",
        "phone": "+91 44 4200 2288",
        "status": "Operational",
        "emergency_capacity": "110/150 Emergency Beds",
        "has_trauma_center": True,
        "has_emergency_power": True,
        "flood_status": "Auxiliary generators active on 2nd floor",
        "verified": True,
    },
    {
        "id": "HOSP-05",
        "name": "Tambaram Taluk Government Hospital",
        "category": "Hospital",
        "latitude": 12.9250,
        "longitude": 80.1250,
        "address": "GST Road, Tambaram Sanatorium, Chennai",
        "phone": "+91 44 2241 8100",
        "status": "Operational",
        "emergency_capacity": "30/50 Beds",
        "has_trauma_center": False,
        "has_emergency_power": True,
        "flood_status": "Dry & Operational",
        "verified": True,
    },

    # Shelters & Evacuation Centers
    {
        "id": "SHEL-01",
        "name": "Velachery Community Hall (Shelter A-14)",
        "category": "Shelter",
        "latitude": 12.9730,
        "longitude": 80.2180,
        "address": "Gandhi St, Baby Nagar, Velachery, Chennai",
        "phone": "+91 44 2244 5501",
        "status": "Open",
        "emergency_capacity": "350/400 Persons",
        "has_trauma_center": False,
        "has_emergency_power": True,
        "flood_status": "Elevated hall floor",
        "verified": True,
    },
    {
        "id": "SHEL-02",
        "name": "Pallavaram Government Higher Secondary School",
        "category": "Shelter",
        "latitude": 12.9675,
        "longitude": 80.1491,
        "address": "Cantonment High Grounds, Pallavaram, Chennai",
        "phone": "+91 44 2264 1234",
        "status": "Open",
        "emergency_capacity": "320/500 Persons",
        "has_trauma_center": False,
        "has_emergency_power": True,
        "flood_status": "High elevation ground",
        "verified": True,
    },
    {
        "id": "SHEL-03",
        "name": "Saidapet Model High School Relief Camp",
        "category": "Shelter",
        "latitude": 13.0180,
        "longitude": 80.2240,
        "address": "Jeany Rd, Saidapet, Chennai",
        "phone": "+91 44 2435 9801",
        "status": "Near Full",
        "emergency_capacity": "190/200 Persons",
        "has_trauma_center": False,
        "has_emergency_power": False,
        "flood_status": "Surrounded by water; boat ferry operating",
        "verified": True,
    },
    {
        "id": "SHEL-04",
        "name": "Madipakkam Community Relief Center",
        "category": "Shelter",
        "latitude": 12.9642,
        "longitude": 80.1983,
        "address": "Medavakkam Main Rd, Madipakkam, Chennai",
        "phone": "+91 44 2258 7720",
        "status": "Open",
        "emergency_capacity": "180/300 Persons",
        "has_trauma_center": False,
        "has_emergency_power": True,
        "flood_status": "Dry interior, food packets stocked",
        "verified": True,
    },

    # Safe Zones
    {
        "id": "SAFE-01",
        "name": "Guindy Race Course High Ground Assembly Area",
        "category": "SafeZone",
        "latitude": 13.0067,
        "longitude": 80.2133,
        "address": "Race Course Road, Guindy, Chennai",
        "phone": "N/A - Open Staging",
        "status": "Open",
        "emergency_capacity": "Capacity: 2,500 Evacuees",
        "has_trauma_center": False,
        "has_emergency_power": True,
        "flood_status": "Elevated ridge (>15m above sea level)",
        "verified": True,
    },
    {
        "id": "SAFE-02",
        "name": "St. Thomas Mount Ridge Safe Evacuation Zone",
        "category": "SafeZone",
        "latitude": 12.9961,
        "longitude": 80.1878,
        "address": "Mount Hilltop, St. Thomas Mount, Chennai",
        "phone": "N/A - High Ground",
        "status": "Open",
        "emergency_capacity": "Capacity: 1,800 Evacuees",
        "has_trauma_center": False,
        "has_emergency_power": False,
        "flood_status": "Complete high altitude safety (Hilltop)",
        "verified": True,
    },

    # Emergency Services
    {
        "id": "EMRG-01",
        "name": "Tamil Nadu Fire & Rescue Services Station - Velachery",
        "category": "EmergencyService",
        "latitude": 12.9810,
        "longitude": 80.2195,
        "address": "Velachery Bypass Rd, Chennai",
        "phone": "+91 44 2244 0101",
        "status": "Operational",
        "emergency_capacity": "4 Rubber Boats / 2 Fire Engines",
        "has_trauma_center": False,
        "has_emergency_power": True,
        "flood_status": "Active Rescue Dispatch Hub",
        "verified": True,
    },
    {
        "id": "EMRG-02",
        "name": "Guindy NDRF Regional Response Staging Post",
        "category": "EmergencyService",
        "latitude": 13.0100,
        "longitude": 80.2100,
        "address": "SIDCO Industrial Estate, Guindy, Chennai",
        "phone": "+91 44 2250 0911",
        "status": "Operational",
        "emergency_capacity": "12 Inflatable Zodiacs / 6 Heavy Trucks",
        "has_trauma_center": False,
        "has_emergency_power": True,
        "flood_status": "Strategic EOC Dispatch Base",
        "verified": True,
    },
]


def list_facilities(category: Optional[str] = None) -> List[Dict[str, Any]]:
    if not category or category.lower() == "all":
        return FACILITY_DATABASE
    cat_lower = category.lower()
    return [f for f in FACILITY_DATABASE if f["category"].lower() == cat_lower]


def find_nearby_facilities(
    lat: float,
    lng: float,
    radius_km: float = 15.0,
    category: Optional[str] = None,
) -> List[Dict[str, Any]]:
    facilities = list_facilities(category)
    results = []

    for f in facilities:
        dist = round(haversine_km(lat, lng, f["latitude"], f["longitude"]), 2)
        if dist <= radius_km:
            f_copy = dict(f)
            f_copy["distance_km"] = dist
            # Estimate urban disaster driving time at 25km/h
            f_copy["eta_minutes"] = max(2, int(round((dist / 25.0) * 60)))
            results.append(f_copy)

    results.sort(key=lambda x: x["distance_km"])
    return results
