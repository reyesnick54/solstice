/**
 * HELIOS ALT06 — product, pricing, and availability observation envelopes.
 * Simulation-first; no execution authority or ledger mutation.
 */

import type { UtcInstant } from '@solstice/domain';

import type {
  HELIOS_ALT06_PRODUCT_DEMAND_SCHEMA,
  ProductAvailabilityState,
  ProductDemandProviderKind,
  ProductDemandSourcePermitClass,
  ProductPromotionKind,
  SkuIdentifierKind,
  SkuMatchConfidence,
} from './taxonomy.ts';

export type ProductDemandProviderRef = {
  readonly providerId: string;
  readonly feedId: string;
  readonly capability: string;
  readonly providerKind: ProductDemandProviderKind;
  readonly sourcePermitClass: ProductDemandSourcePermitClass;
};

export type ProductDemandObservationProvenance = {
  readonly observationId: string;
  readonly provider: ProductDemandProviderRef;
  readonly evidenceRef: string;
  readonly rawPayloadHash: string;
  readonly providerAvailabilityTime: UtcInstant;
  readonly sunreyArrivalTime: UtcInstant;
  readonly knowableAt: UtcInstant;
  readonly grantsExecutionAuthority: false;
};

export type SkuIdentifier = {
  readonly kind: SkuIdentifierKind;
  readonly value: string;
};

export type ProductVariantFingerprint = {
  readonly packCount: string | null;
  readonly unitOfMeasure: string | null;
  readonly flavorOrScent: string | null;
  readonly sizeLabel: string | null;
  readonly normalizedTitle: string;
};

/** Canonical sellable unit under a logical product family. */
export type SkuEntity = {
  readonly schema: typeof HELIOS_ALT06_PRODUCT_DEMAND_SCHEMA;
  readonly skuEntityId: string;
  readonly productObservationId: string;
  readonly identifiers: readonly SkuIdentifier[];
  readonly variant: ProductVariantFingerprint;
  readonly manufacturerSku: string | null;
  readonly currency: string;
  readonly categoryId: string | null;
  readonly brandNodeId: string | null;
  readonly provenance: ProductDemandObservationProvenance;
  readonly grantsExecutionAuthority: false;
};

export type ProductObservation = {
  readonly schema: typeof HELIOS_ALT06_PRODUCT_DEMAND_SCHEMA;
  readonly productObservationId: string;
  readonly displayName: string;
  readonly categoryId: string;
  readonly brandNodeId: string;
  readonly canonicalEntityId: string | null;
  readonly skuEntityIds: readonly string[];
  readonly provenance: ProductDemandObservationProvenance;
  readonly grantsExecutionAuthority: false;
};

export type PriceObservation = {
  readonly schema: typeof HELIOS_ALT06_PRODUCT_DEMAND_SCHEMA;
  readonly observationKind: 'price';
  readonly priceObservationId: string;
  readonly skuEntityId: string;
  readonly shelfPriceMinor: bigint;
  readonly listPriceMinor: bigint | null;
  readonly currency: string;
  readonly venueId: string;
  readonly competitorSetId: string | null;
  readonly provenance: ProductDemandObservationProvenance;
  readonly grantsExecutionAuthority: false;
};

export type AvailabilityObservation = {
  readonly schema: typeof HELIOS_ALT06_PRODUCT_DEMAND_SCHEMA;
  readonly observationKind: 'availability';
  readonly availabilityObservationId: string;
  readonly skuEntityId: string;
  readonly state: ProductAvailabilityState;
  readonly unitsAvailable: number | null;
  readonly venueId: string;
  readonly provenance: ProductDemandObservationProvenance;
  readonly grantsExecutionAuthority: false;
};

export type PromotionObservation = {
  readonly schema: typeof HELIOS_ALT06_PRODUCT_DEMAND_SCHEMA;
  readonly observationKind: 'promotion';
  readonly promotionObservationId: string;
  readonly skuEntityId: string;
  readonly promotionKind: ProductPromotionKind;
  readonly promoPriceMinor: bigint | null;
  readonly discountBps: number | null;
  readonly venueId: string;
  readonly validFrom: UtcInstant | null;
  readonly validTo: UtcInstant | null;
  readonly provenance: ProductDemandObservationProvenance;
  readonly grantsExecutionAuthority: false;
};

export type AssortmentObservation = {
  readonly schema: typeof HELIOS_ALT06_PRODUCT_DEMAND_SCHEMA;
  readonly observationKind: 'assortment';
  readonly assortmentObservationId: string;
  readonly venueId: string;
  readonly categoryId: string;
  readonly listedSkuEntityIds: readonly string[];
  readonly newIntroductionSkuIds: readonly string[];
  readonly removedSkuIds: readonly string[];
  readonly provenance: ProductDemandObservationProvenance;
  readonly grantsExecutionAuthority: false;
};

export type ProductDemandState = {
  readonly schema: typeof HELIOS_ALT06_PRODUCT_DEMAND_SCHEMA;
  readonly skuEntityId: string;
  readonly evaluationTime: UtcInstant;
  readonly knowableAt: UtcInstant;
  readonly latestPriceMinor: bigint | null;
  readonly availability: ProductAvailabilityState | null;
  readonly activePromotionKinds: readonly ProductPromotionKind[];
  readonly grantsExecutionAuthority: false;
};

export type SkuMatchResult = {
  readonly skuEntityId: string | null;
  readonly confidence: SkuMatchConfidence;
  readonly matchedIdentifier: SkuIdentifier | null;
  readonly variantComparable: boolean;
  readonly message: string | null;
};

export type Alt06ProductDemandObservation =
  | ProductObservation
  | SkuEntity
  | PriceObservation
  | AvailabilityObservation
  | PromotionObservation
  | AssortmentObservation;
