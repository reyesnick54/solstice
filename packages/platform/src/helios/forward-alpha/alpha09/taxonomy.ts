/**
 * HELIOS Forward Alpha — ALPHA09 risk-adjusted return and tail evidence (taxonomy).
 */

export const HELIOS_ALPHA09_SCHEMA = 'sunrey.helios.forward-alpha.alpha09.v1' as const;

export const HELIOS_ALPHA09_RISK_ADJUSTED_EVIDENCE_QUALIFIED =
  'HELIOS_ALPHA09_RISK_ADJUSTED_EVIDENCE_QUALIFIED' as const;

export const HELIOS_ALPHA09_RISK_ADJUSTED_EVIDENCE_BLOCKED =
  'HELIOS_ALPHA09_RISK_ADJUSTED_EVIDENCE_BLOCKED' as const;

/** Strategy holding horizon — minimum evidence requirements differ by class. */
export const ALPHA09_HORIZON_CLASSES = Object.freeze([
  'INTRADAY',
  'SWING',
  'POSITION',
  'MULTI_MONTH',
] as const);

export type Alpha09HorizonClass = (typeof ALPHA09_HORIZON_CLASSES)[number];

/** Historical expected-shortfall confidence (engineering tail probe, not regulatory VaR). */
export const ALPHA09_TAIL_CONFIDENCE_BPS = 950 as const;

/**
 * When one slice explains more than this share of net attributable PnL, repeatability claims are blocked.
 * 6_500 bps = 65%.
 */
export const ALPHA09_SINGLE_SLICE_DOMINANCE_BPS = 6_500 as const;

export const ALPHA09_TOP5_TRADES_DOMINANCE_BPS = 9_000 as const;

export type Alpha09MinimumTrackRecordPolicy = {
  readonly horizonClass: Alpha09HorizonClass;
  readonly minimumCalendarDays: number;
  readonly minimumIndependentOpportunities: number;
  readonly minimumPeriodsForSharpe: number;
  readonly minimumPeriodsForTailEs: number;
};

export const ALPHA09_TRACK_RECORD_POLICIES: Readonly<Record<Alpha09HorizonClass, Alpha09MinimumTrackRecordPolicy>> =
  Object.freeze({
    INTRADAY: Object.freeze({
      horizonClass: 'INTRADAY',
      minimumCalendarDays: 20,
      minimumIndependentOpportunities: 200,
      minimumPeriodsForSharpe: 60,
      minimumPeriodsForTailEs: 120,
    }),
    SWING: Object.freeze({
      horizonClass: 'SWING',
      minimumCalendarDays: 45,
      minimumIndependentOpportunities: 40,
      minimumPeriodsForSharpe: 30,
      minimumPeriodsForTailEs: 60,
    }),
    POSITION: Object.freeze({
      horizonClass: 'POSITION',
      minimumCalendarDays: 180,
      minimumIndependentOpportunities: 25,
      minimumPeriodsForSharpe: 36,
      minimumPeriodsForTailEs: 48,
    }),
    MULTI_MONTH: Object.freeze({
      horizonClass: 'MULTI_MONTH',
      minimumCalendarDays: 365,
      minimumIndependentOpportunities: 12,
      minimumPeriodsForSharpe: 24,
      minimumPeriodsForTailEs: 36,
    }),
  });
