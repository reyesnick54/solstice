import type { ForwardStrategyResearchRecord } from './types.ts';
import { isLoserStrategy } from './stats.ts';

export type LosersInclusionCheck = {
  readonly losersExistInUniverse: boolean;
  readonly losersRepresentedInReport: boolean;
  readonly winnersOnlyBlocked: boolean;
  readonly blocker: string | null;
};

/**
 * Reports must not cherry-pick: when the cumulative universe contains losers, at least one
 * must appear in the strategy outcome rows exposed on the book.
 */
export function checkLosersInclusion(input: {
  readonly universe: readonly ForwardStrategyResearchRecord[];
  readonly reportedStrategyIds: readonly string[];
}): LosersInclusionCheck {
  const loserIds = input.universe.filter(isLoserStrategy).map((s) => s.strategyId);
  const losersExistInUniverse = loserIds.length > 0;
  const reported = new Set(input.reportedStrategyIds);
  const losersRepresentedInReport = loserIds.some((id) => reported.has(id));
  const winnersOnlyBlocked = losersExistInUniverse && !losersRepresentedInReport;
  return Object.freeze({
    losersExistInUniverse,
    losersRepresentedInReport,
    winnersOnlyBlocked,
    blocker: winnersOnlyBlocked ? 'WINNERS_ONLY_REPORT_BLOCKED' : null,
  });
}
