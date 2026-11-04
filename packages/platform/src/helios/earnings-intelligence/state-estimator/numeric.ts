/** Fixed-scale decimal arithmetic for EPS/revenue (scale 1_000_000). */

const SCALE = 1_000_000n;

export function parseEarningsDecimal(value: string): { readonly ok: true; readonly scaled: bigint } | { readonly ok: false; readonly message: string } {
  const trimmed = value.trim();
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return { ok: false, message: `invalid decimal: ${value}` };
  }
  const negative = trimmed.startsWith('-');
  const unsigned = negative ? trimmed.slice(1) : trimmed;
  const parts = unsigned.split('.');
  const wholePart = parts[0] && parts[0].length > 0 ? parts[0] : '0';
  const fracPart = parts[1] ?? '';
  const frac = (fracPart + '000000').slice(0, 6);
  const scaled = BigInt(wholePart) * SCALE + BigInt(frac.padEnd(6, '0').slice(0, 6));
  return { ok: true, scaled: negative ? -scaled : scaled };
}

export function formatEarningsDecimal(scaled: bigint): string {
  const negative = scaled < 0n;
  const abs = negative ? -scaled : scaled;
  const whole = abs / SCALE;
  const frac = abs % SCALE;
  const fracStr = frac.toString().padStart(6, '0').replace(/0+$/, '');
  const body = fracStr.length > 0 ? `${whole.toString()}.${fracStr}` : whole.toString();
  return negative ? `-${body}` : body;
}

export function earningsDecimalToNumber(scaled: bigint): number {
  return Number(scaled) / Number(SCALE);
}

export function numberToEarningsDecimal(value: number): string {
  const scaled = BigInt(Math.round(value * Number(SCALE)));
  return formatEarningsDecimal(scaled);
}

export function addEarningsDecimal(a: string, b: string): string | null {
  const left = parseEarningsDecimal(a);
  const right = parseEarningsDecimal(b);
  if (!left.ok || !right.ok) return null;
  return formatEarningsDecimal(left.scaled + right.scaled);
}

export function subEarningsDecimal(a: string, b: string): string | null {
  const left = parseEarningsDecimal(a);
  const right = parseEarningsDecimal(b);
  if (!left.ok || !right.ok) return null;
  return formatEarningsDecimal(left.scaled - right.scaled);
}

export const EARNINGS_DECIMAL_SCALE = SCALE;
