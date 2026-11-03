/**
 * Entity resolution bindings for prediction-market slugs and canonical instrument IDs.
 */

import type { PredictionMarketCategory } from './taxonomy.ts';

export type PredictionMarketEntityBinding = {
  readonly canonicalInstrumentId: string;
  readonly marketSlug: string;
  readonly venueId: string;
  readonly providerNativeSlug: string;
  readonly aliasCommitments: readonly string[];
};

export function canonicalPredictionMarketInstrumentId(input: {
  readonly venueId: string;
  readonly marketSlug: string;
}): string {
  const slug = input.marketSlug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-');
  return `PREDICTION:${input.venueId}:${slug}`;
}

export function outcomeIdFor(instrumentId: string, side: 'YES' | 'NO'): string {
  return `${instrumentId}:OUTCOME:${side}`;
}

export function resolvePredictionMarketEntity(input: {
  readonly venueId: string;
  readonly marketSlug: string;
  readonly providerNativeSlug?: string;
}): PredictionMarketEntityBinding {
  const canonicalInstrumentId = canonicalPredictionMarketInstrumentId({
    venueId: input.venueId,
    marketSlug: input.marketSlug,
  });
  const native = input.providerNativeSlug ?? input.marketSlug;
  return Object.freeze({
    canonicalInstrumentId,
    marketSlug: input.marketSlug,
    venueId: input.venueId,
    providerNativeSlug: native,
    aliasCommitments: Object.freeze([
      `slug:${native}`,
      `venue:${input.venueId}:slug:${native}`,
    ]),
  });
}

export function buildInstrumentMetadata(input: {
  readonly binding: PredictionMarketEntityBinding;
  readonly question: string;
  readonly category: PredictionMarketCategory;
}): {
  readonly instrumentId: string;
  readonly marketSlug: string;
  readonly question: string;
  readonly category: PredictionMarketCategory;
  readonly venueId: string;
} {
  return Object.freeze({
    instrumentId: input.binding.canonicalInstrumentId,
    marketSlug: input.binding.marketSlug,
    question: input.question,
    category: input.category,
    venueId: input.binding.venueId,
  });
}
