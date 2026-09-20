/**
 * M02 market observation validation and quarantine.
 */

import { isUtcInstant } from '../../../../domain/src/time.ts';
import { BAR_TIMEFRAMES, type BarTimeframe, type CanonicalMarketObservation, type OhlcvBar, type QuarantineReason } from './types.ts';
import { providerSupportsOrderBook, resolveMarketInstrument } from './instrument-registry.ts';
import { validateOrderBookSnapshot } from './order-book.ts';

export type MarketValidationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: QuarantineReason; readonly message: string };

const TIMEFRAME_SET = new Set<string>(BAR_TIMEFRAMES);

export function isSupportedTimeframe(value: string): value is BarTimeframe {
  return TIMEFRAME_SET.has(value);
}

export function validateOhlcvBar(bar: OhlcvBar): MarketValidationResult {
  if (!isSupportedTimeframe(bar.timeframe)) {
    return { ok: false, code: 'UNSUPPORTED_TIMEFRAME', message: `unsupported timeframe ${bar.timeframe}` };
  }
  if (!resolveMarketInstrument(bar.instrumentId)) {
    return { ok: false, code: 'INVALID_INSTRUMENT', message: `unknown instrument ${bar.instrumentId}` };
  }
  if (!isUtcInstant(bar.startTime) || !isUtcInstant(bar.endTime)) {
    return { ok: false, code: 'TIMESTAMP_INVERSION', message: 'bar timestamps are malformed' };
  }
  if (Date.parse(bar.endTime) <= Date.parse(bar.startTime)) {
    return { ok: false, code: 'TIMESTAMP_INVERSION', message: 'bar endTime must follow startTime' };
  }
  if (Date.parse(bar.arrivalTimestamp) < Date.parse(bar.sourceTimestamp)) {
    return { ok: false, code: 'TIMESTAMP_INVERSION', message: 'bar arrival precedes source event' };
  }
  if (bar.volumeUnits < 0n) {
    return { ok: false, code: 'NEGATIVE_VOLUME', message: 'bar volume cannot be negative' };
  }
  if (bar.openMinorUnits <= 0n || bar.highMinorUnits <= 0n || bar.lowMinorUnits <= 0n || bar.closeMinorUnits <= 0n) {
    return { ok: false, code: 'IMPOSSIBLE_OHLC', message: 'bar prices must be positive' };
  }
  if (bar.highMinorUnits < bar.lowMinorUnits) {
    return { ok: false, code: 'IMPOSSIBLE_OHLC', message: 'bar high is below low' };
  }
  if (bar.highMinorUnits < bar.openMinorUnits || bar.highMinorUnits < bar.closeMinorUnits) {
    return { ok: false, code: 'IMPOSSIBLE_OHLC', message: 'bar high is below open or close' };
  }
  if (bar.lowMinorUnits > bar.openMinorUnits || bar.lowMinorUnits > bar.closeMinorUnits) {
    return { ok: false, code: 'IMPOSSIBLE_OHLC', message: 'bar low is above open or close' };
  }
  if (bar.entitlement.unavailable) {
    return { ok: false, code: 'MISSING_ENTITLEMENT', message: 'bar entitlement unavailable' };
  }
  if (!bar.providerId?.trim()) {
    return { ok: false, code: 'INVALID_PROVIDER_MAPPING', message: 'providerId is required' };
  }
  return { ok: true };
}

export function validateMarketObservation(observation: CanonicalMarketObservation): MarketValidationResult {
  if (!resolveMarketInstrument(observation.instrumentId)) {
    return { ok: false, code: 'INVALID_INSTRUMENT', message: `unknown instrument ${observation.instrumentId}` };
  }
  if (!observation.providerId?.trim()) {
    return { ok: false, code: 'INVALID_PROVIDER_MAPPING', message: 'providerId is required' };
  }
  if (observation.entitlement.unavailable) {
    return { ok: false, code: 'MISSING_ENTITLEMENT', message: 'entitlement unavailable' };
  }

  switch (observation.observationType) {
    case 'ohlcv_bar':
      return validateOhlcvBar(observation);
    case 'order_book_snapshot': {
      if (!providerSupportsOrderBook(observation.instrumentId)) {
        return {
          ok: false,
          code: 'MALFORMED_ORDER_BOOK',
          message: 'instrument does not support order book observations',
        };
      }
      const bookResult = validateOrderBookSnapshot(observation.orderBook);
      if (!bookResult.ok) {
        return { ok: false, code: bookResult.code as QuarantineReason, message: bookResult.message };
      }
      return { ok: true };
    }
    case 'quote':
    case 'best_bid_offer':
    case 'reference_price': {
      if (
        observation.bidMinorUnits === null &&
        observation.askMinorUnits === null &&
        observation.lastMinorUnits === null
      ) {
        return { ok: false, code: 'MALFORMED_PAYLOAD', message: 'quote has no price fields' };
      }
      if (Date.parse(observation.arrivalTimestamp) < Date.parse(observation.sourceTimestamp)) {
        return { ok: false, code: 'TIMESTAMP_INVERSION', message: 'quote arrival precedes source event' };
      }
      if (
        observation.bidMinorUnits !== null &&
        observation.askMinorUnits !== null &&
        observation.bidMinorUnits >= observation.askMinorUnits
      ) {
        return { ok: false, code: 'CROSSED_MARKET', message: 'crossed quote market' };
      }
      return { ok: true };
    }
    case 'trade': {
      if (observation.priceMinorUnits <= 0n || observation.quantityMinorUnits < 0n) {
        return { ok: false, code: 'MALFORMED_PAYLOAD', message: 'invalid trade price or quantity' };
      }
      if (Date.parse(observation.arrivalTimestamp) < Date.parse(observation.sourceTimestamp)) {
        return { ok: false, code: 'TIMESTAMP_INVERSION', message: 'trade arrival precedes source event' };
      }
      return { ok: true };
    }
    case 'market_status':
      return { ok: true };
    default:
      return { ok: false, code: 'MALFORMED_PAYLOAD', message: 'unsupported observation type' };
  }
}

export function barDedupeKey(bar: OhlcvBar): string {
  return `${bar.instrumentId}|${bar.timeframe}|${bar.startTime}|${bar.providerId}`;
}

export function detectSequenceRegression(
  current: bigint | null,
  prior: bigint | null,
): boolean {
  if (current === null || prior === null) return false;
  return current < prior;
}
