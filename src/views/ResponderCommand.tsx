import React, { useState } from 'react';
import { Incident, FieldAsset, IncidentStatus, Rumor } from '../types';
import { StorageService } from '../services/storageService';
import { FIELD_ASSETS, INITIAL_RUMORS } from '../data/mockData';
import {
  addResponderNote,
  getResponderToken,
  listResponderReports,
  setResponderToken,
  toIncident,
  updateResponderReport,
} from '../services/apiService';

interface ResponderCommandProps {
  incidents: Incident[];
  onUpdateIncident: (id: string, updates: Partial<Incident>) => void;
  selectedIncidentId?: string;
  onSelectIncidentId?: (id: string) => void;
  onServerReportsLoaded?: (incidents: Incident[]) => void;
}

interface AuditLogEntry {
  id: string;
  timestamp: string;
  event: string;
  incidentId: string;
  operator: string;
  details: string;
}

export const ResponderCommand: React.FC<ResponderCommandProps> = ({
  incidents,
  onUpdateIncident,
  selectedIncidentId: initialSelectedId,
  onServerReportsLoaded,
}) => {
  const [activeSubsystem, setActiveSubsystem] = useState<
    'incident-feeds' | 'geo-clusters' | 'ai-priority-queue' | 'misinformation-verification' | 'dispatch-logistics' | 'audit-log'
  >('incident-feeds');

  const [selectedIncidentId, setSelectedIncidentId] = useState<string>(
    initialSelectedId || incidents[0]?.id || 'CL-8921'
  );

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterUrgency, setFilterUrgency] = useState('All');
  const [filterSyncState, setFilterSyncState] = useState('All');
  const [filterTime, setFilterTime] = useState('Last 6 Hours');

  // Responder review controls; asset assignment does not dispatch a unit.
  const [selectedAsset, setSelectedAsset] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<IncidentStatus>('Under Review');
  const [newLogNote, setNewLogNote] = useState('');
  const [showLogModal, setShowLogModal] = useState(false);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [responderToken, setResponderTokenState] = useState(getResponderToken);
  const [apiError, setApiError] = useState<string | null>(null);
  const [apiConnected, setApiConnected] = useState(false);
  const [isSavingReview, setIsSavingReview] = useState(false);

  // Logistics state
  const [fleetAssets, setFleetAssets] = useState<FieldAsset[]>(FIELD_ASSETS);
  const [rumorList, setRumorList] = useState<Rumor[]>(INITIAL_RUMORS);

  const [auditLogEntries, setAuditLogEntries] = useState<AuditLogEntry[]>([]);

  const activeIncident = incidents.find(i => i.id === selectedIncidentId) || incidents[0];

  // Filtered list
  const filteredIncidents = incidents.filter(inc => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const match = inc.id.toLowerCase().includes(q) ||
        inc.title.toLowerCase().includes(q) ||
        inc.location.street.toLowerCase().includes(q) ||
        inc.location.landmark.toLowerCase().includes(q);
      if (!match) return false;
    }
    if (filterCategory !== 'All' && !inc.categories.some(c => c.toLowerCase().includes(filterCategory.toLowerCase()))) {
      return false;
    }
    if (filterUrgency !== 'All' && inc.urgency.toLowerCase() !== filterUrgency.toLowerCase()) {
      return false;
    }
    return true;
  });

  const triggerFeedback = (msg: string) => {
    setActionFeedback(msg);
    setTimeout(() => setActionFeedback(null), 3500);
  };

  const handleExportGeoJson = () => {
    const data = StorageService.exportGeoJson();
    const blob = new Blob([data], { type: 'application/geo+json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `crisislens_tactical_${new Date().toISOString().slice(0, 10)}.geojson`;
    a.click();
    URL.revokeObjectURL(url);
    triggerFeedback('Exported tactical GeoJSON to disk');
  };

  const handleExportCsv = () => {
    const data = StorageService.exportCsv();
    const blob = new Blob([data], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `crisislens_radio_log_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    triggerFeedback('Exported report CSV. No radio transmission occurred.');
  };

  const handleLoadServerReports = async (event: React.FormEvent) => {
    event.preventDefault();
    setResponderToken(responderToken);
    setApiError(null);
    try {
      const reports = await listResponderReports();
      onServerReportsLoaded?.(reports.map(toIncident));
      setApiConnected(true);
      triggerFeedback(`Loaded ${reports.length} report(s) from the CrisisLens API.`);
    } catch (error) {
      setApiConnected(false);
      setApiError(error instanceof Error ? error.message : 'Unable to load server reports.');
    }
  };

  const handleSaveReview = async () => {
    if (!activeIncident) return;
    setIsSavingReview(true);
    setApiError(null);
    try {
      const report = await updateResponderReport(activeIncident.id, selectedStatus, selectedAsset || null);
      const updated = toIncident(report);
      onUpdateIncident(activeIncident.id, updated);
      const newAuditEntry = {
        id: `aud-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        event: 'Responder review and assignment saved',
        incidentId: activeIncident.id,
        operator: 'Authenticated CrisisLens responder',
        details: `Review status: ${updated.status}. Assignment recorded: ${updated.assignedUnit || 'Unassigned'}. No dispatch occurred.`,
      };
      setAuditLogEntries(entries => [newAuditEntry, ...entries]);
      triggerFeedback('Review and assignment saved by the CrisisLens API. No emergency services were contacted.');
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Could not save responder review.');
    } finally {
      setIsSavingReview(false);
    }
  };

  const handleAddNote = async () => {
    if (!newLogNote.trim() || !activeIncident) return;
    setApiError(null);
    try {
      const note = await addResponderNote(activeIncident.id, newLogNote);
      const updatedNotes = [
        ...(activeIncident.notes || []),
        { id: String(note.id), author: note.author, timestamp: note.created_at, text: note.text },
      ];
      onUpdateIncident(activeIncident.id, { notes: updatedNotes });
      setNewLogNote('');
      setShowLogModal(false);
      triggerFeedback('Internal note saved by the CrisisLens API.');
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Could not save internal note.');
    }
  };

  // Subsystem list
  const subsystems = [
    { id: 'incident-feeds', label: 'Incident Feeds', icon: 'emergency_home', badge: `${filteredIncidents.length}` },
    { id: 'geo-clusters', label: 'Geo-Clusters', icon: 'hub', badge: '4 Clusters' },
    { id: 'ai-priority-queue', label: 'AI Priority Queue', icon: 'neurology', badge: 'Score 96+' },
    { id: 'misinformation-verification', label: 'Misinformation Desk', icon: 'fact_check', badge: '3 Active' },
    { id: 'dispatch-logistics', label: 'Dispatch Logistics', icon: 'local_shipping', badge: `${fleetAssets.length} Units` },
    { id: 'audit-log', label: 'Audit Log', icon: 'history_edu', badge: `${auditLogEntries.length} Records` },
  ] as const;

  return (
    <div className="relative flex flex-col lg:flex-row w-full min-h-[calc(100vh-140px)] gap-2 lg:pt-16">
      <section className="w-full lg:absolute lg:top-0 lg:right-0 lg:w-auto lg:z-10 flex flex-col sm:flex-row sm:items-center gap-2 p-3 bg-surface-container-lowest rounded-xl border border-surface-container-high">
        <form onSubmit={handleLoadServerReports} className="flex flex-wrap items-center gap-2">
          <label className="text-xs font-semibold text-on-surface-variant" htmlFor="responder-api-token">
            Responder API token
          </label>
          <input
            id="responder-api-token"
            type="password"
            autoComplete="current-password"
            value={responderToken}
            onChange={event => setResponderTokenState(event.target.value)}
            placeholder="Paste local development token"
            className="h-9 min-w-48 px-2 rounded-lg bg-surface-container-low text-xs border border-surface-container-high"
          />
          <button
            type="submit"
            className="h-9 px-3 rounded-lg bg-primary text-on-primary text-xs font-bold"
          >
            {apiConnected ? 'Refresh server reports' : 'Connect'}
          </button>
          <span className={`text-xs font-bold ${apiConnected ? 'text-tertiary' : 'text-on-surface-variant'}`}>
            {apiConnected ? 'API connected' : 'Not connected'}
          </span>
        </form>
        {apiError && <p role="alert" className="text-xs font-semibold text-error">{apiError}</p>}
      </section>
      {/* Sidebar: Command Subsystems (Desktop) */}
      <aside className="hidden lg:flex flex-col justify-between w-64 bg-surface-container-low shrink-0 py-space-md border-r border-surface-container-high rounded-xl">
        <div className="flex flex-col">
          <div className="px-space-md py-space-xs mb-space-sm flex items-center justify-between">
            <span className="font-mono text-xs uppercase tracking-wider text-secondary font-bold">
              Command Subsystems
            </span>
            <span className="w-2 h-2 rounded-full bg-tertiary animate-pulse"></span>
          </div>

          <nav className="flex flex-col gap-1 px-space-sm">
            {subsystems.map(sub => {
              const active = activeSubsystem === sub.id;
              return (
                <button
                  key={sub.id}
                  onClick={() => setActiveSubsystem(sub.id)}
                  className={`flex items-center justify-between px-space-md py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer text-left ${
                    active
                      ? 'bg-primary-container text-on-primary-container font-bold shadow-xs ring-1 ring-primary'
                      : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                  }`}
                >
                  <div className="flex items-center gap-space-sm">
                    <span className="material-symbols-outlined text-[18px]">{sub.icon}</span>
                    <span>{sub.label}</span>
                  </div>
                  <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-bold ${
                    active ? 'bg-white/20 text-white' : 'bg-surface-container text-on-surface-variant'
                  }`}>
                    {sub.badge}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="px-space-md pt-space-md">
          <div className="p-space-sm rounded-lg bg-surface-container text-on-surface font-mono text-[11px] flex flex-col gap-1 border border-surface-container-high">
            <div className="flex justify-between items-center">
              <span className="text-secondary">SYNC PENDING</span>
              <span className="font-bold text-on-surface">0 items</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-secondary">CRISISLENS API</span>
              <span className={`font-bold ${apiConnected ? 'text-tertiary' : 'text-outline'}`}>
                {apiConnected ? 'CONNECTED' : 'NOT CONNECTED'}
              </span>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile & Tablet Subsystem Horizontal Navigation Bar */}
      <div className="lg:hidden flex items-center gap-1.5 overflow-x-auto pb-2 px-1 scrollbar-none shrink-0 w-full bg-surface-container-low p-2 rounded-xl border border-surface-container-high mb-2">
        {subsystems.map(sub => {
          const active = activeSubsystem === sub.id;
          return (
            <button
              key={sub.id}
              onClick={() => setActiveSubsystem(sub.id)}
              className={`flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                active
                  ? 'bg-primary text-on-primary shadow-xs'
                  : 'bg-surface-container text-on-surface hover:bg-surface-container-high'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">{sub.icon}</span>
              <span>{sub.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Command Workspace */}
      <div className="flex-1 flex flex-col min-w-0 py-1">
        {/* Persistent Sync & Operational Status Bar */}
        <div className="mb-space-md flex flex-wrap items-center justify-between gap-space-sm bg-surface-container-low px-space-md py-2 rounded-xl shadow-xs border border-surface-container-high">
          <div className="flex items-center gap-space-md truncate">
            <div className="flex items-center gap-2 font-mono text-xs text-secondary truncate">
              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-tertiary animate-pulse shrink-0"></span>
              <span className="font-bold text-on-surface">CRISISLENS REPORT FEED</span>
              <span className="text-outline">::</span>
              <span className="truncate">SECTOR: CHENNAI SOUTH (VELACHERY / TAMBARAM AXIS)</span>
            </div>
            <span className="hidden sm:inline-block px-2 py-0.5 rounded bg-secondary-container text-on-secondary-fixed font-mono text-[11px] font-semibold">
              LATENCY 34ms
            </span>
          </div>
          <div className="flex items-center gap-space-md text-xs">
            <div className="flex items-center gap-1.5 font-mono text-on-surface-variant">
              <span className="material-symbols-outlined text-[16px] text-tertiary">cloud_done</span>
              <span>Local and loaded server records ({incidents.length})</span>
            </div>
            <div className="hidden md:flex items-center gap-1 font-mono text-error font-semibold bg-error-container/40 px-2 py-0.5 rounded text-[11px]">
              <span>{apiConnected ? 'CRISISLENS API CONNECTED' : 'SIMULATION MODE (DEMO RUNTIME)'}</span>
            </div>
          </div>
        </div>

        {/* ----------------- SUBSYSTEM 1: INCIDENT FEEDS (DEFAULT) ----------------- */}
        {activeSubsystem === 'incident-feeds' && (
          <div className="flex flex-col gap-space-md">
            {/* Top Metric KPI Cards (4 columns) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-gutter-desktop mb-space-sm">
              {/* Card 1: Total Reports */}
              <div className="relative overflow-hidden bg-surface-container-lowest p-space-lg rounded-xl shadow-xs hover:shadow-sm transition-shadow border border-surface-container-high">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs uppercase tracking-wider text-secondary font-semibold">Reports in Current View</span>
                  <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-surface-container text-secondary font-mono text-[11px]">
                    <span className="material-symbols-outlined text-[14px]">info</span> Demo sample
                  </span>
                </div>
                <div className="flex items-baseline gap-space-sm mb-1">
                  <span className="text-3xl font-bold text-on-surface font-mono">{apiConnected ? incidents.length : '—'}</span>
                  <span className="text-xs text-secondary font-semibold">Logged</span>
                </div>
                <div className="flex items-center justify-between text-outline text-[11px]">
                  <span>{apiConnected ? 'Loaded from CrisisLens API' : 'Connect to API to load live report count'}</span>
                  <span className="font-mono">No dispatch integration</span>
                </div>
                <div className="mt-2 h-6 w-full opacity-60">
                  <svg className="w-full h-full stroke-primary fill-none stroke-[2]" viewBox="0 0 160 28">
                    <polyline points="0,20 20,18 40,22 60,15 80,12 100,16 120,8 140,11 160,4"></polyline>
                  </svg>
                </div>
              </div>

              {/* Card 2: Awaiting Review */}
              <div className="relative overflow-hidden bg-surface-container-lowest p-space-lg rounded-xl shadow-xs hover:shadow-sm transition-shadow border border-surface-container-high">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs uppercase tracking-wider text-secondary font-semibold">Awaiting Responder Review</span>
                  <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-mono text-[11px] font-bold">
                    <span className="material-symbols-outlined text-[14px]">warning</span> Action Req.
                  </span>
                </div>
                <div className="flex items-baseline gap-space-sm mb-1">
                  <span className="text-3xl font-bold text-amber-900 font-mono">47</span>
                  <span className="text-xs text-amber-800 font-semibold">Pending Triage</span>
                </div>
                <div className="flex items-center justify-between text-outline text-[11px]">
                  <span className="text-amber-800 font-semibold">Requires triage verification</span>
                  <span className="font-mono">Queue &lt; 6m avg</span>
                </div>
                <div className="mt-3 w-full bg-surface-container rounded-full h-1.5 overflow-hidden">
                  <div className="bg-amber-600 h-1.5 rounded-full" style={{ width: '38%' }}></div>
                </div>
              </div>

              {/* Card 3: Critical Life Safety */}
              <div className="relative overflow-hidden bg-error-container/20 p-space-lg rounded-xl shadow-xs hover:shadow-sm transition-shadow border border-error/20">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs uppercase tracking-wider text-error font-bold">Life Safety / Critical</span>
                  <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-error text-on-error font-mono text-[10px] uppercase font-bold">
                    <span className="material-symbols-outlined text-[14px]">e911_emergency</span> High Risk
                  </span>
                </div>
                <div className="flex items-baseline gap-space-sm mb-1">
                  <span className="text-3xl font-bold text-error font-mono">12</span>
                  <span className="text-xs text-error/80 font-semibold">Active Hazards</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-error font-bold">Human review required</span>
                  <span className="font-mono text-error font-semibold">No dispatch integration</span>
                </div>
                <div className="mt-3 flex gap-1">
                  <span className="h-1.5 flex-1 rounded bg-error"></span>
                  <span className="h-1.5 flex-1 rounded bg-error"></span>
                  <span className="h-1.5 flex-1 rounded bg-error"></span>
                  <span className="h-1.5 flex-1 rounded bg-error/30"></span>
                </div>
              </div>

              {/* Card 4: Coordinated / Resolved */}
              <div className="relative overflow-hidden bg-surface-container-lowest p-space-lg rounded-xl shadow-xs hover:shadow-sm transition-shadow border border-surface-container-high">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs uppercase tracking-wider text-secondary font-semibold">Coordinated / Resolved</span>
                  <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-tertiary-container text-on-tertiary font-mono text-[11px] font-bold">
                    <span className="material-symbols-outlined text-[14px]">check_circle</span> 65.5%
                  </span>
                </div>
                <div className="flex items-baseline gap-space-sm mb-1">
                  <span className="text-3xl font-bold text-tertiary font-mono">842</span>
                  <span className="text-xs text-secondary font-semibold">Closed</span>
                </div>
                <div className="flex items-center justify-between text-outline text-[11px]">
                  <span className="text-tertiary font-medium">Field team confirmed</span>
                  <span className="font-mono">312 Boats / 530 Ambul.</span>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="h-1.5 w-full bg-surface-container rounded-full overflow-hidden">
                    <div className="bg-tertiary h-1.5 rounded-full" style={{ width: '65.5%' }}></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Operational Filter & Search Ribbon */}
            <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-xs mb-space-sm flex flex-col xl:flex-row gap-space-md items-stretch xl:items-center justify-between border border-surface-container-high">
              <div className="flex-1 flex flex-col md:flex-row gap-space-md">
                <div className="relative flex-1 min-w-[240px]">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">
                    search
                  </span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by Report ID, Landmark, Category or Keyword..."
                    className="w-full h-11 pl-10 pr-4 bg-surface-container-low text-on-surface rounded-lg text-xs focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary focus:outline-none transition-all placeholder:text-outline border border-surface-container-high"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <select
                      value={filterCategory}
                      onChange={(e) => setFilterCategory(e.target.value)}
                      className="h-11 px-3 pr-8 rounded-lg bg-surface-container-low text-on-surface text-xs font-semibold appearance-none focus:outline-none cursor-pointer border border-surface-container-high"
                    >
                      <option value="All">All Categories</option>
                      <option value="Rescue">Rescue (Stranded)</option>
                      <option value="Medical">Medical &amp; Trauma</option>
                      <option value="Hazard">Hazard (Electrical/Chem)</option>
                      <option value="FoodWater">Food &amp; Potable Water</option>
                    </select>
                    <span className="material-symbols-outlined pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-outline text-[18px]">
                      expand_more
                    </span>
                  </div>

                  <div className="relative">
                    <select
                      value={filterUrgency}
                      onChange={(e) => setFilterUrgency(e.target.value)}
                      className="h-11 px-3 pr-8 rounded-lg bg-surface-container-low text-on-surface text-xs font-bold appearance-none focus:outline-none cursor-pointer border border-surface-container-high"
                    >
                      <option value="All">Urgency: All</option>
                      <option value="Critical" className="text-error font-bold">Critical (12)</option>
                      <option value="Urgent" className="text-amber-700">High / Urgent (28)</option>
                      <option value="Moderate">Moderate (7)</option>
                    </select>
                    <span className="material-symbols-outlined pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-outline text-[18px]">
                      expand_more
                    </span>
                  </div>

                  <div className="relative">
                    <select
                      value={filterSyncState}
                      onChange={(e) => setFilterSyncState(e.target.value)}
                      className="h-11 px-3 pr-8 rounded-lg bg-surface-container-low text-on-surface text-xs font-semibold appearance-none focus:outline-none cursor-pointer border border-surface-container-high"
                    >
                      <option value="All">Sync: All States</option>
                      <option value="ServerReceived">Server Received</option>
                      <option value="SavedDevice">Field Queued</option>
                    </select>
                    <span className="material-symbols-outlined pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-outline text-[18px]">
                      expand_more
                    </span>
                  </div>

                  <div className="relative">
                    <select
                      value={filterTime}
                      onChange={(e) => setFilterTime(e.target.value)}
                      className="h-11 px-3 pr-8 rounded-lg bg-surface-container-low text-on-surface text-xs font-semibold appearance-none focus:outline-none cursor-pointer border border-surface-container-high"
                    >
                      <option>Last 1 Hour</option>
                      <option>Last 6 Hours</option>
                      <option>All Incident Life</option>
                    </select>
                    <span className="material-symbols-outlined pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-outline text-[18px]">
                      expand_more
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleExportGeoJson}
                  className="h-11 px-3 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs border border-surface-container-high cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">file_download</span>
                  <span>Export GeoJSON</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="h-11 px-3 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs border border-surface-container-high cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">table_chart</span>
                  <span>Report CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowBroadcastModal(true)}
                  className="h-11 px-4 rounded-lg bg-primary hover:bg-primary-container text-on-primary text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">broadcast_on_personal</span>
                  <span>Messaging unavailable</span>
                </button>
              </div>
            </div>

            {/* Split View Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter-desktop items-start">
              {/* LEFT PANEL: Synchronized Triage Queue */}
              <div className="lg:col-span-5 flex flex-col gap-space-sm">
                <div className="flex items-center justify-between px-space-xs mb-1">
                  <div className="flex items-center gap-space-xs">
                    <span className="text-sm font-bold text-on-surface">Responder Report Queue</span>
                    <span className="px-2 py-0.5 bg-surface-container-high text-on-surface-variant font-mono text-[11px] font-bold rounded">
                      {filteredIncidents.length} Items Focus
                    </span>
                  </div>
                  <span className="font-mono text-xs text-secondary">Manual refresh</span>
                </div>

                <div className="flex flex-col gap-space-sm max-h-[820px] overflow-y-auto pr-1">
                  {filteredIncidents.map(inc => {
                    const isSelected = inc.id === selectedIncidentId;
                    const isCrit = inc.urgency === 'Critical';
                    const isUrg = inc.urgency === 'Urgent';

                    return (
                      <div
                        key={inc.id}
                        onClick={() => setSelectedIncidentId(inc.id)}
                        className={`relative rounded-xl p-space-md cursor-pointer transition-all border ${
                          isSelected
                            ? 'bg-surface-container-lowest shadow-md ring-2 ring-primary border-primary'
                            : 'bg-surface-container-lowest shadow-xs hover:shadow-sm border-surface-container-high'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-space-xs mb-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold tracking-wider ${
                              isCrit
                                ? 'bg-error text-on-error'
                                : isUrg
                                ? 'bg-amber-500 text-white'
                                : 'bg-surface-container text-on-surface'
                            }`}>
                              {inc.urgency.toUpperCase()}
                            </span>
                            <span className="font-mono text-xs font-bold text-primary">{inc.id}</span>
                            <span className="text-secondary text-xs">| {inc.categories[0]}</span>
                          </div>
                          <span className="px-1.5 py-0.5 rounded bg-surface-container text-outline font-mono text-[10px] font-bold">
                            {apiConnected ? 'API REPORT' : 'DEMO RECORD'}
                          </span>
                        </div>

                        <h3 className="text-sm font-bold text-on-surface mb-1 leading-snug">
                          {inc.title}
                        </h3>

                        <div className="flex items-center gap-3 text-secondary text-xs mb-2">
                          <span className="flex items-center gap-0.5 truncate">
                            <span className="material-symbols-outlined text-[16px] text-outline">pin_drop</span>
                            <span className="truncate">{inc.location.street}</span>
                          </span>
                          {inc.waterDepth && (
                            <span className="flex items-center gap-0.5 font-mono text-xs text-error font-semibold shrink-0">
                              <span className="material-symbols-outlined text-[16px]">water_full</span>
                              <span>{inc.waterDepth}</span>
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between pt-1 bg-surface-container-low px-space-sm py-1.5 rounded-lg border border-surface-container">
                          <div className="flex items-center gap-2">
                            <span className="flex items-center gap-0.5 px-2 py-0.5 rounded bg-surface-container-high text-on-surface font-mono text-xs font-bold">
                              <span className="material-symbols-outlined text-[14px] text-primary">neurology</span>
                              <span>{inc.aiScore > 0 ? `Demo score ${inc.aiScore}` : `Priority ${inc.urgency}`}</span>
                            </span>
                            <span className="text-secondary font-mono text-[11px]">{inc.timeAgo}</span>
                          </div>
                          <span className="flex items-center gap-1 text-tertiary text-xs font-bold">
                            <span className="material-symbols-outlined text-[16px]">check_circle</span>
                            <span className="truncate max-w-[140px]">
                              {inc.assignedUnit ? `Assignment recorded (${inc.assignedUnit.split(' ')[0]})` : inc.status}
                            </span>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* RIGHT PANEL: Interactive Crisis Map & Detail Drawer */}
              <div className="lg:col-span-7 flex flex-col gap-space-lg">
                {/* Map */}
                <div className="relative bg-surface-container-lowest rounded-xl overflow-hidden shadow-xs border border-surface-container-high">
                  <div className="px-space-md py-space-sm bg-surface-container-low flex items-center justify-between border-b border-surface-container">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-[20px]">explore</span>
                      <span className="text-xs font-bold text-on-surface">
                        Geospatial Tactical Grid (12.97° N, 80.21° E)
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded bg-surface-container text-on-surface-variant font-mono text-[11px]">
                        Layer: Demo map preview (not live telemetry)
                      </span>
                      <button 
                        onClick={() =>                         triggerFeedback('Map is a static preview; no live map layer is connected.')}
                        className="p-1 rounded hover:bg-surface-container text-on-surface cursor-pointer" 
                        title="Recenter"
                      >
                        <span className="material-symbols-outlined text-[18px]">my_location</span>
                      </button>
                    </div>
                  </div>

                  <div 
                    className="relative w-full h-72 sm:h-80 bg-cover bg-center flex items-center justify-center" 
                    style={{ backgroundImage: `url('https://lh3.googleusercontent.com/aida-public/AB6AXuAz6bRNyEIXyoDqu-OS6ybK--Z0gm5KtTnkznbuRKbpEVpbMNVMLPauJafram2DMeccdNGKOVkO6JzXPP9OsK13fKOT43LCHiAxmpgdlQr61F50Ggj4UEYX-EuXBCPyOe2e_HZ2em2n8_eW9ilPZokD-W3Ym3FJ42Mqy4M7tOJJdrLNm3SFtbDFoGl8GRb3NMw0wNAYRfztlLk_2Iz8glo8SPhYJLjqmJtP73YSq8byhMve7VOw1H2_')` }}
                  >
                    <div 
                      onClick={() => setSelectedIncidentId('CL-8921')}
                      className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group cursor-pointer z-20"
                    >
                      <div className={`px-2 py-0.5 rounded bg-error text-on-error font-mono text-xs font-bold shadow-lg flex items-center gap-1 ring-2 ring-surface-container-lowest ${
                        selectedIncidentId === 'CL-8921' ? 'animate-bounce' : ''
                      }`}>
                        <span className="material-symbols-outlined text-[14px]">crisis_alert</span>
                        <span>CL-8921 [96%]</span>
                      </div>
                      <div className="w-3 h-3 bg-error rotate-45 -mt-1 ring-2 ring-surface-container-lowest"></div>
                    </div>

                    <div 
                      onClick={() => setSelectedIncidentId('CL-8919')}
                      className="absolute top-1/4 left-1/4 flex flex-col items-center cursor-pointer opacity-90 hover:opacity-100 z-10"
                    >
                      <div className="px-2 py-0.5 rounded bg-amber-500 text-white font-mono text-[11px] font-bold shadow-md flex items-center gap-1 ring-1 ring-surface-container-lowest">
                        <span>CL-8919</span>
                      </div>
                      <div className="w-2 h-2 bg-amber-500 rotate-45 -mt-0.5"></div>
                    </div>

                    <div className="absolute bottom-1/4 right-1/4 flex flex-col items-center cursor-pointer z-10">
                      <div className="px-2 py-0.5 rounded bg-primary text-on-primary font-mono text-[11px] font-semibold shadow-md flex items-center gap-1 ring-1 ring-surface-container-lowest">
                        <span className="material-symbols-outlined text-[12px]">home_repair_service</span>
                        <span>Staging Post B</span>
                      </div>
                      <div className="w-2 h-2 bg-primary rotate-45 -mt-0.5"></div>
                    </div>

                    <div className="absolute bottom-2 left-2 px-space-sm py-1 rounded bg-surface-container-lowest/90 backdrop-blur-xs font-mono text-[11px] text-on-surface shadow-xs flex items-center gap-space-md border border-surface-container-high">
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-error"></span>
                        <span>Water Depth &gt; 3.5ft</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-primary"></span>
                        <span>NDRF Boat Sector</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Selected Report Detail Drawer */}
                {activeIncident && (
                  <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col gap-space-md border border-surface-container-high">
                    <div className="flex flex-wrap items-center justify-between gap-space-sm pb-space-sm bg-surface-container-low px-space-md py-space-sm rounded-lg border border-surface-container">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-base sm:text-lg font-bold text-on-surface">Incident {activeIncident.id}</span>
                        <span className="px-2 py-0.5 rounded bg-error-container text-error font-mono text-xs font-bold uppercase">
                          DEMO RECORD
                        </span>
                        <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-900 text-xs font-semibold flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">visibility</span> {activeIncident.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 font-mono text-xs text-secondary font-bold">
                        <span>PRIORITY: CAT-1 LIFE CRITICAL</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
                      <div className="p-space-sm rounded-lg bg-surface-container-low flex flex-col gap-1 border border-surface-container">
                        <span className="text-[11px] text-secondary uppercase font-bold tracking-wider">Coordinates &amp; Anchor</span>
                        <div className="text-sm font-semibold text-on-surface flex items-center gap-1">
                          <span className="material-symbols-outlined text-[18px] text-error">fmd_bad</span>
                          <span>{activeIncident.location.street}</span>
                        </div>
                        <span className="font-mono text-xs text-on-surface-variant">
                          Approx GPS ±{activeIncident.location.accuracyMeters || 15}m | Landmark: {activeIncident.location.landmark}
                        </span>
                      </div>

                      <div className="p-space-sm rounded-lg bg-surface-container-low flex flex-col gap-1 border border-surface-container">
                        <span className="text-[11px] text-secondary uppercase font-bold tracking-wider">Temporal Origin</span>
                        <div className="text-sm font-semibold text-on-surface flex items-center gap-1">
                          <span className="material-symbols-outlined text-[18px] text-secondary">schedule</span>
                          <span>{activeIncident.timestamp}</span>
                        </div>
                        <span className="font-mono text-xs text-on-surface-variant">
                          {activeIncident.syncState === 'ReceivedServer'
                            ? 'CrisisLens API acknowledged this report'
                            : 'Saved locally; server acknowledgement pending'}
                        </span>
                      </div>
                    </div>

                    {activeIncident.requestMessage && (
                      <div className="rounded-lg border border-primary/20 bg-primary-fixed/40 p-4">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-on-primary-fixed">
                          Request message from report
                        </h3>
                        <p className="mt-2 whitespace-pre-wrap text-sm text-on-surface">
                          {activeIncident.requestMessage}
                        </p>
                        <p className="mt-2 text-xs text-on-surface-variant">
                          Stored by CrisisLens. This message was not sent to emergency services.
                        </p>
                      </div>
                    )}

                    {/* Ground Imagery */}
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[11px] text-secondary uppercase font-bold tracking-wider">
                        Ground Verification Imagery
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        <div className="relative rounded-lg overflow-hidden h-28 bg-surface-container-high border border-surface-container">
                          <img
                            className="w-full h-full object-cover"
                            alt="Terrace View"
                            src="https://lh3.googleusercontent.com/aida-public/AB6AXuBVL8zapLCvnyG13HJGn1SiB3tj0N_Tkj1YqDWNY3RhYenZoqPhyIz-Xz1P3GjK4dcNh4FWKCswwC_Pg-NPw27WBlYco3o6LkRNwNJY19yJ73lbAn7aglNWATkrqCwn3KPRgCBJFqlPml57d9k1hZs5UVD_c-jk1WemZ7KoMwnGluHk2KcSG_d6syVm5jPtZWwDhaQVFQBWBce6KCmP0fArKf8jBW3JlK2g5JLBRvmxRt_JJXjwSvNG"
                          />
                          <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-surface-container-lowest/90 text-on-surface font-mono text-[10px] font-bold">
                            Terrace View
                          </span>
                        </div>
                        <div className="relative rounded-lg overflow-hidden h-28 bg-surface-container-high border border-surface-container">
                          <img
                            className="w-full h-full object-cover"
                            alt="Gauge View"
                            src="https://lh3.googleusercontent.com/aida-public/AB6AXuCEoHWRHGWNl1IPlkOde55zUYM_U2dZ1SQHuej_KI3_lQMAO6pk1kpj35vKNwPEi28aFKwP7KEHNXkB2SJi-n-TrFWZakowg7Nyxl_dVZ9qDfGZtacZaUEws9Q5tP-z2gGvaYxlaf4ty_POpPdfGeuF_f7ACA-uxsffXSwsqX9STqUHvWtdqChoHwVP-Q_AXn-hTffjt9aTWd5zF4a79X4g8LCI2O6HJ-vfVBO0OJg9iL47bAVl4sPg"
                          />
                          <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-surface-container-lowest/90 text-on-surface font-mono text-[10px] font-bold">
                            Gauge: +4"/hr
                          </span>
                        </div>
                        <div className="relative rounded-lg overflow-hidden h-28 bg-surface-container-low border border-surface-container flex flex-col items-center justify-center p-2 text-center">
                          <span className="material-symbols-outlined text-primary text-[28px] mb-1">cell_tower</span>
                          <span className="font-mono text-xs text-on-surface font-bold">Cell CID: #440-20-891</span>
                          <span className="text-[11px] text-secondary">Tower triangulation valid</span>
                        </div>
                      </div>
                    </div>

                    {/* AI Priority Breakdown */}
                    <div className="p-space-md rounded-xl bg-surface-container-high flex flex-col gap-space-xs border border-surface-container-highest">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-space-xs">
                          <span className="material-symbols-outlined text-primary text-[20px]">psychology</span>
                          <span className="text-xs font-bold text-on-surface">Triage Suggestion &amp; Rationale</span>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-primary text-on-primary font-mono text-xs font-bold">
                          {activeIncident.aiScore > 0 ? `Demo score: ${activeIncident.aiScore}/100` : `Reporter priority: ${activeIncident.urgency}`}
                        </span>
                      </div>
                      <p className="text-xs text-on-surface leading-relaxed">
                        {activeIncident.aiRationale || 'No triage suggestion is available. A human responder must review the report.'}
                      </p>
                      <div className="flex items-center gap-2 mt-1 pt-1 bg-surface-container-lowest/60 px-space-sm py-1.5 rounded border border-surface-container">
                        <span className="material-symbols-outlined text-tertiary text-[18px]">verified</span>
                        <span className="text-xs text-on-surface">
                          Asset record: <strong className="text-primary font-bold">{activeIncident.recommendedAsset}</strong>
                        </span>
                      </div>
                    </div>

                    {/* Sync Pipeline Steps */}
                    <div className="flex flex-col gap-1">
                      <span className="text-[11px] text-secondary uppercase font-bold tracking-wider">
                        Report State (No Dispatch Integration)
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                        <div className="p-2.5 rounded-lg bg-surface-container-low flex flex-col gap-1 border border-surface-container">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-xs font-bold text-tertiary flex items-center gap-1">
                              <span className="material-symbols-outlined text-[14px]">save</span> Saved on Device
                            </span>
                            <span className="material-symbols-outlined text-[14px] text-tertiary">check_circle</span>
                          </div>
                          <span className="font-mono text-[11px] text-secondary">{apiConnected ? 'API report list loaded' : 'Demo/local data'}</span>
                          <span className="text-[10px] text-on-surface-variant">Browser data is not encrypted</span>
                        </div>

                        <div className="p-2.5 rounded-lg bg-surface-container-low flex flex-col gap-1 border border-surface-container">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-xs font-bold text-tertiary flex items-center gap-1">
                              <span className="material-symbols-outlined text-[14px]">cloud_done</span> API Acknowledgement
                            </span>
                            <span className={`material-symbols-outlined text-[14px] ${apiConnected && activeIncident.syncState === 'ReceivedServer' ? 'text-tertiary' : 'text-outline'}`}>
                              {apiConnected && activeIncident.syncState === 'ReceivedServer' ? 'check_circle' : 'help'}
                            </span>
                          </div>
                          <span className="font-mono text-[11px] text-secondary">
                            {apiConnected && activeIncident.syncState === 'ReceivedServer' ? 'Received' : 'Not confirmed'}
                          </span>
                          <span className="text-[10px] text-on-surface-variant">CrisisLens storage only</span>
                        </div>

                        <div className="p-2.5 rounded-lg bg-primary-container text-on-primary-container flex flex-col gap-1 ring-1 ring-primary shadow-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-xs font-bold flex items-center gap-1">
                              <span className="material-symbols-outlined text-[14px]">fact_check</span> Human Review
                            </span>
                            <span className="font-mono text-[10px] font-bold uppercase bg-white/20 px-1 rounded">
                              {apiConnected ? 'API' : 'LOCAL'}
                            </span>
                          </div>
                          <span className="font-mono text-[11px] opacity-90">
                            {apiConnected ? activeIncident.status : 'Not connected'}
                          </span>
                          <span className="text-[10px] opacity-80">Save requires responder authorization</span>
                        </div>

                        <div className="p-2.5 rounded-lg bg-surface-container-low flex flex-col gap-1 border border-surface-container opacity-80">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-xs font-bold text-secondary flex items-center gap-1">
                              <span className="material-symbols-outlined text-[14px]">local_shipping</span> Emergency Dispatch
                            </span>
                            <span className="material-symbols-outlined text-[14px] text-outline">hourglass_empty</span>
                          </div>
                          <span className="font-mono text-[11px] text-outline">Not available</span>
                          <span className="text-[10px] text-outline">Assignment is not dispatch</span>
                        </div>
                      </div>
                    </div>

                    {/* Dispatcher Actions */}
                    <div className="pt-2 flex flex-col gap-space-sm border-t border-surface-container">
                      <span className="text-[11px] text-secondary uppercase font-bold tracking-wider">
                        Responder Review Controls
                      </span>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-sm">
                        <div className="flex flex-col gap-1">
                          <label className="text-xs text-on-surface-variant font-semibold">
                            Record Optional Assignment (Does Not Dispatch)
                          </label>
                          <div className="relative">
                            <select
                              value={selectedAsset}
                              onChange={(e) => setSelectedAsset(e.target.value)}
                              className="w-full h-11 px-3 pr-8 rounded-lg bg-surface-container-low text-on-surface text-xs font-bold appearance-none focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer border border-surface-container-high"
                            >
                              <option value="">No assignment</option>
                              {fleetAssets.map(asset => (
                                <option key={asset.id} value={`${asset.name} (${asset.sector})`}>
                                  {asset.name} ({asset.sector})
                                </option>
                              ))}
                            </select>
                            <span className="material-symbols-outlined pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-outline">
                              expand_more
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-xs text-on-surface-variant font-semibold">
                            Update Review Status
                          </label>
                          <div className="relative">
                            <select
                              value={selectedStatus}
                              onChange={(e) => setSelectedStatus(e.target.value as IncidentStatus)}
                              className="w-full h-11 px-3 pr-8 rounded-lg bg-surface-container-low text-on-surface text-xs font-bold appearance-none focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer border border-surface-container-high"
                            >
                              <option value="Responder Verified (No Dispatch)" className="text-error font-bold">
                                Responder Verified (No Dispatch)
                              </option>
                              <option value="Rejected / Duplicate">
                                Rejected / Duplicate
                              </option>
                              <option value="Resolved (reviewer marked)">
                                Resolved (reviewer marked)
                              </option>
                            </select>
                            <span className="material-symbols-outlined pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-outline">
                              expand_more
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-space-sm pt-2">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setShowLogModal(true)}
                            className="h-11 px-3 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-surface-container-high"
                          >
                            <span className="material-symbols-outlined text-[18px]">edit_note</span>
                            <span>Add Tactical Log Note</span>
                          </button>

                          {activeIncident.contact.primary ? (
                            <a
                              href={`tel:${activeIncident.contact.primary.replace(/[^0-9+]/g, '')}`}
                              className="h-11 px-3 rounded-lg bg-surface-container hover:bg-surface-container-high text-primary text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-surface-container-high"
                            >
                              <span className="material-symbols-outlined text-[18px]">call</span>
                              <span>Call Safe Contact</span>
                            </a>
                          ) : (
                            <span className="text-xs text-on-surface-variant">No safe contact provided</span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={handleSaveReview}
                          disabled={isSavingReview}
                          className="h-11 px-space-lg rounded-lg bg-primary hover:bg-primary-container text-on-primary text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[18px]">{isSavingReview ? 'progress_activity' : 'save'}</span>
                          {isSavingReview ? 'Saving Review...' : 'Save Review & Assignment'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ----------------- SUBSYSTEM 2: GEO-CLUSTERS ----------------- */}
        {activeSubsystem === 'geo-clusters' && (
          <div className="flex flex-col gap-4">
            <div className="bg-surface-container-lowest p-6 rounded-xl shadow-xs border border-surface-container-high flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs uppercase text-primary font-bold">Subsystem 02</span>
                  <span className="text-outline">/</span>
                  <span className="text-xs font-bold text-on-surface">Spatial Aggregation Engine</span>
                </div>
                <h2 className="text-xl font-bold text-on-surface mt-1">
                  Active Hazard Geo-Clusters (4 Hotspots)
                </h2>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Clusters grouped by hydrological inundation contour and culvert isolation, minimizing individual rescue boat transit hops.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => triggerFeedback('Cluster dispatch beacons are not integrated. No transceivers were contacted.')}
                  className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-container text-on-primary text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">hub</span>
                  <span>Batch Sync Clusters</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                {
                  id: 'cluster-alpha',
                  name: 'Cluster Alpha: Velachery Sector 3 & Gandhi Road Basin',
                  incidentsCount: 18,
                  waterDepth: '1.3m (Rising +4"/hr)',
                  compositeScore: 96,
                  activeUnits: 'NDRF Boat Unit #3, Skiff #12',
                  primaryHazard: 'Severe rooftop structural isolation; 42 civilians trapped; elderly cardiac patients',
                  recommendedAction: 'Maintain Zodiac flotilla shuttle between Gandhi Road & Velachery Flyover camp.'
                },
                {
                  id: 'cluster-bravo',
                  name: 'Cluster Bravo: Madipakkam Lowlands & School Street',
                  incidentsCount: 12,
                  waterDepth: '1.1m (Standing)',
                  compositeScore: 91,
                  activeUnits: 'TNEB Grid Crew #2',
                  primaryHazard: 'Submerged pole transformers arcing into flooded alleys; electrocution danger',
                  recommendedAction: 'Coordinate isolation of 230V Feeder 4B before deploying rubber skiffs.'
                },
                {
                  id: 'cluster-charlie',
                  name: 'Cluster Charlie: Adyar River Delta & Saidapet Axis',
                  incidentsCount: 14,
                  waterDepth: '1.5m (Surging +15cm/hr)',
                  compositeScore: 94,
                  activeUnits: 'Army Amphibian #2',
                  primaryHazard: 'Culvert breaches near railway underpass; rapid storm surge draining from Chembarambakkam',
                  recommendedAction: 'Deploy high-freeboard amphibious carrier for deep-water extraction.'
                },
                {
                  id: 'cluster-delta',
                  name: 'Cluster Delta: Tambaram Axis & Mudichur Lake Bund',
                  incidentsCount: 8,
                  waterDepth: '0.9m (Stable)',
                  compositeScore: 85,
                  activeUnits: '108 ALS Ambulance #14, SDRF Crew #7',
                  primaryHazard: 'Perinatal labor cases, dialysis patients with spoiled medicine; power failure >24h',
                  recommendedAction: 'Priority medical extraction to Tambaram General Hospital.'
                }
              ].map(cl => (
                <div
                  key={cl.id}
                  className="bg-surface-container-lowest p-5 rounded-xl shadow-xs border border-surface-container-high flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-error-container text-error uppercase">
                        RISK INDEX: {cl.compositeScore}/100
                      </span>
                      <span className="font-mono text-xs font-bold text-primary">
                        {cl.incidentsCount} Distress Pings
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-on-surface mb-2 leading-snug">
                      {cl.name}
                    </h3>

                    <div className="p-3 bg-surface-container-low rounded-lg border border-surface-container flex flex-col gap-1 text-xs mb-3">
                      <div><strong className="text-on-surface">Hydrological Level:</strong> <span className="font-mono text-error font-bold">{cl.waterDepth}</span></div>
                      <div><strong className="text-on-surface">Primary Threat:</strong> <span className="text-on-surface-variant">{cl.primaryHazard}</span></div>
                      <div><strong className="text-on-surface">Active Units:</strong> <span className="text-tertiary font-semibold">{cl.activeUnits}</span></div>
                    </div>

                    <p className="text-xs text-on-surface-variant leading-relaxed mb-3">
                      <strong>Directive:</strong> {cl.recommendedAction}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-surface-container">
                    <button
                      onClick={() => {
                        setActiveSubsystem('incident-feeds');
                        setSearchQuery(cl.name.split(':')[1]?.trim() || '');
                      }}
                      className="text-xs text-primary font-bold hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <span>Filter Incident Feeds to Cluster</span>
                      <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                    </button>

                    <button
                      onClick={() => triggerFeedback('Dispatch is not integrated. No task force was contacted or deployed.')}
                      className="px-3 py-1.5 rounded-lg bg-surface-container text-on-surface text-xs font-bold uppercase transition-colors cursor-pointer border border-surface-container-high"
                    >
                      Dispatch unavailable
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ----------------- SUBSYSTEM 3: AI PRIORITY QUEUE ----------------- */}
        {activeSubsystem === 'ai-priority-queue' && (
          <div className="flex flex-col gap-4">
            <div className="bg-surface-container-lowest p-6 rounded-xl shadow-xs border border-surface-container-high flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs uppercase text-primary font-bold">Subsystem 03</span>
                  <span className="text-outline">/</span>
                  <span className="text-xs font-bold text-on-surface">Rule-Based Suggestions</span>
                </div>
                <h2 className="text-xl font-bold text-on-surface mt-1">
                  Priority Review Queue
                </h2>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Human review is required. Rule-based suggestions do not dispatch responders or claim model accuracy.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => triggerFeedback('Priority suggestions are stored with each report. No dispatch action was taken.')}
                  className="px-4 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-bold uppercase flex items-center gap-1.5 border border-surface-container-high cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">neurology</span>
                  <span>About Triage Suggestions</span>
                </button>
              </div>
            </div>

            {/* Ranked Queue Cards */}
            <div className="flex flex-col gap-3">
              {[...incidents].sort((a, b) => {
                const rank = { Critical: 0, Urgent: 1, Moderate: 2 };
                return rank[a.urgency] - rank[b.urgency];
              }).map((inc, rank) => (
                <div
                  key={inc.id}
                  className="bg-surface-container-lowest p-5 rounded-xl shadow-xs border border-surface-container-high flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-error-container text-error flex flex-col items-center justify-center font-mono font-bold shrink-0 border border-error/20">
                      <span className="text-[10px] leading-none uppercase">RANK</span>
                      <span className="text-lg leading-none mt-0.5">#{rank + 1}</span>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-mono text-xs font-bold text-primary">{inc.id}</span>
                        <span className="text-outline">·</span>
                        <span className="px-2 py-0.5 rounded font-mono text-[11px] font-bold bg-error text-on-error">
                          {inc.aiScore > 0 ? `DEMO SCORE ${inc.aiScore}/100` : `PRIORITY ${inc.urgency.toUpperCase()}`}
                        </span>
                        <span className="text-outline">·</span>
                        <span className="text-xs text-on-surface font-semibold">{inc.location.street}</span>
                      </div>

                      <h4 className="text-sm font-bold text-on-surface leading-snug">
                        {inc.title}
                      </h4>

                      <div className="p-2.5 rounded-lg bg-surface-container-low border border-surface-container text-xs text-on-surface-variant mt-2 max-w-3xl">
                        <strong className="text-on-surface">Explainable Attribution: </strong>
                        {inc.aiScoringAttribution || inc.aiRationale}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0 self-stretch md:self-auto justify-between">
                    <span className="font-mono text-xs text-tertiary font-bold">
                      {inc.assignedUnit ? `Assignment: ${inc.assignedUnit.split(' ')[0]} (no dispatch)` : 'No assignment recorded'}
                    </span>
                    <button
                      onClick={() => {
                        setSelectedIncidentId(inc.id);
                        setActiveSubsystem('incident-feeds');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-container text-on-primary text-xs font-bold uppercase transition-colors cursor-pointer"
                    >
                      Command Focus →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ----------------- SUBSYSTEM 4: MISINFORMATION VERIFICATION ----------------- */}
        {activeSubsystem === 'misinformation-verification' && (
          <div className="flex flex-col gap-4">
            <div className="bg-surface-container-lowest p-6 rounded-xl shadow-xs border border-surface-container-high flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs uppercase text-primary font-bold">Subsystem 04</span>
                  <span className="text-outline">/</span>
                  <span className="text-xs font-bold text-on-surface">Demo Claims</span>
                </div>
                <h2 className="text-xl font-bold text-on-surface mt-1">
                  Misinformation Review Queue
                </h2>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Claims in this panel are mock examples only. Use the Misinformation Queue for server-backed human reviews with evidence.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-4 py-2 rounded-lg bg-surface-container text-on-surface-variant text-xs font-bold uppercase">
                  Broadcast integration unavailable
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {rumorList.map(r => (
                <div key={r.id} className="bg-surface-container-lowest p-5 rounded-xl shadow-xs border border-surface-container-high flex flex-col md:flex-row items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold uppercase bg-amber-100 text-amber-900">
                        {r.status}
                      </span>
                      <span className="font-mono text-xs text-secondary font-bold">{r.id}</span>
                      <span className="text-xs text-on-surface-variant">· {r.location}</span>
                    </div>
                    <h3 className="text-sm font-bold text-on-surface mb-2">"{r.claim}"</h3>
                    <div className="p-2.5 bg-surface-container-low rounded-lg border border-surface-container text-xs">
                      <span className="font-bold text-on-surface block">Demo only — not verified:</span>
                      <span className="text-on-surface-variant">{r.officialFact}</span>
                    </div>
                  </div>

                  <div className="shrink-0 flex flex-col items-end gap-2">
                    <span className="font-mono text-xs text-on-surface-variant font-bold">Evidence review not recorded</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ----------------- SUBSYSTEM 5: DISPATCH LOGISTICS ----------------- */}
        {activeSubsystem === 'dispatch-logistics' && (
          <div className="flex flex-col gap-4">
            <div className="bg-surface-container-lowest p-6 rounded-xl shadow-xs border border-surface-container-high flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs uppercase text-primary font-bold">Subsystem 05</span>
                  <span className="text-outline">/</span>
                  <span className="text-xs font-bold text-on-surface">Field Asset Telemetry</span>
                </div>
                <h2 className="text-xl font-bold text-on-surface mt-1">
                  Demo Asset Placeholders
                </h2>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Sample data only; no real asset telemetry, fleet contact, or emergency dispatch is connected.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => triggerFeedback('Fleet telemetry is not integrated. No units were contacted.')}
                  className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-container text-on-primary text-xs font-bold uppercase cursor-pointer"
                >
                  Fleet telemetry unavailable
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {fleetAssets.map(asset => (
                <div key={asset.id} className="bg-surface-container-lowest p-5 rounded-xl shadow-xs border border-surface-container-high flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold uppercase ${
                        asset.status === 'En Route'
                          ? 'bg-primary-fixed text-on-primary-fixed font-bold'
                          : asset.status === 'On Scene'
                          ? 'bg-error-container text-error font-bold'
                          : 'bg-tertiary-fixed text-on-tertiary-fixed font-bold'
                      }`}>
                        {asset.status}
                      </span>
                      <span className="text-xs font-mono font-bold text-secondary">Crew: {asset.personnel} PPL</span>
                    </div>

                    <h3 className="text-sm font-bold text-on-surface mb-1">
                      {asset.name}
                    </h3>

                    <div className="text-xs text-secondary mb-3">
                      <span>Sector: <strong>{asset.sector}</strong></span> · <span>Cap: {asset.capacity}</span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-surface-container-low border border-surface-container flex flex-col gap-1 text-xs mb-3">
                      <span className="font-bold text-on-surface">On-Board Equipment:</span>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {asset.equipment.map((eq, i) => (
                          <span key={i} className="px-1.5 py-0.5 rounded bg-surface-container text-on-surface font-mono text-[10px]">
                            {eq}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-surface-container">
                    <button
                      onClick={() => {
                        const newStatus = asset.status === 'Available' ? 'En Route' : asset.status === 'En Route' ? 'On Scene' : 'Available';
                        setFleetAssets(fleetAssets.map(a => a.id === asset.id ? { ...a, status: newStatus } : a));
                        triggerFeedback(`Demo placeholder ${asset.name} changed locally to ${newStatus}. No live asset was updated.`);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-xs font-bold text-on-surface transition-colors cursor-pointer border border-surface-container-high"
                    >
                      Change Demo Status
                    </button>
                    <button
                      onClick={() => triggerFeedback('VHF communications are not integrated. No channel was opened.')}
                      className="text-xs text-primary font-bold hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[16px]">radio</span>
                      <span>VHF unavailable</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ----------------- SUBSYSTEM 6: AUDIT LOG ----------------- */}
        {activeSubsystem === 'audit-log' && (
          <div className="flex flex-col gap-4">
            <div className="bg-surface-container-lowest p-6 rounded-xl shadow-xs border border-surface-container-high flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs uppercase text-primary font-bold">Subsystem 06</span>
                  <span className="text-outline">/</span>
                  <span className="text-xs font-bold text-on-surface">Session Review Actions</span>
                </div>
                <h2 className="text-xl font-bold text-on-surface mt-1">
                  Responder Review Activity
                </h2>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Actions from this browser session only. The API stores the authoritative audit records; this view is not tamper-proof or a complete ledger.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const data = JSON.stringify(auditLogEntries, null, 2);
                    const blob = new Blob([data], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `crisislens_audit_manifest_${new Date().toISOString().slice(0, 10)}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                    triggerFeedback('Exported this browser session review view.');
                  }}
                  className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-container text-on-primary text-xs font-bold uppercase flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <span className="material-symbols-outlined text-[18px]">download</span>
                  <span>Export Session View</span>
                </button>
              </div>
            </div>

            {/* Audit Log Entries Table */}
            <div className="bg-surface-container-lowest rounded-xl shadow-xs border border-surface-container-high overflow-hidden">
              <div className="divide-y divide-surface-container">
                {auditLogEntries.map((entry) => (
                  <div key={entry.id} className="p-4 hover:bg-surface-container-low transition-colors flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span className="material-symbols-outlined text-primary text-[22px] shrink-0 mt-0.5">verified_user</span>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-mono text-xs font-bold text-on-surface">{entry.event}</span>
                          <span className="text-outline">·</span>
                          <span className="font-mono text-xs font-bold text-primary">{entry.incidentId}</span>
                        </div>
                        <p className="text-xs text-on-surface-variant leading-relaxed">
                          {entry.details}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 self-end md:self-auto text-xs text-on-surface-variant font-mono">
                      <span>{entry.operator}</span>
                      <span>·</span>
                      <span className="font-bold text-on-surface">{entry.timestamp}</span>
                    </div>
                  </div>
                ))}
                {auditLogEntries.length === 0 && (
                  <p className="p-5 text-sm text-on-surface-variant">
                    No responder review actions have been saved in this browser session.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Action Toast Feedback */}
      {actionFeedback && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div className="bg-inverse-surface text-inverse-on-surface px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 border border-white/10 text-xs font-semibold">
            <span className="material-symbols-outlined text-tertiary-fixed text-[20px]">check_circle</span>
            <span>{actionFeedback}</span>
          </div>
        </div>
      )}

      {/* Modal: Add Tactical Log Note */}
      {showLogModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-surface-container-lowest p-6 rounded-xl shadow-2xl max-w-md w-full border border-surface-container-high">
            <h3 className="text-base font-bold text-on-surface mb-2">Append Tactical Operational Note</h3>
            <p className="text-xs text-on-surface-variant mb-4">
              This internal note is stored by the CrisisLens API for report {activeIncident?.id}. It is not sent over radio.
            </p>
            <textarea
              rows={3}
              value={newLogNote}
              onChange={(e) => setNewLogNote(e.target.value)}
              placeholder="Message draft (not transmitted)"
              className="w-full bg-surface-container-low text-on-surface rounded-lg p-3 text-xs focus:ring-2 focus:ring-primary focus:outline-none mb-4 border border-surface-container-high"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowLogModal(false)}
                className="px-3 py-2 rounded-lg bg-surface-container text-xs font-semibold text-on-surface hover:bg-surface-container-high cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddNote}
                className="px-4 py-2 rounded-lg bg-primary text-xs font-bold text-on-primary hover:bg-primary-container cursor-pointer"
              >
                Save to Incident Log
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Broadcast Fleet Alert */}
      {showBroadcastModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-surface-container-lowest p-6 rounded-xl shadow-2xl max-w-md w-full border border-surface-container-high">
            <div className="flex items-center gap-2 text-error mb-2">
              <span className="material-symbols-outlined text-[24px]">broadcast_on_personal</span>
              <h3 className="text-base font-bold text-on-surface">Messaging Is Not Configured</h3>
            </div>
            <p className="text-xs text-on-surface-variant mb-4">
              No message will be sent. VHF, SMS, and encrypted broadcast integrations are not available in this build.
            </p>
            <textarea
              rows={3}
              value={broadcastMessage}
              onChange={(e) => setBroadcastMessage(e.target.value)}
              className="w-full bg-surface-container-low text-on-surface rounded-lg p-3 text-xs focus:ring-2 focus:ring-primary focus:outline-none mb-4 border border-surface-container-high"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowBroadcastModal(false)}
                className="px-3 py-2 rounded-lg bg-surface-container text-xs font-semibold text-on-surface hover:bg-surface-container-high cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowBroadcastModal(false);
                  setBroadcastMessage('');
                  triggerFeedback('Draft cleared. No message was sent.');
                }}
                className="px-4 py-2 rounded-lg bg-surface-container text-xs font-bold text-on-surface hover:bg-surface-container-high cursor-pointer"
              >
                Close Without Sending
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
