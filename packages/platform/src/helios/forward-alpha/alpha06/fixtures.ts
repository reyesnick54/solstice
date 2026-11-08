import { asUtcInstant, type UtcInstant } from '@solstice/domain';

import { deepLevel2Snapshot, thinLevel2Snapshot } from '../../execution-twin/simulation/fixtures.ts';
import { fundingEvent } from '../../execution-twin/simulation/funding-model.ts';

import type { Alpha06ForwardScenario } from './types.ts';

export const ALPHA06_FIXTURE_NOW = asUtcInstant('2026-11-08T07:00:00.000Z');
export const ALPHA06_FIXTURE_EXIT = asUtcInstant('2026-11-08T07:05:00.000Z');

function scaledDeepBook(now: UtcInstant, bidMinor: bigint, askMinor: bigint) {
  const base = deepLevel2Snapshot(now);
  return Object.freeze({
    ...base,
    snapshotId: `l2_alpha06_${bidMinor}_${askMinor}`,
    bids: Object.freeze([{ priceMinorUnits: bidMinor, sizeUnits: 80n }]),
    asks: Object.freeze([{ priceMinorUnits: askMinor, sizeUnits: 80n }]),
  });
}

/** Signal edge survives partial execution costs on a deep book. */
export function alpha06SurvivingScenario(now: UtcInstant = ALPHA06_FIXTURE_NOW): Alpha06ForwardScenario {
  const entryBook = scaledDeepBook(now, 99_950_00n, 100_050_00n);
  const exitBook = scaledDeepBook(
    ALPHA06_FIXTURE_EXIT,
    100_450_00n,
    100_550_00n,
  );
  return Object.freeze({
    scenarioId: 'alpha06_survives_deep_book',
    strategyType: 'CRYPTO_SPOT',
    instrumentId: 'CRYPTO:BTC:USD:SIM',
    currency: 'USD',
    entry: Object.freeze({
      side: 'BUY',
      signalPriceMinor: 100_000_00n,
      quantityUnits: 4n,
      at: now,
    }),
    exit: Object.freeze({
      side: 'SELL',
      signalPriceMinor: 100_500_00n,
      quantityUnits: 4n,
      at: ALPHA06_FIXTURE_EXIT,
    }),
    entryBook,
    exitBook,
    algorithmKind: 'MARKET',
  });
}

/** Thin liquidity: signal alpha vanishes after fees, spread, and unfilled quantity. */
export function alpha06DecayScenario(now: UtcInstant = ALPHA06_FIXTURE_NOW): Alpha06ForwardScenario {
  const entryBook = thinLevel2Snapshot(now);
  const exitBook = thinLevel2Snapshot(ALPHA06_FIXTURE_EXIT);
  return Object.freeze({
    scenarioId: 'alpha06_decay_thin_book',
    strategyType: 'CRYPTO_SPOT',
    instrumentId: 'CRYPTO:BTC:USD:SIM',
    currency: 'USD',
    entry: Object.freeze({
      side: 'BUY',
      signalPriceMinor: 100_000_00n,
      quantityUnits: 50n,
      at: now,
    }),
    exit: Object.freeze({
      side: 'SELL',
      signalPriceMinor: 100_010_00n,
      quantityUnits: 50n,
      at: ALPHA06_FIXTURE_EXIT,
    }),
    entryBook,
    exitBook,
    algorithmKind: 'TWAP',
  });
}

/** Perpetual funding drag applied on top of execution friction. */
export function alpha06PerpFundingScenario(now: UtcInstant = ALPHA06_FIXTURE_NOW): Alpha06ForwardScenario {
  const base = alpha06SurvivingScenario(now);
  return Object.freeze({
    ...base,
    scenarioId: 'alpha06_perp_funding',
    strategyType: 'PERPETUAL_FUNDING',
    fundingEvents: Object.freeze([
      fundingEvent('fund_1', base.instrumentId, now, 25, 100_000_00n, 'USD'),
      fundingEvent('fund_2', base.instrumentId, ALPHA06_FIXTURE_EXIT, 25, 100_200_00n, 'USD'),
    ]),
  });
}
