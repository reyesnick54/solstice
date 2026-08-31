/**
 * Decimal-safe numeric handling and validation for crypto market data.
 */

import { asUtcInstant, type UtcInstant } from '../../../domain/src/time.ts';
import type { CryptoMarketReferenceQuote } from './types.ts';

export type ValidationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: string; readonly message: string };

export function validatePriceMinorUnits(value: bigint): ValidationResult {
  if (value <= 0n) {
    return Object.freeze({ ok: false, code: 'NEGATIVE_PRICE', message: 'price must be positive' });
  }
  return Object.freeze({ ok: true });
}

export function validateSupplyMinorUnits(value: bigint | null): ValidationResult {
  if (value === null) {
    return Object.freeze({ ok: true });
  }
  if (value < 0n) {
    return Object.freeze({ ok: false, code: 'NEGATIVE_SUPPLY', message: 'supply must be non-negative' });
  }
  return Object.freeze({ ok: true });
}

export function validateMarketCapMinorUnits(value: bigint | null): ValidationResult {
  if (value === null) {
    return Object.freeze({ ok: true });
  }
  if (value < 0n) {
    return Object.freeze({ ok: false, code: 'NEGATIVE_MARKET_CAP', message: 'marketCap must be non-negative' });
  }
  return Object.freeze({ ok: true });
}

export function validateTimestamp(value: string): ValidationResult {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return Object.freeze({ ok: false, code: 'INVALID_TIMESTAMP', message: `invalid timestamp ${value}` });
  }
  if (parsed > Date.now() + 86_400_000) {
    return Object.freeze({ ok: false, code: 'FUTURE_TIMESTAMP', message: 'timestamp is in the future' });
  }
  return Object.freeze({ ok: true });
}

export function parseDecimalToMinorUnits(value: string | number, scale: number): bigint | null {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || Number.isNaN(value)) {
      return null;
    }
    const factor = 10 ** scale;
    return BigInt(Math.round(value * factor));
  }
  const trimmed = value.trim();
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return null;
  }
  const negative = trimmed.startsWith('-');
  const unsigned = negative ? trimmed.slice(1) : trimmed;
  const [whole, fraction = ''] = unsigned.split('.');
  const padded = (fraction + '0'.repeat(scale)).slice(0, scale);
  const minor = BigInt(whole + padded);
  return negative ? -minor : minor;
}

export function bpsFromPercent(value: number | null): bigint | null {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }
  return BigInt(Math.round(value * 100));
}

export function validateQuote(quote: CryptoMarketReferenceQuote): ValidationResult {
  const price = validatePriceMinorUnits(quote.priceMinorUnits);
  if (!price.ok) return price;
  const cap = validateMarketCapMinorUnits(quote.marketCapMinorUnits);
  if (!cap.ok) return cap;
  const circulating = validateSupplyMinorUnits(quote.circulatingSupplyMinorUnits);
  if (!circulating.ok) return circulating;
  const total = validateSupplyMinorUnits(quote.totalSupplyMinorUnits);
  if (!total.ok) return total;
  const marketTs = validateTimestamp(quote.marketTimestamp);
  if (!marketTs.ok) return marketTs;
  return Object.freeze({ ok: true });
}

export type OutlierCheckInput = {
  readonly previousPriceMinorUnits: bigint | null;
  readonly nextPriceMinorUnits: bigint;
  readonly toleranceBps?: bigint;
};

export function detectPriceOutlier(input: OutlierCheckInput): ValidationResult {
  if (input.previousPriceMinorUnits === null || input.previousPriceMinorUnits <= 0n) {
    return Object.freeze({ ok: true });
  }
  const tolerance = input.toleranceBps ?? 5_000n;
  const delta = input.nextPriceMinorUnits > input.previousPriceMinorUnits
    ? input.nextPriceMinorUnits - input.previousPriceMinorUnits
    : input.previousPriceMinorUnits - input.nextPriceMinorUnits;
  const changeBps = (delta * 10_000n) / input.previousPriceMinorUnits;
  if (changeBps > tolerance) {
    return Object.freeze({
      ok: false,
      code: 'PRICE_OUTLIER',
      message: `price changed ${changeBps.toString()} bps exceeds tolerance ${tolerance.toString()} bps`,
    });
  }
  return Object.freeze({ ok: true });
}

export function defaultCryptoMarketNow(): UtcInstant {
  return asUtcInstant('2026-08-21T09:00:00.000Z');
}
