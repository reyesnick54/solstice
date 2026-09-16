/**
 * Finnhub response parsers for capital market observations.
 */

export type FinnhubQuotePayload = {
  readonly c?: number;
  readonly d?: number;
  readonly dp?: number;
  readonly h?: number;
  readonly l?: number;
  readonly o?: number;
  readonly pc?: number;
  readonly t?: number;
};

export function validateFinnhubQuotePayload(raw: unknown): raw is FinnhubQuotePayload {
  if (typeof raw !== 'object' || raw === null) {
    return false;
  }
  const payload = raw as FinnhubQuotePayload;
  if (payload.c !== undefined && (!Number.isFinite(payload.c) || payload.c < 0)) {
    return false;
  }
  if (payload.t !== undefined && (!Number.isFinite(payload.t) || payload.t <= 0)) {
    return false;
  }
  return payload.c !== undefined || payload.o !== undefined || payload.pc !== undefined;
}

export function finnhubSourceTimestamp(payload: FinnhubQuotePayload): string | null {
  if (payload.t === undefined || !Number.isFinite(payload.t) || payload.t <= 0) {
    return null;
  }
  const millis = payload.t > 1_000_000_000_000 ? payload.t : payload.t * 1000;
  return new Date(millis).toISOString();
}

export function decimalToMinorUnits(value: number | undefined, scale = 2): bigint | null {
  if (value === undefined || !Number.isFinite(value) || value < 0) {
    return null;
  }
  const factor = 10 ** scale;
  return BigInt(Math.round(value * factor));
}
