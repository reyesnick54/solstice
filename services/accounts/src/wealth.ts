import type { CustomerId } from '../../../packages/domain/src/customer.ts';
import { isErr, ok, type Result } from '../../../packages/domain/src/result.ts';
import type { FxConversion } from '../../../packages/money/src/money.ts';
import {
  blendCustomerPosition,
  projectCurrencyIndexedPosition,
  type CustomerPosition,
  type MixedCurrencyWithoutConversion,
} from './balances.ts';
import type { Account } from '../../../packages/domain/src/account.ts';
import type { Ledger } from '../../../packages/ledger/src/journal.ts';

/**
 * FX valuation is injected. Phase C Prompt 4 owns live/simulated FX.
 * Until then the default port returns no rates and wealth stays unavailable.
 */
export type FxValuationPort = {
  conversionsFor(input: {
    readonly fromCurrencies: readonly string[];
    readonly toCurrency: string;
  }): readonly FxConversion[];
};

export const unavailableFxValuation: FxValuationPort = {
  conversionsFor() {
    return [];
  },
};

export type WealthValuation =
  | {
      readonly kind: 'POSITION';
      readonly position: CustomerPosition;
      readonly valuationCurrency: string;
      readonly valuationStatus: 'AVAILABLE' | 'NOT_REQUIRED';
      readonly reason: null;
    }
  | {
      readonly kind: 'UNAVAILABLE';
      readonly valuationCurrency: string;
      readonly valuationStatus: 'UNAVAILABLE';
      readonly currencies: readonly string[];
      readonly reason: string;
    };

export function projectCustomerWealth(
  ledger: Ledger,
  customerId: CustomerId,
  accounts: readonly Account[],
  valuationCurrency: string,
  fx: FxValuationPort = unavailableFxValuation,
): Result<WealthValuation, MixedCurrencyWithoutConversion> {
  const indexed = projectCurrencyIndexedPosition(ledger, customerId, accounts);
  if (isErr(indexed)) {
    return indexed;
  }
  if (indexed.value.currencies.length === 0) {
    return ok({
      kind: 'UNAVAILABLE',
      valuationCurrency,
      valuationStatus: 'UNAVAILABLE',
      currencies: [],
      reason: 'customer has no currency positions',
    });
  }
  if (indexed.value.currencies.length === 1 && indexed.value.currencies[0] === valuationCurrency) {
    const position = indexed.value.byCurrency[valuationCurrency];
    if (!position) {
      return ok({
        kind: 'UNAVAILABLE',
        valuationCurrency,
        valuationStatus: 'UNAVAILABLE',
        currencies: indexed.value.currencies,
        reason: 'indexed position missing valuation currency',
      });
    }
    return ok({
      kind: 'POSITION',
      position,
      valuationCurrency,
      valuationStatus: 'NOT_REQUIRED',
      reason: null,
    });
  }
  const conversions = fx.conversionsFor({
    fromCurrencies: indexed.value.currencies,
    toCurrency: valuationCurrency,
  });
  const blended = blendCustomerPosition(indexed.value, conversions, valuationCurrency);
  if (isErr(blended)) {
    return ok({
      kind: 'UNAVAILABLE',
      valuationCurrency,
      valuationStatus: 'UNAVAILABLE',
      currencies: indexed.value.currencies,
      reason:
        'FX valuation is unavailable; different currency minor units are never summed. Phase C Prompt 4 productizes FX.',
    });
  }
  return ok({
    kind: 'POSITION',
    position: blended.value,
    valuationCurrency,
    valuationStatus: 'AVAILABLE',
    reason: null,
  });
}
