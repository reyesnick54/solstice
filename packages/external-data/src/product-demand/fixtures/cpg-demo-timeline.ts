import { asUtcInstant, type UtcInstant } from '@solstice/domain';

import { variantFingerprintFromTitle } from '../sku-matching.ts';
import type {
  AssortmentObservation,
  AvailabilityObservation,
  PriceObservation,
  ProductDemandObservationProvenance,
  ProductDemandProviderRef,
  ProductObservation,
  PromotionObservation,
  SkuEntity,
} from '../types.ts';

const PROVIDER: ProductDemandProviderRef = Object.freeze({
  providerId: 'numerator_syndicated_panel',
  feedId: 'us_cpg_weekly',
  capability: 'product_pricing_availability',
  providerKind: 'licensed_syndicated_panel',
  sourcePermitClass: 'licensed_api',
});

function provenance(observationId: string, knowableAt: UtcInstant): ProductDemandObservationProvenance {
  return Object.freeze({
    observationId,
    provider: PROVIDER,
    evidenceRef: `evidence://alt06/${observationId}`,
    rawPayloadHash: `sha256:fixture:${observationId}`,
    providerAvailabilityTime: knowableAt,
    sunreyArrivalTime: knowableAt,
    knowableAt,
    grantsExecutionAuthority: false,
  });
}

export const ALT06_FIXTURE_BRAND_NODE = 'brand:famous_snacks';
export const ALT06_FIXTURE_SUBSIDIARY_NODE = 'subsidiary:famous_snacks_na';
export const ALT06_FIXTURE_ISSUER_ENTITY = 'sunrey:company:us:0000320193';

export const ALT06_DEMO_SKU_CLASSIC = 'sku:classic_crisps_12oz';
export const ALT06_DEMO_SKU_FAMILY = 'sku:classic_crisps_family';
export const ALT06_DEMO_SKU_COMPETITOR = 'sku:rival_crisps_12oz';

const TITLE_CLASSIC = 'Famous Brand Classic Crisps 12oz';
const TITLE_FAMILY = 'Famous Brand Classic Crisps 12oz Family Pack 6pk';
const TITLE_RIVAL = 'Rival Brand Sea Salt Crisps 12oz';

export function alt06DemoSkus(): readonly SkuEntity[] {
  const t0 = asUtcInstant('2026-01-05T12:00:00.000Z');
  return Object.freeze([
    Object.freeze({
      schema: 'sunrey.external.product-demand-observation.v1',
      skuEntityId: ALT06_DEMO_SKU_CLASSIC,
      productObservationId: 'product:classic_crisps',
      identifiers: Object.freeze([
        { kind: 'gtin', value: '00012345678905' },
        { kind: 'manufacturer_sku', value: 'FB-CC-12' },
        { kind: 'deterministic_product_id', value: 'fb:classic_crisps_12oz' },
      ]),
      variant: variantFingerprintFromTitle(TITLE_CLASSIC),
      manufacturerSku: 'FB-CC-12',
      currency: 'USD',
      categoryId: 'cat:salty_snacks',
      brandNodeId: ALT06_FIXTURE_BRAND_NODE,
      provenance: provenance('sku.classic', t0),
      grantsExecutionAuthority: false,
    }),
    Object.freeze({
      schema: 'sunrey.external.product-demand-observation.v1',
      skuEntityId: ALT06_DEMO_SKU_FAMILY,
      productObservationId: 'product:classic_crisps',
      identifiers: Object.freeze([
        { kind: 'gtin', value: '00012345678929' },
        { kind: 'manufacturer_sku', value: 'FB-CC-12-6PK' },
      ]),
      variant: variantFingerprintFromTitle(TITLE_FAMILY),
      manufacturerSku: 'FB-CC-12-6PK',
      currency: 'USD',
      categoryId: 'cat:salty_snacks',
      brandNodeId: ALT06_FIXTURE_BRAND_NODE,
      provenance: provenance('sku.family', t0),
      grantsExecutionAuthority: false,
    }),
    Object.freeze({
      schema: 'sunrey.external.product-demand-observation.v1',
      skuEntityId: ALT06_DEMO_SKU_COMPETITOR,
      productObservationId: 'product:rival_crisps',
      identifiers: Object.freeze([{ kind: 'gtin', value: '00098765432101' }]),
      variant: variantFingerprintFromTitle(TITLE_RIVAL),
      manufacturerSku: 'RB-SS-12',
      currency: 'USD',
      categoryId: 'cat:salty_snacks',
      brandNodeId: 'brand:rival_snacks',
      provenance: provenance('sku.rival', t0),
      grantsExecutionAuthority: false,
    }),
  ]);
}

export function alt06DemoProductObservation(): ProductObservation {
  const t0 = asUtcInstant('2026-01-05T12:00:00.000Z');
  return Object.freeze({
    schema: 'sunrey.external.product-demand-observation.v1',
    productObservationId: 'product:classic_crisps',
    displayName: 'Famous Brand Classic Crisps',
    categoryId: 'cat:salty_snacks',
    brandNodeId: ALT06_FIXTURE_BRAND_NODE,
    canonicalEntityId: ALT06_FIXTURE_ISSUER_ENTITY,
    skuEntityIds: Object.freeze([ALT06_DEMO_SKU_CLASSIC, ALT06_DEMO_SKU_FAMILY]),
    provenance: provenance('product.classic', t0),
    grantsExecutionAuthority: false,
  });
}

function priceRow(input: {
  readonly id: string;
  readonly skuId: string;
  readonly minor: bigint;
  readonly knowableAt: UtcInstant;
}): PriceObservation {
  return Object.freeze({
    schema: 'sunrey.external.product-demand-observation.v1',
    observationKind: 'price',
    priceObservationId: input.id,
    skuEntityId: input.skuId,
    shelfPriceMinor: input.minor,
    listPriceMinor: input.minor + 50n,
    currency: 'USD',
    venueId: 'venue:target_midwest',
    competitorSetId: 'comp:salty_snacks_midwest',
    provenance: provenance(input.id, input.knowableAt),
    grantsExecutionAuthority: false,
  });
}

export function alt06DemoPriceTimeline(): readonly PriceObservation[] {
  return Object.freeze([
    priceRow({
      id: 'price.classic.w1',
      skuId: ALT06_DEMO_SKU_CLASSIC,
      minor: 349n,
      knowableAt: asUtcInstant('2026-01-08T12:00:00.000Z'),
    }),
    priceRow({
      id: 'price.classic.w2',
      skuId: ALT06_DEMO_SKU_CLASSIC,
      minor: 379n,
      knowableAt: asUtcInstant('2026-01-15T12:00:00.000Z'),
    }),
    priceRow({
      id: 'price.rival.w2',
      skuId: ALT06_DEMO_SKU_COMPETITOR,
      minor: 359n,
      knowableAt: asUtcInstant('2026-01-15T12:00:00.000Z'),
    }),
  ]);
}

export function alt06DemoAvailabilityTimeline(): readonly AvailabilityObservation[] {
  return Object.freeze([
    Object.freeze({
      schema: 'sunrey.external.product-demand-observation.v1',
      observationKind: 'availability',
      availabilityObservationId: 'avail.classic.w1',
      skuEntityId: ALT06_DEMO_SKU_CLASSIC,
      state: 'in_stock',
      unitsAvailable: 120,
      venueId: 'venue:target_midwest',
      provenance: provenance('avail.classic.w1', asUtcInstant('2026-01-08T12:00:00.000Z')),
      grantsExecutionAuthority: false,
    }),
    Object.freeze({
      schema: 'sunrey.external.product-demand-observation.v1',
      observationKind: 'availability',
      availabilityObservationId: 'avail.classic.w2',
      skuEntityId: ALT06_DEMO_SKU_CLASSIC,
      state: 'limited',
      unitsAvailable: 18,
      venueId: 'venue:target_midwest',
      provenance: provenance('avail.classic.w2', asUtcInstant('2026-01-15T12:00:00.000Z')),
      grantsExecutionAuthority: false,
    }),
  ]);
}

export function alt06DemoPromotionTimeline(): readonly PromotionObservation[] {
  return Object.freeze([
    Object.freeze({
      schema: 'sunrey.external.product-demand-observation.v1',
      observationKind: 'promotion',
      promotionObservationId: 'promo.classic.w1',
      skuEntityId: ALT06_DEMO_SKU_CLASSIC,
      promotionKind: 'price_cut',
      promoPriceMinor: 329n,
      discountBps: 573,
      venueId: 'venue:target_midwest',
      validFrom: asUtcInstant('2026-01-08T12:00:00.000Z'),
      validTo: asUtcInstant('2026-01-11T12:00:00.000Z'),
      provenance: provenance('promo.classic.w1', asUtcInstant('2026-01-08T12:00:00.000Z')),
      grantsExecutionAuthority: false,
    }),
    Object.freeze({
      schema: 'sunrey.external.product-demand-observation.v1',
      observationKind: 'promotion',
      promotionObservationId: 'promo.classic.w2_clearance',
      skuEntityId: ALT06_DEMO_SKU_CLASSIC,
      promotionKind: 'clearance',
      promoPriceMinor: 299n,
      discountBps: 1430,
      venueId: 'venue:target_midwest',
      validFrom: asUtcInstant('2026-01-22T12:00:00.000Z'),
      validTo: asUtcInstant('2026-01-29T12:00:00.000Z'),
      provenance: provenance('promo.classic.w2_clearance', asUtcInstant('2026-01-22T12:00:00.000Z')),
      grantsExecutionAuthority: false,
    }),
  ]);
}

export function alt06DemoAssortmentTimeline(): readonly AssortmentObservation[] {
  return Object.freeze([
    Object.freeze({
      schema: 'sunrey.external.product-demand-observation.v1',
      observationKind: 'assortment',
      assortmentObservationId: 'assort.w1',
      venueId: 'venue:target_midwest',
      categoryId: 'cat:salty_snacks',
      listedSkuEntityIds: Object.freeze([ALT06_DEMO_SKU_CLASSIC, ALT06_DEMO_SKU_COMPETITOR]),
      newIntroductionSkuIds: Object.freeze([]),
      removedSkuIds: Object.freeze([]),
      provenance: provenance('assort.w1', asUtcInstant('2026-01-08T12:00:00.000Z')),
      grantsExecutionAuthority: false,
    }),
    Object.freeze({
      schema: 'sunrey.external.product-demand-observation.v1',
      observationKind: 'assortment',
      assortmentObservationId: 'assort.w3',
      venueId: 'venue:target_midwest',
      categoryId: 'cat:salty_snacks',
      listedSkuEntityIds: Object.freeze([ALT06_DEMO_SKU_CLASSIC, ALT06_DEMO_SKU_COMPETITOR, ALT06_DEMO_SKU_FAMILY]),
      newIntroductionSkuIds: Object.freeze([ALT06_DEMO_SKU_FAMILY]),
      removedSkuIds: Object.freeze([]),
      provenance: provenance('assort.w3', asUtcInstant('2026-01-22T12:00:00.000Z')),
      grantsExecutionAuthority: false,
    }),
  ]);
}

export function alt06DemoObservationBundle(): readonly import('../types.ts').Alt06ProductDemandObservation[] {
  return Object.freeze([
    alt06DemoProductObservation(),
    ...alt06DemoSkus(),
    ...alt06DemoPriceTimeline(),
    ...alt06DemoAvailabilityTimeline(),
    ...alt06DemoPromotionTimeline(),
    ...alt06DemoAssortmentTimeline(),
  ]);
}
