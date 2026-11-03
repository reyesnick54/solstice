/**
 * Sanitized Kraken public market-data fixtures for CI conformance probes.
 */

export const KRAKEN_TICKER_FIXTURE = Object.freeze({
  error: [],
  result: Object.freeze({
    XXBTZUSD: Object.freeze({
      a: Object.freeze(['67234.5', '1', '1.000']),
      b: Object.freeze(['67234.4', '1', '1.000']),
      c: Object.freeze(['67234.5', '0.001']),
      v: Object.freeze(['1024.5', '2048.0']),
      p: Object.freeze(['67000.1', '66800.2']),
      t: Object.freeze([1_700_000_000, 1_700_086_400]),
      l: Object.freeze(['66000.0', '65500.0']),
      h: Object.freeze(['68000.0', '68500.0']),
      o: '66500.0',
    }),
  }),
});

export function krakenFixtureLastPrice(symbol: string): string | null {
  const key = symbol.replace('/', '').replace('BTC', 'XBT');
  const pairKey = key === 'XBTUSD' || key === 'BTCUSD' ? 'XXBTZUSD' : null;
  if (!pairKey) {
    return null;
  }
  const row = KRAKEN_TICKER_FIXTURE.result[pairKey as keyof typeof KRAKEN_TICKER_FIXTURE.result];
  if (!row || !Array.isArray(row.c)) {
    return null;
  }
  return row.c[0] ?? null;
}
