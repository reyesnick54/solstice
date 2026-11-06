import { evaluateOffPolicyMultiEstimator } from './off-policy-evaluator.ts';
import {
  HELIOS_CF05_DOUBLY_ROBUST_OPE_QUALIFIED,
  HELIOS_CF05_OPE_BLOCKED,
} from './taxonomy.ts';
import type { MultiEstimatorOffPolicyResult } from './types.ts';

export { HELIOS_CF05_DOUBLY_ROBUST_OPE_QUALIFIED, HELIOS_CF05_OPE_BLOCKED };

/**
 * Re-evaluate qualification for an existing CF05 result (no re-bootstrap).
 */
export function qualifyCf05OffPolicyEstimate(result: MultiEstimatorOffPolicyResult): MultiEstimatorOffPolicyResult['qualification'] {
  return result.qualification;
}

export function evaluateCf05OffPolicyQualification(result: MultiEstimatorOffPolicyResult): MultiEstimatorOffPolicyResult['qualification'] {
  return result.qualification;
}

/**
 * Convenience: run evaluation and return only qualification (marker + blockers).
 */
export function runCf05Qualification(
  ...args: Parameters<typeof evaluateOffPolicyMultiEstimator>
): MultiEstimatorOffPolicyResult['qualification'] {
  return evaluateOffPolicyMultiEstimator(...args).qualification;
}
