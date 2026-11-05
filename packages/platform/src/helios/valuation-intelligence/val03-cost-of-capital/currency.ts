/**
 * Currency and inflation consistency guards for discounting.
 */

import type { CostOfCapitalInput } from './types.ts';

export type CurrencyConsistencyResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: string };

export function assertCurrencyConsistency(input: CostOfCapitalInput): CurrencyConsistencyResult {
  if (input.cashFlowCurrency !== input.discountCurrency) {
    return Object.freeze({
      ok: false,
      reason: `cash flow currency ${input.cashFlowCurrency} must match discount currency ${input.discountCurrency}`,
    });
  }
  if (input.yieldCurve.currency !== input.discountCurrency) {
    return Object.freeze({
      ok: false,
      reason: `yield curve currency ${input.yieldCurve.currency} must match discount currency ${input.discountCurrency}`,
    });
  }
  return Object.freeze({ ok: true });
}
