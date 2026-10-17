import { IncidentCategory } from '../types';
import { requestTriageSuggestion } from './apiService';

export interface TriageResult {
  suggestedPriority: 'Critical' | 'Urgent' | 'Moderate';
  reasons: string[];
  uncertainty: string;
}

export const TriageService = {
  async analyzeTriage(
    situation: string,
    categories: IncidentCategory[],
    preferLocal = false
  ): Promise<TriageResult> {
    if (!preferLocal) {
      try {
        const result = await requestTriageSuggestion(situation, categories);
        return {
          suggestedPriority: result.suggested_priority,
          reasons: result.reasons,
          uncertainty: result.uncertainty,
        };
      } catch {
        // A deterministic local rule baseline remains available while offline.
      }
    }
    const lower = situation.toLowerCase();
    const critical = ['cardiac', 'heart attack', 'bleeding', 'drowning', 'pregnant', 'infant', 'baby', 'trapped', 'electrical']
      .filter(term => lower.includes(term));
    const urgent = ['elderly', 'child', 'water rising', 'medicine', 'oxygen', 'flood', 'stranded', 'missing']
      .filter(term => lower.includes(term));
    if (categories.includes('Medical')) urgent.push('medical need');
    const reasons = (critical.length ? critical : urgent).slice(0, 4);
    return {
      suggestedPriority: critical.length ? 'Critical' : urgent.length ? 'Urgent' : 'Moderate',
      reasons: reasons.length
        ? reasons.map(term => `Description mentions: ${term}`)
        : ['No configured high-risk keywords were identified'],
      uncertainty: critical.length ? 'high' : urgent.length ? 'high' : 'very_high',
    };
  }
};
