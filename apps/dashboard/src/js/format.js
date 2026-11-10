// Formatting only. Amounts arrive as integer minor-unit strings and are
// formatted with BigInt string arithmetic: no floating point touches money.

const FIAT_EXPONENT = { USD: 2, GBP: 2, EUR: 2, SAR: 2, AED: 2, JPY: 0 };
const FIAT_SYMBOL = { USD: '$', GBP: '£', EUR: '€', SAR: 'SAR ', AED: 'AED ' };

let assetDecimals = { SUNREY_COIN: 6, MOONREY_COIN: 6 };
export function setAssetDecimals(map) {
  assetDecimals = { ...assetDecimals, ...map };
}

const ASSET_LABEL = {
  SUNREY_COIN: 'SR',
  MOONREY_COIN: 'MR',
  SRC: 'SR',
  MRC: 'MR',
  SANDBOX_USD: 'sandbox USD',
};
export function assetLabel(id) {
  return ASSET_LABEL[id] || id;
}

function group(intString) {
  return intString.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** Format an integer string with `exponent` implied decimals. */
export function scaled(minor, exponent, { minFraction = exponent, maxFraction = exponent } = {}) {
  if (minor === null || minor === undefined || minor === '') return '—';
  let s = String(minor).trim();
  if (!/^-?\d+$/.test(s)) return String(minor);
  const negative = s.startsWith('-');
  if (negative) s = s.slice(1);
  s = s.replace(/^0+(?=\d)/, '');
  if (exponent === 0) return (negative ? '−' : '') + group(s);
  const padded = s.padStart(exponent + 1, '0');
  const whole = padded.slice(0, padded.length - exponent);
  let frac = padded.slice(padded.length - exponent);
  frac = frac.slice(0, maxFraction);
  while (frac.length > minFraction && frac.endsWith('0')) frac = frac.slice(0, -1);
  return (negative ? '−' : '') + group(whole) + (frac ? '.' + frac : '');
}

export function money(value, fallbackCurrency) {
  if (!value) return '—';
  const minor = value.minorUnits ?? value.amountMinorUnits ?? value.amount ?? null;
  const currency = value.currency || fallbackCurrency || '';
  const exp = FIAT_EXPONENT[currency] ?? 2;
  const text = scaled(minor, exp);
  if (text === '—') return text;
  const sym = FIAT_SYMBOL[currency];
  return sym ? (text.startsWith('−') ? '−' + sym + text.slice(1) : sym + text) : `${text} ${currency}`;
}

export function minorMoney(minor, currency) {
  return money({ minorUnits: minor, currency });
}

export function token(quantity, assetId, opts) {
  const exp = assetDecimals[assetId] ?? 0;
  return `${scaled(quantity, exp, { minFraction: 0, maxFraction: exp, ...(opts || {}) })} ${assetLabel(assetId)}`;
}

/** Parse a user-typed decimal amount into minor units without floats. */
export function toMinorUnits(text, exponent) {
  const s = String(text || '').trim().replace(/,/g, '');
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const [whole, frac = ''] = s.split('.');
  if (frac.length > exponent) return null;
  const digits = (whole + frac.padEnd(exponent, '0')).replace(/^0+(?=\d)/, '');
  return digits === '' ? '0' : digits;
}

export function fiatExponent(currency) {
  return FIAT_EXPONENT[currency] ?? 2;
}

export function dateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

export function relative(iso) {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return '';
  const m = Math.round(ms / 60000);
  if (Math.abs(m) < 1) return 'just now';
  if (Math.abs(m) < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (Math.abs(h) < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function humanize(code) {
  if (code === null || code === undefined) return '—';
  return String(code)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase())
    .replace(/\b(hin|fx|ai|kyc|aml|usd|eur|id|api|p&l|sr|mr|totp|mfa|pnl)\b/gi, (w) => w.toUpperCase());
}

export function shortId(id, keep = 10) {
  const s = String(id || '');
  return s.length > keep + 4 ? `${s.slice(0, keep)}…${s.slice(-4)}` : s;
}
