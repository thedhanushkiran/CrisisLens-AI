export type UrgencyLevel = 'Critical' | 'Urgent' | 'Moderate';

export type IncidentCategory = 
  | 'Rescue' 
  | 'Medical' 
  | 'FoodWater' 
  | 'Shelter' 
  | 'Missing' 
  | 'Hazard';

export type SyncState = 
  | 'SavedDevice' 
  | 'QueuedSatellite' 
  | 'ReceivedServer' 
  | 'EOCReview' 
  | 'UnitDispatched'
  | 'Resolved';

export type IncidentStatus = 
  | 'Under Review'
  | 'Responder Verified (No Dispatch)'
  | 'Rejected / Duplicate'
  | 'Resolved (reviewer marked)'
  | 'Verified Priority (Dispatching)'
  | 'Field Corroborated - In Transit'
  | 'On Scene - Active Rescue'
  | 'Patient Evacuated / Resolved'
  | 'False Alarm / Duplicate';

export interface GroundImage {
  id: string;
  url: string;
  label: string;
  caption?: string;
  waterGaugeReading?: string;
}

export interface IncidentNote {
  id: string;
  author: string;
  timestamp: string;
  text: string;
}

export interface Incident {
  id: string;
  title: string;
  description: string;
  requestMessage?: string;
  categories: IncidentCategory[];
  urgency: UrgencyLevel;
  aiScore: number;
  aiConfidence: number;
  aiTriggers: string[];
  aiRationale: string;
  aiScoringAttribution?: string;
  recommendedAsset: string;
  location: {
    street: string;
    landmark: string;
    lat: number;
    lng: number;
    sector: string;
    accuracyMeters?: number;
    coordinatesConsented?: boolean;
  };
  coordinatesConsented?: boolean;
  contact: {
    primary: string;
    alternate?: string;
  };
  timestamp: string;
  timeAgo: string;
  syncState: SyncState;
  assignedUnit: string | null;
  status: IncidentStatus;
  groundImages: GroundImage[];
  sha256Digest: string;
  waterDepth?: string;
  trappedCount: number;
  vulnerableCount: number;
  notes: IncidentNote[];
  isDemo?: boolean;
}

export interface Rumor {
  id: string;
  claim: string;
  location: string;
  status: 'Unverified' | 'Needs Review' | 'Corroborated' | 'Disputed';
  reportedBy: string;
  sharesEstimated: number;
  aiCorroborationScore: number;
  officialFact: string;
  source: string;
  timestamp: string;
  isDemo?: boolean;
}

export interface FieldAsset {
  id: string;
  name: string;
  type: 'Boat' | 'Ambulance' | 'Skiff' | 'Amphibian' | 'Truck' | 'Helicopter';
  status: 'Available' | 'En Route' | 'On Scene' | 'Standby';
  sector: string;
  personnel: number;
  capacity: string;
  equipment: string[];
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time: string;
  type: 'critical' | 'warning' | 'info' | 'success';
  unread: boolean;
}

export type ActiveTab = 
  | 'public-portal'
  | 'emergency-report'
  | 'responder-command'
  | 'crisis-map'
  | 'misinformation-queue'
  | 'sync-and-offline-center';

export type Language = 'en' | 'ta';
