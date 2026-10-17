import React, { useEffect, useState } from 'react';
import { Rumor } from '../types';
import { INITIAL_RUMORS } from '../data/mockData';
import {
  createMisinformationClaim,
  listMisinformationClaims,
  reviewMisinformationClaim,
  toRumor,
} from '../services/apiService';
import type { ServerClaim } from '../services/apiService';

export const MisinformationQueue: React.FC = () => {
  const [rumors, setRumors] = useState<Rumor[]>(INITIAL_RUMORS);
  const [selectedFilter, setSelectedFilter] = useState<'all' | Rumor['status']>('all');
  const [newClaim, setNewClaim] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [statusError, setStatusError] = useState(false);
  const [reviewInputs, setReviewInputs] = useState<Record<string, {
    status: ServerClaim['status'];
    evidence: string;
    decision: string;
  }>>({});

  useEffect(() => {
    listMisinformationClaims()
      .then(claims => setRumors(current => [
        ...claims.map(toRumor),
        ...current.filter(rumor => rumor.isDemo),
      ]))
      .catch(error => {
        setStatusError(true);
        setStatusMsg(error instanceof Error ? error.message : 'Unable to load claims from the API.');
      });
  }, []);

  const filteredRumors = rumors.filter(r => {
    if (selectedFilter === 'all') return true;
    return r.status === selectedFilter;
  });

  const handleVerifyNewClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClaim.trim()) return;

    setIsVerifying(true);
    setStatusError(false);
    try {
      const result = await createMisinformationClaim(newClaim, newLocation);
      const added = toRumor(result);
      setRumors(current => [added, ...current]);
      setNewClaim('');
      setNewLocation('');
      setStatusMsg('Claim stored as Unverified. A responder must review evidence before assigning a verification status.');
    } catch (error) {
      setStatusError(true);
      setStatusMsg(error instanceof Error ? error.message : 'Could not save the claim.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleReview = async (rumor: Rumor) => {
    const input = reviewInputs[rumor.id] || { status: 'needs_review', evidence: '', decision: '' };
    setStatusError(false);
    try {
      const result = await reviewMisinformationClaim(
        rumor.id,
        input.status,
        input.evidence,
        input.decision,
      );
      const updated = toRumor(result);
      setRumors(current => current.map(item => item.id === rumor.id ? updated : item));
      setStatusMsg(`Claim ${rumor.id} updated to ${updated.status}.`);
    } catch (error) {
      setStatusError(true);
      setStatusMsg(error instanceof Error ? error.message : 'Could not save the reviewer decision.');
    }
  };

  return (
    <div className="flex flex-col w-full max-w-6xl mx-auto gap-space-xl">
      {/* Header Banner */}
      <div className="bg-surface-container-lowest p-6 rounded-xl shadow-xs border border-surface-container-high flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-surface-container-high text-primary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[28px]">fact_check</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs uppercase text-primary font-bold">Pillar 03 Desk</span>
              <span className="text-outline">/</span>
              <span className="text-xs text-on-surface-variant font-mono">Human Evidence Review</span>
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-on-surface mt-0.5">
              Misinformation Review Queue
            </h1>
            <p className="text-xs md:text-sm text-on-surface-variant mt-1 max-w-2xl leading-relaxed">
              New claims remain Unverified until an authorized responder records a decision. Corroborated and Disputed decisions require supporting evidence.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0 bg-surface-container-low p-3 rounded-lg border border-surface-container">
          <div className="text-center">
            <span className="text-2xl font-bold text-on-surface font-mono">{rumors.filter(rumor => !rumor.isDemo).length}</span>
            <span className="text-[10px] uppercase font-bold text-on-surface-variant block">Server Claims</span>
          </div>
          <div className="w-px h-8 bg-surface-container-high"></div>
          <div className="text-center">
            <span className="text-2xl font-bold text-tertiary font-mono">Evidence</span>
            <span className="text-[10px] uppercase font-bold text-on-surface-variant block">Human review</span>
          </div>
        </div>
      </div>

      {/* Submit a claim without assigning a verification result */}
      <div className="bg-surface-container-lowest p-5 sm:p-6 rounded-xl shadow-xs border border-surface-container-high">
        <h3 className="text-sm font-bold text-on-surface mb-1 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[20px]">psychology</span>
          <span>Submit a Claim for Review</span>
        </h3>
        <p className="text-xs text-on-surface-variant mb-4">
          Submission records the claim as Unverified. No automated fact-checking or official-source lookup is performed.
        </p>

        <form onSubmit={handleVerifyNewClaim} className="flex flex-col gap-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <input
                type="text"
                required
                value={newClaim}
                onChange={(e) => setNewClaim(e.target.value)}
                placeholder="E.g., Chembarambakkam dam gates opened 100% without warning; water rising 10 feet in 10 mins..."
                className="w-full h-11 px-3 bg-surface-container-low text-on-surface rounded-lg text-xs focus:ring-2 focus:ring-primary focus:outline-none border border-surface-container-high"
              />
            </div>
            <div>
              <input
                type="text"
                value={newLocation}
                onChange={(e) => setNewLocation(e.target.value)}
                placeholder="Location / Sector (e.g., Adyar / Velachery)"
                className="w-full h-11 px-3 bg-surface-container-low text-on-surface rounded-lg text-xs focus:ring-2 focus:ring-primary focus:outline-none border border-surface-container-high"
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[11px] text-on-surface-variant">
              Claims are not verified automatically. Responder authentication is required to record decisions.
            </span>
            <button
              type="submit"
              disabled={isVerifying}
              className="px-4 py-2.5 rounded-lg bg-primary hover:bg-primary-container text-on-primary text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">
                {isVerifying ? 'progress_activity' : 'save'}
              </span>
              <span>{isVerifying ? 'Saving...' : 'Submit Unverified Claim'}</span>
            </button>
          </div>
        </form>

        {statusMsg && (
          <div className={`mt-3 p-3 rounded-lg text-xs font-bold flex items-center gap-2 ${
            statusError
              ? 'bg-error-container border border-error/20 text-on-error-container'
              : 'bg-tertiary-container/10 border border-tertiary/20 text-tertiary'
          }`}>
            <span className="material-symbols-outlined text-[18px]">{statusError ? 'error' : 'check_circle'}</span>
            <span>{statusMsg}</span>
          </div>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {(['all', 'Unverified', 'Needs Review', 'Corroborated', 'Disputed'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setSelectedFilter(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                selectedFilter === tab
                  ? 'bg-primary text-on-primary shadow-xs'
                  : 'bg-surface-container text-on-surface hover:bg-surface-container-high'
              }`}
            >
              {tab === 'all' ? 'All Claims' : tab}
            </button>
          ))}
        </div>
        <span className="text-xs text-on-surface-variant font-mono">
          Showing {filteredRumors.length} items
        </span>
      </div>

      {/* Claims List */}
      <div className="flex flex-col gap-4">
        {filteredRumors.map(rumor => {
          const isDisputed = rumor.status === 'Disputed';
          const isCorroborated = rumor.status === 'Corroborated';

          return (
            <div
              key={rumor.id}
              className="bg-surface-container-lowest p-5 rounded-xl shadow-xs border border-surface-container-high flex flex-col md:flex-row items-start justify-between gap-4"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className={`px-2.5 py-0.5 rounded font-mono text-xs font-bold tracking-wider uppercase ${
                    isDisputed
                      ? 'bg-error-container text-error border border-error/20'
                      : isCorroborated
                      ? 'bg-tertiary-container text-on-tertiary font-bold'
                      : 'bg-amber-100 text-amber-900'
                  }`}>
                    {rumor.status}
                  </span>
                  <span className="font-mono text-xs font-bold text-secondary">{rumor.id}</span>
                  <span className="text-outline">·</span>
                  <span className="text-xs text-on-surface-variant flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">location_on</span>
                    {rumor.location}
                  </span>
                  <span className="text-outline">·</span>
                  <span className="text-xs text-secondary font-mono">{rumor.timestamp}</span>
                </div>

                <h3 className="text-sm font-bold text-on-surface mb-2 leading-relaxed">
                  "{rumor.claim}"
                </h3>

                <div className="p-3 rounded-lg bg-surface-container-low border border-surface-container flex flex-col gap-1 mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-secondary">
                    Reviewer Decision &amp; Evidence
                  </span>
                  <p className="text-xs text-on-surface font-semibold leading-relaxed">
                    {rumor.officialFact}
                  </p>
                  <span className="font-mono text-[10px] text-on-surface-variant mt-1">
                    Source: {rumor.source}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-[11px] text-on-surface-variant">
                  <span>Reported via: <strong>{rumor.reportedBy}</strong></span>
                  <span>·</span>
                  <span>Automated fact-check: <strong>Not performed</strong></span>
                </div>
              </div>

              {/* Action Controls */}
              <div className="shrink-0 flex flex-col items-end gap-2 self-stretch md:self-auto justify-between">
                {!rumor.isDemo && (
                  <div className="w-full md:w-72 flex flex-col gap-2">
                    <select
                      value={reviewInputs[rumor.id]?.status || 'needs_review'}
                      onChange={event => setReviewInputs(current => ({
                        ...current,
                        [rumor.id]: {
                          status: event.target.value as ServerClaim['status'],
                          evidence: current[rumor.id]?.evidence || '',
                          decision: current[rumor.id]?.decision || '',
                        },
                      }))}
                      className="h-9 px-2 rounded bg-surface-container-low text-xs border border-surface-container-high"
                    >
                      <option value="unverified">Unverified</option>
                      <option value="needs_review">Needs Review</option>
                      <option value="corroborated">Corroborated</option>
                      <option value="disputed">Disputed</option>
                    </select>
                    <input
                      value={reviewInputs[rumor.id]?.evidence || ''}
                      onChange={event => setReviewInputs(current => ({
                        ...current,
                        [rumor.id]: {
                          status: current[rumor.id]?.status || 'needs_review',
                          evidence: event.target.value,
                          decision: current[rumor.id]?.decision || '',
                        },
                      }))}
                      placeholder="Evidence/source (required to verify)"
                      className="h-9 px-2 rounded bg-surface-container-low text-xs border border-surface-container-high"
                    />
                    <textarea
                      value={reviewInputs[rumor.id]?.decision || ''}
                      onChange={event => setReviewInputs(current => ({
                        ...current,
                        [rumor.id]: {
                          status: current[rumor.id]?.status || 'needs_review',
                          evidence: current[rumor.id]?.evidence || '',
                          decision: event.target.value,
                        },
                      }))}
                      placeholder="Reviewer decision (required to verify)"
                      rows={2}
                      className="px-2 py-1 rounded bg-surface-container-low text-xs border border-surface-container-high"
                    />
                    <button
                      onClick={() => handleReview(rumor)}
                      className="px-3 py-1.5 rounded bg-primary text-on-primary text-xs font-bold"
                    >
                      Save reviewer decision
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
