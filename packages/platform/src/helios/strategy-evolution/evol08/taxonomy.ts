/**
 * HELIOS EVOL08 — adversarial strategy falsification (simulation taxonomy; no live execution).
 */

export const FALSIFICATION_ENGINE_SCHEMA = 'helios.strategy-evolution.evol08.falsification.v1' as const;

export const FALSIFICATION_REPORT_SCHEMA =
  'helios.strategy-evolution.evol08.falsification-report.v1' as const;

/** Every stress challenger the engine must exercise before qualification. */
export const STRESS_CHALLENGER_KINDS = [
  'TRANSACTION_COST_INCREASE',
  'SPREAD_WIDENING',
  'LATENCY',
  'PARTIAL_FILLS',
  'MISSING_DATA',
  'PROVIDER_OUTAGE',
  'MARKET_GAPS',
  'REGIME_CHANGE',
  'VOLATILITY_SHOCK',
  'LIQUIDITY_SHOCK',
  'CORRELATION_BREAK',
  'CROWDING_PROXY',
  'HIGHER_FUNDING_COSTS',
  'SLIPPAGE',
  'DELAYED_SIGNAL',
  'FEATURE_REVISION',
  'PARAMETER_PERTURBATION',
] as const;

export type StressChallengerKind = (typeof STRESS_CHALLENGER_KINDS)[number];

export const STRUCTURAL_FALSIFICATION_QUESTIONS = [
  'Does performance disappear if thresholds change slightly?',
  'Does performance come from one instrument?',
  'Does performance come from one year?',
  'Does performance come from one sector?',
  'Does performance come from one extreme event?',
  'Does performance come from one provider?',
  'Does performance come from one regime?',
  'Does performance come from one trade?',
] as const;

export type StructuralFalsificationQuestionId = (typeof STRUCTURAL_FALSIFICATION_QUESTIONS)[number];

/** Program qualification marker — gates only; agents never set this directly. */
export const HELIOS_EVOL08_FALSIFICATION_ENGINE_QUALIFIED =
  'HELIOS_EVOL08_FALSIFICATION_ENGINE_QUALIFIED' as const;

export const HELIOS_EVOL08_FALSIFICATION_ENGINE_BLOCKED =
  'HELIOS_EVOL08_FALSIFICATION_ENGINE_BLOCKED' as const;
