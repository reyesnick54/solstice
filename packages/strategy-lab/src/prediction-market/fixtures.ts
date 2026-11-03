import type { PredictionStrategyBookView } from './types.ts';

export function fixtureYesBookView(): PredictionStrategyBookView {
  return Object.freeze({
    contractInstrumentId: 'helios:prediction:contract:0xfixture_fed_dec_2026:yes',
    bestBidMinor: 6400n,
    bestAskMinor: 6450n,
    midMinor: 6425n,
    spreadBps: 78,
    bidDepthContracts: 130_000n,
    askDepthContracts: 100_000n,
    volume24hContracts: 250_000n,
  });
}

export function fixtureNoBookView(): PredictionStrategyBookView {
  return Object.freeze({
    contractInstrumentId: 'helios:prediction:contract:0xfixture_fed_dec_2026:no',
    bestBidMinor: 3500n,
    bestAskMinor: 3600n,
    midMinor: 3550n,
    spreadBps: 281,
    bidDepthContracts: 85_000n,
    askDepthContracts: 115_000n,
    volume24hContracts: 180_000n,
  });
}
