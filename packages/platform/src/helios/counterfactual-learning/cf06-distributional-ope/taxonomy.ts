/**
 * HELIOS CF06 — Distributional off-policy evaluation (research estimators).
 */
export const HELIOS_CF06_DISTRIBUTIONAL_OPE_QUALIFIED = 'HELIOS_CF06_DISTRIBUTIONAL_OPE_QUALIFIED' as const;
export const HELIOS_CF06_DISTRIBUTIONAL_OPE_BLOCKED = 'HELIOS_CF06_DISTRIBUTIONAL_OPE_BLOCKED' as const;

export const CF06_DISTRIBUTIONAL_ESTIMATOR_KINDS = [
  'QUANTILE_DOUBLY_ROBUST_RESEARCH',
  'KERNEL_DISTRIBUTIONAL_EMBEDDING_RESEARCH',
] as const;

export type Cf06DistributionalEstimatorKind = (typeof CF06_DISTRIBUTIONAL_ESTIMATOR_KINDS)[number];

export const CF06_VALIDATION_STRENGTH = ['NONE', 'WEAK', 'STRONG'] as const;
export type Cf06ValidationStrength = (typeof CF06_VALIDATION_STRENGTH)[number];
