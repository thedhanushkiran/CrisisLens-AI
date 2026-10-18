import { Incident, IncidentStatus, IncidentCategory, Rumor } from '../types';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1').replace(/\/$/, '');
const RESPONDER_TOKEN_KEY = 'crisislens_responder_token';
const ACCOUNT_TOKEN_KEY = 'crisislens_account_token';

export interface AccountProfile {
  id: string;
  display_name: string;
  email: string;
  phone: string | null;
  created_at: string;
}

interface AccountAuthResponse {
  access_token: string;
  token_type: 'bearer';
  user: AccountProfile;
}

type ReviewStatus = 'unreviewed' | 'in_review' | 'verified' | 'rejected' | 'resolved';
const REVIEW_STATUS_BY_INCIDENT_STATUS: Record<IncidentStatus, ReviewStatus> = {
  'Under Review': 'in_review',
  'Responder Verified (No Dispatch)': 'verified',
  'Rejected / Duplicate': 'rejected',
  'Resolved (reviewer marked)': 'resolved',
  'Verified Priority (Dispatching)': 'verified',
  'Field Corroborated - In Transit': 'in_review',
  'On Scene - Active Rescue': 'in_review',
  'Patient Evacuated / Resolved': 'resolved',
  'False Alarm / Duplicate': 'rejected',
};

interface ReportAcknowledgement {
  client_id: string | null;
  status: 'accepted' | 'duplicate' | 'invalid' | 'retryable_failure';
  server_status: string | null;
  message: string | null;
}

interface SyncResponse {
  acknowledgements: ReportAcknowledgement[];
}

export interface ServerReport {
  id: string;
  categories: IncidentCategory[];
  description: string;
  request_message: string | null;
  location_text: string;
  landmark: string | null;
  latitude: number | null;
  longitude: number | null;
  coordinates_consented: boolean;
  urgency: 'Critical' | 'Urgent' | 'Moderate';
  triage: {
    suggested_priority: 'Critical' | 'Urgent' | 'Moderate';
    reasons: string[];
    uncertainty: string;
  };
  client_sync_status: string;
  server_sync_status: string;
  review_status: ReviewStatus;
  assigned_to: string | null;
  contact_primary?: string | null;
  contact_alternate?: string | null;
  notes?: Array<{ id: number; author: string; text: string; created_at: string }>;
  created_at: string;
  updated_at: string;
}

export interface ServerClaim {
  id: string;
  claim: string;
  location: string | null;
  status: 'unverified' | 'needs_review' | 'corroborated' | 'disputed';
  evidence?: string | null;
  reviewer_decision?: string | null;
  created_at: string;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers },
    });
  } catch {
    throw new Error('CrisisLens API is unreachable. The report remains saved on this device.');
  }

  const result = await response.json().catch(() => null) as { detail?: string } | null;
  if (!response.ok) {
    throw new Error(result?.detail || `CrisisLens API returned HTTP ${response.status}`);
  }
  return result as T;
}

export function getResponderToken(): string {
  return sessionStorage.getItem(RESPONDER_TOKEN_KEY) || 'dev-responder-token';
}

export function setResponderToken(token: string): void {
  if (token.trim()) sessionStorage.setItem(RESPONDER_TOKEN_KEY, token.trim());
  else sessionStorage.removeItem(RESPONDER_TOKEN_KEY);
}

function reportPayload(incident: Incident) {
  const coords = incident.location;
  const coordinatesConsented = incident.coordinatesConsented === true;
  return {
    id: incident.id,
    categories: incident.categories,
    description: incident.description,
    request_message: incident.requestMessage || null,
    location_text: incident.location.street,
    landmark: incident.location.landmark || null,
    latitude: coordinatesConsented ? coords.lat : null,
    longitude: coordinatesConsented ? coords.lng : null,
    coordinates_consented: coordinatesConsented,
    urgency: incident.urgency,
    contact_primary: incident.contact.primary || null,
    contact_alternate: incident.contact.alternate || null,
    client_sync_status: incident.syncState === 'SavedDevice' ? 'saved_device' : 'queued',
  };
}

export async function syncReports(incidents: Incident[]): Promise<ReportAcknowledgement[]> {
  const token = getAccountToken();
  const result = await request<SyncResponse>('/reports/sync', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: JSON.stringify(incidents.map(reportPayload)),
  });
  return result.acknowledgements;
}

export function getAccountToken(): string {
  return sessionStorage.getItem(ACCOUNT_TOKEN_KEY) || '';
}

export function clearAccountSession(): void {
  sessionStorage.removeItem(ACCOUNT_TOKEN_KEY);
}

function saveAccountSession(result: AccountAuthResponse): AccountProfile {
  sessionStorage.setItem(ACCOUNT_TOKEN_KEY, result.access_token);
  return result.user;
}

export async function registerAccount(input: {
  display_name: string;
  email: string;
  phone: string | null;
  password: string;
}): Promise<AccountProfile> {
  const result = await request<AccountAuthResponse>('/accounts/register', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return saveAccountSession(result);
}

export async function loginAccount(input: { email: string; password: string }): Promise<AccountProfile> {
  const result = await request<AccountAuthResponse>('/accounts/login', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return saveAccountSession(result);
}

export async function getCurrentAccount(): Promise<AccountProfile> {
  const token = getAccountToken();
  if (!token) throw new Error('No signed-in account.');
  return request<AccountProfile>('/accounts/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function logoutAccount(): Promise<void> {
  const token = getAccountToken();
  if (token) {
    await request<void>('/accounts/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  }
  clearAccountSession();
}

export interface TriageSuggestion {
  suggested_priority: 'Critical' | 'Urgent' | 'Moderate';
  reasons: string[];
  uncertainty: string;
  is_human_decision: false;
}

export function requestTriageSuggestion(description: string, categories: IncidentCategory[]) {
  return request<TriageSuggestion>('/triage/suggest', {
    method: 'POST',
    body: JSON.stringify({ description, categories }),
  });
}

export async function listResponderReports(): Promise<ServerReport[]> {
  const token = getResponderToken();
  if (!token) throw new Error('Enter a responder API token to load server reports.');
  return request<ServerReport[]>('/responder/reports', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function listMyReports(): Promise<ServerReport[]> {
  const token = getAccountToken();
  if (!token) throw new Error('Sign in to view reports linked to your account.');
  return request<ServerReport[]>('/accounts/me/reports', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function updateResponderReport(
  id: string,
  status: IncidentStatus,
  assignedTo: string | null,
): Promise<ServerReport> {
  const token = getResponderToken();
  if (!token) throw new Error('Enter a responder API token before reviewing reports.');
  const reviewStatus = REVIEW_STATUS_BY_INCIDENT_STATUS[status];
  return request<ServerReport>(`/responder/reports/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ review_status: reviewStatus, assigned_to: assignedTo }),
  });
}

export async function addResponderNote(id: string, text: string) {
  const token = getResponderToken();
  if (!token) throw new Error('Enter a responder API token before adding internal notes.');
  return request<{ id: number; author: string; text: string; created_at: string }>(
    `/responder/reports/${encodeURIComponent(id)}/notes`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ text }),
    },
  );
}

export async function listMisinformationClaims(): Promise<ServerClaim[]> {
  return request<ServerClaim[]>('/misinformation/claims');
}

export async function createMisinformationClaim(claim: string, location: string) {
  return request<ServerClaim>('/misinformation/claims', {
    method: 'POST',
    body: JSON.stringify({
      id: `CLAIM-${crypto.randomUUID()}`,
      claim,
      location: location || null,
    }),
  });
}

export async function reviewMisinformationClaim(
  id: string,
  status: ServerClaim['status'],
  evidence: string,
  reviewerDecision: string,
) {
  const token = getResponderToken();
  if (!token) throw new Error('Connect as a responder before reviewing claims.');
  return request<ServerClaim>(`/misinformation/claims/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      status,
      evidence: evidence || null,
      reviewer_decision: reviewerDecision || null,
    }),
  });
}

export function toRumor(claim: ServerClaim): Rumor {
  const statusLabel: Record<ServerClaim['status'], 'Unverified' | 'Needs Review' | 'Corroborated' | 'Disputed'> = {
    unverified: 'Unverified',
    needs_review: 'Needs Review',
    corroborated: 'Corroborated',
    disputed: 'Disputed',
  };
  return {
    id: claim.id,
    claim: claim.claim,
    location: claim.location || 'Location not provided',
    status: statusLabel[claim.status],
    reportedBy: 'CrisisLens API',
    sharesEstimated: 0,
    aiCorroborationScore: 0,
    officialFact: claim.reviewer_decision || 'No reviewer decision recorded.',
    source: claim.evidence || 'No evidence submitted.',
    timestamp: claim.created_at,
  };
}

export function toIncident(report: ServerReport): Incident {
  const reviewState: Record<ReviewStatus, IncidentStatus> = {
    unreviewed: 'Under Review',
    in_review: 'Under Review',
    verified: 'Responder Verified (No Dispatch)',
    rejected: 'Rejected / Duplicate',
    resolved: 'Resolved (reviewer marked)',
  };
  return {
    id: report.id,
    title: `${report.location_text.split(',')[0]}: ${report.description.slice(0, 70)}`,
    description: report.description,
    requestMessage: report.request_message || undefined,
    categories: report.categories,
    urgency: report.urgency,
    aiScore: 0,
    aiConfidence: 0,
    aiTriggers: report.triage.reasons,
    aiRationale: `Rule-based suggestion: ${report.triage.suggested_priority}. Uncertainty: ${report.triage.uncertainty}. Human review is required.`,
    aiScoringAttribution: undefined,
    recommendedAsset: 'No asset selected; no emergency-services dispatch integration',
    location: {
      street: report.location_text,
      landmark: report.landmark || '',
      lat: report.latitude ?? 0,
      lng: report.longitude ?? 0,
      sector: report.location_text,
      coordinatesConsented: report.coordinates_consented,
    },
    coordinatesConsented: report.coordinates_consented,
    contact: {
      primary: report.contact_primary || '',
      alternate: report.contact_alternate || undefined,
    },
    timestamp: report.created_at,
    timeAgo: 'Server record',
    syncState: report.server_sync_status === 'received' ? 'ReceivedServer' : 'EOCReview',
    assignedUnit: report.assigned_to,
    status: reviewState[report.review_status],
    groundImages: [],
    sha256Digest: '',
    trappedCount: 0,
    vulnerableCount: 0,
    notes: (report.notes || []).map(note => ({
      id: String(note.id),
      author: note.author,
      timestamp: note.created_at,
      text: note.text,
    })),
  };
}

export interface Facility {
  id: string;
  name: string;
  category: 'Hospital' | 'Shelter' | 'SafeZone' | 'EmergencyService';
  latitude: number;
  longitude: number;
  address: string;
  phone: string;
  status: string;
  emergency_capacity: string;
  has_trauma_center?: boolean;
  has_emergency_power?: boolean;
  flood_status: string;
  verified: boolean;
  distance_km?: number;
  eta_minutes?: number;
}

export interface RouteStep {
  step_number: number;
  instruction: string;
  distance_m: number;
  heading: string;
}

export interface RouteHazardWarning {
  hazard_zone: string;
  risk: string;
  caution: string;
  proximity_km: number;
}

export interface EvacuationRouteResponse {
  status: string;
  origin: { latitude: number; longitude: number };
  destination: { latitude: number; longitude: number };
  distance_km: number;
  duration_minutes: number;
  geometry: [number, number][];
  steps: RouteStep[];
  hazard_warnings: RouteHazardWarning[];
  disclaimer: string;
}

export interface GeocodeResult {
  name: string;
  display_name?: string;
  lat: number;
  lng: number;
  type: string;
  provider?: string;
  confidence?: number;
}

export interface GeocodeSearchResponse {
  status: string;
  query: string;
  provider: string;
  from_cache?: boolean;
  results: GeocodeResult[];
}

export interface SeverityPredictionResponse {
  predicted_severity: 'Critical' | 'Urgent' | 'Moderate';
  confidence: number;
  class_probabilities: Record<string, number>;
  uncertainty: string;
  contributing_factors: string[];
  is_human_decision: boolean;
  model_version: string;
  requires_human_override: boolean;
  limitations_note: string;
}

export interface HotspotCluster {
  cluster_id: string;
  centroid: { latitude: number; longitude: number };
  radius_km: number;
  incident_count: number;
  critical_count: number;
  urgent_count: number;
  risk_level: 'High' | 'Elevated' | 'Moderate';
  incident_ids: string[];
  time_window: string;
  data_coverage: string;
}

export interface HotspotsResponse {
  status: string;
  cluster_count: number;
  total_geocoded_incidents: number;
  clustering_algorithm: string;
  epsilon_km: number;
  hotspots: HotspotCluster[];
  disclaimer: string;
}

export interface RankedDispatchAsset {
  asset_id: string;
  name: string;
  type: string;
  status: string;
  sector: string;
  distance_km: number;
  estimated_eta_minutes: number;
  suitability_score: number;
  match_reasons: string[];
}

export interface DispatchPrioritizationResponse {
  status: string;
  incident_target: {
    latitude: number;
    longitude: number;
    urgency: string;
    water_depth_m: number;
  };
  ranked_recommendations: RankedDispatchAsset[];
  disclaimer: string;
}

export async function listFacilities(category?: string): Promise<Facility[]> {
  const query = category && category !== 'All' ? `?category=${encodeURIComponent(category)}` : '';
  const result = await request<{ status: string; facilities: Facility[] }>(`/facilities${query}`);
  return result.facilities;
}

export async function findNearbyFacilities(
  lat: number,
  lng: number,
  radius_km: number = 15,
  category?: string
): Promise<Facility[]> {
  const catParam = category && category !== 'All' ? `&category=${encodeURIComponent(category)}` : '';
  const result = await request<{ status: string; facilities: Facility[] }>(
    `/facilities/nearby?lat=${lat}&lng=${lng}&radius_km=${radius_km}${catParam}`
  );
  return result.facilities;
}

export async function calculateRoute(
  orig_lat: number,
  orig_lng: number,
  dest_lat: number,
  dest_lng: number,
  avoid_hazards: boolean = true
): Promise<EvacuationRouteResponse> {
  return request<EvacuationRouteResponse>('/geo/route', {
    method: 'POST',
    body: JSON.stringify({
      origin_lat: orig_lat,
      origin_lng: orig_lng,
      destination_lat: dest_lat,
      destination_lng: dest_lng,
      avoid_hazards,
    }),
  });
}

export async function geocodeSearch(query: string, limit: number = 5): Promise<GeocodeResult[]> {
  const result = await request<GeocodeSearchResponse>(
    `/geo/geocode?q=${encodeURIComponent(query)}&limit=${limit}`
  );
  return result.results || [];
}

export async function geocodeSearchWithMeta(query: string, limit: number = 5): Promise<GeocodeSearchResponse> {
  return request<GeocodeSearchResponse>(
    `/geo/geocode?q=${encodeURIComponent(query)}&limit=${limit}`
  );
}

export async function reverseGeocode(lat: number, lng: number): Promise<GeocodeResult | null> {
  const result = await request<{ status: string; result: GeocodeResult | null }>(
    `/geo/reverse?lat=${lat}&lng=${lng}`
  );
  return result.result;
}

export async function predictIncidentSeverity(payload: {
  description: string;
  categories: string[];
  water_depth_m?: number;
  trapped_count?: number;
  vulnerable_count?: number;
}): Promise<SeverityPredictionResponse> {
  return request<SeverityPredictionResponse>('/ml/predict-severity', {
    method: 'POST',
    body: JSON.stringify({
      description: payload.description,
      categories: payload.categories,
      water_depth_m: payload.water_depth_m ?? 0,
      trapped_count: payload.trapped_count ?? 0,
      vulnerable_count: payload.vulnerable_count ?? 0,
    }),
  });
}

export async function getIncidentHotspots(
  eps_km: number = 2.5,
  min_samples: number = 2
): Promise<HotspotsResponse> {
  return request<HotspotsResponse>(`/ml/hotspots?eps_km=${eps_km}&min_samples=${min_samples}`);
}

export async function prioritizeDispatch(payload: {
  incident_lat: number;
  incident_lng: number;
  urgency: string;
  categories: string[];
  water_depth_m: number;
  trapped_count: number;
  available_assets?: any[];
}): Promise<DispatchPrioritizationResponse> {
  return request<DispatchPrioritizationResponse>('/ml/prioritize-dispatch', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getMlMetrics(): Promise<any> {
  return request<any>('/ml/metrics');
}
