import React, { useState } from 'react';
import { ActiveTab, Language } from '../types';
import { TRANSLATIONS } from '../data/mockData';
import type { AccountProfile } from '../services/apiService';

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  isOffline: boolean;
  setIsOffline: (offline: boolean) => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  unreadCount: number;
  onOpenNotifications: () => void;
  account: AccountProfile | null;
  onOpenAccount: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  isOffline,
  setIsOffline,
  language,
  setLanguage,
  unreadCount,
  onOpenNotifications,
  account,
  onOpenAccount,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const t = TRANSLATIONS[language];

  const navLinks: { id: ActiveTab; label: string }[] = [
    { id: 'public-portal', label: t.publicPortal },
    { id: 'emergency-report', label: t.emergencyReport },
    { id: 'responder-command', label: t.responderCommand },
    { id: 'crisis-map', label: t.crisisMap },
    { id: 'misinformation-queue', label: t.misinformationQueue },
    { id: 'sync-and-offline-center', label: t.syncCenter },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-surface shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
      {/* Top operational ticker banner */}
      <div className={`h-7 px-4 md:px-margin-desktop flex items-center justify-between text-xs tracking-wider transition-colors ${
        isOffline ? 'bg-amber-800 text-amber-50' : 'bg-surface-container-high text-on-surface'
      }`}>
        <div className="flex items-center gap-space-sm truncate">
          <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${
            isOffline ? 'bg-amber-300' : 'bg-outline'
          }`}></span>
          <span className="uppercase font-bold tracking-widest text-[11px]">
            {isOffline ? 'SIMULATED OFFLINE' : t.online}
          </span>
          <span className="opacity-80 hidden md:inline truncate text-[11px]">
            — {t.lastSync}
          </span>
        </div>

        <div className="flex items-center gap-3 sm:gap-space-lg shrink-0">
          <button
            onClick={() => setIsOffline(!isOffline)}
            className="px-2 py-0.5 rounded bg-tertiary-container hover:opacity-90 text-on-tertiary text-[11px] font-mono uppercase font-semibold cursor-pointer transition-opacity"
            type="button"
          >
            {isOffline ? t.simulateOnline : t.simulateOffline}
          </button>
          <div className="flex items-center gap-1 text-[11px]">
            <button
              onClick={() => setLanguage('en')}
              className={`cursor-pointer transition-colors ${language === 'en' ? 'font-bold underline text-white' : 'opacity-80 hover:opacity-100'}`}
            >
              English
            </button>
            <span className="opacity-60">|</span>
            <button
              onClick={() => setLanguage('ta')}
              className={`cursor-pointer transition-colors ${language === 'ta' ? 'font-bold underline text-white' : 'opacity-80 hover:opacity-100'}`}
            >
              தமிழ்
            </button>
          </div>
        </div>
      </div>

      {/* Main Navigation Row */}
      <div className="h-16 px-4 md:px-margin-desktop flex items-center justify-between bg-surface-container-lowest">
        <div className="flex items-center gap-3 md:gap-space-lg">
          {/* Logo brand lockup */}
          <div 
            onClick={() => setActiveTab('public-portal')}
            className="flex items-center gap-2 sm:gap-space-md cursor-pointer select-none"
          >
            <img 
              alt="CrisisLens AI Logo" 
              className="h-8 w-auto object-contain" 
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuCsMPJPAG3jw1tZE27yot2-Ym2FYOfd5BIWMUrfP4DdPgvIE7X5wE3yV38HXOEThOprAJ2guD5ih61uOAkqG5-x5KDf5eEdSGOJTZbgxC0JCFN_wz_AGuz98LzjP-peJ89QR88WIMi1pwJlgrK52-aLP5YaBeuLz_gEbS4meqZrkaHZZEXiXXGp2hmoY5GN6EeqiUJ2jYevnQyJULSCiiMQtBe1-G4NTeB5Dnyg0vDlNNEbLM9sNxGP"
              onError={(e) => {
                // Fallback icon if URL fails
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            <div className="flex flex-col">
              <span className="text-base sm:text-lg font-bold tracking-tight text-on-surface uppercase leading-none">
                {t.appName}
              </span>
              <span className="text-[10px] sm:text-label-sm text-error bg-error-container px-1 py-0.2 rounded leading-tight inline-block w-fit font-bold mt-0.5">
                {t.prototypeNotice}
              </span>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden xl:flex items-center gap-1 ml-space-md">
            {navLinks.map((link) => {
              const isActive = activeTab === link.id;
              return (
                <button
                  key={link.id}
                  onClick={() => setActiveTab(link.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-surface-container-high text-primary font-bold shadow-xs'
                      : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
                  }`}
                >
                  {link.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right CTA and Actions */}
        <div className="flex items-center gap-2 sm:gap-space-md">
          <button
            type="button"
            onClick={onOpenAccount}
            className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-surface-container-high px-2 sm:px-3 text-xs font-bold text-on-surface hover:bg-surface-container"
          >
            <span className="material-symbols-outlined text-[18px]">account_circle</span>
            <span className="max-w-24 truncate">{account?.display_name || 'Sign in'}</span>
          </button>

          {/* Urgent Report Button */}
          <button
            onClick={() => setActiveTab('emergency-report')}
            className="inline-flex items-center justify-center min-h-[40px] sm:min-h-[44px] px-3 sm:px-space-lg rounded-lg bg-error hover:bg-on-error-container text-on-error text-xs sm:text-sm font-bold uppercase tracking-wider shadow-sm transition-all cursor-pointer hover:shadow"
          >
            <span className="material-symbols-outlined text-[18px] mr-1 hidden sm:inline">campaign</span>
            {t.reportEmergency}
          </button>

          {/* Notifications Button */}
          <button
            onClick={onOpenNotifications}
            aria-label="Notifications"
            className="relative p-2 rounded-lg hover:bg-surface-container text-on-surface transition-colors cursor-pointer"
            type="button"
          >
            <span className="material-symbols-outlined text-[22px]">notifications</span>
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-error text-on-error font-mono text-[10px] font-bold flex items-center justify-center leading-none">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Profile Badge */}
          <div className="flex items-center gap-2 pl-1 sm:pl-space-sm border-l border-outline-variant/30">
            <img
              alt="Profile"
              className="w-8 h-8 rounded-full object-cover border border-outline-variant"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuCPbY-ocNOOZadat0QZUWBo_SZI27DUmAdTyTst8U5R6Ehz9qCl5zVe9zrFfVNvki43uQ7t0R1-uI6PHmnQsTzABnIvGMlfiITNSbFsh92ImesIinoUmZT5ZeYek-zb3_QL3EGMrKYkPoPeQtLjnowWQPiAjG-7EJDAv7W52cxctyiPnK1Wj_gnDIcJgrXBwDley5y3QdVbDO4sCAetbSkoMV5i7mrXSaURKnVAWtKMANX48S_rK015"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="%23004ac6"><circle cx="12" cy="8" r="4"/><path d="M20 19v1a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6z"/></svg>';
              }}
            />
            <div className="hidden lg:flex flex-col text-left">
              <span className="text-xs font-semibold text-on-surface leading-tight">Local User</span>
              <span className="text-[10px] text-on-surface-variant leading-tight">Prototype account</span>
            </div>
          </div>

          {/* Mobile Menu Hamburger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="xl:hidden p-2 rounded-lg text-on-surface hover:bg-surface-container cursor-pointer"
            aria-label="Toggle navigation menu"
          >
            <span className="material-symbols-outlined text-[24px]">
              {mobileMenuOpen ? 'close' : 'menu'}
            </span>
          </button>
        </div>
      </div>

      {/* Mobile Drawer Dropdown */}
      {mobileMenuOpen && (
        <div className="xl:hidden bg-surface-container-lowest border-b border-surface-container-high px-4 py-3 shadow-lg flex flex-col gap-1">
          {navLinks.map((link) => {
            const isActive = activeTab === link.id;
            return (
              <button
                key={link.id}
                onClick={() => {
                  setActiveTab(link.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors flex items-center justify-between cursor-pointer ${
                  isActive
                    ? 'bg-surface-container-high text-primary font-bold'
                    : 'text-on-surface hover:bg-surface-container-low'
                }`}
              >
                <span>{link.label}</span>
                {isActive && <span className="material-symbols-outlined text-[18px]">chevron_right</span>}
              </button>
            );
          })}
        </div>
      )}
    </header>
  );
};
