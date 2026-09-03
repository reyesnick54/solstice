// @ts-nocheck
import { economicProofDigest } from './hash.ts';
import { deriveCanonicalEventId } from './event-identity.ts';
import type { CanonicalEntityId, CanonicalEventId } from './types.ts';
import type {
  AggregationLevel,
  EventBoundaryStrategy,
  ProductiveDomain,
  ProductiveEventKey,
} from './productive-event-types.ts';

export type { ProductiveEventKey };

export type ProductiveEventKeyMaterial = {
  readonly canonicalEntityId: CanonicalEntityId;
  readonly economicAction: string;
  readonly metric: string;
  readonly unit: string;
  readonly validFromUtc: string;
  readonly validUntilUtc: string | null;
  readonly domain: ProductiveDomain;
  readonly boundaryStrategy: EventBoundaryStrategy;
  readonly geographyCommitment?: string;
  readonly batchRunJobId?: string;
  readonly sourceIndependentEventId?: string;
  readonly resourceOutputType?: string;
  readonly aggregationLevel?: AggregationLevel;
  readonly parentEntityCommitment?: string;
};

export function asProductiveEventKey(value: string): ProductiveEventKey {
  return value as ProductiveEventKey;
}

/**
 * Domain-aware productive event identity. Quantity is intentionally excluded so
 * corroborating observations with tolerable variance share one event key.
 * Maps to canonicalEventId when quantity is fixed at reconciliation time.
 */
export function deriveProductiveEventKey(material: ProductiveEventKeyMaterial): ProductiveEventKey {
  return asProductiveEventKey(
    economicProofDigest([
      'productive-event-key',
      material.domain,
      material.boundaryStrategy,
      material.canonicalEntityId,
      material.economicAction,
      material.metric,
      material.unit,
      material.validFromUtc,
      material.validUntilUtc ?? '',
      material.geographyCommitment ?? '',
      material.batchRunJobId ?? '',
      material.sourceIndependentEventId ?? '',
      material.resourceOutputType ?? '',
      material.aggregationLevel ?? 'LEAF',
      material.parentEntityCommitment ?? '',
    ]),
  );
}

/**
 * Binds a reconciled quantity to produce the Wave 3 canonicalEventId.
 * Extends deriveCanonicalEventId by committing the productive event key.
 */
export function deriveCanonicalEventIdFromKey(
  eventKey: ProductiveEventKey,
  material: {
    readonly canonicalEntityId: CanonicalEntityId;
    readonly economicAction: string;
    readonly quantity: bigint;
    readonly unit: string;
    readonly validFromUtc: string;
    readonly validUntilUtc: string | null;
    readonly locationCommitment?: string;
    readonly domainIdentifierCommitment?: string;
  },
): CanonicalEventId {
  return deriveCanonicalEventId({
    canonicalEntityId: material.canonicalEntityId,
    economicAction: material.economicAction,
    quantity: material.quantity,
    unit: material.unit,
    validFromUtc: material.validFromUtc,
    validUntilUtc: material.validUntilUtc,
    locationCommitment: material.locationCommitment,
    domainIdentifierCommitment: material.domainIdentifierCommitment ?? eventKey,
  });
}

export type DomainEventBoundaryDefaults = {
  readonly boundaryStrategy: EventBoundaryStrategy;
  readonly metricField: string;
};

const DOMAIN_DEFAULTS: Readonly<Record<ProductiveDomain, DomainEventBoundaryDefaults>> = Object.freeze({
  ENERGY: { boundaryStrategy: 'FIXED_INTERVAL', metricField: 'energy_generated' },
  COMPUTE: { boundaryStrategy: 'BATCH_IDENTIFIER', metricField: 'compute_workload' },
  MANUFACTURING: { boundaryStrategy: 'BATCH_IDENTIFIER', metricField: 'goods_produced' },
  AGRICULTURE: { boundaryStrategy: 'FIXED_INTERVAL', metricField: 'crop_harvested' },
  LOGISTICS: { boundaryStrategy: 'SOURCE_EVENT_ID', metricField: 'goods_shipped' },
  RESOURCES: { boundaryStrategy: 'FIXED_INTERVAL', metricField: 'resource_extracted' },
  WATER: { boundaryStrategy: 'FIXED_INTERVAL', metricField: 'water_produced' },
});

export function domainBoundaryDefaults(domain: ProductiveDomain): DomainEventBoundaryDefaults {
  return DOMAIN_DEFAULTS[domain];
}

export function inferDomainFromAction(economicAction: string): ProductiveDomain {
  const normalized = economicAction.toUpperCase();
  if (normalized.includes('ENERGY') || normalized.includes('GENERATION')) return 'ENERGY';
  if (normalized.includes('COMPUTE') || normalized.includes('GPU')) return 'COMPUTE';
  if (normalized.includes('GOODS') || normalized.includes('MANUFACTUR')) return 'MANUFACTURING';
  if (normalized.includes('CROP') || normalized.includes('HARVEST') || normalized.includes('FARM')) return 'AGRICULTURE';
  if (normalized.includes('SHIP') || normalized.includes('LOGISTIC') || normalized.includes('FREIGHT')) return 'LOGISTICS';
  if (normalized.includes('MINERAL') || normalized.includes('EXTRACT') || normalized.includes('RESOURCE')) return 'RESOURCES';
  if (normalized.includes('WATER')) return 'WATER';
  return 'MANUFACTURING';
}
