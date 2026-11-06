/**
 * HELIOS counterfactual learning — CF05 multi-estimator off-policy evaluation (taxonomy).
 *
 * Simulation / research only. Does not assert unobserved outcomes as facts.
 */

export const HELIOS_CF05_SCHEMA = 'helios.counterfactual-learning.cf05.v1' as const;

export const HELIOS_CF05_AUTHORITY = 'packages/platform/src/helios/counterfactual-learning/cf05' as const;

export const HELIOS_CF05_DOUBLY_ROBUST_OPE_QUALIFIED =
  'HELIOS_CF05_DOUBLY_ROBUST_OPE_QUALIFIED' as const;

export const HELIOS_CF05_OPE_BLOCKED = 'HELIOS_CF05_OPE_BLOCKED' as const;

export const OPE_ESTIMATOR_KINDS = [
  'DIRECT_METHOD',
  'IPS',
  'SELF_NORMALIZED_IPS',
  'DOUBLY_ROBUST',
  'SWITCH_DOUBLY_ROBUST',
] as const;

export type OpeEstimatorKind = (typeof OPE_ESTIMATOR_KINDS)[number];

export const OPE_EVALUATION_STATUS = ['OK', 'INCONCLUSIVE'] as const;

export type OpeEvaluationStatus = (typeof OPE_EVALUATION_STATUS)[number];
