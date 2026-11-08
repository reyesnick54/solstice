import type { ForwardStrategyPortfolio, PortfolioCapitalAllocation, StrategyCapitalDeployment } from './types.ts';

export type PortfolioAllocationPolicy = {
  /** Target cash held as bps of total capital (0–10_000). */
  readonly cashReserveBps: number;
  /** Per-strategy weights in bps; when omitted, equal-weight across legs. */
  readonly strategyWeightBps?: Readonly<Record<string, number>>;
};

function parseMinor(value: string): bigint {
  return BigInt(value);
}

/**
 * Builds a single-pool capital allocation. Each minor unit is assigned at most once
 * (deployed sleeves plus cash).
 */
export function buildPortfolioCapitalAllocation(
  portfolio: ForwardStrategyPortfolio,
  policy: PortfolioAllocationPolicy,
): PortfolioCapitalAllocation {
  const total = parseMinor(portfolio.totalCapitalMinor);
  const cashReserveBps = Math.min(10_000, Math.max(0, policy.cashReserveBps));
  const cashMinor = (total * BigInt(cashReserveBps)) / 10_000n;
  const deployable = total - cashMinor;

  const explicit = policy.strategyWeightBps;
  const legs = portfolio.legs;
  let weightTotal = 0;
  const weights: number[] = [];
  for (const leg of legs) {
    const w = explicit?.[leg.strategyId] ?? Math.floor(10_000 / Math.max(1, legs.length));
    weights.push(w);
    weightTotal += w;
  }
  if (weightTotal <= 0) {
    throw new Error('portfolio allocation requires positive strategy weights');
  }

  const deployments: StrategyCapitalDeployment[] = [];
  let deployedSum = 0n;
  for (let i = 0; i < legs.length; i += 1) {
    const leg = legs[i]!;
    const share = (deployable * BigInt(weights[i]!)) / BigInt(weightTotal);
    deployedSum += share;
    deployments.push(
      Object.freeze({
        strategyId: leg.strategyId,
        weightBps: Math.round((weights[i]! * 10_000) / weightTotal),
        allocatedCapitalMinor: share.toString(),
      }),
    );
  }

  const capitalConserved = deployedSum + cashMinor === total;
  return Object.freeze({
    portfolioId: portfolio.portfolioId,
    totalCapitalMinor: portfolio.totalCapitalMinor,
    cashMinor: cashMinor.toString(),
    deployments: Object.freeze(deployments),
    deploymentWeightBpsTotal: deployments.reduce((acc, row) => acc + row.weightBps, 0),
    capitalConserved,
  });
}

export function assertNoCapitalDoubleCount(allocation: PortfolioCapitalAllocation): string | null {
  if (!allocation.capitalConserved) {
    return 'CAPITAL_NOT_CONSERVED';
  }
  const total = parseMinor(allocation.totalCapitalMinor);
  const cash = parseMinor(allocation.cashMinor);
  let deployed = 0n;
  for (const row of allocation.deployments) {
    deployed += parseMinor(row.allocatedCapitalMinor);
  }
  if (deployed + cash !== total) {
    return 'CAPITAL_DOUBLE_COUNT';
  }
  return null;
}
