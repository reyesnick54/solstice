import type { CapitalContext } from './types.ts';

export type InvestableCapital = {
  readonly brokerageCashMinor: bigint;
  readonly protectedLiquidityMinor: bigint;
  readonly scheduledObligationMinor: bigint;
  readonly unsettledMinor: bigint;
  readonly riskMinimumCashMinor: bigint;
  readonly investableMinor: bigint;
  readonly allCashIsInvestable: false;
};

/**
 * Investable capital is computed by deterministic code from existing facts.
 * The Mesh cannot decide that all cash is investable.
 */
export function computeInvestableCapital(context: CapitalContext): InvestableCapital {
  const protectedLiquidity = context.mandate.minimumLiquidMinor;
  const riskFloor = context.riskBudget.minimumBrokerageCashMinor;
  const reserved =
    max(protectedLiquidity, riskFloor) + context.scheduledObligationMinor + context.portfolio.unsettledCashMinor;
  const investable = context.portfolio.brokerageCashMinor - reserved;
  return Object.freeze({
    brokerageCashMinor: context.portfolio.brokerageCashMinor,
    protectedLiquidityMinor: protectedLiquidity,
    scheduledObligationMinor: context.scheduledObligationMinor,
    unsettledMinor: context.portfolio.unsettledCashMinor,
    riskMinimumCashMinor: riskFloor,
    investableMinor: investable > 0n ? investable : 0n,
    allCashIsInvestable: false,
  });
}

function max(left: bigint, right: bigint): bigint {
  return left > right ? left : right;
}
