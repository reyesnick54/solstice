/**
 * Compose canonical U.S. equity market state from direct and consolidated observations.
 */

import { HELIOS_MD07_SCHEMA } from './taxonomy.ts';
import { measureUsEquityViewDivergence } from './divergence.ts';
import { deriveQuoteTopology } from './quote-topology.ts';
import {
  classifyLotSize,
  resolveRoundLotPolicyAt,
  resolveRoundLotShares,
} from './round-lot-policy.ts';
import type {
  ComposeUsEquityMarketStateInput,
  UsEquityAuctionState,
  UsEquityFeedObservationBundle,
  UsEquityFeedView,
  UsEquityMarketState,
  UsEquityNbbo,
  UsEquityOddLotBest,
  UsEquityQuoteSide,
  UsEquityVenueBbo,
  UsEquityVenueQuoteObservation,
} from './types.ts';

export function composeUsEquityMarketState(input: ComposeUsEquityMarketStateInput): UsEquityMarketState {
  const policy = resolveRoundLotPolicyAt(input.roundLotPolicyAsOf);
  if (!policy) {
    throw new Error(`no round-lot policy for ${input.roundLotPolicyAsOf}`);
  }
  const refPrice = input.referencePriceMinorUnits ?? 10_000n;
  const roundLotShares = resolveRoundLotShares(policy, refPrice);

  const directFeedView = input.directFeed
    ? buildFeedView(input.directFeed, roundLotShares)
    : null;
  const consolidatedView = input.consolidatedFeed
    ? buildFeedView(input.consolidatedFeed, roundLotShares)
    : null;

  const divergence =
    directFeedView || consolidatedView
      ? measureUsEquityViewDivergence(directFeedView, consolidatedView)
      : null;

  const activeAuction = pickActiveAuction(directFeedView, consolidatedView);

  return Object.freeze({
    schema: HELIOS_MD07_SCHEMA,
    instrumentId: input.instrumentId,
    symbol: input.symbol,
    currency: input.currency,
    priceScale: input.priceScale,
    roundLotPolicyRef: Object.freeze({
      policyId: policy.policyId,
      version: policy.version,
    }),
    directFeedView,
    consolidatedView,
    divergence,
    activeAuction,
    evaluatedAt: input.evaluatedAt,
    grantsExecutionAuthority: false as const,
  });
}

function buildFeedView(
  bundle: UsEquityFeedObservationBundle,
  roundLotShares: bigint,
): UsEquityFeedView {
  const venueBbos = bundle.venueQuotes.map((quote) => buildVenueBbo(quote, roundLotShares));
  const nbbo = synthesizeNbbo(venueBbos);
  const oddLot = synthesizeOddLotBest(venueBbos, roundLotShares);

  return Object.freeze({
    viewKind: bundle.viewKind,
    venueBbos,
    nbbo,
    oddLot,
    lastTrade: bundle.lastTrade,
    depth: bundle.depth,
    auctionImbalance: bundle.auctionImbalance,
    tradingStatus: bundle.tradingStatus,
    shortSaleState: bundle.shortSaleState,
    observedAt: bundle.observedAt,
    sourceProviderId: bundle.providerId,
  });
}

function buildVenueBbo(
  quote: UsEquityVenueQuoteObservation,
  roundLotShares: bigint,
): UsEquityVenueBbo {
  const bid = toQuoteSide(
    quote.bidPriceMinorUnits,
    quote.bidSizeShares,
    roundLotShares,
    quote.venueId,
    quote.sourceTimestamp,
    quote.arrivalTimestamp,
  );
  const ask = toQuoteSide(
    quote.askPriceMinorUnits,
    quote.askSizeShares,
    roundLotShares,
    quote.venueId,
    quote.sourceTimestamp,
    quote.arrivalTimestamp,
  );
  return Object.freeze({
    venueId: quote.venueId,
    bid,
    ask,
    topology: deriveQuoteTopology(bid, ask),
  });
}

function toQuoteSide(
  priceMinorUnits: bigint | null,
  sizeShares: bigint | null,
  roundLotShares: bigint,
  venueId: string,
  sourceTimestamp: UsEquityVenueQuoteObservation['sourceTimestamp'],
  arrivalTimestamp: UsEquityVenueQuoteObservation['arrivalTimestamp'],
): UsEquityQuoteSide | null {
  if (priceMinorUnits === null || sizeShares === null) {
    return null;
  }
  return Object.freeze({
    priceMinorUnits,
    sizeShares,
    lotClassification: classifyLotSize(roundLotShares, sizeShares),
    venueId,
    sourceTimestamp,
    arrivalTimestamp,
  });
}

function synthesizeNbbo(venueBbos: readonly UsEquityVenueBbo[]): UsEquityNbbo | null {
  if (venueBbos.length === 0) {
    return null;
  }
  const bids = venueBbos.map((v) => v.bid).filter((q): q is UsEquityQuoteSide => q !== null);
  const asks = venueBbos.map((v) => v.ask).filter((q): q is UsEquityQuoteSide => q !== null);
  if (bids.length === 0 && asks.length === 0) {
    return null;
  }
  const bestBid =
    bids.length === 0
      ? null
      : bids.reduce((best, cur) => (cur.priceMinorUnits > best.priceMinorUnits ? cur : best));
  const bestAsk =
    asks.length === 0
      ? null
      : asks.reduce((best, cur) => (cur.priceMinorUnits < best.priceMinorUnits ? cur : best));
  const contributingVenueIds = Object.freeze([
    ...new Set(
      venueBbos
        .filter((v) => v.bid !== null || v.ask !== null)
        .map((v) => v.venueId),
    ),
  ]);
  return Object.freeze({
    bid: bestBid,
    ask: bestAsk,
    topology: deriveQuoteTopology(bestBid, bestAsk),
    contributingVenueIds,
  });
}

function synthesizeOddLotBest(
  venueBbos: readonly UsEquityVenueBbo[],
  roundLotShares: bigint,
): UsEquityOddLotBest {
  let bestOddLotBid: UsEquityQuoteSide | null = null;
  let bestOddLotAsk: UsEquityQuoteSide | null = null;

  for (const venue of venueBbos) {
    if (venue.bid && isOddLotQuote(venue.bid, roundLotShares)) {
      if (!bestOddLotBid || venue.bid.priceMinorUnits > bestOddLotBid.priceMinorUnits) {
        bestOddLotBid = venue.bid;
      }
    }
    if (venue.ask && isOddLotQuote(venue.ask, roundLotShares)) {
      if (!bestOddLotAsk || venue.ask.priceMinorUnits < bestOddLotAsk.priceMinorUnits) {
        bestOddLotAsk = venue.ask;
      }
    }
  }

  return Object.freeze({ bestOddLotBid, bestOddLotAsk });
}

function isOddLotQuote(side: UsEquityQuoteSide, roundLotShares: bigint): boolean {
  return side.lotClassification === 'ODD' || side.sizeShares < roundLotShares;
}

function pickActiveAuction(
  direct: UsEquityFeedView | null,
  consolidated: UsEquityFeedView | null,
): UsEquityAuctionState | null {
  const imbalance = consolidated?.auctionImbalance ?? direct?.auctionImbalance ?? null;
  if (!imbalance) {
    return null;
  }
  return Object.freeze({
    auctionKind: imbalance.auctionKind,
    imbalance,
    sourceTimestamp: imbalance.sourceTimestamp,
  });
}
