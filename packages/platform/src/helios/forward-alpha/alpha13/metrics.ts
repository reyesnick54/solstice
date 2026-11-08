import type {
  ForwardStrategyPortfolio,
  PortfolioCapitalAllocation,
  PortfolioForwardEvidence,
  StrategyAttributionSlice,
  StrategyInteractionState,
} from './types.ts';
import { computeAlphaBreadth } from './alpha-breadth.ts';
import { HELIOS_ALPHA13_PORTFOLIO_FORWARD_EVIDENCE_SCHEMA } from './taxonomy.ts';
import type { AlphaBreadth } from './types.ts';

function weightedSum(
  portfolio: ForwardStrategyPortfolio,
  allocation: PortfolioCapitalAllocation,
  field: 'periodReturnBps' | 'activeReturnBps' | 'standaloneAlphaBps' | 'maxDrawdownBps',
): number {
  const weightByStrategy = new Map(allocation.deployments.map((row) => [row.strategyId, row.weightBps]));
  let totalWeight = 0;
  let acc = 0;
  for (const leg of portfolio.legs) {
    const w = weightByStrategy.get(leg.strategyId) ?? 0;
    totalWeight += w;
    acc += (leg[field] * w) / 10_000;
  }
  if (totalWeight === 0) {
    return 0;
  }
  return Math.round((acc * 10_000) / totalWeight);
}

function portfolioVolatilityBps(portfolio: ForwardStrategyPortfolio, allocation: PortfolioCapitalAllocation): number {
  const weightByStrategy = new Map(allocation.deployments.map((row) => [row.strategyId, row.weightBps]));
  const len = portfolio.legs[0]?.returnSeriesBps.length ?? 0;
  if (len === 0) {
    return 0;
  }
  const series: number[] = [];
  for (let t = 0; t < len; t += 1) {
    let r = 0;
    let wSum = 0;
    for (const leg of portfolio.legs) {
      const w = weightByStrategy.get(leg.strategyId) ?? 0;
      r += ((leg.returnSeriesBps[t] ?? 0) * w) / 10_000;
      wSum += w;
    }
    series.push(wSum > 0 ? Math.round((r * 10_000) / wSum) : 0);
  }
  const mean = series.reduce((a, b) => a + b, 0) / series.length;
  const variance = series.reduce((a, b) => a + (b - mean) ** 2, 0) / series.length;
  return Math.round(Math.sqrt(variance));
}

function mergeFactorExposures(
  portfolio: ForwardStrategyPortfolio,
  allocation: PortfolioCapitalAllocation,
): Readonly<Record<string, number>> {
  const out: Record<string, number> = {};
  const weightByStrategy = new Map(allocation.deployments.map((row) => [row.strategyId, row.weightBps]));
  for (const leg of portfolio.legs) {
    const w = weightByStrategy.get(leg.strategyId) ?? 0;
    for (const [factor, exposure] of Object.entries(leg.factorExposureBps)) {
      out[factor] = (out[factor] ?? 0) + Math.round((exposure * w) / 10_000);
    }
  }
  return Object.freeze(out);
}

function deduplicateAlphaBps(
  portfolio: ForwardStrategyPortfolio,
  allocation: PortfolioCapitalAllocation,
  interaction: StrategyInteractionState,
): { readonly deduplicated: number; readonly naive: number; readonly blocked: number } {
  /** Uncorrected researcher sum — would double-count overlapping economic exposure. */
  const naive = portfolio.legs.reduce((acc, leg) => acc + leg.standaloneAlphaBps, 0);
  const weightedActive = weightedSum(portfolio, allocation, 'activeReturnBps');
  const overlapShareBps = Math.min(10_000, interaction.duplicateAlphaExposureBps);
  const highlyCorrelatedPairs = Object.values(interaction.pairwiseReturnCorrelationScale).filter(
    (v) => v >= 8_500,
  ).length;
  const overlapFractionBps =
    highlyCorrelatedPairs > 0 ? Math.max(overlapShareBps, 5_000) : overlapShareBps;
  const economicAlphaBps = Math.round((weightedActive * (10_000 - Math.round(overlapFractionBps / 2))) / 10_000);
  const deduplicated = Math.max(weightedActive, economicAlphaBps);
  const blocked = Math.max(0, naive - deduplicated);
  return Object.freeze({ deduplicated, naive, blocked });
}

function marginalRiskContributions(
  portfolio: ForwardStrategyPortfolio,
  allocation: PortfolioCapitalAllocation,
  portfolioVolBps: number,
): readonly StrategyAttributionSlice[] {
  const weightByStrategy = new Map(allocation.deployments.map((row) => [row.strategyId, row.weightBps]));
  const legVol = new Map<string, number>();
  for (const leg of portfolio.legs) {
    const series = leg.returnSeriesBps;
    if (series.length === 0) {
      legVol.set(leg.strategyId, 0);
      continue;
    }
    const mean = series.reduce((a, b) => a + b, 0) / series.length;
    const variance = series.reduce((a, b) => a + (b - mean) ** 2, 0) / series.length;
    legVol.set(leg.strategyId, Math.sqrt(variance));
  }
  const slices: StrategyAttributionSlice[] = [];
  for (const leg of portfolio.legs) {
    const w = weightByStrategy.get(leg.strategyId) ?? 0;
    const vol = legVol.get(leg.strategyId) ?? 0;
    const mrc =
      portfolioVolBps > 0
        ? Math.round(((w / 10_000) * vol * 10_000) / portfolioVolBps)
        : Math.round((w * vol) / 10);
    const div = Math.max(0, 10_000 - Math.round((vol * 10_000) / Math.max(1, portfolioVolBps)));
    slices.push(
      Object.freeze({
        strategyId: leg.strategyId,
        returnContributionBps: Math.round((leg.periodReturnBps * w) / 10_000),
        activeContributionBps: Math.round((leg.activeReturnBps * w) / 10_000),
        alphaContributionBps: 0,
        marginalRiskContributionBps: Math.min(10_000, mrc),
        diversificationContributionBps: Math.min(10_000, div),
      }),
    );
  }
  return Object.freeze(slices);
}

function applyAlphaAttribution(
  slices: readonly StrategyAttributionSlice[],
  deduplicatedAlphaBps: number,
  interaction: StrategyInteractionState,
): readonly StrategyAttributionSlice[] {
  let eligibleWeight = 0;
  for (const row of slices) {
    const penalized = interaction.interactions.some(
      (ix) =>
        ix.kind === 'DUPLICATE_EXPOSURE' &&
        ix.strategyIds.includes(row.strategyId) &&
        ix.severityBps >= 8_500,
    );
    if (!penalized) {
      eligibleWeight += row.returnContributionBps !== 0 ? Math.abs(row.returnContributionBps) : 1;
    }
  }
  return Object.freeze(
    slices.map((row) => {
      const penalized = interaction.interactions.some(
        (ix) =>
          ix.kind === 'DUPLICATE_EXPOSURE' &&
          ix.strategyIds.includes(row.strategyId) &&
          ix.severityBps >= 8_500,
      );
      const share =
        !penalized && eligibleWeight > 0
          ? Math.abs(row.returnContributionBps) / eligibleWeight
          : penalized
            ? 0
            : 1 / slices.length;
      return Object.freeze({
        ...row,
        alphaContributionBps: Math.round(deduplicatedAlphaBps * share),
      });
    }),
  );
}

export function buildPortfolioForwardEvidence(input: {
  readonly portfolio: ForwardStrategyPortfolio;
  readonly allocation: PortfolioCapitalAllocation;
  readonly interaction: StrategyInteractionState;
}): PortfolioForwardEvidence {
  const { portfolio, allocation, interaction } = input;
  const portfolioReturnBps = weightedSum(portfolio, allocation, 'periodReturnBps');
  const activeReturnBps = weightedSum(portfolio, allocation, 'activeReturnBps');
  const volBps = portfolioVolatilityBps(portfolio, allocation);
  const riskAdjustedReturnBps = volBps > 0 ? Math.round((activeReturnBps * 10_000) / volBps) : activeReturnBps;
  const maxDrawdownBps = Math.max(...portfolio.legs.map((leg) => leg.maxDrawdownBps));
  const factorExposureBps = mergeFactorExposures(portfolio, allocation);
  const alphaParts = deduplicateAlphaBps(portfolio, allocation, interaction);
  let contributions = marginalRiskContributions(portfolio, allocation, volBps);
  contributions = applyAlphaAttribution(contributions, alphaParts.deduplicated, interaction);
  const alphaBreadth: AlphaBreadth = computeAlphaBreadth(portfolio, interaction.pairwiseReturnCorrelationScale);

  return Object.freeze({
    schema: HELIOS_ALPHA13_PORTFOLIO_FORWARD_EVIDENCE_SCHEMA,
    portfolioId: portfolio.portfolioId,
    allocation,
    interaction,
    portfolioReturnBps,
    activeReturnBps,
    riskAdjustedReturnBps,
    maxDrawdownBps,
    factorExposureBps,
    strategyContributions: contributions,
    alphaBreadth,
    naiveAlphaSumBps: alphaParts.naive,
    deduplicatedAlphaBps: alphaParts.deduplicated,
    alphaDoubleCountBlockedBps: alphaParts.blocked,
    capitalDoubleCountDetected: !allocation.capitalConserved,
  });
}
