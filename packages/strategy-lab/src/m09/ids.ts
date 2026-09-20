/** Canonical instrument identifiers for HELIOS Multi-Asset M09. */
export const M09_SPY_INSTRUMENT_ID = 'SECURITY:US:SPY:ARCX' as const;
export const M09_QQQ_INSTRUMENT_ID = 'SECURITY:US:QQQ:XNAS' as const;

export const M09_INSTRUMENT_UNIVERSE = Object.freeze([
  M09_SPY_INSTRUMENT_ID,
  M09_QQQ_INSTRUMENT_ID,
] as const);

export const M09_BAR_INTERVAL = '15m' as const;
