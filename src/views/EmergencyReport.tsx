import React, { useState } from 'react';
import { IncidentCategory, UrgencyLevel, Incident } from '../types';
import { StorageService, computeSha256 } from '../services/storageService';
import { TriageService } from '../services/triageService';
import { AccountProfile, syncReports } from '../services/apiService';

interface EmergencyReportProps {
  onIncidentSubmitted?: (incident: Incident) => void;
  isOffline: boolean;
  account: AccountProfile | null;
  onOpenAccount: () => void;
}

export const EmergencyReport: React.FC<EmergencyReportProps> = ({
  onIncidentSubmitted,
  isOffline,
  account,
  onOpenAccount,
}) => {
  // Form State
  const [categories, setCategories] = useState<IncidentCategory[]>(['Rescue']);
  const [urgency, setUrgency] = useState<UrgencyLevel>('Moderate');
  const [situationText, setSituationText] = useState('');
  const [requestMessage, setRequestMessage] = useState('');
  const [locationStreet, setLocationStreet] = useState('');
  const [landmarkDetails, setLandmarkDetails] = useState('');
  const [contactPrimary, setContactPrimary] = useState('');
  const [contactAlt, setContactAlt] = useState('');
  const [gpsCoordinates, setGpsCoordinates] = useState('');
  const [gpsAccuracyMeters, setGpsAccuracyMeters] = useState<number | null>(null);
  const [coordinatesConsented, setCoordinatesConsented] = useState(false);
  
  // Real-time Receipt State
  const [incidentId, setIncidentId] = useState('Not submitted');
  const [shaDigest, setShaDigest] = useState('—');
  const [timestampStr, setTimestampStr] = useState('—');
  const [copiedReceipt, setCopiedReceipt] = useState(false);

  // Submission & UI States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [serverConfirmed, setServerConfirmed] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [isAnalyzingAI, setIsAnalyzingAI] = useState(false);

  // Category Toggle
  const toggleCategory = (cat: IncidentCategory) => {
    let updated: IncidentCategory[];
    if (categories.includes(cat)) {
      if (categories.length === 1) return; // keep at least one
      updated = categories.filter(c => c !== cat);
    } else {
      updated = [...categories, cat];
    }
    setCategories(updated);
    updateHash(situationText, updated);
  };

  // Re-pin Coordinates
  const refreshCoordinates = () => {
    if (!navigator.geolocation) {
      triggerToast('This browser does not provide device geolocation.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const latitudeDirection = coords.latitude < 0 ? 'S' : 'N';
        const longitudeDirection = coords.longitude < 0 ? 'W' : 'E';
        setGpsCoordinates(
          `${Math.abs(coords.latitude).toFixed(6)}° ${latitudeDirection}, ${Math.abs(coords.longitude).toFixed(6)}° ${longitudeDirection}`
        );
        setGpsAccuracyMeters(coords.accuracy);
        triggerToast('Coordinates captured from this device. They are not shared unless you consent.');
      },
      (error) => triggerToast(`Unable to capture coordinates: ${error.message}`),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  };

  // Quick fill templates
  const insertTemplate = (text: string) => {
    setSituationText(text);
    updateHash(text, categories);
  };

  // Update hash dynamically
  const updateHash = async (text: string, cats: IncidentCategory[]) => {
    const hash = await computeSha256(text + cats.join(',') + locationStreet);
    setShaDigest(hash);
  };

  // Trigger Toast
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  // Copy receipt
  const handleCopyReceipt = () => {
    navigator.clipboard.writeText(`CrisisLens ID: ${incidentId} | Hash: ${shaDigest} | GPS: ${gpsCoordinates}`);
    setCopiedReceipt(true);
    setTimeout(() => setCopiedReceipt(false), 2000);
  };

  // Rule-based priority suggestion
  const handleRunAiTriage = async () => {
    setIsAnalyzingAI(true);
    try {
      const result = await TriageService.analyzeTriage(situationText, categories, isOffline);
      triggerToast(
        `Rule-based suggestion: ${result.suggestedPriority}. ${result.reasons.join('; ')}. Uncertainty: ${result.uncertainty}. Human review required.`
      );
    } finally {
      setIsAnalyzingAI(false);
    }
  };

  // Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!situationText.trim() || !locationStreet.trim()) return;

    setIsSubmitting(true);

    try {
      const aiResult = await TriageService.analyzeTriage(situationText, categories, isOffline);

      const generatedId = `CL-${crypto.randomUUID()}`;
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' IST';
      const newHash = await computeSha256(situationText + generatedId + locationStreet);
      const coordinateParts = /(-?\d+(?:\.\d+)?)°?\s*([NS])\s*,\s*(-?\d+(?:\.\d+)?)°?\s*([EW])/i.exec(gpsCoordinates);
      const latitude = coordinateParts
        ? Number(coordinateParts[1]) * (coordinateParts[2].toUpperCase() === 'S' ? -1 : 1)
        : 0;
      const longitude = coordinateParts
        ? Number(coordinateParts[3]) * (coordinateParts[4].toUpperCase() === 'W' ? -1 : 1)
        : 0;
      const reportCoordinatesConsented = coordinatesConsented && coordinateParts !== null;

      setIncidentId(generatedId);
      setShaDigest(newHash);
      setTimestampStr(timeStr);
      setServerConfirmed(false);

      const newIncident: Incident = {
        id: generatedId,
        title: `${locationStreet.split(',')[0] || 'Urgent Evacuation'}: ${situationText.substring(0, 70)}...`,
        description: situationText,
        requestMessage: requestMessage.trim() || undefined,
        categories: categories,
        urgency: urgency,
        aiScore: 0,
        aiConfidence: 0,
        aiTriggers: aiResult.reasons,
        aiRationale: `Rule-based suggestion: ${aiResult.suggestedPriority}. ${aiResult.reasons.join('; ')}. Uncertainty: ${aiResult.uncertainty}. Human review is required.`,
        recommendedAsset: 'No asset assigned; no emergency-services dispatch integration',
        location: {
          street: locationStreet,
          landmark: landmarkDetails,
          lat: reportCoordinatesConsented ? latitude : 0,
          lng: reportCoordinatesConsented ? longitude : 0,
          sector: 'Chennai South - Sector 3',
          accuracyMeters: reportCoordinatesConsented ? gpsAccuracyMeters ?? undefined : undefined,
          coordinatesConsented: reportCoordinatesConsented,
        },
        coordinatesConsented: reportCoordinatesConsented,
        contact: {
          primary: contactPrimary,
          alternate: contactAlt,
        },
        timestamp: `${now.toDateString()} — ${timeStr}`,
        timeAgo: 'Just now',
        syncState: 'SavedDevice',
        assignedUnit: null,
        status: 'Under Review',
        groundImages: [],
        sha256Digest: newHash,
        trappedCount: 0,
        vulnerableCount: 0,
        notes: [
          {
            id: 'note-0',
            author: 'CrisisLens Local Shield',
            timestamp: timeStr,
            text: 'Saved to browser local storage. This local copy is not encrypted.'
          }
        ]
      };

      StorageService.saveIncident(newIncident);
      onIncidentSubmitted?.(newIncident);

      setSubmitSuccess(true);
      if (isOffline) {
        triggerToast(`Report ${generatedId} saved on this device and queued; it has not reached the server.`);
      } else {
        try {
          const acknowledgements = await syncReports([newIncident]);
          const acknowledgement = acknowledgements[0];
          if (acknowledgement?.status === 'accepted' || acknowledgement?.status === 'duplicate') {
            StorageService.markReportsSynced([generatedId]);
            const confirmedIncident = { ...newIncident, syncState: 'ReceivedServer' as const };
            StorageService.updateIncidentStatus(generatedId, { syncState: 'ReceivedServer' });
            onIncidentSubmitted?.(confirmedIncident);
            setServerConfirmed(true);
            triggerToast(`CrisisLens API acknowledged ${generatedId}. This is not an emergency-services delivery receipt.`);
          } else {
            triggerToast(`Report ${generatedId} is saved locally and pending sync: ${acknowledgement?.message || 'retry required'}`);
          }
        } catch (error) {
          triggerToast(error instanceof Error
            ? `Report ${generatedId} is saved locally and pending sync. ${error.message}`
            : `Report ${generatedId} is saved locally and pending sync.`);
        }
      }
    } catch (error) {
      triggerToast(error instanceof Error ? error.message : 'Unable to save this report on the device.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col w-full relative">
      {/* Persistent Offline Status Ribbon */}
      <div className="w-full bg-surface-container-high rounded-xl p-space-md shadow-xs mb-space-xl border border-surface-container-highest">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md">
          <div className="flex items-start md:items-center gap-space-md">
            <div className="w-10 h-10 rounded-lg bg-surface-container-lowest flex items-center justify-center shrink-0 shadow-xs text-error border border-error/10">
              <span className="material-symbols-outlined text-[24px]">{serverConfirmed ? 'cloud_done' : 'cloud_off'}</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`inline-block w-2.5 h-2.5 rounded-full ${serverConfirmed ? 'bg-tertiary' : 'bg-amber-500'}`}></span>
                <span className="text-base sm:text-headline-sm font-bold text-on-surface">
                  {serverConfirmed ? 'CrisisLens API Acknowledged' : isOffline ? 'Offline — Report Queue Active' : 'Local-First Report Storage'}
                </span>
              </div>
              <p className="text-xs text-on-surface-variant mt-0.5 leading-relaxed">
              Reports are first stored in this browser's local storage, which is not encrypted. Server acknowledgement means CrisisLens stored the report; it does not contact emergency services.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-space-sm shrink-0 bg-surface-container-lowest px-space-md py-1.5 rounded-lg border border-surface-container-high">
            <span className="material-symbols-outlined text-primary text-[18px]">{serverConfirmed ? 'cloud_done' : 'storage'}</span>
            <span className="font-mono text-xs text-on-surface font-semibold">{serverConfirmed ? 'Server acknowledgement received' : 'Browser localStorage — not encrypted'}</span>
          </div>
        </div>
      </div>

      {/* Operational Context Advisory */}
      <div className="mb-space-xl p-space-md bg-error-container text-on-error-container rounded-xl flex items-start gap-space-md shadow-xs border border-error/20">
        <span className="material-symbols-outlined text-[24px] text-error shrink-0 mt-0.5">emergency</span>
        <div className="flex-1">
          <span className="text-xs uppercase tracking-wide font-bold block">Notice for High-Stakes Operations</span>
          <p className="text-xs mt-0.5 opacity-90 leading-relaxed">
            Submitting this form logs your incident to the District Incident Commander's triage queue. Responders deploy by severity scoring and spatial routing. 
            <strong> This interface does not trigger an immediate 911 siren dispatch.</strong> If cellular voice works, immediately attempt 112 / 911.
          </p>
        </div>
      </div>

      {/* Main Multi-Step Tactical Form Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-xl items-start">
        {/* Left / Center: Interactive Step Flow Form */}
        <div className="lg:col-span-8 flex flex-col gap-space-xl">
          <form className="flex flex-col gap-space-xl" onSubmit={handleSubmit}>
            {/* STEP 1: Incident Category Selection */}
            <section className="bg-surface-container-lowest p-5 sm:p-space-xl rounded-xl shadow-xs border border-surface-container-high">
              <div className="flex items-center justify-between mb-space-md">
                <div className="flex items-center gap-space-sm">
                  <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed uppercase font-bold">
                    Step 01
                  </span>
                  <h2 className="text-base sm:text-lg font-bold text-on-surface">Emergency Need Category</h2>
                </div>
                <span className="text-[11px] text-error bg-error-container px-2 py-0.5 rounded uppercase font-bold">
                  Required
                </span>
              </div>
              <p className="text-xs text-on-surface-variant mb-space-lg">
                Select the primary condition endangering life or safety. Multi-selection permitted for complex hazard zones.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-space-md">
                {/* 1. Rescue */}
                <div
                  onClick={() => toggleCategory('Rescue')}
                  className={`relative flex flex-col p-space-md rounded-xl cursor-pointer transition-all select-none border ${
                    categories.includes('Rescue')
                      ? 'bg-surface-container-high border-primary ring-2 ring-primary shadow-xs'
                      : 'bg-surface-container-low border-transparent hover:bg-surface-container'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-space-sm">
                    <span className="material-symbols-outlined text-primary text-[28px]">scuba_diving</span>
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center font-mono text-[11px] ${
                      categories.includes('Rescue') ? 'bg-primary text-on-primary font-bold' : 'bg-surface-variant text-on-surface-variant opacity-40'
                    }`}>
                      {categories.includes('Rescue') ? '✓' : '○'}
                    </span>
                  </div>
                  <span className="text-sm text-on-surface font-bold">Rescue Evacuation</span>
                  <span className="text-xs text-on-surface-variant mt-1 leading-snug">
                    Water rescue, terrace trapped, structural isolation
                  </span>
                </div>

                {/* 2. Medical */}
                <div
                  onClick={() => toggleCategory('Medical')}
                  className={`relative flex flex-col p-space-md rounded-xl cursor-pointer transition-all select-none border ${
                    categories.includes('Medical')
                      ? 'bg-surface-container-high border-primary ring-2 ring-primary shadow-xs'
                      : 'bg-surface-container-low border-transparent hover:bg-surface-container'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-space-sm">
                    <span className="material-symbols-outlined text-error text-[28px]">vital_signs</span>
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center font-mono text-[11px] ${
                      categories.includes('Medical') ? 'bg-primary text-on-primary font-bold' : 'bg-surface-variant text-on-surface-variant opacity-40'
                    }`}>
                      {categories.includes('Medical') ? '✓' : '○'}
                    </span>
                  </div>
                  <span className="text-sm text-on-surface font-bold">Critical Medical</span>
                  <span className="text-xs text-on-surface-variant mt-1 leading-snug">
                    Severe injury, dialysis, oxygen needed, labor
                  </span>
                </div>

                {/* 3. Food & Water */}
                <div
                  onClick={() => toggleCategory('FoodWater')}
                  className={`relative flex flex-col p-space-md rounded-xl cursor-pointer transition-all select-none border ${
                    categories.includes('FoodWater')
                      ? 'bg-surface-container-high border-primary ring-2 ring-primary shadow-xs'
                      : 'bg-surface-container-low border-transparent hover:bg-surface-container'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-space-sm">
                    <span className="material-symbols-outlined text-tertiary text-[28px]">water_drop</span>
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center font-mono text-[11px] ${
                      categories.includes('FoodWater') ? 'bg-primary text-on-primary font-bold' : 'bg-surface-variant text-on-surface-variant opacity-40'
                    }`}>
                      {categories.includes('FoodWater') ? '✓' : '○'}
                    </span>
                  </div>
                  <span className="text-sm text-on-surface font-bold">Food &amp; Drinking Water</span>
                  <span className="text-xs text-on-surface-variant mt-1 leading-snug">
                    Potable reserves gone &gt;24 hrs, infant formula
                  </span>
                </div>

                {/* 4. Shelter */}
                <div
                  onClick={() => toggleCategory('Shelter')}
                  className={`relative flex flex-col p-space-md rounded-xl cursor-pointer transition-all select-none border ${
                    categories.includes('Shelter')
                      ? 'bg-surface-container-high border-primary ring-2 ring-primary shadow-xs'
                      : 'bg-surface-container-low border-transparent hover:bg-surface-container'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-space-sm">
                    <span className="material-symbols-outlined text-secondary text-[28px]">roofing</span>
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center font-mono text-[11px] ${
                      categories.includes('Shelter') ? 'bg-primary text-on-primary font-bold' : 'bg-surface-variant text-on-surface-variant opacity-40'
                    }`}>
                      {categories.includes('Shelter') ? '✓' : '○'}
                    </span>
                  </div>
                  <span className="text-sm text-on-surface font-bold">Shelter Collapse</span>
                  <span className="text-xs text-on-surface-variant mt-1 leading-snug">
                    Roof ripped, landslide risk, flooded living room
                  </span>
                </div>

                {/* 5. Missing */}
                <div
                  onClick={() => toggleCategory('Missing')}
                  className={`relative flex flex-col p-space-md rounded-xl cursor-pointer transition-all select-none border ${
                    categories.includes('Missing')
                      ? 'bg-surface-container-high border-primary ring-2 ring-primary shadow-xs'
                      : 'bg-surface-container-low border-transparent hover:bg-surface-container'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-space-sm">
                    <span className="material-symbols-outlined text-on-surface-variant text-[28px]">person_search</span>
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center font-mono text-[11px] ${
                      categories.includes('Missing') ? 'bg-primary text-on-primary font-bold' : 'bg-surface-variant text-on-surface-variant opacity-40'
                    }`}>
                      {categories.includes('Missing') ? '✓' : '○'}
                    </span>
                  </div>
                  <span className="text-sm text-on-surface font-bold">Missing Individuals</span>
                  <span className="text-xs text-on-surface-variant mt-1 leading-snug">
                    Separated family, elder lost in surge, coords
                  </span>
                </div>

                {/* 6. Hazard */}
                <div
                  onClick={() => toggleCategory('Hazard')}
                  className={`relative flex flex-col p-space-md rounded-xl cursor-pointer transition-all select-none border ${
                    categories.includes('Hazard')
                      ? 'bg-surface-container-high border-primary ring-2 ring-primary shadow-xs'
                      : 'bg-surface-container-low border-transparent hover:bg-surface-container'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-space-sm">
                    <span className="material-symbols-outlined text-error text-[28px]">bolt</span>
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center font-mono text-[11px] ${
                      categories.includes('Hazard') ? 'bg-primary text-on-primary font-bold' : 'bg-surface-variant text-on-surface-variant opacity-40'
                    }`}>
                      {categories.includes('Hazard') ? '✓' : '○'}
                    </span>
                  </div>
                  <span className="text-sm text-on-surface font-bold">Hazardous Incident</span>
                  <span className="text-xs text-on-surface-variant mt-1 leading-snug">
                    Live dangling electric cables, toxic gas, dam burst
                  </span>
                </div>
              </div>
            </section>

            {/* STEP 2: Urgency Level & Triage Classification */}
            <section className="bg-surface-container-lowest p-5 sm:p-space-xl rounded-xl shadow-xs border border-surface-container-high">
              <div className="flex items-center justify-between mb-space-md">
                <div className="flex items-center gap-space-sm">
                  <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed uppercase font-bold">
                    Step 02
                  </span>
                  <h2 className="text-base sm:text-lg font-bold text-on-surface">Urgency &amp; Life Threat Level</h2>
                </div>
                <span className="text-[11px] text-error bg-error-container px-2 py-0.5 rounded uppercase font-bold">
                  Required
                </span>
              </div>
              <p className="text-xs text-on-surface-variant mb-space-lg">
                Helps algorithm and human incident commanders sequence life-flight and Zodiac boat drops.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md">
                {/* Critical */}
                <div
                  onClick={() => setUrgency('Critical')}
                  className={`flex flex-col p-space-md rounded-xl cursor-pointer transition-all border ${
                    urgency === 'Critical'
                      ? 'bg-error-container text-on-error-container border-error ring-2 ring-error shadow-xs'
                      : 'bg-surface-container-low text-on-surface border-transparent hover:bg-surface-container'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold uppercase text-error">Tier 1: Critical</span>
                    <span className="material-symbols-outlined text-error text-[20px]">warning</span>
                  </div>
                  <p className="text-xs leading-relaxed opacity-90">
                    Immediate physical threat to life within 0–4 hours. Active immersion, heavy bleeding, shock.
                  </p>
                </div>

                {/* Urgent */}
                <div
                  onClick={() => setUrgency('Urgent')}
                  className={`flex flex-col p-space-md rounded-xl cursor-pointer transition-all border ${
                    urgency === 'Urgent'
                      ? 'bg-secondary-container text-on-secondary-container border-secondary ring-2 ring-secondary shadow-xs'
                      : 'bg-surface-container-low text-on-surface border-transparent hover:bg-surface-container'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold uppercase text-on-surface">Tier 2: Urgent</span>
                    <span className="material-symbols-outlined text-on-surface-variant text-[20px]">schedule</span>
                  </div>
                  <p className="text-xs leading-relaxed text-on-surface-variant">
                    Conditions deteriorating rapidly. Resources failing within 12 hours. High vulnerability.
                  </p>
                </div>

                {/* Stable */}
                <div
                  onClick={() => setUrgency('Moderate')}
                  className={`flex flex-col p-space-md rounded-xl cursor-pointer transition-all border ${
                    urgency === 'Moderate'
                      ? 'bg-surface-container-high text-on-surface border-tertiary ring-2 ring-tertiary shadow-xs'
                      : 'bg-surface-container-low text-on-surface border-transparent hover:bg-surface-container'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold uppercase text-on-surface">Tier 3: Stable</span>
                    <span className="material-symbols-outlined text-tertiary text-[20px]">shield</span>
                  </div>
                  <p className="text-xs leading-relaxed text-on-surface-variant">
                    Sheltered, dry, but stranded without egress. Essential needs required within 24–48 hours.
                  </p>
                </div>
              </div>
            </section>

            {/* STEP 3: Situation Intelligence */}
            <section className="bg-surface-container-lowest p-5 sm:p-space-xl rounded-xl shadow-xs border border-surface-container-high">
              <div className="flex items-center justify-between mb-space-md">
                <div className="flex items-center gap-space-sm">
                  <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed uppercase font-bold">
                    Step 03
                  </span>
                  <h2 className="text-base sm:text-lg font-bold text-on-surface">Ground Situation Narrative</h2>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleRunAiTriage}
                    disabled={isAnalyzingAI}
                    className="text-xs text-primary font-bold hover:underline flex items-center gap-1 cursor-pointer bg-primary-fixed px-2 py-0.5 rounded"
                  >
                    <span className="material-symbols-outlined text-[16px]">psychology</span>
                    <span>{isAnalyzingAI ? 'Evaluating...' : 'Rule-Based Triage Suggestion'}</span>
                  </button>
                  <span className="text-[11px] text-error bg-error-container px-2 py-0.5 rounded uppercase font-bold">
                    Required
                  </span>
                </div>
              </div>

              {/* Quick Fill Templates */}
              <div className="mb-space-md">
                <span className="text-xs text-on-surface font-bold block mb-1.5">Quick-Fill Templates:</span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => insertTemplate('Terrace Trapped: 4 adults, 1 child, 5ft rising water')}
                    className="px-space-sm py-1 rounded-full bg-surface-container hover:bg-surface-container-high text-xs text-on-surface text-left transition-colors cursor-pointer border border-surface-container-high"
                  >
                    Terrace Trapped: 4 adults, 1 child, 5ft rising water
                  </button>
                  <button
                    type="button"
                    onClick={() => insertTemplate('Elderly Medical: Heart patient without oxygen cylinder')}
                    className="px-space-sm py-1 rounded-full bg-surface-container hover:bg-surface-container-high text-xs text-on-surface text-left transition-colors cursor-pointer border border-surface-container-high"
                  >
                    Elderly Medical: Heart patient without oxygen cylinder
                  </button>
                  <button
                    type="button"
                    onClick={() => insertTemplate('Road Cut-off: Culvert broke, 30 families isolated')}
                    className="px-space-sm py-1 rounded-full bg-surface-container hover:bg-surface-container-high text-xs text-on-surface text-left transition-colors cursor-pointer border border-surface-container-high"
                  >
                    Road Cut-off: Culvert broke, 30 families isolated
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-on-surface" htmlFor="situationText">
                  Situation Details &amp; Counts <span className="text-on-surface-variant font-normal">(Include headcounts, water depth, battery remaining)</span>
                </label>
                <textarea
                  id="situationText"
                  rows={4}
                  required
                  value={situationText}
                  onChange={(e) => {
                    setSituationText(e.target.value);
                    updateHash(e.target.value, categories);
                  }}
                  placeholder="E.g., 4 adults and 1 toddler trapped on 2nd floor balcony. Water level 5 feet and rising 6 inches per hour. Battery at 14%. Need dry rations and evacuation raft."
                  className="w-full bg-surface-container-low text-on-surface rounded-lg p-space-md text-sm focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary focus:outline-none transition-all placeholder:text-outline border border-surface-container-high leading-relaxed"
                />
              </div>

              {/* Image analysis is not implemented in this prototype. */}
              <div className="mt-4 p-3 bg-surface-container-low rounded-lg border border-surface-container flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[22px]">add_a_photo</span>
                  <div>
                    <span className="text-xs font-bold text-on-surface block">Photo Evidence (Not Available)</span>
                    <span className="text-[11px] text-on-surface-variant">Image upload and automated image analysis are not implemented.</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled
                    className="px-3 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-container text-primary font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">image_not_supported</span>
                    <span>Unavailable</span>
                  </button>
                </div>
              </div>

            </section>

            <section className="bg-surface-container-lowest p-5 sm:p-space-xl rounded-xl shadow-xs border border-surface-container-high">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-on-surface">Request message for responders</h2>
                  <p className="text-xs text-on-surface-variant mt-1">
                    Optional. Saved with this report and visible to authorized CrisisLens responders only. It is not sent to emergency services.
                  </p>
                </div>
                <div className="text-xs text-on-surface-variant">
                  {account ? `Linked to ${account.email}` : 'Report will be unlinked from an account'}
                </div>
              </div>
              <label className="sr-only" htmlFor="requestMessage">Request message for responders</label>
              <textarea
                id="requestMessage"
                rows={3}
                maxLength={2000}
                value={requestMessage}
                onChange={(event) => setRequestMessage(event.target.value)}
                placeholder="What help do you need? Share important details for the human review team."
                className="w-full bg-surface-container-low text-on-surface rounded-lg p-space-md text-sm focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary focus:outline-none transition-all placeholder:text-outline border border-surface-container-high leading-relaxed"
              />
              <div className="flex items-center justify-between mt-2 text-xs text-on-surface-variant">
                <button type="button" onClick={onOpenAccount} className="text-primary font-semibold hover:underline">
                  {account ? 'View account' : 'Sign in or create a profile'}
                </button>
                <span>{requestMessage.length}/2000</span>
              </div>
            </section>

            {/* STEP 4: Location & Geospatial Grounding */}
            <section className="bg-surface-container-lowest p-5 sm:p-space-xl rounded-xl shadow-xs border border-surface-container-high">
              <div className="flex items-center justify-between mb-space-md">
                <div className="flex items-center gap-space-sm">
                  <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed uppercase font-bold">
                    Step 04
                  </span>
                  <h2 className="text-base sm:text-lg font-bold text-on-surface">Location &amp; Physical Markers</h2>
                </div>
                <span className="text-[11px] text-error bg-error-container px-2 py-0.5 rounded uppercase font-bold">
                  Required
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-space-lg mb-space-md">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-on-surface" htmlFor="locationStreet">
                    Street / Area / Ward Address (Required)
                  </label>
                  <input
                    id="locationStreet"
                    type="text"
                    required
                    value={locationStreet}
                    onChange={(e) => {
                      setLocationStreet(e.target.value);
                      updateHash(situationText, categories);
                    }}
                    placeholder="14/2 Velachery Main Road, Near Gandhi Statue, Chennai"
                    className="h-12 bg-surface-container-low text-on-surface rounded-lg px-space-md text-sm focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary focus:outline-none transition-all border border-surface-container-high"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-on-surface" htmlFor="landmarkDetails">
                    Visual Landmark &amp; Roof Color (For Helicopters / Drones)
                  </label>
                  <input
                    id="landmarkDetails"
                    type="text"
                    value={landmarkDetails}
                    onChange={(e) => setLandmarkDetails(e.target.value)}
                    placeholder="E.g., Bright blue tin roof, yellow banner tied to balcony"
                    className="h-12 bg-surface-container-low text-on-surface rounded-lg px-space-md text-sm focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary focus:outline-none transition-all border border-surface-container-high"
                  />
                </div>
              </div>

              {/* GPS Sensor Capture Module */}
              <div className="bg-surface-container-low rounded-xl p-space-md flex flex-col md:flex-row items-start md:items-center justify-between gap-space-md border border-surface-container">
                <div className="flex items-center gap-space-md">
                  <div className="w-10 h-10 rounded-lg bg-surface-container-high text-primary flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[24px]">my_location</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-on-surface">Device coordinates:</span>
                      <span className="font-mono text-xs bg-surface-container px-2 py-0.5 rounded text-on-surface font-semibold">
                        {gpsCoordinates || 'Not captured'}
                      </span>
                    </div>
                    <p className="text-xs text-on-surface-variant mt-0.5">
                      {gpsAccuracyMeters === null ? 'Coordinates are optional and require explicit consent.' : `Device-reported accuracy: ±${Math.round(gpsAccuracyMeters)} meters`}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={refreshCoordinates}
                  className="h-11 px-space-md rounded-lg bg-surface-container-highest hover:bg-surface-variant text-on-surface text-xs font-bold inline-flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer border border-surface-container-high"
                >
                  <span className="material-symbols-outlined text-[18px]">satellite_alt</span>
                  <span>Capture Device Coordinates</span>
                </button>
              </div>
              <label className="mt-3 flex items-start gap-2 text-xs text-on-surface-variant">
                <input
                  type="checkbox"
                  checked={coordinatesConsented}
                  onChange={(event) => setCoordinatesConsented(event.target.checked)}
                  className="mt-0.5 accent-primary"
                />
                <span>I consent to include captured coordinates with this report. Leave unchecked to share location text only.</span>
              </label>

              {/* Mini Tactical Map Anchor Preview */}
              <div className="mt-space-md overflow-hidden rounded-xl shadow-inner relative border border-surface-container-high">
                <div 
                  className="w-full h-44 bg-cover bg-center" 
                  style={{ backgroundImage: `url('https://lh3.googleusercontent.com/aida-public/AB6AXuBqHnPIjr4ZJTff-1v1eBXauKAtGiHE5IPPHgxQOUswSFoNtdgbwxzckgA43DXJcWn6E3ronjnA1ozHJGGIy20IY84g1IUI7ykZxXBqcoZqsQ6SJRtnOya3k0-MqKLJNe1N0bOeQRLIx9doXIJN2TE6boUjV7Z_wiUoLfQdrubwUX5G7WGBdkvIUj71nr7aaBBckYTT5xvtWshev9l3z5ndHcbYcqOrxsTL3ZkSFM4iJ-VKepsObsr3')` }}
                >
                  <div className="absolute inset-0 bg-inverse-surface/40 flex items-center justify-center">
                    <div className="bg-surface-container-lowest/95 backdrop-blur-md px-space-md py-space-xs rounded-full shadow-lg flex items-center gap-space-sm border border-surface-container-high">
                      <span className="material-symbols-outlined text-error text-[20px] animate-bounce">location_on</span>
                      <span className="font-mono text-xs font-bold text-on-surface">Incident Anchor: 12.9784, 80.2217</span>
                      <span className="text-[11px] bg-tertiary text-on-tertiary px-1.5 py-0.5 rounded font-mono font-bold">
                        Cached Tile
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* STEP 5: Resilient Contact Nodes */}
            <section className="bg-surface-container-lowest p-5 sm:p-space-xl rounded-xl shadow-xs border border-surface-container-high">
              <div className="flex items-center justify-between mb-space-md">
                <div className="flex items-center gap-space-sm">
                  <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed uppercase font-bold">
                    Step 05
                  </span>
                  <h2 className="text-base sm:text-lg font-bold text-on-surface">Safe Contact Channels</h2>
                </div>
                <span className="text-xs text-on-surface-variant font-normal">SMS transport is not configured</span>
              </div>
              <p className="text-xs text-on-surface-variant mb-space-lg leading-relaxed">
                Optional if phone battery is under 5% or SIM tower is completely down. Submissions without numbers are still prioritized by physical geo-coordinates.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-space-lg">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-on-surface" htmlFor="contactPrimary">
                    Primary Phone / WhatsApp Number
                  </label>
                  <input
                    id="contactPrimary"
                    type="tel"
                    value={contactPrimary}
                    onChange={(e) => setContactPrimary(e.target.value)}
                    placeholder="Optional callback number"
                    className="h-12 bg-surface-container-low text-on-surface rounded-lg px-space-md text-sm focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary focus:outline-none transition-all border border-surface-container-high"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-on-surface" htmlFor="contactAlt">
                    Alternate Contact / Relative / Neighbor
                  </label>
                  <input
                    id="contactAlt"
                    type="tel"
                    value={contactAlt}
                    onChange={(e) => setContactAlt(e.target.value)}
                    placeholder="Optional alternate callback number"
                    className="h-12 bg-surface-container-low text-on-surface rounded-lg px-space-md text-sm focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary focus:outline-none transition-all border border-surface-container-high"
                  />
                </div>
              </div>
            </section>

            {/* SUBMIT ACTION BAR */}
            <div className="p-space-lg bg-surface-container-lowest rounded-xl shadow-xs border border-surface-container-high flex flex-col sm:flex-row items-center justify-between gap-space-md">
              <div className="flex items-center gap-2 text-on-surface-variant text-xs">
                <span className="material-symbols-outlined text-tertiary text-[20px]">save</span>
                <span className="font-medium">Local save is not server receipt or emergency dispatch</span>
              </div>
              <div className="flex items-center gap-space-md w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => {
                    setSituationText('');
                    setLocationStreet('');
                    setLandmarkDetails('');
                    setContactAlt('');
                  }}
                  className="min-h-[48px] px-space-lg rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-semibold transition-colors w-full sm:w-auto cursor-pointer"
                >
                  Clear Form
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`min-h-[48px] px-space-2xl rounded-lg text-xs font-bold uppercase tracking-wider shadow-md transition-all flex items-center justify-center gap-2 w-full sm:w-auto cursor-pointer text-white ${
                    submitSuccess
                      ? 'bg-tertiary hover:bg-tertiary-container'
                      : 'bg-error hover:bg-on-error-container'
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {isSubmitting ? 'refresh' : submitSuccess ? 'check_circle' : 'broadcast_on_home'}
                  </span>
                  <span>
                    {isSubmitting
                      ? 'Committing to Memory...'
                      : submitSuccess
                      ? serverConfirmed ? 'Report Acknowledged by API' : 'Report Saved — Sync Pending'
                      : 'Submit Emergency Report'}
                  </span>
                </button>
              </div>
            </div>
          </form>

          {/* Transparent Pipeline Preview */}
          <section className="bg-surface-container-lowest p-5 sm:p-space-xl rounded-xl shadow-xs border border-surface-container-high">
            <h3 className="text-base font-bold text-on-surface mb-1">Deterministic Delivery &amp; Sync Pipeline</h3>
            <p className="text-xs text-on-surface-variant mb-space-lg">
              Reports are saved in the browser first. When available, you can synchronize them to the CrisisLens API.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 relative">
              {/* Step 1 */}
              <div className="p-2.5 bg-surface-container-low rounded-lg flex flex-col gap-1 items-start border border-surface-container">
                <div className="w-6 h-6 rounded-full bg-tertiary text-on-tertiary flex items-center justify-center font-mono text-[11px] font-bold">
                  01
                </div>
                <span className="text-xs text-on-surface font-bold mt-1">Save Locally</span>
                <span className="text-[11px] text-on-surface-variant leading-tight">Browser localStorage; not encrypted</span>
              </div>
              {/* Step 2 */}
              <div className="p-2.5 bg-surface-container-low rounded-lg flex flex-col gap-1 items-start border border-surface-container">
                <div className="w-6 h-6 rounded-full bg-surface-variant text-on-surface-variant flex items-center justify-center font-mono text-[11px] font-bold">
                  02
                </div>
                <span className="text-xs text-on-surface font-bold mt-1">Pending Queue</span>
                <span className="text-[11px] text-on-surface-variant leading-tight">Wait until manual sync can reach the API</span>
              </div>
              {/* Step 3 */}
              <div className="p-2.5 bg-surface-container-low rounded-lg flex flex-col gap-1 items-start border border-surface-container">
                <div className="w-6 h-6 rounded-full bg-surface-variant text-on-surface-variant flex items-center justify-center font-mono text-[11px] font-bold">
                  03
                </div>
                <span className="text-xs text-on-surface font-bold mt-1">API Sync</span>
                <span className="text-[11px] text-on-surface-variant leading-tight">Requires connectivity to the configured API</span>
              </div>
              {/* Step 4 */}
              <div className="p-2.5 bg-surface-container-low rounded-lg flex flex-col gap-1 items-start border border-surface-container">
                <div className="w-6 h-6 rounded-full bg-surface-variant text-on-surface-variant flex items-center justify-center font-mono text-[11px] font-bold">
                  04
                </div>
                <span className="text-xs text-on-surface font-bold mt-1">API Acknowledgement</span>
                <span className="text-[11px] text-on-surface-variant leading-tight">CrisisLens stored the report</span>
              </div>
              {/* Step 5 */}
              <div className="p-2.5 bg-surface-container-low rounded-lg flex flex-col gap-1 items-start border border-surface-container col-span-2 sm:col-span-1">
                <div className="w-6 h-6 rounded-full bg-surface-variant text-on-surface-variant flex items-center justify-center font-mono text-[11px] font-bold">
                  05
                </div>
                <span className="text-xs text-on-surface font-bold mt-1">Human Review</span>
                <span className="text-[11px] text-on-surface-variant leading-tight">Separate authenticated responder workflow</span>
              </div>
            </div>

            <div className="mt-space-md p-space-sm bg-surface-container rounded-lg flex items-center gap-space-sm text-on-surface-variant text-xs">
              <span className="material-symbols-outlined text-[18px] text-secondary shrink-0">info</span>
              <span>API acknowledgement is not delivery to emergency services. CrisisLens does not dispatch responders.</span>
            </div>
          </section>
        </div>

        {/* Right Column: Live Incident Receipt Preview & Field Guidance */}
        <div className="lg:col-span-4 flex flex-col gap-space-xl">
          {/* Generated Tactical Receipt Card */}
          <div className="bg-surface-container-lowest p-space-xl rounded-xl shadow-md transition-all border border-surface-container-high">
            <div className="flex items-center justify-between pb-space-sm mb-space-md bg-surface-container-low -mx-space-xl -mt-space-xl p-space-md rounded-t-xl border-b border-surface-container">
              <div className="flex items-center gap-space-xs">
                <span className="w-2.5 h-2.5 rounded-full bg-tertiary"></span>
                <span className="text-xs uppercase font-bold text-on-surface">Local Audit Receipt</span>
              </div>
              <span className="font-mono text-xs text-tertiary bg-surface-container-lowest px-2 py-0.5 rounded font-bold border border-tertiary/20">
                {serverConfirmed ? 'API RECEIVED' : submitSuccess ? 'PENDING SYNC' : 'NO REPORT'}
              </span>
            </div>

            <div className="flex flex-col gap-space-md">
              <div className="flex justify-between items-baseline">
                <span className="text-xs text-on-surface-variant uppercase font-semibold">Incident ID</span>
                <span className="font-mono text-lg font-bold text-primary">{incidentId}</span>
              </div>

              <div className="flex justify-between items-baseline">
                <span className="text-xs text-on-surface-variant uppercase font-semibold">SHA-256 Digest</span>
                <span className="font-mono text-xs text-on-surface font-semibold">{shaDigest}...</span>
              </div>

              <div className="p-space-sm bg-surface-container-low rounded-lg flex flex-col gap-1.5 border border-surface-container">
                <div className="flex justify-between text-xs">
                  <span className="text-on-surface-variant">Local Storage Engine</span>
                  <span className="font-mono text-tertiary font-bold">Browser localStorage</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-on-surface-variant">Offline Redundancy</span>
                  <span className="font-mono text-on-surface font-bold">Not encrypted</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-on-surface-variant">Timestamp (UTC+5:30)</span>
                  <span className="font-mono text-on-surface">{timestampStr}</span>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-xs text-on-surface-variant uppercase font-semibold">Active Categorization</span>
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {categories.map((c) => (
                    <span key={c} className="px-2 py-0.5 rounded bg-primary-fixed text-on-primary-fixed font-mono text-[11px] font-bold">
                      {c.toUpperCase()}
                    </span>
                  ))}
                  <span className={`px-2 py-0.5 rounded font-mono text-[11px] font-bold ${
                    urgency === 'Critical' ? 'bg-error-container text-on-error-container' : 'bg-surface-container text-on-surface'
                  }`}>
                    TIER: {urgency.toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="p-space-md bg-surface-container-high rounded-xl border border-surface-container-highest">
                <div className="flex items-center gap-space-xs text-on-surface text-xs font-bold mb-1">
                  <span className="material-symbols-outlined text-[18px] text-primary">cell_tower</span>
                  <span>Manual API Retry</span>
                </div>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  After reconnecting, open Sync &amp; Offline Center and manually retry pending reports. No background or mesh transport is configured.
                </p>
              </div>

              <button
                type="button"
                onClick={handleCopyReceipt}
                disabled={!submitSuccess}
                className="w-full h-11 bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer border border-surface-container-high"
              >
                <span className="material-symbols-outlined text-[18px]">content_copy</span>
                <span>{copiedReceipt ? 'Copied to Clipboard!' : 'Copy Incident Hash'}</span>
              </button>
            </div>
          </div>

          {/* Field Survival Directives Card */}
          <div className="bg-surface-container-lowest p-space-xl rounded-xl shadow-xs border border-surface-container-high">
            <div className="flex items-center gap-space-sm mb-space-md">
              <span className="material-symbols-outlined text-secondary text-[24px]">contactless</span>
              <h3 className="text-base font-bold text-on-surface">Offline Survival Advice</h3>
            </div>
            <ul className="flex flex-col gap-space-sm text-xs text-on-surface-variant leading-relaxed">
              <li className="flex items-start gap-space-sm">
                <span className="material-symbols-outlined text-tertiary text-[18px] shrink-0 mt-0.5">check_circle</span>
                <span><strong>Preserve Battery:</strong> Set screen brightness to 10%, turn off Bluetooth and hotspot. Keep phone in flight mode except when polling signal.</span>
              </li>
              <li className="flex items-start gap-space-sm">
                <span className="material-symbols-outlined text-tertiary text-[18px] shrink-0 mt-0.5">check_circle</span>
                <span><strong>Acoustic Signaling:</strong> If water level reaches roof, use a metal utensil or whistle in bursts of 3 (International Distress Signal).</span>
              </li>
              <li className="flex items-start gap-space-sm">
                <span className="material-symbols-outlined text-tertiary text-[18px] shrink-0 mt-0.5">check_circle</span>
                <span><strong>Water Decontamination:</strong> Do not consume stagnant flood runoff under any circumstances. Boil potable water for 3 full minutes if stove operates.</span>
              </li>
            </ul>
          </div>

          {/* Current report state */}
          <div className="bg-surface-container-lowest p-space-xl rounded-xl shadow-xs border border-surface-container-high">
            <div className="flex items-center justify-between mb-space-md">
              <h3 className="text-base font-bold text-on-surface">Current Report State</h3>
              <span className="font-mono text-xs text-on-surface-variant">Browser queue</span>
            </div>
            <div className="flex flex-col gap-space-sm">
              <div className="p-space-sm bg-surface-container-low rounded-lg flex items-center justify-between border border-surface-container">
                <div>
                  <div className="font-mono text-xs font-bold text-on-surface">{incidentId}</div>
                  <div className="text-[11px] text-on-surface-variant">
                    {submitSuccess ? 'Saved in browser storage' : 'No report submitted in this form yet'}
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-mono text-[10px] font-bold uppercase">
                  {serverConfirmed ? 'API Acknowledged' : submitSuccess ? 'Pending Sync' : 'Not Submitted'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Notification Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md w-full px-4 animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div className="bg-inverse-surface text-inverse-on-surface p-space-md rounded-xl shadow-2xl flex items-center justify-between gap-space-md border border-white/10">
            <div className="flex items-center gap-space-sm">
              <span className="material-symbols-outlined text-tertiary-fixed text-[24px]">verified</span>
              <div>
                <div className="text-xs font-bold">{serverConfirmed ? 'API Acknowledged' : 'Local save / pending API sync'}</div>
                <div className="text-xs text-inverse-on-surface/80">{toastMessage}</div>
              </div>
            </div>
            <button
              onClick={() => setToastMessage(null)}
              className="text-inverse-on-surface/60 hover:text-inverse-on-surface p-1 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
