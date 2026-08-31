/**
 * ACCESS Wave 3 — entitlement restoration on cancellation/refund.
 */

import type { AccessCategoryId } from '../domain/taxonomy.ts';
import type { AccessFulfillmentEvidence } from './types.ts';

export type EntitlementRestorationDecision = {
  readonly restoreUnits: bigint;
  readonly reason: string;
  readonly policyId: string;
  readonly policyVersion: string;
};

export type AccessEntitlementRestorationPolicy = {
  readonly policyId: string;
  readonly version: string;
  readonly category: AccessCategoryId;
  readonly evaluate: (input: {
    readonly originalUnitsConsumed: bigint;
    readonly fulfillmentEvidence: readonly AccessFulfillmentEvidence[];
    readonly cancellationTiming: 'BEFORE_SERVICE' | 'AFTER_SERVICE' | 'PARTIAL_USE';
    readonly providerNonRefundable: boolean;
    readonly noShow: boolean;
  }) => EntitlementRestorationDecision;
};

function proportionalRestore(original: bigint, refundRatio: number): bigint {
  if (refundRatio <= 0) return 0n;
  if (refundRatio >= 1) return original;
  return (original * BigInt(Math.floor(refundRatio * 1000))) / 1000n;
}

const MOBILITY_RESTORATION: AccessEntitlementRestorationPolicy = Object.freeze({
  policyId: 'MOBILITY_RESTORATION',
  version: 'v1',
  category: 'MOBILITY',
  evaluate(input) {
    if (input.noShow) {
      return Object.freeze({
        restoreUnits: 0n,
        reason: 'no-show under valid provider terms',
        policyId: 'MOBILITY_RESTORATION',
        policyVersion: 'v1',
      });
    }
    if (input.providerNonRefundable) {
      return Object.freeze({
        restoreUnits: 0n,
        reason: 'provider non-refundable terms',
        policyId: 'MOBILITY_RESTORATION',
        policyVersion: 'v1',
      });
    }
    if (input.cancellationTiming === 'BEFORE_SERVICE') {
      return Object.freeze({
        restoreUnits: input.originalUnitsConsumed,
        reason: 'full restoration before service',
        policyId: 'MOBILITY_RESTORATION',
        policyVersion: 'v1',
      });
    }
    if (input.cancellationTiming === 'PARTIAL_USE') {
      const used = input.fulfillmentEvidence.reduce((sum, row) => sum + row.quantityFulfilled, 0n);
      const restore = input.originalUnitsConsumed > used ? input.originalUnitsConsumed - used : 0n;
      return Object.freeze({
        restoreUnits: restore,
        reason: 'partial use restoration',
        policyId: 'MOBILITY_RESTORATION',
        policyVersion: 'v1',
      });
    }
    return Object.freeze({
      restoreUnits: 0n,
      reason: 'after service cancellation',
      policyId: 'MOBILITY_RESTORATION',
      policyVersion: 'v1',
    });
  },
});

const EXPERIENCES_RESTORATION: AccessEntitlementRestorationPolicy = Object.freeze({
  policyId: 'EXPERIENCES_RESTORATION',
  version: 'v1',
  category: 'EXPERIENCES',
  evaluate(input) {
    if (input.providerNonRefundable || input.cancellationTiming !== 'BEFORE_SERVICE') {
      return Object.freeze({
        restoreUnits: 0n,
        reason: 'non-refundable event ticket policy',
        policyId: 'EXPERIENCES_RESTORATION',
        policyVersion: 'v1',
      });
    }
    return Object.freeze({
      restoreUnits: input.originalUnitsConsumed,
      reason: 'pre-event cancellation',
      policyId: 'EXPERIENCES_RESTORATION',
      policyVersion: 'v1',
    });
  },
});

const DEFAULT_RESTORATION: AccessEntitlementRestorationPolicy = Object.freeze({
  policyId: 'DEFAULT_RESTORATION',
  version: 'v1',
  category: 'OTHER',
  evaluate(input) {
    const ratio = input.providerNonRefundable ? 0 : input.cancellationTiming === 'BEFORE_SERVICE' ? 1 : 0;
    return Object.freeze({
      restoreUnits: proportionalRestore(input.originalUnitsConsumed, ratio),
      reason: 'default restoration policy',
      policyId: 'DEFAULT_RESTORATION',
      policyVersion: 'v1',
    });
  },
});

const RESTORATION_REGISTRY: Partial<Record<AccessCategoryId, AccessEntitlementRestorationPolicy>> = Object.freeze({
  MOBILITY: MOBILITY_RESTORATION,
  EXPERIENCES: EXPERIENCES_RESTORATION,
});

export function resolveEntitlementRestorationPolicy(category: AccessCategoryId): AccessEntitlementRestorationPolicy {
  return RESTORATION_REGISTRY[category] ?? DEFAULT_RESTORATION;
}
