/**
 * HELIOS CF09 — identification checks and output classification (deterministic).
 */

import type { CausalIdentificationAssessment, ConditionalDecisionEffect, DecisionTreatmentDefinition } from './types.ts';
import type { Cf09CausalOutputClassification } from './taxonomy.ts';

const MIN_CROSS_FIT_FOLDS = 2;

export type Cf09ClassificationInput = Pick<
  CausalIdentificationAssessment,
  | 'overlap'
  | 'confounding'
  | 'support'
  | 'treatmentConsistency'
  | 'temporalStability'
  | 'crossFit'
  | 'modelSelectionIsEffectNeutral'
  | 'includesRiskComplianceRejections'
  | 'rejectionSamplePolicy'
>;

/**
 * Derives the causal output label from identification diagnostics. Never upgrades
 * association to causality — callers must pass honest status fields.
 */
export function deriveCf09OutputClassification(input: Cf09ClassificationInput): Cf09CausalOutputClassification {
  if (!input.modelSelectionIsEffectNeutral) {
    return 'IDENTIFICATION_FAILED';
  }
  if (input.crossFit.foldCount < MIN_CROSS_FIT_FOLDS) {
    return 'IDENTIFICATION_FAILED';
  }
  if (input.overlap === 'FAILED' || input.confounding === 'UNADDRESSED' || input.treatmentConsistency === 'FAILED') {
    return 'IDENTIFICATION_FAILED';
  }
  if (input.support === 'FAILED') {
    return 'IDENTIFICATION_FAILED';
  }

  if (input.overlap === 'WEAK' || input.support === 'SPARSE') {
    return 'INSUFFICIENT_SUPPORT';
  }

  if (
    input.includesRiskComplianceRejections ||
    input.confounding === 'RESIDUAL_CONCERN' ||
    input.temporalStability === 'UNSTABLE'
  ) {
    return 'ASSOCIATIONAL_ONLY';
  }

  if (
    input.overlap === 'ADEQUATE' &&
    input.confounding === 'ADDRESSED' &&
    input.support === 'ADEQUATE' &&
    input.treatmentConsistency === 'CONSISTENT' &&
    (input.temporalStability === 'STABLE' || input.temporalStability === 'UNKNOWN')
  ) {
    return 'CAUSAL_ESTIMATE_SUPPORTED';
  }

  return 'ASSOCIATIONAL_ONLY';
}

export function validateDecisionTreatmentDefinition(row: DecisionTreatmentDefinition): readonly string[] {
  const errors: string[] = [];
  if (row.schema !== 'sunrey.helios.cf09.decision-treatment.v1') {
    errors.push('decision-treatment.schema mismatch');
  }
  if (!row.definitionId.trim()) {
    errors.push('decision-treatment.definitionId required');
  }
  if (!row.treatedArm.trim() || !row.controlArm.trim()) {
    errors.push('decision-treatment arms required');
  }
  if (row.treatedArm === row.controlArm) {
    errors.push('decision-treatment treatedArm and controlArm must differ');
  }
  if (!row.outcomeRef.trim()) {
    errors.push('decision-treatment.outcomeRef required');
  }
  if (!row.estimatedAtUtc.trim()) {
    errors.push('decision-treatment.estimatedAtUtc required');
  }
  return Object.freeze(errors);
}

/** True when declared classification matches {@link deriveCf09OutputClassification}. */
export function identificationAssessmentIsInternallyConsistent(assessment: CausalIdentificationAssessment): boolean {
  const derived = deriveCf09OutputClassification(assessment);
  return derived === assessment.outputClassification;
}

/** Ensures a conditional effect does not claim a causal effect without supported identification. */
export function conditionalEffectRespectsCausalLabel(effect: ConditionalDecisionEffect): boolean {
  const { outputClassification } = effect.assessment;
  if (outputClassification === 'CAUSAL_ESTIMATE_SUPPORTED') {
    if (effect.assessment.includesRiskComplianceRejections) {
      return false;
    }
    return identificationAssessmentIsInternallyConsistent(effect.assessment);
  }
  if (outputClassification === 'IDENTIFICATION_FAILED') {
    return false;
  }
  return identificationAssessmentIsInternallyConsistent(effect.assessment);
}
