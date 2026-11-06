/**
 * HELIOS EVOL09 — evolutionary multiple-testing firewall (taxonomy).
 */

export const HELIOS_EVOL09_SCHEMA = 'sunrey.helios.strategy-evolution.evol09.v1' as const;

export const HELIOS_EVOL09_MULTIPLE_TESTING_FIREWALL_QUALIFIED =
  'HELIOS_EVOL09_MULTIPLE_TESTING_FIREWALL_QUALIFIED' as const;
export const HELIOS_EVOL09_MULTIPLE_TESTING_FIREWALL_BLOCKED =
  'HELIOS_EVOL09_MULTIPLE_TESTING_FIREWALL_BLOCKED' as const;

/** Minimum periods in the evaluation track record before Sharpe-style ratios are treated as stable. */
export const EVOL09_MINIMUM_TRACK_RECORD_PERIODS = 30 as const;

/** Minimum trials before PBO / CSCV-style rank diagnostics are reported. */
export const EVOL09_MIN_TRIALS_FOR_PBO = 8 as const;
