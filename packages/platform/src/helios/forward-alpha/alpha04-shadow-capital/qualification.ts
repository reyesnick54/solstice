import {
  HELIOS_ALPHA04_SHADOW_CAPITAL_BLOCKED,
  HELIOS_ALPHA04_SHADOW_CAPITAL_QUALIFIED,
} from './taxonomy.ts';

export { HELIOS_ALPHA04_SHADOW_CAPITAL_QUALIFIED, HELIOS_ALPHA04_SHADOW_CAPITAL_BLOCKED };

export type Alpha04QualificationChecks = {
  readonly researchPostureFlags: boolean;
  readonly preRegisteredStartingNotional: boolean;
  readonly rejectsInsufficientCash: boolean;
  readonly settlementStateModeled: boolean;
  readonly reservedCashModeled: boolean;
  readonly realizedUnrealizedPnL: boolean;
  readonly feesTracked: boolean;
  readonly navAndExposure: boolean;
  readonly noInfiniteCapital: boolean;
  readonly campaignReinvestPolicy: boolean;
  readonly multiStrategySupported: boolean;
  readonly equityCurveTracksNav: boolean;
  readonly snapshotDeterministic: boolean;
  readonly noLedgerBypass: boolean;
};

export type Alpha04QualificationResult = {
  readonly marker:
    | typeof HELIOS_ALPHA04_SHADOW_CAPITAL_QUALIFIED
    | typeof HELIOS_ALPHA04_SHADOW_CAPITAL_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

const LABELS: Record<keyof Alpha04QualificationChecks, string> = {
  researchPostureFlags: 'research posture flags (no customer/live capital)',
  preRegisteredStartingNotional: 'pre-registered immutable starting notional',
  rejectsInsufficientCash: 'rejects trades beyond cash constraints',
  settlementStateModeled: 'settlement and unsettled cash modeled',
  reservedCashModeled: 'reserved capital modeled',
  realizedUnrealizedPnL: 'realized and unrealized PnL',
  feesTracked: 'fees and transaction costs tracked',
  navAndExposure: 'NAV, gross exposure, net exposure',
  noInfiniteCapital: 'no infinite capital',
  campaignReinvestPolicy: 'campaign reinvestment policy enforced',
  multiStrategySupported: 'multi-strategy portfolio aggregation',
  equityCurveTracksNav: 'equity curve tracks NAV without retrospective capital',
  snapshotDeterministic: 'deterministic snapshot restore',
  noLedgerBypass: 'does not post SunRey ledger journals',
};

export function evaluateAlpha04ShadowCapitalQualification(
  checks: Alpha04QualificationChecks,
): Alpha04QualificationResult {
  const blockers: string[] = [];
  for (const [key, passed] of Object.entries(checks) as [keyof Alpha04QualificationChecks, boolean][]) {
    if (!passed) {
      blockers.push(LABELS[key]);
    }
  }
  if (blockers.length === 0) {
    return Object.freeze({
      marker: HELIOS_ALPHA04_SHADOW_CAPITAL_QUALIFIED,
      qualified: true,
      blockers: Object.freeze([]),
    });
  }
  return Object.freeze({
    marker: HELIOS_ALPHA04_SHADOW_CAPITAL_BLOCKED,
    qualified: false,
    blockers: Object.freeze(blockers),
  });
}
