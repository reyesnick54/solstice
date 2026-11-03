/**
 * AAF09 instrument identities — quote currency is part of identity (BTC/USD ≠ BTC/USDT).
 */

export type Aaf09BaseAsset = 'BTC' | 'ETH';
export type Aaf09QuoteCurrency = 'USD' | 'USDT';

export type Aaf09InstrumentDefinition = {
  readonly instrumentId: string;
  readonly baseAsset: Aaf09BaseAsset;
  readonly quoteCurrency: Aaf09QuoteCurrency;
  readonly pairLabel: string;
  readonly krakenPair: string;
  readonly coingeckoId: string;
};

export const AAF09_INSTRUMENTS: readonly Aaf09InstrumentDefinition[] = Object.freeze([
  Object.freeze({
    instrumentId: 'CRYPTO:AAF09:BTC:USD',
    baseAsset: 'BTC',
    quoteCurrency: 'USD',
    pairLabel: 'BTC/USD',
    krakenPair: 'XBTUSD',
    coingeckoId: 'bitcoin',
  }),
  Object.freeze({
    instrumentId: 'CRYPTO:AAF09:BTC:USDT',
    baseAsset: 'BTC',
    quoteCurrency: 'USDT',
    pairLabel: 'BTC/USDT',
    krakenPair: 'XBTUSDT',
    coingeckoId: 'bitcoin',
  }),
  Object.freeze({
    instrumentId: 'CRYPTO:AAF09:ETH:USD',
    baseAsset: 'ETH',
    quoteCurrency: 'USD',
    pairLabel: 'ETH/USD',
    krakenPair: 'ETHUSD',
    coingeckoId: 'ethereum',
  }),
  Object.freeze({
    instrumentId: 'CRYPTO:AAF09:ETH:USDT',
    baseAsset: 'ETH',
    quoteCurrency: 'USDT',
    pairLabel: 'ETH/USDT',
    krakenPair: 'ETHUSDT',
    coingeckoId: 'ethereum',
  }),
]);

const BY_ID = new Map(AAF09_INSTRUMENTS.map((row) => [row.instrumentId, row]));

export function resolveAaf09Instrument(instrumentId: string): Aaf09InstrumentDefinition | undefined {
  return BY_ID.get(instrumentId);
}

export function instrumentsShareBaseButDifferQuote(a: string, b: string): boolean {
  const left = resolveAaf09Instrument(a);
  const right = resolveAaf09Instrument(b);
  if (!left || !right) return false;
  return left.baseAsset === right.baseAsset && left.quoteCurrency !== right.quoteCurrency;
}

export function assertDistinctInstrumentPair(a: string, b: string): boolean {
  return a !== b;
}
