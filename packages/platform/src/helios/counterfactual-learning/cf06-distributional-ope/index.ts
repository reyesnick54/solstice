/**
 * HELIOS CF06 — Distributional off-policy evaluation (counterfactual outcome distributions).
 *
 * Two research estimators:
 * - Quantile-based IPS / DR research path (`estimateDistributionalPolicyQuantileDoublyRobust`)
 * - Kernel-smoothed distributional embedding (`estimateDistributionalPolicyKernelEmbedding`)
 *
 * Qualification `HELIOS_CF06_DISTRIBUTIONAL_OPE_QUALIFIED` requires strong validation; weak
 * validation keeps outputs in research-only posture.
 */
export {
  HELIOS_CF06_DISTRIBUTIONAL_OPE_BLOCKED,
  HELIOS_CF06_DISTRIBUTIONAL_OPE_QUALIFIED,
  CF06_DISTRIBUTIONAL_ESTIMATOR_KINDS,
  CF06_VALIDATION_STRENGTH,
  type Cf06DistributionalEstimatorKind,
  type Cf06ValidationStrength,
} from './taxonomy.ts';

export type {
  Cf06LoggedTrajectorySample,
  CounterfactualOutcomeDistribution,
  CounterfactualQuantileEstimate,
  DistributionalPolicyEstimate,
  EstimatedPolicyOutcomeDifference,
  TailOutcomeState,
  Cf06QualificationResult,
} from './types.ts';

export { buildCounterfactualOutcomeDistribution } from './distribution-summary.ts';
export { estimateDistributionalPolicyQuantileDoublyRobust } from './quantile-dr.ts';
export { estimateDistributionalPolicyKernelEmbedding } from './kernel-embedding.ts';
export { compareFactualToEstimatedPolicyDistribution } from './comparison.ts';
export { evaluateCf06DistributionalOpeQualification } from './qualification.ts';
