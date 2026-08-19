import { err, ok, type Result } from '../../../domain/src/result.ts';
import { valuationFailure, type ValuationFailure } from './types.ts';

export const REFERENCE_VALUE_CLASSES = [
  'CONTRACT_REFERENCE',
  'FIAT_REFERENCE',
  'GOVERNED_SETTLEMENT_REFERENCE',
  'NON_MONETARY_REFERENCE_UNIT',
] as const;
export type ReferenceValueClass = (typeof REFERENCE_VALUE_CLASSES)[number];

const FORBIDDEN_SUNREY_DENOMINATIONS = ['SUNREY', 'SUNREY_COIN', 'MOONREY', 'MOONREY_COIN'] as const;

export type ContributionReferenceValue = {
  readonly amount: bigint;
  readonly denomination: string;
  readonly minorUnitPrecision: bigint;
  readonly valueClass: ReferenceValueClass;
  readonly isSunReyQuantity: false;
  readonly isPEVEScore: false;
  readonly isHumanWorth: false;
  readonly createsMintAuthority: false;
};

export type ReferenceValueInput = {
  readonly amount: bigint;
  readonly denomination: string;
  readonly minorUnitPrecision: bigint;
  readonly valueClass: ReferenceValueClass;
};

export function createContributionReferenceValue(input: ReferenceValueInput): Result<ContributionReferenceValue, ValuationFailure> {
  if (typeof input.amount !== 'bigint' || typeof input.minorUnitPrecision !== 'bigint') {
    return err(valuationFailure('FLOAT_MONETARY_MATH_FORBIDDEN', 'reference values admit only bigint amounts and precision'));
  }
  if (input.minorUnitPrecision < 0n) {
    return err(valuationFailure('INVALID_POLICY', 'minorUnitPrecision cannot be negative'));
  }
  if ((FORBIDDEN_SUNREY_DENOMINATIONS as readonly string[]).includes(input.denomination)) {
    return err(valuationFailure('SUNREY_QUANTITY_FORBIDDEN', 'a contribution reference value cannot be a SunRey quantity'));
  }
  if (!(REFERENCE_VALUE_CLASSES as readonly string[]).includes(input.valueClass)) {
    return err(valuationFailure('INVALID_POLICY', `unknown reference value class '${input.valueClass}'`));
  }
  return ok(
    Object.freeze({
      amount: input.amount,
      denomination: input.denomination,
      minorUnitPrecision: input.minorUnitPrecision,
      valueClass: input.valueClass,
      isSunReyQuantity: false,
      isPEVEScore: false,
      isHumanWorth: false,
      createsMintAuthority: false,
    }),
  );
}

export function referenceValueIsNotSunRey(value: ContributionReferenceValue): boolean {
  return value.isSunReyQuantity === false && value.createsMintAuthority === false;
}
