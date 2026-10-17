import React, { useState } from 'react';
import { StorageService } from '../services/storageService';
import { syncReports } from '../services/apiService';

interface SyncOfflineCenterProps {
  isOffline: boolean;
  setIsOffline: (offline: boolean) => void;
  onSyncCompleted?: () => void;
}

export const SyncOfflineCenter: React.FC<SyncOfflineCenterProps> = ({
  isOffline,
  setIsOffline,
  onSyncCompleted,
}) => {
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [syncFailed, setSyncFailed] = useState(false);
  const [queue, setQueue] = useState(() => StorageService.getOfflineQueue());

  const handleManualSync = async () => {
    if (isOffline) {
      setSyncFailed(true);
      setSyncResult('Offline mode is enabled. Reports remain saved on this device.');
      return;
    }
    if (!queue.length) {
      setSyncFailed(false);
      setSyncResult('No pending reports to synchronize.');
      return;
    }
    setSyncing(true);
    setSyncResult(null);
    try {
      const acknowledgements = await syncReports(queue);
      const received = acknowledgements
        .filter(item => item.status === 'accepted' || item.status === 'duplicate')
        .map(item => item.client_id)
        .filter((id): id is string => Boolean(id));
      StorageService.markReportsSynced(received);
      setQueue(StorageService.getOfflineQueue());
      const invalid = acknowledgements.filter(item => item.status === 'invalid').length;
      const retryable = acknowledgements.filter(item => item.status === 'retryable_failure').length;
      setSyncFailed(invalid + retryable > 0);
      setSyncResult(
        `CrisisLens API acknowledged ${received.length} report(s). ${invalid} invalid; ${retryable} retryable failure(s). An API acknowledgement is not emergency-services delivery.`
      );
      if (onSyncCompleted) onSyncCompleted();
    } catch (error) {
      setSyncFailed(true);
      setSyncResult(error instanceof Error ? error.message : 'Could not synchronize reports. They remain queued.');
    } finally {
      setSyncing(false);
    }
  };

  const handleExportGeoJson = () => {
    const data = StorageService.exportGeoJson();
    const blob = new Blob([data], { type: 'application/geo+json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `crisislens_offline_dump_${new Date().toISOString().slice(0, 10)}.geojson`;
    a.click();
    URL.revokeObjectURL(url);
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
  };

  return (
    <div className="flex flex-col w-full max-w-6xl mx-auto gap-space-xl">
      {/* Top Header */}
      <div className="bg-surface-container-lowest p-6 rounded-xl shadow-xs border border-surface-container-high flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-surface-container-high text-primary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[28px]">cloud_sync</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs uppercase text-primary font-bold">Local Queue</span>
              <span className="text-outline">/</span>
              <span className="text-xs text-on-surface-variant font-mono">Manual Synchronization</span>
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-on-surface mt-0.5">
              Sync &amp; Offline Command Center
            </h1>
            <p className="text-xs md:text-sm text-on-surface-variant mt-1 max-w-2xl leading-relaxed">
              Reports are saved to this browser's localStorage and remain queued until the API acknowledges them. This prototype does not provide mesh relays or encrypted local storage.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsOffline(!isOffline)}
            className={`px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer transition-colors ${
              isOffline
                ? 'bg-amber-600 text-white hover:bg-amber-700'
                : 'bg-surface-container hover:bg-surface-container-high text-on-surface border border-surface-container-high'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">
              {isOffline ? 'wifi_off' : 'wifi'}
            </span>
            <span>{isOffline ? 'Simulation: Offline' : 'Simulation: Online'}</span>
          </button>
        </div>
      </div>

      {/* Storage Breakdown Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface-container-lowest p-5 rounded-xl shadow-xs border border-surface-container-high flex flex-col justify-between">
          <span className="text-xs text-secondary font-bold uppercase">Local Report Queue</span>
          <div className="flex items-baseline gap-2 my-2">
            <span className="text-3xl font-bold text-on-surface font-mono">{queue.length}</span>
            <span className="text-sm text-secondary font-bold">reports</span>
          </div>
          <span className="text-xs text-on-surface-variant font-medium">Stored in browser localStorage (not encrypted)</span>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-xl shadow-xs border border-surface-container-high flex flex-col justify-between">
          <span className="text-xs text-secondary font-bold uppercase">Pending Sync Queue</span>
          <div className="flex items-baseline gap-2 my-2">
            <span className="text-3xl font-bold text-error font-mono">{queue.length}</span>
            <span className="text-sm text-secondary font-bold">Records</span>
          </div>
          <span className="text-xs text-on-surface-variant font-mono">Manual API synchronization only</span>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-xl shadow-xs border border-surface-container-high flex flex-col justify-between">
          <span className="text-xs text-secondary font-bold uppercase">Cached Vector Map Tiles</span>
          <div className="flex items-baseline gap-2 my-2">
            <span className="text-3xl font-bold text-on-surface font-mono">Not</span>
            <span className="text-sm text-secondary font-bold">configured</span>
          </div>
          <span className="text-xs text-secondary font-mono">No offline map tile provider</span>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-xl shadow-xs border border-surface-container-high flex flex-col justify-between">
          <span className="text-xs text-secondary font-bold uppercase">Mesh Peer Ad-Hoc Nodes</span>
          <div className="flex items-baseline gap-2 my-2">
            <span className="text-3xl font-bold text-primary font-mono">Not</span>
            <span className="text-sm text-secondary font-bold">available</span>
          </div>
          <span className="text-xs text-secondary font-medium">No peer-to-peer relay integration</span>
        </div>
      </div>

      {/* Manual Action & Synchronize Toolbar */}
      <div className="bg-surface-container-lowest p-6 rounded-xl shadow-xs border border-surface-container-high flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-on-surface">Deterministic Network Synchronization</h3>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Send pending report records to the CrisisLens API and retain any unacknowledged items for retry.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportGeoJson}
            className="px-3 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-xs font-bold text-on-surface flex items-center gap-1.5 transition-colors cursor-pointer border border-surface-container-high"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            <span>Export Full GeoJSON</span>
          </button>
          <button
            onClick={handleExportCsv}
            className="px-3 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-xs font-bold text-on-surface flex items-center gap-1.5 transition-colors cursor-pointer border border-surface-container-high"
          >
            <span className="material-symbols-outlined text-[18px]">table_chart</span>
            <span>Report CSV</span>
          </button>
          <button
            onClick={handleManualSync}
            disabled={syncing || !queue.length}
            className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-container text-xs font-bold uppercase tracking-wider text-on-primary flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">
              {syncing ? 'progress_activity' : 'sync'}
            </span>
            <span>{syncing ? 'Synchronizing...' : 'Sync Pending Reports'}</span>
          </button>
        </div>
      </div>

      {syncResult && (
        <div className={`p-4 rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs ${
          syncFailed
            ? 'bg-error-container border border-error/30 text-on-error-container'
            : 'bg-tertiary-container/15 border border-tertiary/30 text-tertiary'
        }`}>
          <span className="material-symbols-outlined text-[20px]">{syncFailed ? 'error' : 'check_circle'}</span>
          <span>{syncResult}</span>
        </div>
      )}

      {/* Peer Mesh Nodes Topology */}
      <div className="bg-surface-container-lowest p-6 rounded-xl shadow-xs border border-surface-container-high">
        <h3 className="text-sm font-bold text-on-surface mb-1 flex items-center gap-2">
          <span className="material-symbols-outlined text-secondary text-[20px]">hub</span>
          <span>Peer Mesh Relay Integration</span>
        </h3>
        <p className="text-xs text-on-surface-variant mb-4">
          Not implemented. Reports synchronize only when this browser can reach the configured CrisisLens API.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="md:col-span-2 p-3 bg-surface-container-low rounded-lg border border-surface-container flex items-center gap-3">
            <span className="material-symbols-outlined text-secondary text-[22px]">info</span>
            <span className="text-xs text-on-surface-variant">No Bluetooth, Wi-Fi Direct, VHF, or satellite transport is connected in this build.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
