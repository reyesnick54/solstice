import { type Brand, brandAs } from './brand.ts';
import type { AccountId } from './account.ts';
import type { CurrencyCode } from './currency.ts';
import type { UtcInstant } from './time.ts';

export type FeeId = Brand<string, 'FeeId'>;

export function asFeeId(value: string): FeeId {
  if (value.length === 0) {
    throw new TypeError('FeeId must be a non-empty string');
  }
  return brandAs<string, 'FeeId'>(value);
}

export const FEE_TYPES = ['FIXED', 'BASIS_POINTS'] as const;

export type FeeType = (typeof FEE_TYPES)[number];

/**
 * Canonical fee assessment. The assessed amount is always integer minor
 * units. BASIS_POINTS uses rational numerator/denominator (e.g. 25/10000).
 * The fee is not subtracted in place — it is posted as an explicit journal.
 */
export type FeeAssessment = {
  readonly id: FeeId;
  readonly accountId: AccountId;
  readonly feeType: FeeType;
  readonly currency: CurrencyCode;
  readonly assessedMinorUnits: bigint;
  readonly fixedMinorUnits: bigint | null;
  readonly basisPointsNumerator: bigint | null;
  readonly basisPointsDenominator: bigint | null;
  readonly journalId: string | null;
  readonly idempotencyKey: string;
  readonly createdAt: UtcInstant;
};

export function freezeFee(fee: FeeAssessment): FeeAssessment {
  if (typeof fee.assessedMinorUnits !== 'bigint' || fee.assessedMinorUnits <= 0n) {
    throw new TypeError('fee assessed amount must be a positive bigint');
  }
  return Object.freeze({ ...fee });
}
