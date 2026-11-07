/**
 * Build fixture-backed MD09 research ticks from NATIVE05 normalization fixtures.
 */

import type { HeliosOs04VenueId, HeliosVenueAdapter } from '@solstice/provider-sdk';
import type { Md09VenueRawKind, Md09VenueRawTick } from './types.ts';

const DERIVATIVE_KINDS = Object.freeze([
  'funding',
  'mark_price',
  'index_price',
  'open_interest',
  'liquidation',
] as const satisfies readonly Md09VenueRawKind[]);

const HYPERLIQUID_EXTRA: Readonly<
  Partial<Record<(typeof DERIVATIVE_KINDS)[number], unknown>>
> = Object.freeze({
  funding: Object.freeze({ coin: 'BTC', fundingRate: '0.00012', time: 1_690_000_000_000 }),
  mark_price: Object.freeze({ coin: 'BTC', markPx: '67200.2', time: 1_690_000_000_000 }),
  index_price: Object.freeze({ coin: 'BTC', indexPx: '67198.0', time: 1_690_000_000_000 }),
  open_interest: Object.freeze({ coin: 'BTC', oi: '12500.5', time: 1_690_000_000_000 }),
  liquidation: Object.freeze({
    coin: 'BTC',
    px: '67150.0',
    sz: '0.25',
    side: 'sell',
    time: 1_690_000_001_000,
  }),
});

const BYBIT_DERIVS = Object.freeze({
  funding: Object.freeze({ fundingRate: '0.00011', seq: 10 }),
  mark_price: Object.freeze({ markPrice: '67190.0', indexPrice: '67188.5', seq: 10 }),
  index_price: Object.freeze({ indexPrice: '67188.5', seq: 10 }),
  open_interest: Object.freeze({ openInterest: '98000', seq: 10 }),
});

function bumpQuoteRaw(venueId: HeliosOs04VenueId, raw: unknown, bump: number): unknown {
  if (raw === null || typeof raw !== 'object') {
    return raw;
  }
  const row = { ...(raw as Record<string, unknown>) };
  if (typeof row.u === 'number') {
    row.u = row.u + bump;
  }
  if (typeof row.lastUpdateId === 'number') {
    row.lastUpdateId = row.lastUpdateId + bump;
  }
  if (venueId === 'hyperliquid' && typeof row.time === 'number') {
    row.time = row.time + bump * 1_000;
  }
  return Object.freeze(row);
}

function venueDerivativePayload(
  venueId: HeliosOs04VenueId,
  kind: (typeof DERIVATIVE_KINDS)[number],
): unknown | undefined {
  if (venueId === 'hyperliquid') {
    return HYPERLIQUID_EXTRA[kind];
  }
  if (venueId === 'bybit' || venueId === 'okx' || venueId === 'bitget') {
    return (BYBIT_DERIVS as Record<string, unknown>)[kind];
  }
  return undefined;
}

export function buildMd09ReferenceStream(adapter: HeliosVenueAdapter): readonly Md09VenueRawTick[] {
  const fixture = adapter.normalizationFixtures[0];
  if (!fixture?.quote) {
    return Object.freeze([]);
  }
  const symbol = adapter.resolveSymbol({ kind: 'canonical', value: 'BTC/USD' }).canonical;
  const ticks: Md09VenueRawTick[] = [];

  for (const bump of [0, 1, 3]) {
    const kinds: Md09VenueRawKind[] = ['quote'];
    const tick: Record<string, unknown> = {
      tickId: `${adapter.venueId}_tick_${bump}`,
      symbolCanonical: symbol,
      kinds,
      quote: bumpQuoteRaw(adapter.venueId, fixture.quote, bump),
    };
    if (bump === 0 && fixture.trade) {
      kinds.push('trade');
      tick.trade = fixture.trade;
    }
    if (bump === 0 && fixture.book) {
      kinds.push('book');
      tick.book = fixture.book;
    }
    if (bump === 1) {
      kinds.push('venue_status');
      tick.venueStatus = Object.freeze({ status: 'online', venueId: adapter.venueId });
    }
    for (const derivKind of DERIVATIVE_KINDS) {
      const payload = venueDerivativePayload(adapter.venueId, derivKind);
      if (payload && bump === 0) {
        kinds.push(derivKind);
        const key =
          derivKind === 'mark_price'
            ? 'markPrice'
            : derivKind === 'index_price'
              ? 'indexPrice'
              : derivKind === 'open_interest'
                ? 'openInterest'
                : derivKind;
        tick[key] = payload;
      }
    }
    ticks.push(Object.freeze(tick) as Md09VenueRawTick);
  }

  return Object.freeze(ticks);
}

/** @deprecated use buildMd09ReferenceStream(adapter) */
export const MD09_VENUE_RESEARCH_STREAMS = Object.freeze({} as Readonly<Record<HeliosOs04VenueId, readonly Md09VenueRawTick[]>>);
