import {
  HELIOS_ALPHA24_RESEARCH_BOOK_BLOCKED,
  HELIOS_ALPHA24_RESEARCH_BOOK_QUALIFIED,
} from './taxonomy.ts';
import type { Alpha24ResearchBookBundle } from './types.ts';

export type Alpha24QualificationResult = {
  readonly qualified: boolean;
  readonly marker:
    | typeof HELIOS_ALPHA24_RESEARCH_BOOK_QUALIFIED
    | typeof HELIOS_ALPHA24_RESEARCH_BOOK_BLOCKED;
  readonly blockers: readonly string[];
  readonly bundle: Alpha24ResearchBookBundle;
};

export function evaluateAlpha24ResearchBookQualification(
  bundle: Alpha24ResearchBookBundle,
): Alpha24QualificationResult {
  const blockers: string[] = [];
  if (bundle.dailyBook.section.winnersOnlyBlocked) {
    blockers.push('DAILY_WINNERS_ONLY_REPORT');
  }
  if (bundle.weeklyBook.section.winnersOnlyBlocked) {
    blockers.push('WEEKLY_WINNERS_ONLY_REPORT');
  }
  if (bundle.survivorshipAudit.strategiesTested.length !== bundle.strategyCards.length) {
    blockers.push('STRATEGY_CARD_COUNT_MISMATCH');
  }
  const retiredInAudit = new Set(bundle.survivorshipAudit.strategiesRetired);
  const retiredInCards = bundle.strategyCards
    .filter((c) => retiredInAudit.has(c.strategy.strategyId))
    .map((c) => c.strategy.strategyId);
  if (retiredInAudit.size > 0 && retiredInCards.length !== retiredInAudit.size) {
    blockers.push('RETIRED_STRATEGIES_MISSING_FROM_CUMULATIVE_HISTORY');
  }
  const loserUniverse = new Set(bundle.survivorshipAudit.losersInUniverse);
  if (loserUniverse.size > 0) {
    const losersOnCard = bundle.strategyCards.filter((c) => c.isLoser).map((c) => c.strategy.strategyId);
    const loserSet = new Set(losersOnCard);
    if (![...loserUniverse].every((id) => loserSet.has(id))) {
      blockers.push('LOSERS_MISSING_FROM_STRATEGY_CARDS');
    }
  }
  const qualified = blockers.length === 0;
  return Object.freeze({
    qualified,
    marker: qualified ? HELIOS_ALPHA24_RESEARCH_BOOK_QUALIFIED : HELIOS_ALPHA24_RESEARCH_BOOK_BLOCKED,
    blockers: Object.freeze(blockers),
    bundle,
  });
}

export function alpha24ResearchBookMarker(
  result: Alpha24QualificationResult,
): typeof HELIOS_ALPHA24_RESEARCH_BOOK_QUALIFIED | typeof HELIOS_ALPHA24_RESEARCH_BOOK_BLOCKED {
  return result.marker;
}
