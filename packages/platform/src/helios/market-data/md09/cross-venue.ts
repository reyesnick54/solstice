import type { UtcInstant } from '@solstice/domain';
import type { HeliosOs04VenueId } from '@solstice/provider-sdk';
import type { Md09CrossVenueState, Md09MarketObservation } from './types.ts';
import type { Md09VenueHealthState } from './taxonomy.ts';

function compareDecimal(a: string, b: string): number {
  const na = Number(a);
  const nb = Number(b);
  if (na < nb) return -1;
  if (na > nb) return 1;
  return 0;
}

function subtractDecimal(a: string, b: string): string {
  return String(Number(a) - Number(b));
}

function spreadDecimal(bid: string, ask: string): string {
  return subtractDecimal(ask, bid);
}

export function computeMd09CrossVenueState(input: {
  readonly symbolCanonical: string;
  readonly observedAtUtc: UtcInstant;
  readonly observations: readonly Md09MarketObservation[];
  readonly venueHealth: Readonly<Record<string, Md09VenueHealthState>>;
}): Md09CrossVenueState {
  const quotes = input.observations.filter(
    (row) => row.kind === 'quote' && row.quote && row.venueHealth !== 'UNAVAILABLE',
  );
  let bestBid: { venueId: HeliosOs04VenueId; price: string } | null = null;
  let bestAsk: { venueId: HeliosOs04VenueId; price: string } | null = null;

  for (const row of quotes) {
    const q = row.quote!;
    if (!bestBid || compareDecimal(q.bidPrice, bestBid.price) > 0) {
      bestBid = Object.freeze({ venueId: row.venueId, price: q.bidPrice });
    }
    if (!bestAsk || compareDecimal(q.askPrice, bestAsk.price) < 0) {
      bestAsk = Object.freeze({ venueId: row.venueId, price: q.askPrice });
    }
  }

  const mids: Record<string, string> = {};
  for (const row of quotes) {
    const q = row.quote!;
    const mid = String((Number(q.bidPrice) + Number(q.askPrice)) / 2);
    mids[row.venueId] = mid;
  }

  const crossMid =
    bestBid && bestAsk ? String((Number(bestBid.price) + Number(bestAsk.price)) / 2) : null;
  const venueBasis: Record<string, string> = {};
  if (crossMid) {
    for (const [venueId, mid] of Object.entries(mids)) {
      venueBasis[venueId] = subtractDecimal(mid, crossMid);
    }
  }

  const fundingRows = input.observations.filter((row) => row.derivatives.fundingRate !== null);
  let fundingDispersion: string | null = null;
  if (fundingRows.length >= 2) {
    const rates = fundingRows.map((row) => Number(row.derivatives.fundingRate));
    fundingDispersion = String(Math.max(...rates) - Math.min(...rates));
  }

  const markIndexDivergence: Record<string, string> = {};
  for (const row of input.observations) {
    const mark = row.derivatives.markPrice;
    const index = row.derivatives.indexPrice;
    if (mark && index) {
      markIndexDivergence[row.venueId] = subtractDecimal(mark, index);
    }
  }

  const unhealthy = Object.values(input.venueHealth).some(
    (state) => state === 'UNAVAILABLE' || state === 'DESYNCHRONIZED' || state === 'STALE',
  );

  return Object.freeze({
    symbolCanonical: input.symbolCanonical,
    observedAtUtc: input.observedAtUtc,
    bestExecutableBid: bestBid,
    bestExecutableAsk: bestAsk,
    crossVenueSpread: bestBid && bestAsk ? spreadDecimal(bestBid.price, bestAsk.price) : null,
    venueBasis: Object.freeze(venueBasis),
    fundingDispersion,
    markIndexDivergence: Object.freeze(markIndexDivergence),
    executableOpportunity: Object.freeze({
      claimed: false as const,
      reason: unhealthy ? 'venue_health_incomplete' : 'fees_unknown',
    }),
  });
}
