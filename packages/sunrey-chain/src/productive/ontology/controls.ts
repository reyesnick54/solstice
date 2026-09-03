/**
 * Wave 5 — stock/flow and capacity/production controls.
 *
 * Prevents capacity, stock, telemetry, and market price from masquerading
 * as productive events or claims.
 */

import type {
  ProductiveControlRejectionCode,
  ProductiveEventMaterial,
  ProductiveOntologyResult,
} from './types.ts';
import { eventTypeDefinition } from './events.ts';
import { entityClassDefinition, isKnownEntityClass } from './entities.ts';
import { classifyMetric, metricDefinition } from './metrics.ts';
import { categoryOntology } from './categories.ts';

export type ObservationLike = {
  readonly observationId: string;
  readonly metric: string;
  readonly quantity: bigint;
  readonly unit: string;
  readonly entityClass?: string;
  readonly eventType?: string;
};

export type ProductiveEventLike = ProductiveEventMaterial & {
  readonly eventId: string;
};

export type GpuvLike = {
  readonly gpuvId: string;
  readonly claimId: string;
  readonly methodologyId: string;
};

export type MoonReySupplyLike = {
  readonly issuanceId: string;
  readonly claimId?: string;
  readonly gpuvId?: string;
};

function ok<T>(value: T): ProductiveOntologyResult<T> {
  return Object.freeze({ ok: true, value });
}

function fail<T>(code: ProductiveControlRejectionCode, message: string): ProductiveOntologyResult<T> {
  return Object.freeze({ ok: false, code, message });
}

export function refuseCapacityAsProduction(metric: string, entityClass?: string): ProductiveOntologyResult<true> {
  const classified = classifyMetric(metric, entityClass);
  if (!classified) {
    return ok(true);
  }
  if (classified.measurementKind === 'CAPACITY') {
    return fail('CAPACITY_MASQUERADING_AS_PRODUCTION', `metric ${metric} is capacity, not production`);
  }
  return ok(true);
}

export function refuseStockAsFlow(metric: string, entityClass?: string): ProductiveOntologyResult<true> {
  const classified = classifyMetric(metric, entityClass);
  if (!classified) {
    return ok(true);
  }
  if (classified.measurementKind === 'STOCK') {
    return fail('STOCK_MASQUERADING_AS_FLOW', `metric ${metric} is stock, not flow`);
  }
  return ok(true);
}

export function refuseTelemetryAsEvent(metric: string): ProductiveOntologyResult<true> {
  const classified = metricDefinition(metric);
  if (classified && !classified.eligibleForProductiveEvent) {
    return fail('TELEMETRY_IS_NOT_PRODUCTIVE_EVENT', `metric ${metric} is not an eligible productive event metric`);
  }
  if (metric === 'RAW_TELEMETRY' || metric === 'HEARTBEAT' || metric === 'CPU_TEMPERATURE') {
    return fail('TELEMETRY_IS_NOT_PRODUCTIVE_EVENT', `telemetry metric ${metric} cannot become a productive event`);
  }
  return ok(true);
}

export function refuseMarketPriceAsProduction(metric: string): ProductiveOntologyResult<true> {
  if (metric === 'MARKET_PRICE_REFERENCE' || metric.includes('MARKET_PRICE')) {
    return fail('MARKET_PRICE_IS_NOT_PRODUCTION', 'market price is not productive output');
  }
  const classified = metricDefinition(metric);
  if (classified?.derivationClass === 'MARKET_REFERENCE') {
    return fail('MARKET_PRICE_IS_NOT_PRODUCTION', `metric ${metric} is market reference, not production`);
  }
  return ok(true);
}

export function validateProductiveEventMaterial(material: ProductiveEventMaterial): ProductiveOntologyResult<ProductiveEventMaterial> {
  if (!isKnownEntityClass(material.entityClass)) {
    return fail('UNKNOWN_ENTITY_CLASS', `unknown entity class ${material.entityClass}`);
  }
  const eventDef = eventTypeDefinition(material.eventType);
  if (!eventDef) {
    return fail('UNKNOWN_EVENT_TYPE', `unknown event type ${material.eventType}`);
  }
  const entityDef = entityClassDefinition(material.entityClass)!;
  if (entityDef.category !== eventDef.category) {
    return fail('CATEGORY_EVENT_MISMATCH', `entity ${material.entityClass} category does not match event ${material.eventType}`);
  }
  if (!eventDef.entityClasses.includes(material.entityClass)) {
    return fail('CATEGORY_EVENT_MISMATCH', `entity class ${material.entityClass} not valid for event ${material.eventType}`);
  }
  if (material.measurementKind !== 'FLOW') {
    return fail('INCOMPATIBLE_MEASUREMENT_KIND', 'productive events require FLOW measurement kind');
  }
  const capacityCheck = refuseCapacityAsProduction(material.metric, material.entityClass);
  if (!capacityCheck.ok) {
    return capacityCheck as ProductiveOntologyResult<ProductiveEventMaterial>;
  }
  const stockCheck = refuseStockAsFlow(material.metric, material.entityClass);
  if (!stockCheck.ok) {
    return stockCheck as ProductiveOntologyResult<ProductiveEventMaterial>;
  }
  const telemetryCheck = refuseTelemetryAsEvent(material.metric);
  if (!telemetryCheck.ok) {
    return telemetryCheck as ProductiveOntologyResult<ProductiveEventMaterial>;
  }
  const marketCheck = refuseMarketPriceAsProduction(material.metric);
  if (!marketCheck.ok) {
    return marketCheck as ProductiveOntologyResult<ProductiveEventMaterial>;
  }
  if (material.intervalStartUtc >= material.intervalEndUtc) {
    return fail('OBSERVATION_IS_NOT_EVENT', 'productive event requires a bounded time interval');
  }
  if (material.quantity <= 0n) {
    return fail('OBSERVATION_IS_NOT_EVENT', 'productive event quantity must be positive');
  }
  const category = categoryOntology(entityDef.category);
  if (!category.eventTypes.includes(material.eventType)) {
    return fail('CATEGORY_EVENT_MISMATCH', `event ${material.eventType} not in category ontology`);
  }
  return ok(material);
}

export function observationIsNotEvent(observation: ObservationLike): ProductiveOntologyResult<true> {
  if (observation.eventType) {
    return ok(true);
  }
  const capacity = refuseCapacityAsProduction(observation.metric, observation.entityClass);
  if (!capacity.ok) {
    return capacity;
  }
  const stock = refuseStockAsFlow(observation.metric, observation.entityClass);
  if (!stock.ok) {
    return stock;
  }
  const telemetry = refuseTelemetryAsEvent(observation.metric);
  if (!telemetry.ok) {
    return telemetry;
  }
  return ok(true);
}

export function eventIsNotClaim(event: ProductiveEventLike, claimEventId: string): ProductiveOntologyResult<true> {
  if (claimEventId !== event.eventId) {
    return fail('EVENT_IS_NOT_CLAIM', 'claim must reference the same productive event identity');
  }
  return ok(true);
}

export function claimIsNotGpuv(claimId: string, gpuv: GpuvLike): ProductiveOntologyResult<true> {
  if (gpuv.claimId !== claimId) {
    return fail('CLAIM_IS_NOT_GPUV', 'GPUV must reference the originating claim');
  }
  return ok(true);
}

export function claimIsNotMoonRey(claimId: string, issuance: MoonReySupplyLike): ProductiveOntologyResult<true> {
  if (issuance.claimId && issuance.claimId !== claimId) {
    return fail('CLAIM_IS_NOT_MOONREY', 'MoonRey issuance must reference the same claim when claim-bound');
  }
  return ok(true);
}

export function gpuvIsNotMoonRey(gpuv: GpuvLike, issuance: MoonReySupplyLike): ProductiveOntologyResult<true> {
  if (issuance.gpuvId && issuance.gpuvId !== gpuv.gpuvId) {
    return fail('CLAIM_IS_NOT_MOONREY', 'MoonRey issuance must reference the same GPUV when GPUV-bound');
  }
  return ok(true);
}

const monetizedStockFingerprints = new Set<string>();

export function refuseDuplicateStockMonetization(stockFingerprint: string): ProductiveOntologyResult<true> {
  if (monetizedStockFingerprints.has(stockFingerprint)) {
    return fail('DUPLICATE_STOCK_MONETIZATION', `stock fingerprint ${stockFingerprint} already monetized`);
  }
  monetizedStockFingerprints.add(stockFingerprint);
  return ok(true);
}

export function resetStockMonetizationRegistryForTests(): void {
  monetizedStockFingerprints.clear();
}
