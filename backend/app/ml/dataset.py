"""
Disaster Triage Dataset Generator and Benchmark for CrisisLens AI.

Generates a representative disaster dataset for emergency incident classification,
hotspot spatial clustering, and resource dispatch prioritization.
Categories: Rescue, Medical, FoodWater, Shelter, Missing, Hazard
Severity Targets: Critical (High life threat), Urgent (Time-sensitive), Moderate (Stable/Support)
"""

import pandas as pd
import numpy as np

# Curated seed incident records representing realistic urban disaster scenarios
# (e.g. urban flooding, cyclones, structural compromises, logistical requests)
CURATED_INCIDENTS = [
    # Critical incidents
    {
        "description": "72yo cardiac patient experiencing chest pain and shortness of breath. Ground floor flooded 1.5m, stuck on terrace.",
        "categories": "Medical,Rescue",
        "water_depth_m": 1.5,
        "trapped_count": 4,
        "vulnerable_count": 1,
        "has_elderly": 1,
        "has_child": 0,
        "has_medical": 1,
        "has_hazard": 0,
        "lat": 12.9784,
        "lng": 80.2217,
        "severity": "Critical"
    },
    {
        "description": "High voltage transformer sparking in standing water right outside apartment building. Sparks arcing into alley.",
        "categories": "Hazard,Rescue",
        "water_depth_m": 1.1,
        "trapped_count": 12,
        "vulnerable_count": 3,
        "has_elderly": 1,
        "has_child": 2,
        "has_medical": 0,
        "has_hazard": 1,
        "lat": 12.9642,
        "lng": 80.1983,
        "severity": "Critical"
    },
    {
        "description": "Pregnant mother in third trimester experiencing severe labor contractions. Roads submerged, ambulance unable to reach.",
        "categories": "Medical,Rescue",
        "water_depth_m": 0.9,
        "trapped_count": 2,
        "vulnerable_count": 2,
        "has_elderly": 0,
        "has_child": 1,
        "has_medical": 1,
        "has_hazard": 0,
        "lat": 12.9249,
        "lng": 80.1472,
        "severity": "Critical"
    },
    {
        "description": "Two children and elderly grandfather swept onto roof of car in rapidly moving canal floodwaters. Immediate boat needed.",
        "categories": "Rescue",
        "water_depth_m": 2.0,
        "trapped_count": 3,
        "vulnerable_count": 3,
        "has_elderly": 1,
        "has_child": 2,
        "has_medical": 0,
        "has_hazard": 1,
        "lat": 13.0180,
        "lng": 80.2240,
        "severity": "Critical"
    },
    {
        "description": "House collapse in mudslide. 3 family members trapped beneath debris and rubble, calling for help.",
        "categories": "Rescue",
        "water_depth_m": 0.4,
        "trapped_count": 3,
        "vulnerable_count": 1,
        "has_elderly": 1,
        "has_child": 0,
        "has_medical": 1,
        "has_hazard": 1,
        "lat": 13.0012,
        "lng": 80.2050,
        "severity": "Critical"
    },
    {
        "description": "Severe arterial bleeding from broken glass laceration in submerged compound. Patient becoming unresponsive.",
        "categories": "Medical",
        "water_depth_m": 0.8,
        "trapped_count": 1,
        "vulnerable_count": 1,
        "has_elderly": 0,
        "has_child": 0,
        "has_medical": 1,
        "has_hazard": 0,
        "lat": 12.9810,
        "lng": 80.2310,
        "severity": "Critical"
    },
    {
        "description": "Oxygen concentrator battery depleted due to 36-hour grid outage. Chronic respiratory patient in critical distress.",
        "categories": "Medical",
        "water_depth_m": 0.6,
        "trapped_count": 2,
        "vulnerable_count": 1,
        "has_elderly": 1,
        "has_child": 0,
        "has_medical": 1,
        "has_hazard": 0,
        "lat": 12.9550,
        "lng": 80.1800,
        "severity": "Critical"
    },
    {
        "description": "Drowning infant rescued from flash surge, requires CPR and immediate pediatric trauma stabilization.",
        "categories": "Medical,Rescue",
        "water_depth_m": 1.2,
        "trapped_count": 2,
        "vulnerable_count": 1,
        "has_elderly": 0,
        "has_child": 1,
        "has_medical": 1,
        "has_hazard": 1,
        "lat": 13.0450,
        "lng": 80.2400,
        "severity": "Critical"
    },

    # Urgent incidents
    {
        "description": "Diabetic resident isolated on second floor with insulin spoiled by heat. Requires cold-chain insulin within 8 hours.",
        "categories": "Medical",
        "water_depth_m": 0.9,
        "trapped_count": 1,
        "vulnerable_count": 1,
        "has_elderly": 1,
        "has_child": 0,
        "has_medical": 1,
        "has_hazard": 0,
        "lat": 12.9890,
        "lng": 80.2120,
        "severity": "Urgent"
    },
    {
        "description": "Family of 6 including 2 toddlers stranded on first floor. Water rising steadily at 2 inches per hour.",
        "categories": "Rescue",
        "water_depth_m": 0.8,
        "trapped_count": 6,
        "vulnerable_count": 2,
        "has_elderly": 0,
        "has_child": 2,
        "has_medical": 0,
        "has_hazard": 0,
        "lat": 12.9710,
        "lng": 80.2190,
        "severity": "Urgent"
    },
    {
        "description": "8-year-old child separated from parents during evacuation near subway station. Currently sheltered with shopkeeper.",
        "categories": "Missing",
        "water_depth_m": 0.3,
        "trapped_count": 1,
        "vulnerable_count": 1,
        "has_elderly": 0,
        "has_child": 1,
        "has_medical": 0,
        "has_hazard": 0,
        "lat": 13.0827,
        "lng": 80.2707,
        "severity": "Urgent"
    },
    {
        "description": "Gas cylinder leak smell spreading across flooded apartment block. Residents cannot evacuate safely.",
        "categories": "Hazard",
        "water_depth_m": 0.7,
        "trapped_count": 15,
        "vulnerable_count": 4,
        "has_elderly": 2,
        "has_child": 2,
        "has_medical": 0,
        "has_hazard": 1,
        "lat": 12.9620,
        "lng": 80.2010,
        "severity": "Urgent"
    },
    {
        "description": "Dialysis patient missed scheduled session today due to blocked access roads. Transportation required before tomorrow morning.",
        "categories": "Medical",
        "water_depth_m": 0.5,
        "trapped_count": 1,
        "vulnerable_count": 1,
        "has_elderly": 1,
        "has_child": 0,
        "has_medical": 1,
        "has_hazard": 0,
        "lat": 13.0250,
        "lng": 80.2100,
        "severity": "Urgent"
    },
    {
        "description": "Water reached main distribution panel, power cut, 4 families stranded on upper floors without drinking water.",
        "categories": "Rescue,FoodWater",
        "water_depth_m": 1.0,
        "trapped_count": 14,
        "vulnerable_count": 3,
        "has_elderly": 2,
        "has_child": 1,
        "has_medical": 0,
        "has_hazard": 1,
        "lat": 12.9740,
        "lng": 80.2230,
        "severity": "Urgent"
    },
    {
        "description": "Elderly couple unable to walk downstairs, water entered ground floor 2 feet. Food supplies exhausted.",
        "categories": "Rescue,FoodWater",
        "water_depth_m": 0.6,
        "trapped_count": 2,
        "vulnerable_count": 2,
        "has_elderly": 2,
        "has_child": 0,
        "has_medical": 0,
        "has_hazard": 0,
        "lat": 12.9300,
        "lng": 80.1500,
        "severity": "Urgent"
    },

    # Moderate incidents
    {
        "description": "Relief camp shelter #4 requesting 200 food packets and chlorination tablets for potable water supply.",
        "categories": "FoodWater,Shelter",
        "water_depth_m": 0.2,
        "trapped_count": 0,
        "vulnerable_count": 15,
        "has_elderly": 5,
        "has_child": 10,
        "has_medical": 0,
        "has_hazard": 0,
        "lat": 12.9675,
        "lng": 80.1491,
        "severity": "Moderate"
    },
    {
        "description": "Community center needs 50 blankets, dry rations, and sanitary kits for 40 sheltered evacuees.",
        "categories": "FoodWater,Shelter",
        "water_depth_m": 0.1,
        "trapped_count": 0,
        "vulnerable_count": 8,
        "has_elderly": 3,
        "has_child": 5,
        "has_medical": 0,
        "has_hazard": 0,
        "lat": 13.0180,
        "lng": 80.2240,
        "severity": "Moderate"
    },
    {
        "description": "Fallen tree blocking secondary residential street. No vehicle passage, but pedestrians can walk around. No injuries.",
        "categories": "Hazard",
        "water_depth_m": 0.1,
        "trapped_count": 0,
        "vulnerable_count": 0,
        "has_elderly": 0,
        "has_child": 0,
        "has_medical": 0,
        "has_hazard": 1,
        "lat": 12.9900,
        "lng": 80.2150,
        "severity": "Moderate"
    },
    {
        "description": "Requesting 10 tarpaulins to cover leaking roof at relief camp before next rain band arrives.",
        "categories": "Shelter",
        "water_depth_m": 0.0,
        "trapped_count": 0,
        "vulnerable_count": 4,
        "has_elderly": 2,
        "has_child": 2,
        "has_medical": 0,
        "has_hazard": 0,
        "lat": 12.9400,
        "lng": 80.1600,
        "severity": "Moderate"
    },
    {
        "description": "Clean drinking water tanker requested for community hall housing 60 dry evacuees.",
        "categories": "FoodWater",
        "water_depth_m": 0.1,
        "trapped_count": 0,
        "vulnerable_count": 10,
        "has_elderly": 4,
        "has_child": 6,
        "has_medical": 0,
        "has_hazard": 0,
        "lat": 12.9650,
        "lng": 80.1550,
        "severity": "Moderate"
    },
    {
        "description": "Minor water logging in front yard, 4 inches deep. Requesting sandbags to prevent entry into house.",
        "categories": "Shelter",
        "water_depth_m": 0.1,
        "trapped_count": 0,
        "vulnerable_count": 0,
        "has_elderly": 0,
        "has_child": 0,
        "has_medical": 0,
        "has_hazard": 0,
        "lat": 13.0300,
        "lng": 80.2500,
        "severity": "Moderate"
    }
]

def generate_augmented_dataset(target_size: int = 600, random_state: int = 42) -> pd.DataFrame:
    """
    Synthesizes an augmented disaster triage dataset by combining curated domain-specific
    archetypes with controlled lexical and numerical variations.
    Guarantees balanced representation across Critical, Urgent, and Moderate classes.
    """
    rng = np.random.RandomState(random_state)
    records = list(CURATED_INCIDENTS)

    # Keywords and phrases for dynamic expansion
    critical_descriptors = [
        ("severe cardiac arrest symptoms reported, patient turning pale", "Medical", 1, 0, 1, 0, 2),
        ("unconscious person submerged in basement apartment water", "Medical,Rescue", 1, 0, 1, 1, 1),
        ("active gas explosion and fire in flooded residential enclave", "Hazard,Rescue", 0, 0, 0, 1, 8),
        ("building foundation cracking visibly, 10 people trapped on 3rd floor", "Rescue", 2, 2, 0, 1, 10),
        ("infant in respiratory arrest, no power for ventilator", "Medical", 0, 1, 1, 0, 1),
        ("broken spine suspected from roof fall during storm, immovable", "Medical", 0, 0, 1, 0, 1),
        ("chemical leak from flooded industrial warehouse affecting school shelter", "Hazard", 5, 8, 1, 1, 20),
        ("water level crossed 2 meters, sweeping families off balcony", "Rescue", 2, 3, 0, 1, 6),
    ]

    urgent_descriptors = [
        ("elderly couple with limited mobility trapped on first floor as water approaches", "Rescue", 2, 0, 0, 0, 2),
        ("water entered home up to 1 meter, family with small children needs extraction", "Rescue", 0, 2, 0, 0, 4),
        ("asthmatic child with exhausted inhaler medication in flooded colony", "Medical", 0, 1, 1, 0, 1),
        ("diabetic insulin stock spoiled due to power loss, replacement needed today", "Medical", 1, 0, 1, 0, 1),
        ("live electrical wire snapped onto fence, no sparks yet but dangerous", "Hazard", 0, 0, 0, 1, 0),
        ("7-year-old lost during neighborhood evacuation, last seen near junction", "Missing", 0, 1, 0, 0, 1),
        ("drinking water completely exhausted for 15 trapped residents on 2nd floor", "FoodWater,Rescue", 3, 2, 0, 0, 15),
        ("pregnant woman with mild pain stranded in waterlogged lane", "Medical", 0, 1, 1, 0, 2),
    ]

    moderate_descriptors = [
        ("community relief camp requires 150 food packets and dry biscuits", "FoodWater", 4, 6, 0, 0, 0),
        ("school camp sheltering 60 people needs drinking water supply tanker", "FoodWater,Shelter", 5, 10, 0, 0, 0),
        ("fallen tree branch obstructing traffic on side street, bypass possible", "Hazard", 0, 0, 0, 1, 0),
        ("sandbags requested to divert slow stormwater runoff from doorstep", "Shelter", 0, 0, 0, 0, 0),
        ("requesting 20 mosquito nets and sanitation kits for flood shelter", "Shelter", 2, 4, 0, 0, 0),
        ("cell tower down in sector, requesting portable booster if available", "Shelter", 0, 0, 0, 0, 0),
        ("drainage clogged with plastic debris, water stagnating at 6 inches", "Hazard", 0, 0, 0, 0, 0),
        ("relief volunteer team requesting replacement flashlights and raincoats", "FoodWater", 0, 0, 0, 0, 0),
    ]

    classes = [
        ("Critical", critical_descriptors, (1.0, 2.5), (1, 15)),
        ("Urgent", urgent_descriptors, (0.4, 1.2), (1, 10)),
        ("Moderate", moderate_descriptors, (0.0, 0.4), (0, 0)),
    ]

    items_per_class = target_size // 3
    base_lat, base_lng = 12.98, 80.22

    for severity, descriptors, depth_range, trapped_range in classes:
        for _ in range(items_per_class):
            desc_template, cats, el, ch, med, haz, trap_base = descriptors[rng.randint(0, len(descriptors))]
            # slight lexical variation
            prefixes = ["Emergency report: ", "Urgent update: ", "Citizen alert: ", "SOS: ", "Call transcript: ", ""]
            suffixes = [" Please prioritize response.", " Immediate review requested.", " Access route submerged.", " Cellular connection spotty.", ""]
            text = f"{rng.choice(prefixes)}{desc_template}{rng.choice(suffixes)}"

            depth = float(np.round(rng.uniform(depth_range[0], depth_range[1]), 2))
            trapped = int(max(0, trap_base + rng.randint(-1, 3)))
            vuln = int(el + ch)

            # Spatial jitter within the Chennai disaster zone (+/- 0.12 deg ~ 12km)
            lat = float(np.round(base_lat + rng.normal(0, 0.05), 6))
            lng = float(np.round(base_lng + rng.normal(0, 0.05), 6))

            records.append({
                "description": text,
                "categories": cats,
                "water_depth_m": depth,
                "trapped_count": trapped,
                "vulnerable_count": vuln,
                "has_elderly": el,
                "has_child": ch,
                "has_medical": med,
                "has_hazard": haz,
                "lat": lat,
                "lng": lng,
                "severity": severity
            })

    df = pd.DataFrame(records)
    return df
