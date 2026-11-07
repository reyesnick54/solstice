/**
 * HELIOS ALT12 qualification — HELIOS_ALT12_MULTIMODAL_FUSION_QUALIFIED
 */

import {
  HELIOS_ALT12_MULTIMODAL_FUSION_BLOCKED,
  HELIOS_ALT12_MULTIMODAL_FUSION_QUALIFIED,
} from '../taxonomy.ts';
import type { AlternativeDataFusionState } from './types.ts';

export { HELIOS_ALT12_MULTIMODAL_FUSION_QUALIFIED, HELIOS_ALT12_MULTIMODAL_FUSION_BLOCKED };

export type Alt12MultimodalFusionQualificationChecks = {
  readonly acceptsPartialModalitySubsets: boolean;
  readonly missingnessTrackedByReason: boolean;
  readonly baselineModelsPresent: boolean;
  readonly advancedModelsPresent: boolean;
  readonly dynamicRoutingApplied: boolean;
  readonly calibratedUncertainty: boolean;
  readonly sourceContributionsPresent: boolean;
  readonly sourceDropoutGraceful: boolean;
  readonly noExecutionAuthority: boolean;
  readonly researchOnly: boolean;
};

export type Alt12MultimodalFusionQualificationResult = {
  readonly marker:
    | typeof HELIOS_ALT12_MULTIMODAL_FUSION_QUALIFIED
    | typeof HELIOS_ALT12_MULTIMODAL_FUSION_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

export function evaluateAlt12MultimodalFusionQualification(
  checks: Alt12MultimodalFusionQualificationChecks,
): Alt12MultimodalFusionQualificationResult {
  const entries: [keyof Alt12MultimodalFusionQualificationChecks, string][] = [
    ['acceptsPartialModalitySubsets', 'partial_modality_subsets'],
    ['missingnessTrackedByReason', 'missingness_by_reason'],
    ['baselineModelsPresent', 'baseline_models'],
    ['advancedModelsPresent', 'advanced_models'],
    ['dynamicRoutingApplied', 'dynamic_routing'],
    ['calibratedUncertainty', 'calibrated_uncertainty'],
    ['sourceContributionsPresent', 'source_contributions'],
    ['sourceDropoutGraceful', 'source_dropout'],
    ['noExecutionAuthority', 'no_execution_authority'],
    ['researchOnly', 'research_only'],
  ];
  const blockers = entries.filter(([key]) => !checks[key]).map(([, label]) => label);
  const qualified = blockers.length === 0;
  return Object.freeze({
    marker: qualified ? HELIOS_ALT12_MULTIMODAL_FUSION_QUALIFIED : HELIOS_ALT12_MULTIMODAL_FUSION_BLOCKED,
    qualified,
    blockers: Object.freeze(blockers),
  });
}

export function qualificationChecksFromState(state: AlternativeDataFusionState): Alt12MultimodalFusionQualificationChecks {
  const missingWithReason = state.modalities.filter(
    (m) => m.availability !== 'PRESENT' && m.missingReason !== null,
  );
  const dropoutGraceful =
    state.dropoutResults.length === 0 ||
    (state.dropoutResults.every((row) => !row.catastrophic) &&
      state.dropoutResults.some((row) => row.gracefulDegradation));

  return Object.freeze({
    acceptsPartialModalitySubsets:
      state.route.activeModalities.length > 0 &&
      (state.route.activeModalities.length < state.modalities.length ||
        state.modalities.some((m) => m.availability !== 'PRESENT')),
    missingnessTrackedByReason: missingWithReason.length > 0 || state.modalities.some((m) => m.availability === 'PRESENT'),
    baselineModelsPresent: Object.values(state.baselineOutputs).length === 3,
    advancedModelsPresent: Object.values(state.advancedOutputs).length === 4,
    dynamicRoutingApplied: state.route.routingNotes.length > 0 || state.route.activeModalities.length > 0,
    calibratedUncertainty: state.uncertainty.calibrated && state.uncertainty.total > 0,
    sourceContributionsPresent: state.sourceContributions.length > 0,
    sourceDropoutGraceful: dropoutGraceful,
    noExecutionAuthority: state.grantsExecutionAuthority === false,
    researchOnly: state.researchOnly === true && state.notAFact === true,
  });
}
