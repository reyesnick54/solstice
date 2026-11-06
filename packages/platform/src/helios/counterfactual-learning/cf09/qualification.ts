/**
 * HELIOS CF09 — engineering qualification gate.
 */

import {
  conditionalEffectRespectsCausalLabel,
  validateDecisionTreatmentDefinition,
} from './assessment.ts';
import type { HeterogeneousEffectState } from './types.ts';
import {
  HELIOS_CF09_HETEROGENEOUS_EFFECTS_BLOCKED,
  HELIOS_CF09_HETEROGENEOUS_EFFECTS_QUALIFIED,
} from './taxonomy.ts';

export type Cf09QualificationResult = {
  readonly marker:
    | typeof HELIOS_CF09_HETEROGENEOUS_EFFECTS_QUALIFIED
    | typeof HELIOS_CF09_HETEROGENEOUS_EFFECTS_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

function pushBlockers(target: string[], row: string): void {
  target.push(row);
}

export function evaluateCf09HeterogeneousEffectsQualification(state: HeterogeneousEffectState): Cf09QualificationResult {
  const blockers: string[] = [];

  if (state.schema !== 'sunrey.helios.cf09.heterogeneous-effect-state.v1') {
    pushBlockers(blockers, 'heterogeneous-effect-state.schema mismatch');
  }

  for (const err of validateDecisionTreatmentDefinition(state.treatment)) {
    pushBlockers(blockers, err);
  }

  if (state.effects.length === 0) {
    pushBlockers(blockers, 'heterogeneous-effect-state.effects must be non-empty');
  }

  for (const effect of state.effects) {
    if (effect.schema !== 'sunrey.helios.cf09.conditional-effect.v1') {
      pushBlockers(blockers, 'conditional-effect.schema mismatch');
      continue;
    }
    if (effect.treatmentDefinitionId !== state.treatment.definitionId) {
      pushBlockers(
        blockers,
        `conditional-effect ${effect.contextSlice.sliceId} treatmentDefinitionId does not match definition`,
      );
    }
    if (!effect.pointEstimate.trim()) {
      pushBlockers(blockers, `conditional-effect ${effect.contextSlice.sliceId} pointEstimate required`);
    }
    if (!conditionalEffectRespectsCausalLabel(effect)) {
      pushBlockers(
        blockers,
        `conditional-effect ${effect.contextSlice.sliceId} identification label inconsistent with diagnostics or forbidden causal claim`,
      );
    }
  }

  if (!state.sealedAtUtc.trim()) {
    pushBlockers(blockers, 'heterogeneous-effect-state.sealedAtUtc required');
  }

  const qualified = blockers.length === 0;

  if (qualified) {
    return Object.freeze({
      marker: HELIOS_CF09_HETEROGENEOUS_EFFECTS_QUALIFIED,
      qualified: true,
      blockers: Object.freeze([]),
    });
  }

  return Object.freeze({
    marker: HELIOS_CF09_HETEROGENEOUS_EFFECTS_BLOCKED,
    qualified: false,
    blockers: Object.freeze(blockers),
  });
}
