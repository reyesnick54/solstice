/**
 * HELIOS OS10 qualification gate (checks supplied by integration tests / orchestration).
 */

export const HELIOS_OS10_POINT_IN_TIME_FUNDAMENTALS_QUALIFIED =
  'HELIOS_OS10_POINT_IN_TIME_FUNDAMENTALS_QUALIFIED' as const;
export const HELIOS_OS10_POINT_IN_TIME_FUNDAMENTALS_BLOCKED =
  'HELIOS_OS10_POINT_IN_TIME_FUNDAMENTALS_BLOCKED' as const;

export type HeliosOs10QualificationChecks = {
  readonly noQ2BeforeFiling: boolean;
  readonly q2OriginalRevenueAtBacktest: boolean;
  readonly noFutureLeakQ2Window: boolean;
  readonly restatementUpdatesEffectiveRevenue: boolean;
  readonly restatementPreservesOriginalFacts: boolean;
  readonly aafRevisionLedgerTracksAmendment: boolean;
  readonly pitEffectiveFactBeforeRestatement: boolean;
  readonly derivedMarginsWhenFactsSupport: boolean;
};

export type HeliosOs10QualificationResult = {
  readonly marker:
    | typeof HELIOS_OS10_POINT_IN_TIME_FUNDAMENTALS_QUALIFIED
    | typeof HELIOS_OS10_POINT_IN_TIME_FUNDAMENTALS_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

const CHECK_LABELS: Record<keyof HeliosOs10QualificationChecks, string> = {
  noQ2BeforeFiling: 'no_q2_before_filing',
  q2OriginalRevenueAtBacktest: 'q2_original_revenue_at_backtest',
  noFutureLeakQ2Window: 'no_future_leak_q2_window',
  restatementUpdatesEffectiveRevenue: 'restatement_updates_effective_revenue',
  restatementPreservesOriginalFacts: 'restatement_preserves_original_facts',
  aafRevisionLedgerTracksAmendment: 'aaf_revision_ledger_tracks_amendment',
  pitEffectiveFactBeforeRestatement: 'pit_effective_fact_before_restatement',
  derivedMarginsWhenFactsSupport: 'derived_margins_when_facts_support',
};

export function evaluateHeliosOs10PointInTimeFundamentalsQualification(
  checks: HeliosOs10QualificationChecks,
): HeliosOs10QualificationResult {
  const blockers: string[] = [];
  for (const [key, pass] of Object.entries(checks) as [keyof HeliosOs10QualificationChecks, boolean][]) {
    if (!pass) {
      blockers.push(CHECK_LABELS[key]);
    }
  }

  if (blockers.length === 0) {
    return Object.freeze({
      marker: HELIOS_OS10_POINT_IN_TIME_FUNDAMENTALS_QUALIFIED,
      qualified: true,
      blockers: Object.freeze([]),
    });
  }

  return Object.freeze({
    marker: HELIOS_OS10_POINT_IN_TIME_FUNDAMENTALS_BLOCKED,
    qualified: false,
    blockers: Object.freeze(blockers),
  });
}
