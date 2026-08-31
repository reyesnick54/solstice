import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { MarketReferenceService } from '../service.ts';
import type { CommodityCode } from '../types.ts';

export type WorldMarketSection = {
  readonly schema: 'sunrey.world.markets.v1';
  readonly generatedAt: UtcInstant;
  readonly referenceOnly: true;
  readonly markets: readonly {
    readonly assetId: string;
    readonly symbol: string;
    readonly venue: string | null;
    readonly priceMinorUnits: string;
    readonly currency: string;
    readonly providerId: string;
  }[];
  readonly resources: readonly {
    readonly commodity: CommodityCode;
    readonly priceMinorUnits: string;
    readonly currency: string;
    readonly unit: string;
    readonly providerId: string;
  }[];
};

export async function buildWorldMarketsSection(
  service: MarketReferenceService,
  assetIds: readonly string[],
  nowUtc: UtcInstant,
): Promise<WorldMarketSection['markets']> {
  const markets: WorldMarketSection['markets'][number][] = [];
  for (const assetId of assetIds) {
    const result = await service.getQuote(assetId, nowUtc);
    if (!result.ok) {
      continue;
    }
    markets.push(
      Object.freeze({
        assetId: result.value.assetId,
        symbol: result.value.symbol,
        venue: result.value.venue?.displayName ?? null,
        priceMinorUnits: result.value.priceMinorUnits.toString(),
        currency: result.value.currency,
        providerId: result.value.providerId,
      }),
    );
  }
  return Object.freeze(markets);
}

export async function buildWorldResourceSection(
  service: MarketReferenceService,
  commodities: readonly CommodityCode[],
  nowUtc: UtcInstant,
): Promise<WorldMarketSection['resources']> {
  const resources: WorldMarketSection['resources'][number][] = [];
  for (const commodity of commodities) {
    const result = await service.getCommodityPrice(commodity, nowUtc);
    if (!result.ok) {
      continue;
    }
    resources.push(
      Object.freeze({
        commodity,
        priceMinorUnits: result.value.priceMinorUnits.toString(),
        currency: result.value.currency,
        unit: result.value.unit.symbol,
        providerId: result.value.providerId,
      }),
    );
  }
  return Object.freeze(resources);
}

export async function buildWorldEconomySnapshot(
  service: MarketReferenceService,
  input: { readonly assetIds: readonly string[]; readonly commodities: readonly CommodityCode[] },
  nowUtc: UtcInstant,
): Promise<WorldMarketSection> {
  const [markets, resources] = await Promise.all([
    buildWorldMarketsSection(service, input.assetIds, nowUtc),
    buildWorldResourceSection(service, input.commodities, nowUtc),
  ]);
  return Object.freeze({
    schema: 'sunrey.world.markets.v1',
    generatedAt: nowUtc,
    referenceOnly: true,
    markets,
    resources,
  });
}
