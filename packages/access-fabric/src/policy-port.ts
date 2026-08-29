import type { UtcInstant } from '../../domain/src/time.ts';
import type { AccessPolicyEligibilityDecision } from './types.ts';

/**
 * Policy eligibility port — callers integrate Regulatory Digital Twin or Kernel
 * policy evaluation externally. This package never embeds country-specific rules.
 */
export type AccessPolicyEligibilityPort = {
  readonly evaluate: (input: {
    readonly subjectId: string;
    readonly entitlementId: string;
    readonly category: string;
    readonly purpose: string;
    readonly jurisdiction: string;
    readonly geographicScope: string;
    readonly evaluatedAt: UtcInstant;
  }) => AccessPolicyEligibilityDecision;
};

export function policyDecisionIndex(
  decisions: readonly AccessPolicyEligibilityDecision[],
): ReadonlyMap<string, AccessPolicyEligibilityDecision> {
  return new Map(decisions.map((decision) => [decision.entitlementId, decision]));
}

export function mergePolicyDecisions(
  existing: readonly AccessPolicyEligibilityDecision[],
  evaluated: readonly AccessPolicyEligibilityDecision[],
): readonly AccessPolicyEligibilityDecision[] {
  const merged = new Map(existing.map((decision) => [decision.entitlementId, decision]));
  for (const decision of evaluated) {
    merged.set(decision.entitlementId, decision);
  }
  return Object.freeze([...merged.values()]);
}
