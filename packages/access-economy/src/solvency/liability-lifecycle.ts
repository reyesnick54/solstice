/**
 * ACCESS-16 — ProviderSettlementLiability lifecycle.
 */

import type { ProviderSettlementLiability, SettlementLiabilityState } from './types.ts';
import { SETTLEMENT_LIABILITY_STATES } from './taxonomy.ts';

const TRANSITIONS = {
  QUOTED: ['RESERVED', 'RELEASED'],
  RESERVED: ['COMMITTED', 'RELEASED'],
  COMMITTED: ['CAPTURED', 'RELEASED', 'DEFAULT_REVIEW'],
  CAPTURED: ['REFUNDED'],
  RELEASED: [],
  REFUNDED: [],
  DEFAULT_REVIEW: ['RELEASED', 'CAPTURED'],
} as const satisfies Readonly<Record<SettlementLiabilityState, readonly SettlementLiabilityState[]>>;

export function canTransitionLiability(
  from: SettlementLiabilityState,
  to: SettlementLiabilityState,
): boolean {
  return TRANSITIONS[from].includes(to);
}

export function transitionLiability(
  liability: ProviderSettlementLiability,
  to: SettlementLiabilityState,
): ProviderSettlementLiability | { readonly ok: false; readonly code: string; readonly message: string } {
  if (!canTransitionLiability(liability.settlementState, to)) {
    return Object.freeze({
      ok: false as const,
      code: 'INVALID_TRANSITION',
      message: `cannot transition ${liability.settlementState} → ${to}`,
    });
  }
  return Object.freeze({ ...liability, settlementState: to });
}

export function createQuotedLiability(input: {
  readonly liabilityId: string;
  readonly providerRef: string;
  readonly reservationId: string;
  readonly currency: string;
  readonly quotedAmountMinorUnits: bigint;
  readonly maximumExposureMinorUnits: bigint;
  readonly jurisdiction: string;
  readonly category: string;
  readonly epoch: string;
  readonly expiration: string;
  readonly evidenceRefs: readonly string[];
}): ProviderSettlementLiability {
  return Object.freeze({
    liabilityId: input.liabilityId,
    providerRef: input.providerRef,
    reservationId: input.reservationId,
    currency: input.currency,
    quotedAmountMinorUnits: input.quotedAmountMinorUnits,
    reservedAmountMinorUnits: 0n,
    maximumExposureMinorUnits: input.maximumExposureMinorUnits,
    jurisdiction: input.jurisdiction,
    category: input.category,
    epoch: input.epoch,
    expiration: input.expiration,
    settlementState: 'QUOTED',
    evidenceRefs: Object.freeze([...input.evidenceRefs]),
  });
}

export function isActiveLiability(liability: ProviderSettlementLiability): boolean {
  return liability.settlementState === 'RESERVED' || liability.settlementState === 'COMMITTED';
}

export function isConfirmedLiability(liability: ProviderSettlementLiability): boolean {
  return liability.settlementState === 'COMMITTED' || liability.settlementState === 'CAPTURED';
}

export function allLiabilityStates(): readonly SettlementLiabilityState[] {
  return SETTLEMENT_LIABILITY_STATES;
}
