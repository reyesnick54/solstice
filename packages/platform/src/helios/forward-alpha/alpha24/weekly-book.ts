import { createHash } from 'node:crypto';

import { HELIOS_ALPHA24_RESEARCH_BOOK_SCHEMA } from './taxonomy.ts';
import { activeStrategies, isLoserStrategy, meanBps, weightedMeanBps } from './stats.ts';
import { checkLosersInclusion } from './losers-policy.ts';
import type {
  ChallengerStatusRow,
  ForwardResearchBookInput,
  RegimePerformanceRow,
  StrategyRankRow,
  StrategyWeeklyPerformanceRow,
  WeeklyForwardResearchBook,
} from './types.ts';

function campaignAgeSummary(
  campaigns: ForwardResearchBookInput['campaigns'],
  asOf: string,
): string {
  if (campaigns.length === 0) {
    return 'no_campaigns';
  }
  const ages = campaigns.map((c) => {
    const end = c.terminatedAt ?? asOf;
    return `campaign=${c.campaignId};days=${Math.max(0, Math.floor((Date.parse(end) - Date.parse(c.startedAt)) / 86_400_000))}`;
  });
  return ages.join('|');
}

export function buildWeeklyForwardResearchBook(input: ForwardResearchBookInput): WeeklyForwardResearchBook {
  const all = input.strategies;
  const performanceRows: StrategyWeeklyPerformanceRow[] = all.map((s) =>
    Object.freeze({
      strategyId: s.strategyId,
      lifecycle: s.lifecycle,
      pnlMinor: s.cumulativePnLMinor,
      benchmarkRelativeBps: s.benchmarkRelativeBps,
      isLoser: isLoserStrategy(s),
    }),
  );
  const losersCheck = checkLosersInclusion({
    universe: all,
    reportedStrategyIds: performanceRows.map((r) => r.strategyId),
  });
  const regimeMap = new Map<string, { count: number; bps: number[] }>();
  for (const s of all) {
    for (const tag of s.regimeTags) {
      const bucket = regimeMap.get(tag) ?? { count: 0, bps: [] };
      bucket.count += 1;
      bucket.bps.push(s.benchmarkRelativeBps);
      regimeMap.set(tag, bucket);
    }
  }
  const regimePerformance: RegimePerformanceRow[] = [...regimeMap.entries()].map(([regimeTag, bucket]) =>
    Object.freeze({
      regimeTag,
      strategyCount: bucket.count,
      aggregateBenchmarkRelativeBps: meanBps(bucket.bps),
    }),
  );
  const ranked = [...all]
    .sort((a, b) => b.benchmarkRelativeBps - a.benchmarkRelativeBps)
    .map((s, index) =>
      Object.freeze({
        strategyId: s.strategyId,
        rank: index + 1,
        benchmarkRelativeBps: s.benchmarkRelativeBps,
      } satisfies StrategyRankRow),
    );
  const challengers: ChallengerStatusRow[] = all.map((s) =>
    Object.freeze({
      strategyId: s.strategyId,
      status: s.isChallenger
        ? s.lifecycle === 'RETIRED' || s.lifecycle === 'TERMINATED'
          ? 'CHALLENGER_RETIRED'
          : 'CHALLENGER_ACTIVE'
        : 'NOT_CHALLENGER',
    }),
  );
  const opportunityCount = input.campaigns.reduce((acc, c) => acc + c.opportunityCount, 0);
  const capacitySummary = `active=${activeStrategies(all).length};mean_util_bps=${meanBps(
    all.map((s) => s.capacityUtilizationBps),
  )}`;
  const material = `weekly:${input.operations.periodStart}:${input.operations.periodEnd}`;
  const bookId = `alpha24-weekly:${createHash('sha256').update(material).digest('hex').slice(0, 16)}`;
  return Object.freeze({
    schema: HELIOS_ALPHA24_RESEARCH_BOOK_SCHEMA,
    kind: 'WEEKLY_FORWARD_RESEARCH_BOOK',
    bookId,
    asOf: input.operations.asOf,
    weekStart: input.operations.periodStart,
    weekEnd: input.operations.periodEnd,
    section: Object.freeze({
      campaignAgeSummary: campaignAgeSummary(input.campaigns, input.operations.asOf),
      opportunityCount,
      strategyPerformanceRows: Object.freeze(performanceRows),
      portfolioPnLMinor: input.operations.portfolioCumulativePnLMinor,
      portfolioBenchmarkRelativeBps: input.operations.portfolioBenchmarkRelativeBps,
      riskVolatilityBps: input.operations.riskMetricVolatilityBps,
      riskTailLossBps: input.operations.riskMetricTailLossBps,
      regimePerformance: Object.freeze(regimePerformance),
      sequentialEvidence: input.operations.sequentialEvidenceSummary,
      multipleTestingState: input.operations.multipleTestingStateSummary,
      capacitySummary,
      executionDecayBps: meanBps(all.map((s) => s.executionDecayBps)),
      alphaDecayBps: weightedMeanBps(
        all.map((s) => ({ weightBps: Math.max(1, s.paperTradeCount), valueBps: s.alphaDecayBps })),
      ),
      strategyRanking: Object.freeze(ranked),
      challengerStatus: Object.freeze(challengers),
      unresolvedConcerns: all.reduce((acc, s) => acc + s.unresolvedConcernCount, 0),
      losersIncluded: losersCheck.losersRepresentedInReport || !losersCheck.losersExistInUniverse,
      winnersOnlyBlocked: losersCheck.winnersOnlyBlocked,
    }),
    aiNarrative: input.aiNarrativeDraft ?? null,
  });
}
