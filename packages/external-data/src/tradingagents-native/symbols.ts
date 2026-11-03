/**
 * Symbol normalization for vendor calls (native port of TradingAgents dataflows/symbols.py).
 */

const FOREX_CURRENCIES = new Set([
  'USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD',
  'CNY', 'CNH', 'HKD', 'SGD', 'SEK', 'NOK', 'DKK', 'PLN',
  'MXN', 'ZAR', 'TRY', 'INR', 'KRW', 'BRL', 'RUB', 'THB',
]);

const CRYPTO_BASES = new Set([
  'BTC', 'ETH', 'SOL', 'XRP', 'ADA', 'DOGE', 'LTC', 'BCH', 'DOT', 'AVAX', 'LINK',
]);

const ALIASES: Readonly<Record<string, string>> = Object.freeze({
  XAUUSD: 'GC=F', XAU: 'GC=F', GOLD: 'GC=F',
  XAGUSD: 'SI=F', XAG: 'SI=F', SILVER: 'SI=F',
  SPX500: '^GSPC', US500: '^GSPC', SPX: '^GSPC',
  BTCUSD: 'BTC-USD',
});

const CRYPTO_QUOTES = ['USDT', 'USDC', 'USD'] as const;
const TICKER_PATH_RE = /^[A-Za-z0-9._\-^=+]+$/;
const HK_CODE = /^(\d{1,5})\.HK$/i;
const SHANGHAI_SH = /^(\d{6})\.SH$/i;

export function cryptoBase(raw: string): string | null {
  if (typeof raw !== 'string') return null;
  const compact = raw.trim().toUpperCase().replace(/\+$/, '').replace(/-/g, '');
  for (const quote of CRYPTO_QUOTES) {
    if (compact.endsWith(quote)) {
      const base = compact.slice(0, -quote.length);
      return CRYPTO_BASES.has(base) ? base : null;
    }
  }
  return null;
}

function normalizeCrypto(s: string): string | null {
  const base = cryptoBase(s);
  return base ? `${base}-USD` : null;
}

export function normalizeSymbol(raw: string): string {
  if (typeof raw !== 'string' || !raw.trim()) return raw;
  let s = raw.trim().toUpperCase().replace(/\+$/, '');
  const crypto = normalizeCrypto(s);
  let canonical: string;
  if (s in ALIASES) {
    canonical = ALIASES[s]!;
  } else if (crypto != null) {
    canonical = crypto;
  } else if (s.length === 6 && FOREX_CURRENCIES.has(s.slice(0, 3)) && FOREX_CURRENCIES.has(s.slice(3))) {
    canonical = `${s}=X`;
  } else {
    const hk = HK_CODE.exec(s);
    if (hk) {
      canonical = `${String(Number(hk[1])).padStart(4, '0')}.HK`;
    } else {
      const sh = SHANGHAI_SH.exec(s);
      canonical = sh ? `${sh[1]}.SS` : s;
    }
  }
  return canonical;
}

export function safeTickerComponent(value: string, maxLen = 32): string {
  if (typeof value !== 'string' || !value) {
    throw new Error(`ticker must be a non-empty string, got ${String(value)}`);
  }
  if (value.length > maxLen) {
    throw new Error(`ticker exceeds ${maxLen} chars: ${JSON.stringify(value)}`);
  }
  if (!TICKER_PATH_RE.test(value)) {
    throw new Error(`ticker contains characters not allowed in a filesystem path: ${JSON.stringify(value)}`);
  }
  if ([...value].every((ch) => ch === '.')) {
    throw new Error(`ticker cannot consist solely of dots: ${JSON.stringify(value)}`);
  }
  return value;
}
