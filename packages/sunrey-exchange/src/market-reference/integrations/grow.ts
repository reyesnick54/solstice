import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { MarketReferenceService } from '../service.ts';
import type { MarketReferenceQuote } from '../types.ts';

export type GrowMarketEvidence = {
  readonly schema: 'sunrey.grow.market-evidence.v1';
  readonly generatedAt: UtcInstant;
  readonly referenceOnly: true;
  readonly executionAuthorized: false;
  readonly quotes: readonly {
    readonly assetId: string;
    readonly symbol: string;
    readonly priceMinorUnits: string;
    readonly currency: string;
    readonly freshness: string;
    readonly providerId: string;
    readonly observationId: string;
  }[];
};

export async function buildGrowMarketEvidence(
  service: MarketReferenceService,
  assetIds: readonly string[],
  nowUtc: UtcInstant,
): Promise<GrowMarketEvidence> {
  const quotes: GrowMarketEvidence['quotes'][number][] = [];
  for (const assetId of assetIds) {
    const result = await service.getQuote(assetId, nowUtc);
    if (!result.ok) {
      continue;
    }
    quotes.push(mapQuote(result.value));
  }
  return Object.freeze({
    schema: 'sunrey.grow.market-evidence.v1',
    generatedAt: nowUtc,
    referenceOnly: true,
    executionAuthorized: false,
    quotes: Object.freeze(quotes),
  });
}

function mapQuote(quote: MarketReferenceQuote) {
  return Object.freeze({
    assetId: quote.assetId,
    symbol: quote.symbol,
    priceMinorUnits: quote.priceMinorUnits.toString(),
    currency: quote.currency,
    freshness: quote.freshness.status,
    providerId: quote.providerId,
    observationId: quote.provenance.observationId,
  });
}
