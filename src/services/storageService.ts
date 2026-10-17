import { Incident } from '../types';
import { INITIAL_INCIDENTS } from '../data/mockData';

const STORAGE_KEY = 'crisislens_incidents_v4';
const OFFLINE_QUEUE_KEY = 'crisislens_offline_queue_v4';

// Helper to calculate simple SHA-256 or hash representation
export async function computeSha256(text: string): Promise<string> {
  try {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
      const msgUint8 = new TextEncoder().encode(text);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgUint8);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return '#' + hashHex.substring(0, 12);
    }
  } catch {
    // Fallback
  }
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash |= 0;
  }
  return '#' + Math.abs(hash).toString(16).padStart(8, '0');
}

export const StorageService = {
  getIncidents(): Incident[] {
    let data: string | null;
    try {
      data = localStorage.getItem(STORAGE_KEY);
    } catch (error) {
      console.error('Unable to read local incident storage.', error);
      throw new Error('Browser storage is unavailable; this report cannot be saved locally.');
    }
    if (!data) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_INCIDENTS));
      return INITIAL_INCIDENTS;
    }
    try {
      const parsed: unknown = JSON.parse(data);
      if (Array.isArray(parsed)) return parsed as Incident[];
      throw new Error('Stored incident data is not a list.');
    } catch (error) {
      console.error('Unable to parse saved incident data.', error);
      throw new Error('Saved incident data is unreadable; it was not replaced.');
    }
  },

  saveIncident(incident: Incident): void {
    const list = this.getIncidents();
    const existingIdx = list.findIndex(i => i.id === incident.id);
    if (existingIdx >= 0) {
      list[existingIdx] = incident;
    } else {
      list.unshift(incident);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));

    // Also queue into offline queue
    const queue = this.getOfflineQueue();
    if (!queue.some(q => q.id === incident.id)) {
      queue.unshift({ ...incident, syncState: 'SavedDevice' });
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    }
  },

  updateIncidentStatus(id: string, updates: Partial<Incident>): Incident | null {
    const list = this.getIncidents();
    const idx = list.findIndex(i => i.id === id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...updates };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      return list[idx];
    }
    return null;
  },

  getOfflineQueue(): Incident[] {
    let data: string | null;
    try {
      data = localStorage.getItem(OFFLINE_QUEUE_KEY);
    } catch (error) {
      console.error('Unable to read the local synchronization queue.', error);
      throw new Error('Browser storage is unavailable; pending reports cannot be read.');
    }
    if (!data) return [];
    try {
      const parsed: unknown = JSON.parse(data);
      if (Array.isArray(parsed)) return parsed as Incident[];
      throw new Error('Stored sync queue is not a list.');
    } catch (error) {
      console.error('Unable to parse the local synchronization queue.', error);
      throw new Error('Pending report queue is unreadable; it was not discarded.');
    }
  },

  markReportsSynced(ids: string[]): void {
    const syncedIds = new Set(ids);
    const list = this.getIncidents();
    list.forEach(incident => {
      if (syncedIds.has(incident.id)) incident.syncState = 'ReceivedServer';
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    const queue = this.getOfflineQueue().filter(item => !syncedIds.has(item.id));
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  },

  exportGeoJson(): string {
    const incidents = this.getIncidents();
    const geojson = {
      type: 'FeatureCollection',
      features: incidents
        .filter(inc => inc.coordinatesConsented === true || inc.location.coordinatesConsented === true)
        .map(inc => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [inc.location.lng, inc.location.lat]
        },
        properties: {
          id: inc.id,
          title: inc.title,
          urgency: inc.urgency,
          aiScore: inc.aiScore,
          categories: inc.categories,
          status: inc.status,
          assignedUnit: inc.assignedUnit,
          waterDepth: inc.waterDepth,
        }
        }))
    };
    return JSON.stringify(geojson, null, 2);
  },

  exportCsv(): string {
    const incidents = this.getIncidents();
    const headers = ['IncidentID', 'Urgency', 'AIScore', 'Categories', 'Street', 'Landmark', 'Latitude', 'Longitude', 'Trapped', 'AssignedUnit', 'Status'];
    const rows = incidents.map(inc => [
      inc.id,
      inc.urgency,
      inc.aiScore,
      `"${inc.categories.join(';')}"`,
      `"${inc.location.street.replace(/"/g, '""')}"`,
      `"${inc.location.landmark.replace(/"/g, '""')}"`,
      inc.coordinatesConsented || inc.location.coordinatesConsented ? inc.location.lat : '',
      inc.coordinatesConsented || inc.location.coordinatesConsented ? inc.location.lng : '',
      inc.trappedCount,
      `"${(inc.assignedUnit || 'Unassigned').replace(/"/g, '""')}"`,
      `"${inc.status}"`
    ]);
    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }
};
