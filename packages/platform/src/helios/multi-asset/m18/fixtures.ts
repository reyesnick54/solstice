import type { UtcInstant } from '@solstice/domain';

import type { HeliosBar15mObservation } from '../index-bars.ts';
import type { InstrumentExposureMetadata, PortfolioPositionFact } from './types.ts';

export const M18_FIXTURE_INSTRUMENTS: readonly InstrumentExposureMetadata[] = Object.freeze([
  Object.freeze({
    instrumentId: 'SECURITY:US:SPY:ARCX',
    symbol: 'SPY',
    assetClass: 'ETF',
    venueId: 'ARCX',
    tradingCurrency: 'USD',
    settlementCurrency: 'USD',
    underlyingInstrumentId: null,
    sourceRefs: Object.freeze(['fixture:spy']),
  }),
  Object.freeze({
    instrumentId: 'SECURITY:US:QQQ:XNAS',
    symbol: 'QQQ',
    assetClass: 'ETF',
    venueId: 'XNAS',
    tradingCurrency: 'USD',
    settlementCurrency: 'USD',
    underlyingInstrumentId: 'INDEX:US:NDX:NDQ',
    sourceRefs: Object.freeze(['fixture:qqq']),
  }),
  Object.freeze({
    instrumentId: 'SECURITY:US:NVDA:XNAS',
    symbol: 'NVDA',
    assetClass: 'EQUITY',
    venueId: 'XNAS',
    tradingCurrency: 'USD',
    settlementCurrency: 'USD',
    underlyingInstrumentId: null,
    sourceRefs: Object.freeze(['fixture:nvda']),
  }),
  Object.freeze({
    instrumentId: 'CRYPTO:GLOBAL:BTC:USD:SIM',
    symbol: 'BTCUSD',
    assetClass: 'CRYPTO_SPOT',
    venueId: 'SIM',
    tradingCurrency: 'USD',
    settlementCurrency: 'USD',
    underlyingInstrumentId: null,
    sourceRefs: Object.freeze(['fixture:btc']),
  }),
  Object.freeze({
    instrumentId: 'SECURITY:US:GLD:ARCX',
    symbol: 'GLD',
    assetClass: 'ETF',
    venueId: 'ARCX',
    tradingCurrency: 'USD',
    settlementCurrency: 'USD',
    underlyingInstrumentId: null,
    sourceRefs: Object.freeze(['fixture:gld']),
  }),
  Object.freeze({
    instrumentId: 'FX:GLOBAL:EUR:USD:SIM',
    symbol: 'EURUSD',
    assetClass: 'FX_SPOT',
    venueId: 'SIM',
    tradingCurrency: 'USD',
    settlementCurrency: 'USD',
    underlyingInstrumentId: null,
    sourceRefs: Object.freeze(['fixture:eurusd']),
  }),
  Object.freeze({
    instrumentId: 'COMMODITY:GLOBAL:WTI:XNYM',
    symbol: 'WTI',
    assetClass: 'COMMODITY',
    venueId: 'XNYM',
    tradingCurrency: 'USD',
    settlementCurrency: 'USD',
    underlyingInstrumentId: null,
    sourceRefs: Object.freeze(['fixture:wti']),
  }),
]);

export function fixturePosition(
  input: Partial<PortfolioPositionFact> & Pick<PortfolioPositionFact, 'positionId' | 'instrumentId' | 'marketValueMinor'>,
): PortfolioPositionFact {
  const side = input.side ?? (input.marketValueMinor < 0n ? 'SHORT' : 'LONG');
  const marketValueMinor = input.marketValueMinor < 0n ? -input.marketValueMinor : input.marketValueMinor;
  return Object.freeze({
    strategyId: 'strategy_default',
    venueId: 'XNAS',
    providerId: 'fixture_provider',
    assetClass: 'EQUITY',
    currency: 'USD',
    quantityUnits: 100n,
    status: 'OPEN',
    openedAt: '2026-09-16T14:00:00.000Z' as UtcInstant,
    closedAt: null,
    ...input,
    marketValueMinor,
    side,
  });
}

export function correlatedBarSeries(
  instrumentId: string,
  baseClose: number,
  asOf: UtcInstant,
  drift = 0,
): readonly HeliosBar15mObservation[] {
  const bars: HeliosBar15mObservation[] = [];
  for (let i = 0; i < 8; i += 1) {
    const close = BigInt(baseClose + i * 10 + drift);
    const hour = String(i).padStart(2, '0');
    const ts = `2026-09-16T${hour}:00:00.000Z` as UtcInstant;
    bars.push(
      Object.freeze({
        instrumentId: instrumentId as HeliosBar15mObservation['instrumentId'],
        barInterval: '15m',
        sourceEventTime: ts,
        knowableAt: ts,
        openMinor: close - 5n,
        highMinor: close + 5n,
        lowMinor: close - 10n,
        closeMinor: close,
        bidMinor: close - 1n,
        askMinor: close + 1n,
        spreadBps: 10n,
        sessionState: 'OPEN',
        marketState: 'NORMAL',
        liquidityState: 'NORMAL',
        marketRegime: 'TRENDING',
        providerId: 'fixture_market',
        observationId: `obs_${instrumentId}_${i}`,
      }),
    );
  }
  void asOf;
  return Object.freeze(bars);
}
