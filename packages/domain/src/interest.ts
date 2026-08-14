import { type Brand, brandAs } from './brand.ts';
import type { AccountId } from './account.ts';
import type { CurrencyCode } from './currency.ts';
import type { UtcInstant } from './time.ts';

export const INTEREST_ROUNDING_MODES = ['FLOOR', 'CEILING', 'HALF_EVEN'] as const;

export type InterestRoundingMode = (typeof INTEREST_ROUNDING_MODES)[number];

export type InterestRateVersionId = Brand<string, 'InterestRateVersionId'>;
export type InterestAccrualId = Brand<string, 'InterestAccrualId'>;

export function asInterestRateVersionId(value: string): InterestRateVersionId {
  if (value.length === 0) {
    throw new TypeError('InterestRateVersionId must be a non-empty string');
  }
  return brandAs<string, 'InterestRateVersionId'>(value);
}

export function asInterestAccrualId(value: string): InterestAccrualId {
  if (value.length === 0) {
    throw new TypeError('InterestAccrualId must be a non-empty string');
  }
  return brandAs<string, 'InterestAccrualId'>(value);
}

/**
 * A referenced rate version. This is not a product APY and does not invent
 * a yield. Callers supply numerator/denominator; the framework only applies
 * integer allocation with an explicit rounding mode.
 */
export type InterestRateVersion = {
  readonly id: InterestRateVersionId;
  readonly reference: string;
  readonly numerator: bigint;
  readonly denominator: bigint;
  readonly rounding: InterestRoundingMode;
  readonly effectiveFrom: UtcInstant;
};

export type InterestAccrual = {
  readonly id: InterestAccrualId;
  readonly accountId: AccountId;
  readonly rateVersionId: InterestRateVersionId;
  readonly currency: CurrencyCode;
  readonly periodStart: UtcInstant;
  readonly periodEnd: UtcInstant;
  readonly principalMinorUnits: bigint;
  readonly accruedMinorUnits: bigint;
  readonly rounding: InterestRoundingMode;
  readonly journalId: string | null;
  readonly idempotencyKey: string;
  readonly createdAt: UtcInstant;
};

export function freezeRateVersion(version: InterestRateVersion): InterestRateVersion {
  if (typeof version.numerator !== 'bigint' || typeof version.denominator !== 'bigint') {
    throw new TypeError('interest rate parts must be bigint');
  }
  if (version.denominator === 0n) {
    throw new RangeError('interest rate denominator must be non-zero');
  }
  return Object.freeze({ ...version });
}

export function freezeAccrual(accrual: InterestAccrual): InterestAccrual {
  if (typeof accrual.accruedMinorUnits !== 'bigint') {
    throw new TypeError('accrued interest must be bigint minor units');
  }
  return Object.freeze({ ...accrual });
}
