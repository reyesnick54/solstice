import type { UtcInstant } from '../../domain/src/time.ts';
import { Money } from '../../money/src/money.ts';
import { assertNoSensitiveCardData } from './pci-boundary.ts';
import type { CardAuthorizationId, CardClearingId, CardId, CardSettlementId } from './ids.ts';

export const CLEARING_SCENARIOS = [
  'EXACT',
  'PARTIAL',
  'OVERAGE_WITHIN_TOLERANCE',
  'OVERAGE_EXCEEDS_TOLERANCE',
  'LATE_PRESENTMENT',
  'FORCE_POST_NO_AUTH',
] as const;

export type ClearingScenario = (typeof CLEARING_SCENARIOS)[number];

export const CLEARING_STATES = ['RECEIVED', 'SETTLED', 'REJECTED', 'DUPLICATE'] as const;
export type ClearingState = (typeof CLEARING_STATES)[number];

export type CardClearingRecord = {
  readonly clearingId: CardClearingId;
  readonly cardId: CardId;
  readonly authorizationId: CardAuthorizationId | null;
  readonly amount: Money;
  readonly scenario: ClearingScenario;
  readonly state: ClearingState;
  readonly processorReference: string;
  readonly settlementId: CardSettlementId | null;
  readonly journalId: string | null;
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
};

export function classifyClearing(input: {
  readonly authorizationAmount: Money | null;
  readonly clearingAmount: Money;
  readonly authorizationPresent: boolean;
  readonly authorizationExpired: boolean;
  readonly overageToleranceMinor: bigint;
}): ClearingScenario {
  if (!input.authorizationPresent) {
    return 'FORCE_POST_NO_AUTH';
  }
  if (input.authorizationExpired) {
    return 'LATE_PRESENTMENT';
  }
  const auth = input.authorizationAmount;
  if (!auth) {
    return 'FORCE_POST_NO_AUTH';
  }
  const cmp = input.clearingAmount.cmp(auth);
  if (cmp === 0) {
    return 'EXACT';
  }
  if (cmp < 0) {
    return 'PARTIAL';
  }
  const overage = input.clearingAmount.minorUnits - auth.minorUnits;
  if (overage <= input.overageToleranceMinor) {
    return 'OVERAGE_WITHIN_TOLERANCE';
  }
  return 'OVERAGE_EXCEEDS_TOLERANCE';
}

export function freezeClearing(record: CardClearingRecord): CardClearingRecord {
  assertNoSensitiveCardData(record, 'clearing');
  if (!(record.amount instanceof Money) || typeof record.amount.minorUnits !== 'bigint') {
    throw new TypeError('clearing amount must be Money bigint minor units');
  }
  return Object.freeze({ ...record });
}
