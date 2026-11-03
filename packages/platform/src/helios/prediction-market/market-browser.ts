/**
 * Prediction event / market browser (domain models only).
 */

import type { PredictionEventMarket, PredictionMarketBrowserQuery, PredictionMarketSummary } from './types.ts';

function matchesSearch(market: PredictionMarketSummary, search: string): boolean {
  const q = search.trim().toLowerCase();
  if (!q) {
    return true;
  }
  return market.question.toLowerCase().includes(q) || market.conditionId.toLowerCase().includes(q);
}

export function browsePredictionMarkets(
  events: readonly PredictionEventMarket[],
  query: PredictionMarketBrowserQuery = {},
): readonly PredictionMarketSummary[] {
  const limit = query.limit ?? 50;
  const out: PredictionMarketSummary[] = [];
  for (const event of events) {
    if (query.category && event.category?.toLowerCase() !== query.category.toLowerCase()) {
      continue;
    }
    for (const market of event.markets) {
      if (query.status && market.status !== query.status) {
        continue;
      }
      if (query.search && !matchesSearch(market, query.search)) {
        continue;
      }
      out.push(market);
      if (out.length >= limit) {
        return Object.freeze(out);
      }
    }
  }
  return Object.freeze(out);
}

export function findEventBySlug(
  events: readonly PredictionEventMarket[],
  slug: string,
): PredictionEventMarket | null {
  return events.find((e) => e.slug === slug) ?? null;
}
