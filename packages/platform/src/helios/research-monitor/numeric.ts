/** Fixed-scale decimal arithmetic for deterministic monitor comparisons (scale 1_000_000). */

const SCALE = 1_000_000n;

export function parseMonitorDecimal(value: string): { readonly ok: true; readonly scaled: bigint } | { readonly ok: false; readonly message: string } {
  const trimmed = value.trim();
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return { ok: false, message: `invalid decimal: ${value}` };
  }
  const negative = trimmed.startsWith('-');
  const unsigned = negative ? trimmed.slice(1) : trimmed;
  const [wholePart, fracPart = ''] = unsigned.split('.');
  const frac = (fracPart + '000000').slice(0, 6);
  const scaled = BigInt(wholePart) * SCALE + BigInt(frac.padEnd(6, '0').slice(0, 6));
  return { ok: true, scaled: negative ? -scaled : scaled };
}

export function formatMonitorDecimal(scaled: bigint): string {
  const negative = scaled < 0n;
  const abs = negative ? -scaled : scaled;
  const whole = abs / SCALE;
  const frac = abs % SCALE;
  const fracStr = frac.toString().padStart(6, '0').replace(/0+$/, '');
  const body = fracStr.length > 0 ? `${whole.toString()}.${fracStr}` : whole.toString();
  return negative ? `-${body}` : body;
}

export function compareMonitorDecimal(a: string, b: string): -1 | 0 | 1 | null {
  const left = parseMonitorDecimal(a);
  const right = parseMonitorDecimal(b);
  if (!left.ok || !right.ok) {
    return null;
  }
  if (left.scaled < right.scaled) return -1;
  if (left.scaled > right.scaled) return 1;
  return 0;
}

export function mulMonitorDecimal(a: string, b: string): string | null {
  const left = parseMonitorDecimal(a);
  const right = parseMonitorDecimal(b);
  if (!left.ok || !right.ok) {
    return null;
  }
  return formatMonitorDecimal((left.scaled * right.scaled) / SCALE);
}

export function divMonitorDecimal(a: string, b: string): string | null {
  const left = parseMonitorDecimal(a);
  const right = parseMonitorDecimal(b);
  if (!left.ok || !right.ok || right.scaled === 0n) {
    return null;
  }
  return formatMonitorDecimal((left.scaled * SCALE) / right.scaled);
}

export function addMonitorDecimal(a: string, b: string): string | null {
  const left = parseMonitorDecimal(a);
  const right = parseMonitorDecimal(b);
  if (!left.ok || !right.ok) {
    return null;
  }
  return formatMonitorDecimal(left.scaled + right.scaled);
}

export function subMonitorDecimal(a: string, b: string): string | null {
  const left = parseMonitorDecimal(a);
  const right = parseMonitorDecimal(b);
  if (!left.ok || !right.ok) {
    return null;
  }
  return formatMonitorDecimal(left.scaled - right.scaled);
}
