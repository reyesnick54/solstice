/**
 * Broker → vendor symbol normalization for portfolio matching (native port; no external-data dependency).
 */

const ALIASES: Readonly<Record<string, string>> = Object.freeze({
  XAUUSD: 'GC=F',
  XAU: 'GC=F',
  GOLD: 'GC=F',
  BTCUSD: 'BTC-USD',
  SPX500: '^GSPC',
});

export function normalizeSymbol(raw: string): string {
  if (typeof raw !== 'string' || !raw.trim()) return raw;
  const s = raw.trim().toUpperCase().replace(/\+$/, '');
  return ALIASES[s] ?? s;
}
