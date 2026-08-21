import type { AuthorizationDecision, DecisionStatus } from '../../permissions/src/decision.ts';
import type { ActionIntent } from '../../permissions/src/action-intent.ts';
import type { ComplianceKernel } from './kernel.ts';
import type { KernelFacts } from './proofs.ts';

/**
 * Product-facing outcomes derived from canonical Kernel statuses.
 * This is not a second Kernel vocabulary. ALLOW/BLOCK/DEFER/
 * REQUIRE_MANUAL_REVIEW remain authoritative on AuthorizationDecision.
 */
export const PRODUCT_POLICY_OUTCOMES = [
  'ALLOW',
  'DENY',
  'REQUIRE_APPROVAL',
  'REQUIRE_STEP_UP_AUTH',
  'REQUIRE_COMPLIANCE_REVIEW',
  'UNAVAILABLE',
] as const;

export type ProductPolicyOutcome = (typeof PRODUCT_POLICY_OUTCOMES)[number];

export type ProductPolicyDecision = {
  readonly outcome: ProductPolicyOutcome;
  readonly kernel: AuthorizationDecision | null;
  readonly reason: string;
};

export function mapKernelStatus(status: DecisionStatus): ProductPolicyOutcome {
  switch (status) {
    case 'ALLOW':
      return 'ALLOW';
    case 'BLOCK':
      return 'DENY';
    case 'REQUIRE_MANUAL_REVIEW':
      return 'REQUIRE_COMPLIANCE_REVIEW';
    case 'DEFER':
      return 'UNAVAILABLE';
    default:
      return 'UNAVAILABLE';
  }
}

/**
 * Reusable Kernel submit adapter. Callers must not reinterpret the
 * enclosed AuthorizationDecision.
 */
export function evaluateThroughKernel(
  kernel: ComplianceKernel,
  intent: ActionIntent,
  facts: KernelFacts,
): ProductPolicyDecision {
  const decision = kernel.submit(intent, facts);
  return Object.freeze({
    outcome: mapKernelStatus(decision.status),
    kernel: decision,
    reason: decision.proofs.map((proof) => `${proof.proof}:${proof.status}`).join(';'),
  });
}
