/**
 * HELIOS FORWARD ALPHA08 — forward multiple-strategy data-snooping firewall (taxonomy).
 */

export const HELIOS_ALPHA08_SCHEMA = 'sunrey.helios.forward-alpha.alpha08.v1' as const;

export const HELIOS_ALPHA08_DATA_SNOOPING_FIREWALL_QUALIFIED =
  'HELIOS_ALPHA08_DATA_SNOOPING_FIREWALL_QUALIFIED' as const;

export const HELIOS_ALPHA08_DATA_SNOOPING_FIREWALL_BLOCKED =
  'HELIOS_ALPHA08_DATA_SNOOPING_FIREWALL_BLOCKED' as const;

/** Minimum forward periods before Sharpe-style deflation is meaningful. */
export const ALPHA08_MINIMUM_FORWARD_PERIODS = 30 as const;

/** Minimum monitored candidates for PBO / reality-check bootstrap. */
export const ALPHA08_MIN_CANDIDATES_FOR_BOOTSTRAP = 3 as const;

/** Default stationary block length when lag-1 autocorrelation exceeds threshold. */
export const ALPHA08_BLOCK_BOOTSTRAP_DEFAULT_BLOCK = 5 as const;

/** Lag-1 |autocorrelation| above this triggers block bootstrap (serial dependence). */
export const ALPHA08_SERIAL_DEPENDENCE_AUTOCORR_THRESHOLD = 0.15 as const;

export const EVOL09_SCHEMA_BRIDGE = 'sunrey.helios.strategy-evolution.evol09.v1' as const;
