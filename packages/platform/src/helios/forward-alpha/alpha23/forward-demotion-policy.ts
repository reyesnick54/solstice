import { createHash } from 'node:crypto';

import {
  ALPHA23_SCHEMA,
  FORBIDDEN_AUTOMATIC_RESEARCH_ACTIONS,
  type ForwardDemotionPolicy,
} from './taxonomy.ts';

const DEFAULT_POLICY_ID = 'helios.alpha23.forward-demotion.default.v1';

function defaultPolicyHash(): string {
  return createHash('sha256').update(DEFAULT_POLICY_ID).digest('hex').slice(0, 16);
}

/**
 * Default fail-closed demotion policy — prefers stopping a failing strategy over extending it.
 */
export function defaultForwardDemotionPolicy(
  overrides?: Partial<
    Pick<
      ForwardDemotionPolicy,
      | 'maxDrawdownBps'
      | 'minAlphaConfidenceBps'
      | 'maxBenchmarkUnderperformanceBps'
      | 'maxExecutionCostBps'
      | 'maxDecisionRateChangeBps'
      | 'minCapacityHeadroomBps'
      | 'minSequentialEvidenceStrengthBps'
      | 'policyId'
      | 'policyHash'
    >
  >,
): ForwardDemotionPolicy {
  return Object.freeze({
    schema: ALPHA23_SCHEMA,
    policyId: overrides?.policyId ?? DEFAULT_POLICY_ID,
    policyHash: overrides?.policyHash ?? defaultPolicyHash(),
    maxDrawdownBps: overrides?.maxDrawdownBps ?? 1_500,
    minAlphaConfidenceBps: overrides?.minAlphaConfidenceBps ?? 4_500,
    maxBenchmarkUnderperformanceBps: overrides?.maxBenchmarkUnderperformanceBps ?? 400,
    maxExecutionCostBps: overrides?.maxExecutionCostBps ?? 80,
    maxDecisionRateChangeBps: overrides?.maxDecisionRateChangeBps ?? 2_500,
    minCapacityHeadroomBps: overrides?.minCapacityHeadroomBps ?? 2_000,
    minSequentialEvidenceStrengthBps: overrides?.minSequentialEvidenceStrengthBps ?? 3_500,
    permitsRiskIncrease: false,
    forbiddenAutomaticActions: FORBIDDEN_AUTOMATIC_RESEARCH_ACTIONS,
  });
}

export function assertNoForbiddenAutomaticAction(
  policy: ForwardDemotionPolicy,
  requested: string,
): { readonly ok: true } | { readonly ok: false; readonly action: string } {
  const forbidden = new Set(policy.forbiddenAutomaticActions);
  if (forbidden.has(requested as (typeof FORBIDDEN_AUTOMATIC_RESEARCH_ACTIONS)[number])) {
    return Object.freeze({ ok: false, action: requested });
  }
  return Object.freeze({ ok: true });
}
