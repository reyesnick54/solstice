import { createHash } from 'node:crypto';

import { HELIOS_ALPHA24_RESEARCH_BOOK_SCHEMA } from './taxonomy.ts';
import { activeStrategies, meanBps } from './stats.ts';
import { checkLosersInclusion } from './losers-policy.ts';
import { isLoserStrategy } from './stats.ts';
import type {
  DailyForwardResearchBook,
  ForwardResearchBookInput,
  StrategyDailyOutcomeRow,
} from './types.ts';

export function buildDailyForwardResearchBook(input: ForwardResearchBookInput): DailyForwardResearchBook {
  const active = activeStrategies(input.strategies);
  const allForHistory = input.strategies;
  const outcomeRows: StrategyDailyOutcomeRow[] = allForHistory.map((s) =>
    Object.freeze({
      strategyId: s.strategyId,
      lifecycle: s.lifecycle,
      pnlMinor: s.cumulativePnLMinor,
      benchmarkRelativeBps: s.benchmarkRelativeBps,
      isLoser: isLoserStrategy(s),
    }),
  );
  const losersCheck = checkLosersInclusion({
    universe: allForHistory,
    reportedStrategyIds: outcomeRows.map((r) => r.strategyId),
  });
  const demotions = Object.freeze(
    input.strategies.filter((s) => s.lifecycle === 'DEMOTED' || s.lifecycle === 'RETIRED').map((s) => s.strategyId),
  );
  const paperTrades = input.strategies.reduce((acc, s) => acc + s.paperTradeCount, 0);
  const execQuality = meanBps(input.strategies.map((s) => s.executionQualityScoreBps));
  const dataQualityIssues = input.strategies.reduce((acc, s) => acc + s.dataQualityIssueCount, 0);
  const maturityDays = meanBps(input.strategies.map((s) => s.outcomeMaturityDays));
  const material = `daily:${input.operations.asOf}:${input.operations.periodEnd}`;
  const bookId = `alpha24-daily:${createHash('sha256').update(material).digest('hex').slice(0, 16)}`;
  return Object.freeze({
    schema: HELIOS_ALPHA24_RESEARCH_BOOK_SCHEMA,
    kind: 'DAILY_FORWARD_RESEARCH_BOOK',
    bookId,
    asOf: input.operations.asOf,
    section: Object.freeze({
      marketConditions: input.operations.marketConditionsSummary,
      activeStrategyCount: active.length,
      newDecisions: input.operations.newDecisionCount,
      paperTrades,
      executionQualitySummaryBps: execQuality,
      pnlMinor: input.operations.portfolioCumulativePnLMinor,
      benchmarkRelativeBps: input.operations.portfolioBenchmarkRelativeBps,
      drawdownBps: input.operations.portfolioMaxDrawdownBps,
      outcomeMaturitySummary: `mean_maturity_days=${maturityDays}`,
      incidents: input.operations.incidentCount,
      demotions,
      dataQualityIssues,
      strategyOutcomes: Object.freeze(outcomeRows),
      losersIncluded: losersCheck.losersRepresentedInReport || !losersCheck.losersExistInUniverse,
      winnersOnlyBlocked: losersCheck.winnersOnlyBlocked,
    }),
    aiNarrative: input.aiNarrativeDraft ?? null,
  });
}
