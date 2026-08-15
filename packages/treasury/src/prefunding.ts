import { Money } from '../../money/src/money.ts';

export type PrefundingRequirement = {
  readonly corridorId: string;
  readonly routeId: string;
  readonly destinationCurrency: string;
  readonly destinationCountry: string;
  readonly required: Money;
};

export type PrefundingDecision =
  | { readonly executable: true; readonly required: Money; readonly available: Money }
  | {
      readonly executable: false;
      readonly reason: 'INSUFFICIENT_DESTINATION_LIQUIDITY' | 'CURRENCY_MISMATCH' | 'NO_PREFUNDING_BOOK';
      readonly required: Money;
      readonly available: Money | null;
    };

export function evaluatePrefunding(
  requirement: PrefundingRequirement,
  book: { readonly currency: string } | undefined,
  position: { readonly currency: string; readonly available: Money } | undefined,
): PrefundingDecision {
  if (!book || !position) {
    return {
      executable: false,
      reason: 'NO_PREFUNDING_BOOK',
      required: requirement.required,
      available: null,
    };
  }
  if (book.currency !== requirement.destinationCurrency || position.currency !== requirement.destinationCurrency) {
    return {
      executable: false,
      reason: 'CURRENCY_MISMATCH',
      required: requirement.required,
      available: position.available,
    };
  }
  const available = position.available;
  if (available.cmp(requirement.required) < 0) {
    return {
      executable: false,
      reason: 'INSUFFICIENT_DESTINATION_LIQUIDITY',
      required: requirement.required,
      available,
    };
  }
  return { executable: true, required: requirement.required, available };
}

export function requiredLiquidityFor(destinationAmount: Money): Money {
  return Money.fromMinorUnits(destinationAmount.minorUnits, destinationAmount.currency);
}
