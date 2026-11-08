import type { UtcInstant } from '@solstice/domain';
import type { CanonicalMarketDataEvent } from '@solstice/provider-sdk';

import { assertMarketEventKnowableAtDecision } from '../../market-data/md01/knowable-at.ts';
import type { PrequentialChronologicalObservation } from './types.ts';

export function filterKnowableMarketEvents(
  decisionTime: UtcInstant,
  observations: readonly PrequentialChronologicalObservation[],
): readonly PrequentialChronologicalObservation[] {
  const eligible: PrequentialChronologicalObservation[] = [];
  for (const row of observations) {
    const gate = assertMarketEventKnowableAtDecision(decisionTime, row.event);
    if (gate.ok) {
      eligible.push(row);
    }
  }
  return Object.freeze(eligible);
}

export function assertNoFutureContextLeak(
  decisionTime: UtcInstant,
  observations: readonly PrequentialChronologicalObservation[],
): { readonly ok: true } | { readonly ok: false; readonly eventId: string } {
  for (const row of observations) {
    if (row.event.knowableAt > decisionTime) {
      return Object.freeze({ ok: false, eventId: row.event.eventId });
    }
  }
  return Object.freeze({ ok: true });
}

export function midPriceMinorFromQuote(event: CanonicalMarketDataEvent): string | null {
  if (event.eventKind !== 'MarketQuoteEvent') {
    return null;
  }
  const bidRaw = event.bidPrice;
  const askRaw = event.askPrice;
  if (bidRaw === null || askRaw === null) {
    return null;
  }
  const bid = Number.parseFloat(bidRaw);
  const ask = Number.parseFloat(askRaw);
  if (!Number.isFinite(bid) || !Number.isFinite(ask)) {
    return null;
  }
  const mid = (bid + ask) / 2;
  const minor = Math.round(mid * 10_000);
  return String(minor);
}
