/**
 * AAF08 initial observation universe — M01 canonical instrument IDs only.
 */

export const AAF08_EQUITIES_ETF_UNIVERSE = Object.freeze([
  'SECURITY:US:SPY:ARCX',
  'SECURITY:US:QQQ:XNAS',
  'SECURITY:US:NVDA:XNAS',
] as const);

export type Aaf08UniverseInstrumentId = (typeof AAF08_EQUITIES_ETF_UNIVERSE)[number];

export function isAaf08UniverseInstrument(instrumentId: string): boolean {
  return (AAF08_EQUITIES_ETF_UNIVERSE as readonly string[]).includes(instrumentId);
}
