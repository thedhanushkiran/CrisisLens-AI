import React from 'react';
import { ActiveTab, Language } from '../types';
import { TRANSLATIONS } from '../data/mockData';

interface PublicPortalProps {
  setActiveTab: (tab: ActiveTab) => void;
  language: Language;
  onSelectIncidentForCommand?: (incidentId: string) => void;
}

export const PublicPortal: React.FC<PublicPortalProps> = ({
  setActiveTab,
  language,
}) => {
  const t = TRANSLATIONS[language];

  return (
    <div className="flex flex-col w-full">
      {/* Prototype Safety Banner (Critical Life-Safety Protocol) */}
      <section className="w-full bg-error-container text-on-error-container rounded-xl p-space-md shadow-sm mb-space-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-space-md border border-error/20">
        <div className="flex items-start gap-space-md">
          <div className="p-space-xs rounded-lg bg-error text-on-error shrink-0 mt-0.5 shadow-xs">
            <span className="material-symbols-outlined text-[24px]">emergency_home</span>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-space-xs flex-wrap">
              <span className="text-[11px] uppercase tracking-widest px-1.5 py-0.5 rounded bg-error text-on-error font-bold">
                Research Prototype
              </span>
              <span className="text-base md:text-headline-sm font-bold tracking-tight text-on-error-container">
                Not 911 / EMS Dispatch Service
              </span>
            </div>
            <p className="text-xs md:text-sm text-on-error-container/90 mt-1 leading-relaxed">
              <strong>PROTOTYPE DISCLAIMER:</strong> CrisisLens AI is an active research and decision-support prototype. It is <span className="underline decoration-error font-bold">NOT</span> an official emergency dispatch or national 911/112 replacement. In an active life-or-death emergency, contact official local emergency responders immediately.
            </p>
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-space-xs self-start md:self-center">
          <span className="font-mono text-xs uppercase px-space-sm py-1 rounded bg-surface text-error font-semibold shadow-2xs border border-error/20">
            Prototype interface
          </span>
        </div>
      </section>

      {/* Hero Grid Layout */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-gutter-desktop items-start mb-space-2xl">
        {/* Left Hero Column: Narrative & Action Primaries */}
        <div className="lg:col-span-7 flex flex-col space-y-space-lg pr-0 lg:pr-space-md">
          {/* Illustrative scenario, not live incident information */}
          <div className="inline-flex items-center gap-space-sm bg-surface-container-high text-on-surface px-space-md py-1.5 rounded-full w-fit shadow-xs">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-error opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-error"></span>
            </span>
            <span className="text-xs tracking-wider uppercase font-bold text-primary">Example Scenario</span>
            <span className="text-outline-variant font-mono text-xs">/</span>
            <span className="text-xs truncate max-w-[220px] sm:max-w-none">Illustrative interface preview</span>
            <span className="bg-tertiary text-on-tertiary px-1.5 py-0.5 rounded font-mono text-[10px] font-bold uppercase ml-1">
              Not live
            </span>
          </div>

          {/* Hero Heading */}
          <h1 className="text-3xl sm:text-4xl lg:text-[42px] font-bold tracking-tight text-on-surface text-balance leading-tight">
            When every second matters, <span className="text-primary underline decoration-primary-fixed-dim decoration-4 underline-offset-4">clarity saves time.</span>
          </h1>

          <p className="text-base sm:text-lg text-on-surface-variant max-w-2xl leading-relaxed">
            {t.heroSub}
          </p>

          {/* Action Triggers */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-space-md pt-space-xs">
            <button
              onClick={() => setActiveTab('emergency-report')}
              className="flex items-center justify-between sm:justify-center gap-space-md min-h-[52px] px-space-xl rounded-lg bg-error hover:bg-on-error-container text-on-error shadow-md transition-all group cursor-pointer"
            >
              <div className="flex items-center gap-space-sm">
                <span className="material-symbols-outlined text-[24px] group-hover:scale-110 transition-transform">
                  report_problem
                </span>
                <div className="flex flex-col text-left">
                  <span className="text-sm font-bold uppercase tracking-wider leading-none">
                    {t.submitReport}
                  </span>
                  <span className="font-mono text-xs opacity-90 leading-tight text-surface-bright mt-0.5">
                    {t.worksOffline}
                  </span>
                </div>
              </div>
              <span className="material-symbols-outlined text-[20px] sm:hidden">arrow_forward</span>
            </button>

            <button
              onClick={() => setActiveTab('responder-command')}
              className="flex items-center justify-center gap-space-sm min-h-[52px] px-space-xl rounded-lg bg-surface-container-lowest text-on-surface hover:bg-surface-container shadow-xs transition-colors border border-surface-container-high cursor-pointer font-semibold"
            >
              <span className="material-symbols-outlined text-[22px] text-primary">terminal</span>
              <span className="text-sm">{t.exploreCommand}</span>
              <span className="font-mono text-[10px] bg-surface-container-high text-primary px-1.5 py-0.5 rounded font-bold">
                DEMO
              </span>
            </button>
          </div>

          {/* Current implementation limits */}
          <div className="flex flex-wrap items-center gap-x-space-lg gap-y-space-xs pt-space-xs text-on-surface-variant">
            <div className="flex items-center gap-1.5 text-xs">
              <span className="material-symbols-outlined text-[16px] text-tertiary">offline_bolt</span>
              <span>Browser localStorage (not encrypted)</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="material-symbols-outlined text-[16px] text-tertiary">verified</span>
              <span>Rule-based triage suggestions</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="material-symbols-outlined text-[16px] text-tertiary">signal_cellular_alt</span>
              <span>Manual API sync; no mesh relay</span>
            </div>
          </div>
        </div>

        {/* Illustrative report and triage preview */}
        <div className="lg:col-span-5 flex flex-col mt-space-lg lg:mt-0">
          <div className="w-full bg-surface-container-lowest rounded-xl shadow-xl overflow-hidden relative border border-surface-container-high">
            {/* Top status strip */}
            <div className="bg-inverse-surface text-inverse-on-surface px-space-lg py-space-sm flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-error animate-pulse"></span>
                <span className="font-mono text-xs uppercase font-bold tracking-wider">
                  EXAMPLE REPORT • NOT LIVE
                </span>
              </div>
              <span className="font-mono text-xs text-secondary-fixed-dim">Illustrative only</span>
            </div>

            {/* Incident Card Body */}
            <div className="p-space-lg flex flex-col space-y-space-md">
              {/* Priority Callout & Score Ring */}
              <div className="flex items-center justify-between bg-error-container text-on-error-container p-space-md rounded-lg">
                <div className="flex items-center gap-space-sm">
                  <span className="material-symbols-outlined text-[26px] text-error">priority_high</span>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-error uppercase">EXAMPLE: CRITICAL SUGGESTION</span>
                    <span className="text-xs text-on-error-container/90">No live report or verification</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 bg-surface-container-lowest px-2.5 py-1 rounded shadow-xs text-on-surface">
                  <span className="text-xs font-bold text-error">RULE-BASED</span>
                </div>
              </div>

              {/* Situation Summary */}
              <div>
                <span className="text-[11px] uppercase tracking-wider text-on-surface-variant font-bold block">
                  Example Report Description
                </span>
                <h3 className="text-base font-bold text-on-surface mt-0.5 leading-snug">
                  Rescue Needed: Water level rising at 4th Cross St, 6 civilians trapped
                </h3>
                <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                  "Ground floor inundated up to chest height (approx 1.3m). Power lines collapsed nearby. Request inflatable Zodiac boat. Diabetic patient requires medication."
                </p>
              </div>

              {/* Geo & Sensor Badges */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-surface-container text-on-surface text-xs font-mono">
                  <span className="material-symbols-outlined text-[14px] text-primary">location_on</span>
                  Example coordinates (not consented report data)
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-surface-container text-on-surface text-xs font-mono">
                  <span className="material-symbols-outlined text-[14px] text-error">water</span>
                  Depth: +1.3m Rapid Rise
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-surface-container text-on-surface text-xs">
                  <span className="material-symbols-outlined text-[14px] text-tertiary">group</span>
                  6 Trapped (2 Elderly)
                </span>
              </div>

              {/* Honest Sync Pipeline Status Bar */}
              <div className="bg-surface-container-low p-space-md rounded-lg flex flex-col space-y-space-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase font-bold text-on-surface-variant">
                    Example Synchronization Path
                  </span>
                  <span className="font-mono text-xs font-semibold text-tertiary flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">info</span> Example only; not a live receipt
                  </span>
                </div>
                {/* Progression Visual */}
                <div className="flex items-center gap-2 pt-1">
                  <div className="flex-1 flex flex-col items-center">
                    <div className="h-1.5 w-full bg-surface-variant rounded-full"></div>
                    <span className="font-mono text-[10px] text-on-surface-variant mt-1">1. Browser storage</span>
                  </div>
                  <div className="w-3 text-center text-outline-variant font-mono text-xs">→</div>
                  <div className="flex-1 flex flex-col items-center">
                    <div className="h-1.5 w-full bg-surface-variant rounded-full"></div>
                    <span className="font-mono text-[10px] text-on-surface-variant mt-1">2. Manual sync</span>
                  </div>
                  <div className="w-3 text-center text-outline-variant font-mono text-xs">→</div>
                  <div className="flex-1 flex flex-col items-center">
                    <div className="h-1.5 w-full bg-surface-variant rounded-full"></div>
                    <span className="font-mono text-[10px] text-on-surface-variant font-bold mt-1">3. CrisisLens API only</span>
                  </div>
                </div>
              </div>

              {/* Micro AI Rationale Box */}
              <div className="bg-surface-variant/40 p-space-sm rounded-lg flex items-start gap-space-sm border border-primary/10">
                <span className="material-symbols-outlined text-[20px] text-primary shrink-0 mt-0.5">psychology</span>
                <div className="flex flex-col text-xs">
                  <span className="font-bold text-on-surface">Rule-based suggestion example:</span>
                  <span className="text-on-surface-variant text-balance mt-0.5">
                    +45 pts (Vulnerable demographics: elderly diabetic), +30 pts (Direct flood threat &gt;1m depth), +19 pts (Electrical hazard proximity).
                  </span>
                </div>
              </div>
            </div>

            {/* Footer of card */}
            <div className="bg-surface-container px-space-lg py-space-sm flex items-center justify-between text-on-surface-variant text-xs">
              <span>Assignment: <strong className="text-on-surface">None; no dispatch integration</strong></span>
              <button
                onClick={() => setActiveTab('crisis-map')}
                className="text-primary font-bold hover:underline inline-flex items-center gap-0.5 cursor-pointer"
              >
                Locate on Tactical Map →
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Operational metrics are intentionally not fabricated */}
      <section className="w-full bg-surface-container-lowest rounded-xl shadow-sm p-space-lg mb-space-2xl border border-surface-container-high">
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-space-md mb-space-md bg-surface-container-low px-space-md py-space-sm rounded-lg gap-space-sm">
          <div className="flex items-center gap-space-sm">
            <span className="w-2.5 h-2.5 rounded-full bg-tertiary"></span>
            <span className="text-xs uppercase tracking-wider text-on-surface font-bold">
              Operational Metrics
            </span>
          </div>
          <div className="font-mono text-xs text-on-surface-variant flex items-center gap-space-sm">
            <span>Live telemetry: <strong>Not connected</strong></span>
            <span>•</span>
            <span>Sync latency: <strong>Not measured</strong></span>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-gutter-desktop">
          {/* Metric 1 */}
          <div className="flex flex-col p-space-md bg-surface rounded-lg border border-surface-container-high/60">
            <div className="flex items-center justify-between text-on-surface-variant mb-space-xs">
              <span className="text-xs uppercase font-semibold">Live Report Count</span>
              <span className="material-symbols-outlined text-primary text-[20px]">edit_note</span>
            </div>
            <span className="text-2xl sm:text-3xl font-bold text-on-surface font-mono">Unavailable</span>
            <span className="font-mono text-xs text-on-surface-variant mt-1">No live aggregate dashboard is connected</span>
          </div>

          {/* Metric 2 */}
          <div className="flex flex-col p-space-md bg-surface rounded-lg border border-surface-container-high/60">
            <div className="flex items-center justify-between text-on-surface-variant mb-space-xs">
              <span className="text-xs uppercase font-semibold">Sync Reliability</span>
              <span className="material-symbols-outlined text-tertiary text-[20px]">sync_saved_locally</span>
            </div>
            <span className="text-2xl sm:text-3xl font-bold text-tertiary font-mono">Not measured</span>
            <span className="font-mono text-xs text-on-surface-variant mt-1">No reliability study has been run</span>
          </div>

          {/* Metric 3 */}
          <div className="flex flex-col p-space-md bg-surface rounded-lg border border-surface-container-high/60">
            <div className="flex items-center justify-between text-on-surface-variant mb-space-xs">
              <span className="text-xs uppercase font-semibold">Rescues Coordinated</span>
              <span className="material-symbols-outlined text-error text-[20px]">sailing</span>
            </div>
            <span className="text-2xl sm:text-3xl font-bold text-on-surface font-mono">Not tracked</span>
            <span className="font-mono text-xs text-on-surface-variant mt-1">No dispatch or outcome integration</span>
          </div>

          {/* Metric 4 */}
          <div className="flex flex-col p-space-md bg-surface rounded-lg border border-surface-container-high/60">
            <div className="flex items-center justify-between text-on-surface-variant mb-space-xs">
              <span className="text-xs uppercase font-semibold">Claims Independently Verified</span>
              <span className="material-symbols-outlined text-secondary text-[20px]">verified_user</span>
            </div>
            <span className="text-2xl sm:text-3xl font-bold text-on-surface font-mono">Not tracked</span>
            <span className="font-mono text-xs text-on-surface-variant mt-1">Human review workflow only</span>
          </div>
        </div>
      </section>

      {/* Visual Tactical Context Section: Situation Map Preview & Operational Dispatch Split */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-gutter-desktop mb-space-2xl items-stretch">
        {/* Map Canvas Integration */}
        <div className="lg:col-span-8 bg-surface-container-lowest rounded-xl shadow-sm p-space-lg flex flex-col justify-between border border-surface-container-high">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-space-md gap-space-sm">
            <div>
              <span className="text-xs uppercase tracking-wider text-primary font-bold">Illustrative Preview</span>
              <h2 className="text-lg md:text-xl font-bold text-on-surface">Static Map Image (Not Live Data)</h2>
            </div>
            <div className="flex items-center gap-space-xs flex-wrap">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-error-container text-on-error-container font-mono text-xs font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-error"></span> No hazard feed
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-tertiary-container text-on-tertiary font-mono text-xs font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-tertiary-fixed"></span> No shelter feed
              </span>
            </div>
          </div>

          {/* Static illustrative imagery; no map, sensor, or dispatch data is connected. */}
          <div 
            className="relative w-full h-80 rounded-lg overflow-hidden shadow-inner bg-cover bg-center" 
            style={{ backgroundImage: `url('https://lh3.googleusercontent.com/aida-public/AB6AXuAz6bRNyEIXyoDqu-OS6ybK--Z0gm5KtTnkznbuRKbpEVpbMNVMLPauJafram2DMeccdNGKOVkO6JzXPP9OsK13fKOT43LCHiAxmpgdlQr61F50Ggj4UEYX-EuXBCPyOe2e_HZ2em2n8_eW9ilPZokD-W3Ym3FJ42Mqy4M7tOJJdrLNm3SFtbDFoGl8GRb3NMw0wNAYRfztlLk_2Iz8glo8SPhYJLjqmJtP73YSq8byhMve7VOw1H2_')` }}
          >
            {/* Overlay HUD inside Map */}
            <div className="absolute top-3 left-3 bg-inverse-surface/90 text-inverse-on-surface backdrop-blur-xs p-space-sm rounded-lg shadow-md flex flex-col space-y-1 z-10 max-w-xs border border-white/10">
              <div className="flex items-center justify-between gap-space-md">
                <span className="text-[11px] uppercase tracking-wider text-secondary-fixed-dim font-bold">Cluster: Adyar River Delta</span>
                <span className="font-mono text-xs text-tertiary-fixed font-bold">GRID 44B</span>
              </div>
              <p className="text-xs text-inverse-on-surface/90 leading-tight">
                Demonstration overlay only; no live water-depth sensors are connected.
              </p>
            </div>

            {/* Tactical Pin Chip 1 */}
            <div className="absolute top-1/3 left-1/4 bg-error text-on-error px-2 py-1 rounded shadow-md flex items-center gap-1 z-10 ring-1 ring-white/50">
              <span className="material-symbols-outlined text-[14px]">crisis_alert</span>
              <span className="font-mono text-xs font-bold">SAMPLE REPORT</span>
            </div>

            {/* Tactical Pin Chip 2 */}
            <div className="absolute bottom-1/4 right-1/3 bg-tertiary text-on-tertiary px-2 py-1 rounded shadow-md flex items-center gap-1 z-10 ring-1 ring-white/50">
              <span className="material-symbols-outlined text-[14px]">shield</span>
              <span className="font-mono text-xs font-bold">SAMPLE SHELTER</span>
            </div>

            {/* Map bottom status strip */}
            <div className="absolute bottom-3 left-3 right-3 bg-surface-container-lowest/95 backdrop-blur-xs p-2 px-space-md rounded-lg shadow-sm flex items-center justify-between text-on-surface text-xs z-10 border border-surface-container-high">
              <div className="flex items-center gap-space-sm truncate mr-2">
                <span className="material-symbols-outlined text-[16px] text-primary shrink-0">satellite_alt</span>
                <span className="truncate">No live map or satellite data source configured</span>
              </div>
              <button
                onClick={() => setActiveTab('crisis-map')}
                className="text-primary font-bold hover:underline shrink-0 cursor-pointer"
              >
                Full Map Console →
              </button>
            </div>
          </div>
        </div>

        {/* Secondary Context Card: Rapid Report Snapshot */}
        <div className="lg:col-span-4 bg-surface-container-lowest rounded-xl shadow-sm p-space-lg flex flex-col justify-between border border-surface-container-high">
          <div className="flex flex-col space-y-space-xs">
            <span className="text-xs uppercase tracking-wider text-primary font-bold">Prototype Limits</span>
            <h3 className="text-lg md:text-xl font-bold text-on-surface">Current Implementation</h3>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Field workers and victims often face sub-zero battery reserves, cracked screens, and severe psychological distress.
            </p>

            {/* Fast feature bullets */}
            <div className="space-y-space-sm pt-space-sm">
              <div className="flex items-start gap-space-sm p-space-sm rounded-lg bg-surface-container-low border border-surface-container">
                <span className="material-symbols-outlined text-[22px] text-tertiary shrink-0 mt-0.5">touch_app</span>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-on-surface">Responsive Layout</span>
                  <span className="text-xs text-on-surface-variant">Field usability has not been evaluated.</span>
                </div>
              </div>

              <div className="flex items-start gap-space-sm p-space-sm rounded-lg bg-surface-container-low border border-surface-container">
                <span className="material-symbols-outlined text-[22px] text-primary shrink-0 mt-0.5">battery_charging_full</span>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-on-surface">Power Use Not Evaluated</span>
                  <span className="text-xs text-on-surface-variant">No battery or low-power performance testing has been performed.</span>
                </div>
              </div>

              <div className="flex items-start gap-space-sm p-space-sm rounded-lg bg-surface-container-low border border-surface-container">
                <span className="material-symbols-outlined text-[22px] text-secondary shrink-0 mt-0.5">translate</span>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-on-surface">Dual Tamil / English Script</span>
                  <span className="text-xs text-on-surface-variant">English and Tamil labels are available; field localization has not been evaluated.</span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-space-md">
            <button
              onClick={() => setActiveTab('emergency-report')}
              className="w-full flex items-center justify-center gap-space-xs py-3 rounded-lg bg-primary text-on-primary text-xs font-bold uppercase tracking-wider hover:bg-on-primary-fixed-variant transition-colors shadow cursor-pointer"
            >
              <span>Open Report Form</span>
              <span className="material-symbols-outlined text-[18px]">bolt</span>
            </button>
          </div>
        </div>
      </section>

      {/* Three Feature Pillars Section */}
      <section className="w-full mb-space-2xl">
        <div className="text-center max-w-3xl mx-auto mb-space-xl">
          <span className="text-xs uppercase tracking-widest text-primary font-bold">Prototype Capabilities</span>
          <h2 className="text-2xl md:text-3xl font-bold text-on-surface mt-1">Implemented Prototype Features</h2>
          <p className="text-sm text-on-surface-variant mt-2 leading-relaxed">
            Reports are stored in browser localStorage and can be synchronized manually to the API. Offline transport, field reliability, and emergency dispatch are not implemented.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter-desktop">
          {/* Pillar 1: Local report storage */}
          <div className="bg-surface-container-lowest rounded-xl p-space-xl shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow border border-surface-container-high">
            <div className="flex flex-col space-y-space-md">
              <div className="w-12 h-12 rounded-lg bg-surface-container-high text-primary flex items-center justify-center">
                <span className="material-symbols-outlined text-[24px]">cloud_off</span>
              </div>
              <div>
                <span className="font-mono text-xs uppercase tracking-wider text-primary font-bold">PILLAR 01</span>
                <h3 className="text-lg font-bold text-on-surface mt-1">Local Storage &amp; Manual Sync</h3>
              </div>
              <p className="text-sm text-on-surface-variant leading-relaxed">
                The open app can save a report in browser localStorage while disconnected. Reconnection does not trigger background sync; use Sync &amp; Offline Center to retry when the API is reachable.
              </p>
            </div>
            <div className="pt-space-lg mt-space-md bg-surface-container-low p-space-md rounded-lg flex items-center justify-between border border-surface-container">
              <div className="flex items-center gap-space-xs font-mono text-xs text-on-surface">
                <span className="material-symbols-outlined text-[16px] text-tertiary">check_circle</span>
                <span>Not encrypted; no zero-loss guarantee</span>
              </div>
              <button
                onClick={() => setActiveTab('sync-and-offline-center')}
                className="text-xs text-primary font-bold hover:underline cursor-pointer"
              >
                View Sync Engine →
              </button>
            </div>
          </div>

          {/* Pillar 2: Explainable rule-based suggestions */}
          <div className="bg-surface-container-lowest rounded-xl p-space-xl shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow border border-surface-container-high">
            <div className="flex flex-col space-y-space-md">
              <div className="w-12 h-12 rounded-lg bg-surface-container-high text-primary flex items-center justify-center">
                <span className="material-symbols-outlined text-[24px]">account_tree</span>
              </div>
              <div>
                <span className="font-mono text-xs uppercase tracking-wider text-primary font-bold">PILLAR 02</span>
                <h3 className="text-lg font-bold text-on-surface mt-1">Rule-Based Triage Suggestions</h3>
              </div>
              <p className="text-sm text-on-surface-variant leading-relaxed">
                A keyword-rule baseline returns a suggested priority, reasons, and uncertainty. It is not a trained model and does not make a human urgency decision or dispatch assets.
              </p>
            </div>
            <div className="pt-space-lg mt-space-md bg-surface-container-low p-space-md rounded-lg flex items-center justify-between border border-surface-container">
              <div className="flex items-center gap-space-xs font-mono text-xs text-on-surface">
                <span className="material-symbols-outlined text-[16px] text-tertiary">rule</span>
                <span>Separate from human decisions</span>
              </div>
              <button
                onClick={() => setActiveTab('responder-command')}
                className="text-xs text-primary font-bold hover:underline cursor-pointer"
              >
                Triage Console →
              </button>
            </div>
          </div>

          {/* Pillar 3: Combatting Disaster Misinformation */}
          <div className="bg-surface-container-lowest rounded-xl p-space-xl shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow border border-surface-container-high">
            <div className="flex flex-col space-y-space-md">
              <div className="w-12 h-12 rounded-lg bg-surface-container-high text-primary flex items-center justify-center">
                <span className="material-symbols-outlined text-[24px]">fact_check</span>
              </div>
              <div>
                <span className="font-mono text-xs uppercase tracking-wider text-primary font-bold">PILLAR 03</span>
                <h3 className="text-lg font-bold text-on-surface mt-1">Combatting Disaster Misinformation</h3>
              </div>
              <p className="text-sm text-on-surface-variant leading-relaxed">
                Reviewers can submit evidence and record corroborated or disputed claim decisions. No automated fact-checking or external source verification is performed.
              </p>
            </div>
            <div className="pt-space-lg mt-space-md bg-surface-container-low p-space-md rounded-lg flex items-center justify-between border border-surface-container">
              <div className="flex items-center gap-space-xs font-mono text-xs text-on-surface">
                <span className="material-symbols-outlined text-[16px] text-tertiary">security</span>
                <span>Fact-Check Desk</span>
              </div>
              <button
                onClick={() => setActiveTab('misinformation-queue')}
                className="text-xs text-primary font-bold hover:underline cursor-pointer"
              >
                Rumor Queue →
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Community Impact & Operational Visual Vignettes */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-gutter-desktop mb-space-2xl">
        {/* Visual card 1: Ground rescue deployment */}
        <div className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm flex flex-col border border-surface-container-high">
          <div className="h-56 w-full relative bg-surface-container">
            <img
              className="w-full h-full object-cover"
              loading="lazy"
              alt="Illustrative emergency response image; not a CrisisLens event or live dispatch."
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuDTHwLFAiWtOqKt5-UW-Iw3fLs3n8XmPLbnoN4EP1e-lnmVpZzlXQyFUxg9mg3KvsRK3gH_Zy6zw3swV_ZYB8TmFuSjClQ_QQVGiwVK07yyR02mvnBu9q6wR0mcaPsHbIOoX_2mnWD5crExsN744m_IT1t4S6eiDQRP1_WyCl__-FbXtLL4P5W4PTogEangyv_qFv4ZgP13298v3605iOszovA9cvH7iHChXHg_Vd4Kn7Yd-N0Z6tPN"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-inverse-surface/90 via-transparent to-transparent"></div>
            <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-surface-bright">
              <span className="text-xs font-bold uppercase tracking-wider">Illustrative Image</span>
              <span className="font-mono text-xs bg-inverse-surface/80 px-2 py-0.5 rounded border border-white/20">
                Not a live response
              </span>
            </div>
          </div>
          <div className="p-space-lg flex flex-col justify-between flex-1">
            <div>
              <h4 className="text-base font-bold text-on-surface">No Dispatch or Routing Integration</h4>
              <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                This prototype does not route rescuers, map live road closures, or coordinate victim rescues.
              </p>
            </div>
            <div className="mt-space-md pt-space-md bg-surface-container-low p-space-sm rounded-lg flex items-center justify-between text-on-surface font-mono text-xs border border-surface-container">
              <span>Response time data</span>
              <strong className="text-tertiary">Not available</strong>
            </div>
          </div>
        </div>

        {/* Visual card 2: Incident command center */}
        <div className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm flex flex-col border border-surface-container-high">
          <div className="h-56 w-full relative bg-surface-container">
            <img
              className="w-full h-full object-cover"
              loading="lazy"
              alt="Illustrative image of an emergency operations room; not connected to CrisisLens."
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuA9iIjpPW9qqDbGgeAMiu37e5q2sZVK--xVaRWS35ivo-W8dtjFB_Ld-5wjddp6NV6MA8Go2YxBJ56c7DQ3ocJAmZrZk5fm5kKg7ghhaGTlLQoD8Hxll1ejfEs66NmyduGq7Cz-xuMwEBEN8py6HzMkKNVInJtCEXmgtUROAxhXJFvpHfYoLZ4umZI7TrNZ0_0xO5SFKz0A6w-OhiHoYWQ0Pmfylwm355Bzc87ZeLpoXyJkwTEcEElr"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-inverse-surface/90 via-transparent to-transparent"></div>
            <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-surface-bright">
              <span className="text-xs font-bold uppercase tracking-wider">Illustrative Image</span>
              <span className="font-mono text-xs bg-inverse-surface/80 px-2 py-0.5 rounded border border-white/20">Not live</span>
            </div>
          </div>
          <div className="p-space-lg flex flex-col justify-between flex-1">
            <div>
              <h4 className="text-base font-bold text-on-surface">Responder Review Workflow</h4>
              <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                Authorized responders can review API reports, record assignments, and add internal notes. No external response center is connected.
              </p>
            </div>
            <div className="mt-space-md pt-space-md bg-surface-container-low p-space-sm rounded-lg flex items-center justify-between text-on-surface font-mono text-xs border border-surface-container">
              <span>Model accuracy</span>
              <strong className="text-primary">Not measured</strong>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom CTA & Bilingual Field Banner */}
      <section className="w-full bg-inverse-surface text-inverse-on-surface rounded-xl p-space-xl shadow-lg relative overflow-hidden mb-space-xl">
        <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-space-xl">
          <div className="flex flex-col space-y-space-sm max-w-2xl text-center lg:text-left">
            <div className="inline-flex items-center justify-center lg:justify-start gap-space-xs font-mono text-xs uppercase tracking-widest text-tertiary-fixed font-bold">
              <span className="material-symbols-outlined text-[16px]">public</span>
              <span>Prototype Availability</span>
            </div>
            <h3 className="text-2xl sm:text-3xl font-bold text-surface-bright">
              Available in English and தமிழ் (Tamil)
            </h3>
            <p className="text-sm text-inverse-on-surface/90 leading-relaxed">
              English and Tamil interface labels are available. Offline app launch, field reliability, emergency-center integration, and dispatch have not been implemented or evaluated.
            </p>
            {/* Script Preview Pill */}
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-space-sm pt-space-xs">
              <div className="px-space-md py-1 rounded bg-surface/10 text-surface-bright text-xs flex items-center gap-space-xs border border-white/10">
                <span className="text-tertiary-fixed font-bold">✓</span>
                <span>அவசர அறிக்கை பதிவு (Emergency Report)</span>
              </div>
              <div className="px-space-md py-1 rounded bg-surface/10 text-surface-bright text-xs flex items-center gap-space-xs border border-white/10">
                <span className="text-tertiary-fixed font-bold">✓</span>
                <span>செயல்பாட்டு மாதிரி (Prototype Interface)</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row lg:flex-col shrink-0 gap-space-md w-full sm:w-auto">
            <button
              onClick={() => setActiveTab('emergency-report')}
              className="flex items-center justify-center gap-space-sm px-space-2xl min-h-[48px] rounded-lg bg-error hover:bg-on-error-container text-on-error text-xs font-bold uppercase tracking-wider shadow-md transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">campaign</span>
              <span>Submit Urgent Report</span>
            </button>
            <button
              onClick={() => setActiveTab('sync-and-offline-center')}
              className="flex items-center justify-center gap-space-sm px-space-xl min-h-[48px] rounded-lg bg-surface/10 hover:bg-surface/20 text-inverse-on-surface text-xs font-semibold transition-colors border border-white/10 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">cloud_sync</span>
              <span>Open Sync &amp; Offline Center</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
