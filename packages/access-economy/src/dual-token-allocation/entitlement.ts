/**
 * ACCESS-15 entitlement issuance through canonical access-fabric semantics.
 * Non-cash, non-transferable, non-withdrawable.
 */

import { accessEntitlementIdFor } from '../ids.ts';
import type { SubjectRef } from '../ids.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';
import type {
  AccessAllocationRecord,
  AccessEconomicMode,
  IssuedAccessEntitlement,
} from './types.ts';

export function issueEntitlementsFromAllocations(input: {
  readonly allocations: readonly AccessAllocationRecord[];
  readonly expiresAt: UtcInstant;
  readonly economicMode?: AccessEconomicMode;
}): readonly IssuedAccessEntitlement[] {
  const economicMode = input.economicMode ?? 'INCLUDED_ACCESS';
  return Object.freeze(
    input.allocations.map((allocation) =>
      Object.freeze({
        entitlementId: accessEntitlementIdFor(
          `${allocation.epochId}:${allocation.subjectRef}:${allocation.category}`,
        ),
        subjectRef: allocation.subjectRef as SubjectRef,
        epochId: allocation.epochId,
        category: allocation.category,
        quantity: allocation.allocatedUnits,
        unit: allocation.capacityUnit,
        transferability: false as const,
        isMonetaryAsset: false as const,
        isWithdrawable: false as const,
        expiresAt: input.expiresAt,
        economicMode,
      }),
    ),
  );
}
