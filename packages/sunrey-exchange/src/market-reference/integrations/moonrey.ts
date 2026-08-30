import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { MarketReferenceService } from '../service.ts';
import type { CommodityCode } from '../types.ts';

export type MoonReyResourceContext = {
  readonly schema: 'sunrey.moonrey.resource-context.v1';
  readonly generatedAt: UtcInstant;
  readonly referenceOnly: true;
  readonly issuanceAuthority: false;
  readonly observations: readonly {
    readonly commodity: CommodityCode;
    readonly priceMinorUnits: string;
    readonly currency: string;
    readonly unit: string;
    readonly marketReference: string;
    readonly providerId: string;
    readonly observationId: string;
    readonly factType: 'REFERENCE_PRICE';
  }[];
};

export async function toMoonReyResourceObservation(
  service: MarketReferenceService,
  commodities: readonly CommodityCode[],
  nowUtc: UtcInstant,
): Promise<MoonReyResourceContext> {
  const observations: MoonReyResourceContext['observations'][number][] = [];
  for (const commodity of commodities) {
    const result = await service.getCommodityPrice(commodity, nowUtc);
    if (!result.ok) {
      continue;
    }
    const row = result.value;
    observations.push(
      Object.freeze({
        commodity,
        priceMinorUnits: row.priceMinorUnits.toString(),
        currency: row.currency,
        unit: row.unit.symbol,
        marketReference: row.marketReference,
        providerId: row.providerId,
        observationId: row.provenance.observationId,
        factType: 'REFERENCE_PRICE' as const,
      }),
    );
  }
  return Object.freeze({
    schema: 'sunrey.moonrey.resource-context.v1',
    generatedAt: nowUtc,
    referenceOnly: true,
    issuanceAuthority: false,
    observations: Object.freeze(observations),
  });
}
