/**
 * HELIOS CF09 — heterogeneous decision-effect intelligence.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  deriveCf09OutputClassification,
  evaluateCf09HeterogeneousEffectsQualification,
  HELIOS_CF09_HETEROGENEOUS_EFFECTS_BLOCKED,
  HELIOS_CF09_HETEROGENEOUS_EFFECTS_QUALIFIED,
  type CausalIdentificationAssessment,
  type ConditionalDecisionEffect,
  type DecisionTreatmentDefinition,
  type HeterogeneousEffectState,
} from '../packages/platform/src/helios/counterfactual-learning/cf09/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const ROOT = process.cwd();

const baseAssessment: CausalIdentificationAssessment = {
  schema: 'sunrey.helios.cf09.identification.v1',
  treatmentDefinitionId: 'dt_enter_vs_no_action',
  contextSliceId: 'slice_default',
  overlap: 'ADEQUATE',
  confounding: 'ADDRESSED',
  support: 'ADEQUATE',
  treatmentConsistency: 'CONSISTENT',
  temporalStability: 'STABLE',
  rejectionSamplePolicy: 'EXCLUDED_FROM_ESTIMATION',
  includesRiskComplianceRejections: false,
  crossFit: { foldCount: 5, foldIds: ['a', 'b', 'c', 'd', 'e'] },
  modelSelectionIsEffectNeutral: true,
  validationCriteria: [
    {
      criterionId: 'cv_residual_risk',
      label: 'Cross-validated residual risk',
      summary: 'Hyperparameters tuned on residual risk / pseudo-outcome prediction error only.',
    },
  ],
  outputClassification: 'CAUSAL_ESTIMATE_SUPPORTED',
};

const sampleTreatment: DecisionTreatmentDefinition = {
  schema: 'sunrey.helios.cf09.decision-treatment.v1',
  definitionId: 'dt_enter_vs_no_action',
  label: 'ENTER vs NO_ACTION',
  treatedArm: 'ENTER',
  controlArm: 'NO_ACTION',
  pretreatmentCovariateRefs: ['cov_liquidity', 'cov_vol_regime'],
  outcomeRef: 'out_net_economic_result_minor',
  estimatedAtUtc: '2026-11-06T12:00:00.000Z',
};

function effectForClassification(
  classification: CausalIdentificationAssessment['outputClassification'],
): ConditionalDecisionEffect {
  const assessment = {
    ...baseAssessment,
    outputClassification: classification,
  };
  const derived = deriveCf09OutputClassification(assessment);
  return {
    schema: 'sunrey.helios.cf09.conditional-effect.v1',
    treatmentDefinitionId: sampleTreatment.definitionId,
    contextSlice: {
      sliceId: 'slice_high_liquidity',
      description: 'High pre-decision liquidity',
      predicateSummary: 'liquidity_ratio >= 0.2',
    },
    modelKind: 'DML_ORTHOGONAL_LEARNER',
    crossFit: assessment.crossFit,
    validationCriteria: assessment.validationCriteria,
    pointEstimate: '1200',
    intervalLow: '400',
    intervalHigh: '2000',
    assessment: { ...assessment, outputClassification: derived },
  };
}

describe('HELIOS CF09 heterogeneous effects', () => {
  it('stays inside the HELIOS platform boundary', () => {
    const findings = lintHeliosBoundary(ROOT).filter((row) => row.file.includes('helios/counterfactual-learning'));
    assert.equal(findings.length, 0, JSON.stringify(findings));
  });

  it('derives CAUSAL_ESTIMATE_SUPPORTED only when identification checks pass', () => {
    assert.equal(
      deriveCf09OutputClassification({
        ...baseAssessment,
        overlap: 'ADEQUATE',
        confounding: 'ADDRESSED',
        support: 'ADEQUATE',
        treatmentConsistency: 'CONSISTENT',
        temporalStability: 'STABLE',
      }),
      'CAUSAL_ESTIMATE_SUPPORTED',
    );
  });

  it('does not treat risk/compliance rejections as automatic causal controls', () => {
    assert.equal(
      deriveCf09OutputClassification({
        ...baseAssessment,
        includesRiskComplianceRejections: true,
      }),
      'ASSOCIATIONAL_ONLY',
    );
  });

  it('flags IDENTIFICATION_FAILED when cross-fitting is absent', () => {
    assert.equal(
      deriveCf09OutputClassification({
        ...baseAssessment,
        crossFit: { foldCount: 1, foldIds: ['only'] },
      }),
      'IDENTIFICATION_FAILED',
    );
  });

  it('flags IDENTIFICATION_FAILED when model selection is not effect-neutral', () => {
    assert.equal(
      deriveCf09OutputClassification({
        ...baseAssessment,
        modelSelectionIsEffectNeutral: false,
      }),
      'IDENTIFICATION_FAILED',
    );
  });

  it('qualifies a consistent heterogeneous-effect state', () => {
    const state: HeterogeneousEffectState = {
      schema: 'sunrey.helios.cf09.heterogeneous-effect-state.v1',
      treatment: sampleTreatment,
      effects: [effectForClassification('CAUSAL_ESTIMATE_SUPPORTED')],
      sealedAtUtc: '2026-11-06T12:05:00.000Z',
    };
    const q = evaluateCf09HeterogeneousEffectsQualification(state);
    assert.equal(q.qualified, true, q.blockers.join('; '));
    assert.equal(q.marker, HELIOS_CF09_HETEROGENEOUS_EFFECTS_QUALIFIED);
  });

  it('blocks causal claims that conflict with diagnostics', () => {
    const badAssessment = {
      ...baseAssessment,
      overlap: 'FAILED',
      outputClassification: 'CAUSAL_ESTIMATE_SUPPORTED' as const,
    };
    const effect: ConditionalDecisionEffect = {
      schema: 'sunrey.helios.cf09.conditional-effect.v1',
      treatmentDefinitionId: sampleTreatment.definitionId,
      contextSlice: {
        sliceId: 'slice_bad',
        description: '',
        predicateSummary: '',
      },
      modelKind: 'R_LEARNER',
      crossFit: badAssessment.crossFit,
      validationCriteria: badAssessment.validationCriteria,
      pointEstimate: '0',
      intervalLow: null,
      intervalHigh: null,
      assessment: badAssessment,
    };
    const state: HeterogeneousEffectState = {
      schema: 'sunrey.helios.cf09.heterogeneous-effect-state.v1',
      treatment: sampleTreatment,
      effects: [effect],
      sealedAtUtc: '2026-11-06T12:05:00.000Z',
    };
    const q = evaluateCf09HeterogeneousEffectsQualification(state);
    assert.equal(q.qualified, false);
    assert.equal(q.marker, HELIOS_CF09_HETEROGENEOUS_EFFECTS_BLOCKED);
    assert.ok(q.blockers.some((row) => row.includes('identification')));
  });
});
