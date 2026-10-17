import React, { Suspense, lazy, useState, useEffect } from 'react';
import { ActiveTab, Language, Incident, NotificationItem } from './types';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { NotificationModal } from './components/NotificationModal';
import type { AccountProfile } from './services/apiService';
import { clearAccountSession, getAccountToken, getCurrentAccount } from './services/apiService';
import { StorageService } from './services/storageService';
import { INITIAL_NOTIFICATIONS } from './data/mockData';

const PublicPortal = lazy(() => import('./views/PublicPortal').then(module => ({ default: module.PublicPortal })));
const EmergencyReport = lazy(() => import('./views/EmergencyReport').then(module => ({ default: module.EmergencyReport })));
const ResponderCommand = lazy(() => import('./views/ResponderCommand').then(module => ({ default: module.ResponderCommand })));
const CrisisMap = lazy(() => import('./views/CrisisMap').then(module => ({ default: module.CrisisMap })));
const MisinformationQueue = lazy(() => import('./views/MisinformationQueue').then(module => ({ default: module.MisinformationQueue })));
const SyncOfflineCenter = lazy(() => import('./views/SyncOfflineCenter').then(module => ({ default: module.SyncOfflineCenter })));
const AccountDialog = lazy(() => import('./components/AccountDialog').then(module => ({ default: module.AccountDialog })));

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('public-portal');
  const [isOffline, setIsOffline] = useState(false);
  const [language, setLanguage] = useState<Language>('en');
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string>('CL-8921');
  const [account, setAccount] = useState<AccountProfile | null>(null);
  const [showAccountDialog, setShowAccountDialog] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);

  // Load incidents from storage
  useEffect(() => {
    const data = StorageService.getIncidents();
    setIncidents(data);
  }, []);

  useEffect(() => {
    if (!getAccountToken()) return;
    let active = true;
    getCurrentAccount().then((user) => {
      if (active) setAccount(user);
    }).catch((error: unknown) => {
      clearAccountSession();
      if (active) {
        setAccount(null);
        setAccountError(error instanceof Error ? error.message : 'Your account session has expired. Sign in again.');
      }
    });
    return () => { active = false; };
  }, []);

  const handleIncidentSubmitted = (newIncident: Incident) => {
    setIncidents(prev => [newIncident, ...prev.filter(incident => incident.id !== newIncident.id)]);
    setSelectedIncidentId(newIncident.id);
  };

  const handleServerReportsLoaded = (serverIncidents: Incident[]) => {
    setIncidents(prev => {
      const serverIds = new Set(serverIncidents.map(incident => incident.id));
      return [...serverIncidents, ...prev.filter(incident => !serverIds.has(incident.id))];
    });
  };

  const handleUpdateIncident = (id: string, updates: Partial<Incident>) => {
    const updated = StorageService.updateIncidentStatus(id, updates);
    if (updated) {
      setIncidents(prev => prev.map(inc => inc.id === id ? { ...inc, ...updates } : inc));
    }
  };

  const handleSelectIncidentFromMap = (id: string) => {
    setSelectedIncidentId(id);
    setActiveTab('responder-command');
  };

  const handleMarkAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, unread: false })));
  };

  const unreadCount = notifications.filter(n => n.unread).length;

  return (
    <div className="min-h-screen bg-surface flex flex-col font-body-md text-body-md text-on-surface antialiased">
      {/* Universal Fixed Top Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isOffline={isOffline}
        setIsOffline={setIsOffline}
        language={language}
        setLanguage={setLanguage}
        unreadCount={unreadCount}
        onOpenNotifications={() => setShowNotificationModal(true)}
        account={account}
        onOpenAccount={() => setShowAccountDialog(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 w-full pt-[96px] pb-14 px-3 sm:px-6 md:px-margin-desktop">
        <Suspense fallback={
          <div className="min-h-[50vh] flex items-center justify-center" role="status">
            <span className="text-sm text-on-surface-variant">Loading this section…</span>
          </div>
        }>
        {activeTab === 'public-portal' && (
          <PublicPortal
            setActiveTab={setActiveTab}
            language={language}
          />
        )}

        {activeTab === 'emergency-report' && (
          <EmergencyReport
            isOffline={isOffline}
            account={account}
            onOpenAccount={() => setShowAccountDialog(true)}
            onIncidentSubmitted={handleIncidentSubmitted}
          />
        )}

        {activeTab === 'responder-command' && (
          <ResponderCommand
            incidents={incidents}
            onUpdateIncident={handleUpdateIncident}
            selectedIncidentId={selectedIncidentId}
            onSelectIncidentId={setSelectedIncidentId}
            onServerReportsLoaded={handleServerReportsLoaded}
          />
        )}

        {activeTab === 'crisis-map' && (
          <CrisisMap
            incidents={incidents}
            onSelectIncident={handleSelectIncidentFromMap}
          />
        )}

        {activeTab === 'misinformation-queue' && (
          <MisinformationQueue />
        )}

        {activeTab === 'sync-and-offline-center' && (
          <SyncOfflineCenter
            isOffline={isOffline}
            setIsOffline={setIsOffline}
            onSyncCompleted={() => {
              setIncidents(StorageService.getIncidents());
            }}
          />
        )}
        </Suspense>
      </main>

      {/* Universal Footer */}
      <Footer />

      {/* Notifications Popover Modal */}
      <NotificationModal
        isOpen={showNotificationModal}
        onClose={() => setShowNotificationModal(false)}
        notifications={notifications}
        onMarkAllRead={handleMarkAllRead}
        onSelectNotification={(notif) => {
          setShowNotificationModal(false);
          setActiveTab('responder-command');
        }}
      />

      {showAccountDialog && (
        <Suspense fallback={null}>
          <AccountDialog
            account={account}
            initialError={accountError}
            onClose={() => setShowAccountDialog(false)}
            onAuthenticated={(user) => {
              setAccount(user);
              setAccountError(null);
              setShowAccountDialog(false);
            }}
            onLoggedOut={() => {
              setAccount(null);
              setShowAccountDialog(false);
            }}
          />
        </Suspense>
      )}
    </div>
  );
}
