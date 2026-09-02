/**
 * Wave 5 — Productive Economy ontology shared types.
 */

import type { ProductiveEconomyCategory } from '../economy-data/types.ts';

export const PRODUCTIVE_MEASUREMENT_KINDS = ['CAPACITY', 'FLOW', 'STOCK'] as const;
export type ProductiveMeasurementKind = (typeof PRODUCTIVE_MEASUREMENT_KINDS)[number];

export const PRODUCTIVE_METRIC_DERIVATION_CLASSES = [
  'DIRECT_MEASUREMENT',
  'OPERATOR_REPORTED',
  'GOVERNMENT_REPORTED',
  'ENTERPRISE_REPORTED',
  'SATELLITE_DERIVED',
  'MODEL_DERIVED',
  'MARKET_REFERENCE',
  'OTHER',
] as const;
export type ProductiveMetricDerivationClass = (typeof PRODUCTIVE_METRIC_DERIVATION_CLASSES)[number];

export const PRODUCTIVE_CONTROL_REJECTION_CODES = [
  'CAPACITY_MASQUERADING_AS_PRODUCTION',
  'STOCK_MASQUERADING_AS_FLOW',
  'TELEMETRY_IS_NOT_PRODUCTIVE_EVENT',
  'OBSERVATION_IS_NOT_EVENT',
  'EVENT_IS_NOT_CLAIM',
  'CLAIM_IS_NOT_GPUV',
  'CLAIM_IS_NOT_MOONREY',
  'MARKET_PRICE_IS_NOT_PRODUCTION',
  'DUPLICATE_STOCK_MONETIZATION',
  'INCOMPATIBLE_MEASUREMENT_KIND',
  'UNKNOWN_ENTITY_CLASS',
  'UNKNOWN_EVENT_TYPE',
  'CATEGORY_EVENT_MISMATCH',
] as const;
export type ProductiveControlRejectionCode = (typeof PRODUCTIVE_CONTROL_REJECTION_CODES)[number];

export type ProductiveOntologyResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly code: ProductiveControlRejectionCode; readonly message: string };

export type ProductiveCategoryOntology = {
  readonly category: ProductiveEconomyCategory;
  readonly label: string;
  readonly entityClasses: readonly string[];
  readonly eventTypes: readonly string[];
  readonly canonicalUnits: readonly string[];
  readonly typicalSourceClasses: readonly string[];
  readonly eventBoundaryNotes: string;
  readonly likelyCorroborationSources: readonly string[];
};

export type ProductiveEntityClassDefinition = {
  readonly entityClass: string;
  readonly category: ProductiveEconomyCategory;
  readonly label: string;
  readonly description: string;
  readonly typicalMetrics: readonly string[];
  readonly capacityMetrics: readonly string[];
  readonly flowMetrics: readonly string[];
  readonly stockMetrics: readonly string[];
};

export type ProductiveEventTypeDefinition = {
  readonly eventType: string;
  readonly category: ProductiveEconomyCategory;
  readonly label: string;
  readonly description: string;
  readonly measurementKind: 'FLOW';
  readonly requiredMetric: string;
  readonly canonicalUnit: string;
  readonly entityClasses: readonly string[];
  readonly rejectsTelemetryAsEvent: true;
};

export type ProductiveMetricDefinition = {
  readonly metric: string;
  readonly category: ProductiveEconomyCategory;
  readonly measurementKind: ProductiveMeasurementKind;
  readonly canonicalUnit: string;
  readonly derivationClass: ProductiveMetricDerivationClass;
  readonly eligibleForProductiveEvent: boolean;
};

export type ProductiveEventMaterial = {
  readonly eventType: string;
  readonly entityClass: string;
  readonly entityRef: string;
  readonly metric: string;
  readonly quantity: bigint;
  readonly unit: string;
  readonly measurementKind: ProductiveMeasurementKind;
  readonly derivationClass: ProductiveMetricDerivationClass;
  readonly intervalStartUtc: string;
  readonly intervalEndUtc: string;
  readonly jurisdiction: string;
  readonly region: string | null;
  readonly observationIds: readonly string[];
  readonly evidenceRefs: readonly string[];
  readonly rightsRef: string | null;
  readonly licenseRef: string | null;
  readonly consensusReceiptRef: string | null;
  readonly methodologyId: string;
};
