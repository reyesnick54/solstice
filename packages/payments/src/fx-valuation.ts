import { asUtcInstant, type UtcInstant } from '../../domain/src/time.ts';
import { Money } from '../../money/src/money.ts';
import { currencyRecord } from '../../domain/src/currency.ts';
import { convertExact } from './fx-rate.ts';
import type { FxRate } from './fx-rate.ts';

export const VALUATION_AUTHORITY = 'PRESENTATION_ONLY_NOT_LEDGER' as const;
export const VALUATION_STALE_AFTER_MS = 60_000n;

export type ValuationPosition = {
  readonly currency: string;
  readonly minorUnits: bigint;
};

export type ValuationLine = {
  readonly currency: string;
  readonly sourceMinorUnits: string;
  readonly convertedMinorUnits: string;
  readonly targetCurrency: string;
  readonly rateNumerator: string;
  readonly rateDenominator: string;
  readonly rateKind: 'REFERENCE';
  readonly rateTimestamp: string;
  readonly stale: boolean;
  readonly available: boolean;
};

export type PresentationValuation = {
  readonly authority: typeof VALUATION_AUTHORITY;
  readonly ledgerAuthoritative: false;
  readonly targetCurrency: string;
  readonly asOf: UtcInstant;
  readonly stale: boolean;
  readonly available: boolean;
  readonly reason: string | null;
  readonly aggregateMinorUnits: string | null;
  readonly lines: readonly ValuationLine[];
};

export type ReferenceRateLookup = {
  getReferenceRate(base: string, quote: string, at: UtcInstant): FxRate | undefined;
};

export function valuePositions(input: {
  readonly positions: readonly ValuationPosition[];
  readonly targetCurrency: string;
  readonly now: UtcInstant;
  readonly rates: ReferenceRateLookup;
  readonly staleAfterMs?: bigint;
}): PresentationValuation {
  const target = input.targetCurrency;
  if (!currencyRecord(target)) {
    return emptyValuation(target, input.now, 'target currency is not a supported simulation currency');
  }
  const staleAfter = input.staleAfterMs ?? VALUATION_STALE_AFTER_MS;
  const lines: ValuationLine[] = [];
  let aggregate = 0n;
  let anyStale = false;
  let allAvailable = true;

  for (const position of input.positions) {
    if (position.currency === target) {
      lines.push(sameCurrencyLine(position, target, input.now));
      aggregate += position.minorUnits;
      continue;
    }
    const rate = input.rates.getReferenceRate(position.currency, target, input.now);
    if (!rate) {
      allAvailable = false;
      lines.push({
        currency: position.currency,
        sourceMinorUnits: position.minorUnits.toString(),
        convertedMinorUnits: '0',
        targetCurrency: target,
        rateNumerator: '0',
        rateDenominator: '1',
        rateKind: 'REFERENCE',
        rateTimestamp: input.now,
        stale: true,
        available: false,
      });
      continue;
    }
    const converted = convertExact(Money.fromMinorUnits(position.minorUnits, position.currency), rate);
    const stale = isStale(rate.timestamp, input.now, staleAfter);
    anyStale = anyStale || stale;
    aggregate += converted.minorUnits;
    lines.push({
      currency: position.currency,
      sourceMinorUnits: position.minorUnits.toString(),
      convertedMinorUnits: converted.minorUnits.toString(),
      targetCurrency: target,
      rateNumerator: rate.numerator.toString(),
      rateDenominator: rate.denominator.toString(),
      rateKind: 'REFERENCE',
      rateTimestamp: rate.timestamp,
      stale,
      available: true,
    });
  }

  const available = allAvailable;
  return Object.freeze({
    authority: VALUATION_AUTHORITY,
    ledgerAuthoritative: false,
    targetCurrency: target,
    asOf: input.now,
    stale: anyStale || !available,
    available,
    reason: available
      ? anyStale
        ? 'one or more reference rates are older than the freshness window'
        : null
      : 'one or more positions lack a reference rate',
    aggregateMinorUnits: available ? aggregate.toString() : null,
    lines: Object.freeze(lines),
  });
}

function sameCurrencyLine(position: ValuationPosition, target: string, now: UtcInstant): ValuationLine {
  return Object.freeze({
    currency: position.currency,
    sourceMinorUnits: position.minorUnits.toString(),
    convertedMinorUnits: position.minorUnits.toString(),
    targetCurrency: target,
    rateNumerator: '1',
    rateDenominator: '1',
    rateKind: 'REFERENCE',
    rateTimestamp: now,
    stale: false,
    available: true,
  });
}

function emptyValuation(target: string, now: UtcInstant, reason: string): PresentationValuation {
  return Object.freeze({
    authority: VALUATION_AUTHORITY,
    ledgerAuthoritative: false,
    targetCurrency: target,
    asOf: now,
    stale: true,
    available: false,
    reason,
    aggregateMinorUnits: null,
    lines: Object.freeze([]),
  });
}

function isStale(timestamp: UtcInstant, now: UtcInstant, windowMs: bigint): boolean {
  const then = Date.parse(asUtcInstant(timestamp));
  const current = Date.parse(asUtcInstant(now));
  if (!Number.isFinite(then) || !Number.isFinite(current)) {
    return true;
  }
  return BigInt(current - then) >= windowMs;
}
