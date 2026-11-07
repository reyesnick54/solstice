import type { UtcInstant } from '@solstice/domain';
import type { HeliosVenueAdapter } from '@solstice/provider-sdk';
import type { Md09VenueResearchAdapter, Md09VenueRawTick } from '@solstice/external-data';
import { HELIOS_MD09_SCHEMA, type Md09MarketDataKind, type Md09VenueHealthState } from './taxonomy.ts';
import { normalizeMd09Derivatives, emptyMd09Derivatives } from './derivatives.ts';
import { applyMd09SequenceStep, initialMd09SequenceIntegrity } from './sequence.ts';
import { assessMd09VenueHealth } from './venue-health.ts';
import type { Md09MarketObservation, Md09SequenceIntegrity, Md09VenueStatusObservation } from './types.ts';

export type Md09VenueSession = Readonly<{
  readonly venueId: HeliosVenueAdapter['venueId'];
  readonly sequenceIntegrity: Md09SequenceIntegrity;
  readonly observations: readonly Md09MarketObservation[];
}>;

function venueStatusFromRaw(raw: unknown): Md09VenueStatusObservation {
  const row = raw as Record<string, unknown> | undefined;
  const status = row?.status;
  if (status === 'online') {
    return Object.freeze({ status: 'online', message: null });
  }
  if (status === 'maintenance') {
    return Object.freeze({ status: 'maintenance', message: 'scheduled maintenance' });
  }
  if (status === 'offline') {
    return Object.freeze({ status: 'offline', message: 'venue offline' });
  }
  return Object.freeze({ status: 'unknown', message: null });
}

function kindsForTick(tick: Md09VenueRawTick): readonly Md09MarketDataKind[] {
  const kinds: Md09MarketDataKind[] = [];
  for (const rawKind of tick.kinds) {
    switch (rawKind) {
      case 'quote':
        kinds.push('quote');
        break;
      case 'trade':
        kinds.push('spot_trade');
        break;
      case 'book':
        kinds.push('l2_book');
        break;
      case 'funding':
        kinds.push('funding');
        break;
      case 'mark_price':
        kinds.push('mark_price');
        break;
      case 'index_price':
        kinds.push('index_price');
        break;
      case 'open_interest':
        kinds.push('open_interest');
        break;
      case 'liquidation':
        kinds.push('liquidation');
        break;
      case 'venue_status':
        kinds.push('venue_status');
        break;
      default:
        break;
    }
  }
  if (tick.l3Book) {
    kinds.push('l3_book');
  }
  return Object.freeze(kinds);
}

export function ingestMd09VenueSession(input: {
  readonly adapter: HeliosVenueAdapter;
  readonly research: Md09VenueResearchAdapter;
  readonly nowUtc: UtcInstant;
}): Md09VenueSession {
  const symbol = input.adapter.resolveSymbol({ kind: 'canonical', value: 'BTC/USD' });
  const sync = input.research.describeSynchronization();
  let sequenceIntegrity = initialMd09SequenceIntegrity();
  const observations: Md09MarketObservation[] = [];

  for (const tick of input.research.referenceStream) {
    const derivatives = normalizeMd09Derivatives({
      funding: tick.funding,
      markPrice: tick.markPrice,
      indexPrice: tick.indexPrice,
      openInterest: tick.openInterest,
      liquidation: tick.liquidation,
    });

    let quote = null;
    let trade = null;
    let l2Book = null;
    let eventTimeUtc = new Date(0).toISOString();
    let sequence: number | null = null;

    if (tick.quote) {
      quote = input.adapter.normalizeQuote(tick.quote, symbol);
      eventTimeUtc = quote.eventTimeUtc;
      sequence = quote.sequence;
      sequenceIntegrity = applyMd09SequenceStep(sequenceIntegrity, sync, quote.sequence, {
        isSnapshot: false,
      });
    }
    if (tick.trade) {
      trade = input.adapter.normalizeTrade(tick.trade, symbol);
      eventTimeUtc = trade.eventTimeUtc;
      sequence = trade.sequence ?? sequence;
      sequenceIntegrity = applyMd09SequenceStep(sequenceIntegrity, sync, trade.sequence);
    }
    if (tick.book) {
      l2Book = input.adapter.normalizeBook(tick.book, symbol);
      eventTimeUtc = l2Book.eventTimeUtc;
      sequence = l2Book.sequence ?? sequence;
      sequenceIntegrity = applyMd09SequenceStep(sequenceIntegrity, sync, l2Book.sequence, {
        isSnapshot: l2Book.isSnapshot,
        snapshotAnchorId: l2Book.sequence !== null ? String(l2Book.sequence) : null,
      });
    }

    const venueStatus = tick.venueStatus ? venueStatusFromRaw(tick.venueStatus) : null;
    const venueOnline = venueStatus?.status !== 'offline';
    const venueHealth: Md09VenueHealthState = assessMd09VenueHealth({
      observedAtUtc: input.nowUtc,
      eventTimeUtc,
      sequenceIntegrity,
      venueOnline,
      /** Fixture research streams retain historical event timestamps from NATIVE05 normalization. */
      staleThresholdMs: Number.POSITIVE_INFINITY,
    });

    for (const kind of kindsForTick(tick)) {
      observations.push(
        Object.freeze({
          schemaVersion: HELIOS_MD09_SCHEMA,
          kind,
          venueId: input.adapter.venueId,
          symbolCanonical: tick.symbolCanonical,
          observedAtUtc: input.nowUtc,
          eventTimeUtc,
          sequence,
          quote,
          trade,
          l2Book,
          l3BookAvailable: Boolean(tick.l3Book),
          derivatives: kind === 'funding' || kind === 'mark_price' || kind === 'index_price' || kind === 'open_interest' || kind === 'liquidation'
            ? derivatives
            : emptyMd09Derivatives(),
          venueStatus,
          synchronization: sync,
          sequenceIntegrity,
          venueHealth,
        }),
      );
    }
  }

  return Object.freeze({
    venueId: input.adapter.venueId,
    sequenceIntegrity,
    observations: Object.freeze(observations),
  });
}
