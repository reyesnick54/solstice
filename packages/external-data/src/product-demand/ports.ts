/**
 * HELIOS ALT06 — provider-neutral ingestion ports (simulation adapters only).
 */

import type {
  Alt06ProductDemandObservation,
  AssortmentObservation,
  AvailabilityObservation,
  PriceObservation,
  ProductObservation,
  PromotionObservation,
  SkuEntity,
} from './types.ts';

export type ProductDemandIngestPort = {
  readonly providerId: string;
  readonly fetchObservations: () => Promise<readonly Alt06ProductDemandObservation[]>;
};

export type ProductDemandObservationBundle = {
  readonly products: readonly ProductObservation[];
  readonly skus: readonly SkuEntity[];
  readonly prices: readonly PriceObservation[];
  readonly availability: readonly AvailabilityObservation[];
  readonly promotions: readonly PromotionObservation[];
  readonly assortments: readonly AssortmentObservation[];
};

export function partitionProductDemandObservations(
  rows: readonly Alt06ProductDemandObservation[],
): ProductDemandObservationBundle {
  const products: ProductObservation[] = [];
  const skus: SkuEntity[] = [];
  const prices: PriceObservation[] = [];
  const availability: AvailabilityObservation[] = [];
  const promotions: PromotionObservation[] = [];
  const assortments: AssortmentObservation[] = [];

  for (const row of rows) {
    if ('observationKind' in row) {
      switch (row.observationKind) {
        case 'price':
          prices.push(row);
          break;
        case 'availability':
          availability.push(row);
          break;
        case 'promotion':
          promotions.push(row);
          break;
        case 'assortment':
          assortments.push(row);
          break;
        default:
          break;
      }
    } else if ('skuEntityId' in row && 'identifiers' in row) {
      skus.push(row);
    } else if ('productObservationId' in row && 'displayName' in row) {
      products.push(row);
    }
  }

  return Object.freeze({
    products: Object.freeze(products),
    skus: Object.freeze(skus),
    prices: Object.freeze(prices),
    availability: Object.freeze(availability),
    promotions: Object.freeze(promotions),
    assortments: Object.freeze(assortments),
  });
}
