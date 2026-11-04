/**
 * HELIOS Earnings Intelligence EARN04 — analyst expectation dynamics taxonomy.
 * Simulation fixtures only; no licensed live analyst feed in CI.
 */

export const HELIOS_EARN04 = 'HELIOS_EARN04' as const;

export const HELIOS_EARN04_ANALYST_EXPECTATIONS_SCHEMA =
  'sunrey.helios.earnings-intelligence.analyst-expectations.v1' as const;

export const HELIOS_EARN04_ANALYST_EXPECTATIONS_AUTHORITY = 'REFERENCE_ONLY' as const;

export const HELIOS_EARN04_DATA_PLANE = 'FIXTURE_SIMULATION_ONLY' as const;

export const HELIOS_EARN04_ANALYST_EXPECTATIONS_QUALIFIED =
  'HELIOS_EARN04_ANALYST_EXPECTATIONS_QUALIFIED' as const;

export const HELIOS_EARN04_ANALYST_EXPECTATIONS_BLOCKED =
  'HELIOS_EARN04_ANALYST_EXPECTATIONS_BLOCKED' as const;

/** Latent consensus filter capability marker (not a live provider). */
export const ANALYST_RESPONSIVENESS = 'ANALYST_RESPONSIVENESS' as const;

export type EarningsForecastMetric = 'eps_diluted' | 'revenue' | 'ebitda' | 'net_income';

export type FiscalPeriodRef = {
  readonly fiscalYear: number;
  readonly fiscalQuarter: 1 | 2 | 3 | 4;
  readonly periodLabel: string;
};

/** Default age beyond which a forecast counts as stale (days). */
export const DEFAULT_STALE_FORECAST_AGE_DAYS = 90;

/** Huber delta in units of robust scale (MAD). */
export const DEFAULT_HUBER_DELTA_MAD_MULTIPLIER = 1.345;
