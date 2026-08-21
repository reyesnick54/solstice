/**
 * Provider-independent payment limits. Policy/configuration — not Lovable.
 * Regulatory compatibility remains a Kernel filter, not a score.
 */

import type { CurrencyCode } from '../../../domain/src/currency.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';
import type { Money } from '../../../money/src/money.ts';
import type { PaymentType, RailPreference } from './payment-intent.ts';

export const PAYMENT_LIMIT_POLICY_ID = 'payments.limits.v1' as const;

export type LimitWindow = 'TRANSACTION' | 'DAILY' | 'WEEKLY' | 'MONTHLY';

export type PaymentLimitDimension = {
  readonly window: LimitWindow;
  readonly currency: CurrencyCode | '*';
  readonly rail: RailPreference | '*';
  readonly paymentType: PaymentType | '*';
  readonly jurisdiction: string | '*';
  readonly riskClass: 'LOW' | 'STANDARD' | 'ELEVATED' | '*';
  readonly maxMinorUnits: bigint;
};

export type PaymentLimitsPolicy = {
  readonly policyId: typeof PAYMENT_LIMIT_POLICY_ID;
  readonly dimensions: readonly PaymentLimitDimension[];
};

export const DEFAULT_PAYMENT_LIMITS: PaymentLimitsPolicy = Object.freeze({
  policyId: PAYMENT_LIMIT_POLICY_ID,
  dimensions: Object.freeze([
    Object.freeze({
      window: 'TRANSACTION',
      currency: '*',
      rail: '*',
      paymentType: '*',
      jurisdiction: '*',
      riskClass: '*',
      maxMinorUnits: 10_000_000n,
    }),
    Object.freeze({
      window: 'DAILY',
      currency: '*',
      rail: '*',
      paymentType: '*',
      jurisdiction: '*',
      riskClass: '*',
      maxMinorUnits: 50_000_000n,
    }),
    Object.freeze({
      window: 'WEEKLY',
      currency: '*',
      rail: '*',
      paymentType: '*',
      jurisdiction: '*',
      riskClass: '*',
      maxMinorUnits: 150_000_000n,
    }),
    Object.freeze({
      window: 'MONTHLY',
      currency: '*',
      rail: '*',
      paymentType: '*',
      jurisdiction: '*',
      riskClass: '*',
      maxMinorUnits: 400_000_000n,
    }),
  ]),
});

export type LimitUsage = {
  readonly amount: Money;
  readonly at: UtcInstant;
  readonly currency: CurrencyCode;
  readonly rail: RailPreference;
  readonly paymentType: PaymentType;
  readonly jurisdiction: string;
  readonly riskClass: 'LOW' | 'STANDARD' | 'ELEVATED';
};

export type LimitDecision =
  | { readonly outcome: 'ALLOW' }
  | {
      readonly outcome: 'LIMIT_EXCEEDED';
      readonly window: LimitWindow;
      readonly maxMinorUnits: string;
      readonly attemptedMinorUnits: string;
    };

const WINDOW_MS: Record<Exclude<LimitWindow, 'TRANSACTION'>, number> = {
  DAILY: 24 * 60 * 60 * 1000,
  WEEKLY: 7 * 24 * 60 * 60 * 1000,
  MONTHLY: 30 * 24 * 60 * 60 * 1000,
};

function matches(dimension: PaymentLimitDimension, usage: Omit<LimitUsage, 'amount' | 'at'>): boolean {
  return (
    (dimension.currency === '*' || dimension.currency === usage.currency) &&
    (dimension.rail === '*' || dimension.rail === usage.rail) &&
    (dimension.paymentType === '*' || dimension.paymentType === usage.paymentType) &&
    (dimension.jurisdiction === '*' || dimension.jurisdiction === usage.jurisdiction) &&
    (dimension.riskClass === '*' || dimension.riskClass === usage.riskClass)
  );
}

export function evaluatePaymentLimits(
  attempted: LimitUsage,
  history: readonly LimitUsage[],
  policy: PaymentLimitsPolicy = DEFAULT_PAYMENT_LIMITS,
): LimitDecision {
  const nowMs = Date.parse(attempted.at);
  for (const dimension of policy.dimensions) {
    if (!matches(dimension, attempted)) {
      continue;
    }
    let used = 0n;
    if (dimension.window === 'TRANSACTION') {
      used = attempted.amount.minorUnits;
    } else {
      const windowMs = WINDOW_MS[dimension.window];
      used = history
        .filter((row) => matches(dimension, row) && nowMs - Date.parse(row.at) < windowMs)
        .reduce((sum, row) => sum + row.amount.minorUnits, 0n);
      used += attempted.amount.minorUnits;
    }
    if (used > dimension.maxMinorUnits) {
      return Object.freeze({
        outcome: 'LIMIT_EXCEEDED',
        window: dimension.window,
        maxMinorUnits: dimension.maxMinorUnits.toString(),
        attemptedMinorUnits: used.toString(),
      });
    }
  }
  return Object.freeze({ outcome: 'ALLOW' });
}
