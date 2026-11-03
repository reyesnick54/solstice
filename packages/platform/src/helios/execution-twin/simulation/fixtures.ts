/**
 * HELIOS OS03 — deterministic fixtures for qualification and tests.
 */

import type { UtcInstant } from '@solstice/domain';

import type { BarObservation, Level2Snapshot, PerpetualInstrumentSpec, QuoteObservation } from './types.ts';

export const OS03_FIXTURE_NOW = '2026-11-03T06:00:00.000Z' as UtcInstant;

export function thinLevel2Snapshot(now: UtcInstant = OS03_FIXTURE_NOW): Level2Snapshot {
  return Object.freeze({
    snapshotId: 'l2_thin',
    instrumentId: 'CRYPTO:BTC:USD:SIM',
    observedAt: now,
    currency: 'USD',
    bids: Object.freeze([{ priceMinorUnits: 99_900_00n, sizeUnits: 1n }]),
    asks: Object.freeze([{ priceMinorUnits: 100_100_00n, sizeUnits: 2n }]),
  });
}

export function gapLevel2Snapshot(now: UtcInstant = OS03_FIXTURE_NOW): Level2Snapshot {
  return Object.freeze({
    snapshotId: 'l2_gap',
    instrumentId: 'CRYPTO:BTC:USD:SIM',
    observedAt: now,
    currency: 'USD',
    bids: Object.freeze([{ priceMinorUnits: 98_000_00n, sizeUnits: 10n }]),
    asks: Object.freeze([{ priceMinorUnits: 102_000_00n, sizeUnits: 10n }]),
  });
}

export function deepLevel2Snapshot(now: UtcInstant = OS03_FIXTURE_NOW): Level2Snapshot {
  return Object.freeze({
    snapshotId: 'l2_deep',
    instrumentId: 'CRYPTO:BTC:USD:SIM',
    observedAt: now,
    currency: 'USD',
    bids: Object.freeze([
      { priceMinorUnits: 99_950_00n, sizeUnits: 50n },
      { priceMinorUnits: 99_900_00n, sizeUnits: 100n },
    ]),
    asks: Object.freeze([
      { priceMinorUnits: 100_050_00n, sizeUnits: 50n },
      { priceMinorUnits: 100_100_00n, sizeUnits: 100n },
    ]),
  });
}

export function staleLevel2Snapshot(now: UtcInstant): Level2Snapshot {
  const observed = new Date(Date.parse(now) - 120_000).toISOString() as UtcInstant;
  return Object.freeze({
    ...thinLevel2Snapshot(observed),
    snapshotId: 'l2_stale',
    observedAt: observed,
  });
}

export function sampleQuote(now: UtcInstant = OS03_FIXTURE_NOW): QuoteObservation {
  return Object.freeze({
    quoteId: 'q1',
    instrumentId: 'CRYPTO:BTC:USD:SIM',
    observedAt: now,
    bidMinorUnits: 99_980_00n,
    askMinorUnits: 100_020_00n,
    bidSizeUnits: 5n,
    askSizeUnits: 5n,
    currency: 'USD',
  });
}

export function sampleBar(now: UtcInstant = OS03_FIXTURE_NOW): BarObservation {
  return Object.freeze({
    barId: 'bar1',
    instrumentId: 'CRYPTO:BTC:USD:SIM',
    observedAt: now,
    openMinorUnits: 99_000_00n,
    highMinorUnits: 101_000_00n,
    lowMinorUnits: 98_500_00n,
    closeMinorUnits: 100_500_00n,
    volumeUnits: 250n,
    currency: 'USD',
  });
}

export function samplePerpetualSpec(): PerpetualInstrumentSpec {
  return Object.freeze({
    instrumentId: 'PERP:BTC:USD:SIM',
    contractMultiplierMinorUnits: 1n,
    multiplierScale: 0,
    settlementCurrency: 'USD',
    maintenanceMarginRateBps: 50,
    initialMarginRateBps: 100,
  });
}
