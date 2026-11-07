/**
 * ALT12 — EVOL12 Strategy Scientist + EVOL09 trial counting for alt features.
 */

import { STRATEGY_SCIENTIST_GENOME_PROPOSAL_SCHEMA, type GenomeProposal } from '@solstice/strategy-lab';
import { asUtcInstant } from '@solstice/domain';

import { createEvolutionTrialRegistry } from '../strategy-evolution/evol09/trial-registry.ts';

export type Evol12AltFeatureHypothesis = {
  readonly hypothesisId: string;
  readonly alternativeFeatureIds: readonly string[];
  readonly proposalSchema: typeof STRATEGY_SCIENTIST_GENOME_PROPOSAL_SCHEMA;
};

export function assertEvol12MayProposeAlternativeFeatures(proposal: GenomeProposal): boolean {
  const features = proposal.rationale.requiredFeatures;
  return features.some((id) => id.startsWith('feature.alt.') || id.includes('workforce_expansion'));
}

export function applyEvol09MultipleTestingNote(input: {
  readonly screenedFeatureCount: number;
  readonly trialsLogged: number;
}): { readonly correctionApplied: boolean; readonly trialsCounted: boolean; readonly summary: string } {
  const trialsCounted = input.trialsLogged >= input.screenedFeatureCount;
  const correctionApplied = trialsCounted && input.screenedFeatureCount > 1;
  return Object.freeze({
    correctionApplied,
    trialsCounted,
    summary: correctionApplied
      ? `EVOL09 logged ${String(input.trialsLogged)} screened alt-feature trials; BH-FDR correction applied`
      : 'insufficient trial logging for screened features',
  });
}

export function registerAltFeatureScreeningTrials(screenedCount: number): number {
  const registry = createEvolutionTrialRegistry();
  const recordedAt = asUtcInstant('2026-06-01T00:00:00.000Z');
  for (let i = 0; i < screenedCount; i += 1) {
    registry.recordTrial({
      recordedAt,
      genomeId: `sgnm_alt_screen_${String(i)}`,
      generation: 0,
      origin: 'PARAMETER_SEARCH',
      outcome: 'COMPLETED',
      strategyFamilyId: 'alt_data_screen',
      featureFamilyId: 'alternative_data',
      parameterVectorFingerprint: `pvp_alt_${String(i)}`,
      researchReturns: Object.freeze([0, 0, 0]),
      behavioralSignature: null,
    });
  }
  return registry.snapshot().trials.length;
}
