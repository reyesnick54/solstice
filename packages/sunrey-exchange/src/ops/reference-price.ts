import { exchangePrice, type ExchangePrice } from '../price.ts';
import type { DigitalOrder, ImmutableTrade } from '../types.ts';
import { sortBook } from '../matching.ts';
import type { ReferencePriceSource } from './taxonomy.ts';

export type ReferencePriceResolution = {
  readonly priceUnits: bigint | null;
  readonly source: ReferencePriceSource | null;
  readonly hierarchy: readonly {
    readonly source: ReferencePriceSource;
    readonly priceUnits: bigint | null;
    readonly used: boolean;
  }[];
  readonly fairPriceGuaranteed: false;
};

/**
 * Explicit hierarchy: recent eligible trades, then internal midpoint,
 * then an approved oracle/reference feed. No implicit source.
 */
export function resolveReferencePrice(input: {
  readonly lastEligibleTrade: ImmutableTrade | null;
  readonly resting: readonly DigitalOrder[];
  readonly approvedOraclePriceUnits: bigint | null;
  readonly oracleApproved: boolean;
  readonly priceTemplate?: ExchangePrice;
}): ReferencePriceResolution {
  const book = sortBook(input.resting);
  const bestBid = book.bids[0]?.limitPrice?.priceUnits ?? null;
  const bestAsk = book.asks[0]?.limitPrice?.priceUnits ?? null;
  const midpoint =
    bestBid !== null && bestAsk !== null ? (bestBid + bestAsk) / 2n : null;
  const trade = input.lastEligibleTrade?.price.priceUnits ?? null;
  const oracle = input.oracleApproved ? input.approvedOraclePriceUnits : null;

  const hierarchy = Object.freeze([
    {
      source: 'RECENT_ELIGIBLE_TRADE' as const,
      priceUnits: trade,
      used: trade !== null,
    },
    {
      source: 'INTERNAL_MIDPOINT' as const,
      priceUnits: midpoint,
      used: trade === null && midpoint !== null,
    },
    {
      source: 'APPROVED_ORACLE_FEED' as const,
      priceUnits: oracle,
      used: trade === null && midpoint === null && oracle !== null,
    },
  ]);

  const used = hierarchy.find((row) => row.used) ?? null;
  return Object.freeze({
    priceUnits: used?.priceUnits ?? null,
    source: used?.source ?? null,
    hierarchy,
    fairPriceGuaranteed: false,
  });
}

export function collarBounds(
  referenceUnits: bigint,
  collarBps: bigint,
): { readonly low: bigint; readonly high: bigint } {
  const delta = (referenceUnits * collarBps) / 10_000n;
  const low = referenceUnits > delta ? referenceUnits - delta : 1n;
  return Object.freeze({ low, high: referenceUnits + delta });
}

export function priceWithinCollar(priceUnits: bigint, referenceUnits: bigint, collarBps: bigint): boolean {
  const { low, high } = collarBounds(referenceUnits, collarBps);
  return priceUnits >= low && priceUnits <= high;
}

export function protectionLimit(
  side: 'BUY' | 'SELL',
  referenceUnits: bigint,
  protectionBps: bigint,
  template: ExchangePrice,
): ExchangePrice {
  const { low, high } = collarBounds(referenceUnits, protectionBps);
  return exchangePrice({
    baseAssetId: template.baseAssetId,
    quoteAssetId: template.quoteAssetId,
    quoteKind: template.quoteKind,
    priceUnits: side === 'BUY' ? high : low,
    quoteScale: template.quoteScale,
    basePrecision: template.basePrecision,
  });
}
