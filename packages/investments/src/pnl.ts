import { Money } from '../../contracts/src/money.ts';
import type {
  RealizedInvestmentLoss,
  RealizedSettledProfit,
  UnrealizedPnL,
} from '../../contracts/src/investment-types.ts';

export function realizedSettledProfit(amount: Money): RealizedSettledProfit {
  if (amount.isNegative()) {
    throw new Error('RealizedSettledProfit amount must be non-negative');
  }
  return Object.freeze({
    kind: 'REALIZED_SETTLED',
    amount,
    settled: true,
    withdrawable: true,
  });
}

export function unrealizedPnL(amount: Money): UnrealizedPnL {
  return Object.freeze({
    kind: 'UNREALIZED',
    amount,
    settled: false,
    withdrawable: false,
  });
}

export function realizedLoss(amount: Money): RealizedInvestmentLoss {
  if (amount.isNegative()) {
    throw new Error('RealizedInvestmentLoss amount must be non-negative');
  }
  return Object.freeze({
    kind: 'REALIZED_LOSS',
    amount,
    settled: true,
    withdrawable: false,
  });
}

/**
 * Realized and unrealized are different types. There is no combined P&L
 * figure. Calling this is a type-level and runtime rejection.
 */
export function sumRealizedAndUnrealized(
  _realized: RealizedSettledProfit,
  _unrealized: UnrealizedPnL,
): never {
  throw new Error(
    'Realized and unrealized P&L are distinct types and cannot be summed',
  );
}

export type UnsweepableMark = UnrealizedPnL;

/**
 * Harvest accepts only RealizedSettledProfit. Passing UnrealizedPnL is a
 * type error (RejectUnrealized<T> = never). This runtime helper exists for
 * widened/unknown callers and always rejects unrealized.
 */
export function rejectUnrealizedSweep(source: { readonly kind: string }): {
  readonly ok: false;
  readonly code: 'UNREALIZED_IS_UNSWEEPABLE';
} {
  void source;
  return { ok: false, code: 'UNREALIZED_IS_UNSWEEPABLE' };
}
