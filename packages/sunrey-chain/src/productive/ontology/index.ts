/**
 * Wave 5 — MoonRey Productive Economy ontology.
 *
 * Specializes Wave 4 Economic Awareness for governed productive contribution.
 * Does not mint MoonRey or define monetary value formulas.
 */

export {
  PRODUCTIVE_ONTOLOGY_ID,
  PRODUCTIVE_ONTOLOGY_VERSION,
  OBSERVATION_CANNOT_MINT,
  SINGLE_SOURCE_IS_NOT_CONSENSUS,
  CONFIGURED_PROVIDER_IS_NOT_AUTOMATICALLY_TRUSTED,
  GPUV_IS_NOT_MOONREY,
  GPUV_IS_NOT_MARKET_PRICE,
  PRODUCTIVE_VALUE_IS_NOT_SUPPLY_POLICY,
  SUPPLY_POLICY_IS_NOT_EXCHANGE_PRICE,
  ORACLE_CANNOT_MINT,
  PRODUCTIVE_ONTOLOGY_INVARIANTS,
} from './constants.ts';

export type {
  ProductiveMeasurementKind,
  ProductiveMetricDerivationClass,
  ProductiveControlRejectionCode,
  ProductiveOntologyResult,
  ProductiveCategoryOntology,
  ProductiveEntityClassDefinition,
  ProductiveEventTypeDefinition,
  ProductiveMetricDefinition,
  ProductiveEventMaterial,
} from './types.ts';

export {
  PRODUCTIVE_MEASUREMENT_KINDS,
  PRODUCTIVE_METRIC_DERIVATION_CLASSES,
  PRODUCTIVE_CONTROL_REJECTION_CODES,
} from './types.ts';

export {
  PRODUCTIVE_CATEGORY_ONTOLOGY,
  categoryOntology,
  listProductiveCategoryOntologies,
} from './categories.ts';

export {
  entityClassDefinition,
  listEntityClasses,
  isKnownEntityClass,
} from './entities.ts';

export {
  eventTypeDefinition,
  listEventTypes,
  isKnownEventType,
  eventTypeForMetric,
} from './events.ts';

export {
  metricDefinition,
  classifyMetric,
  isDerivedMetric,
  listMetrics,
} from './metrics.ts';

export {
  refuseCapacityAsProduction,
  refuseStockAsFlow,
  refuseTelemetryAsEvent,
  refuseMarketPriceAsProduction,
  validateProductiveEventMaterial,
  observationIsNotEvent,
  eventIsNotClaim,
  claimIsNotGpuv,
  claimIsNotMoonRey,
  gpuvIsNotMoonRey,
  refuseDuplicateStockMonetization,
  resetStockMonetizationRegistryForTests,
  type ObservationLike,
  type ProductiveEventLike,
  type GpuvLike,
  type MoonReySupplyLike,
} from './controls.ts';

export {
  PRODUCTIVE_CLAIM_EXTENSION_SCHEMA,
  buildProductiveEconomicClaimBundle,
  productiveClaimLacksSupplyAuthority,
  type ProductiveEconomicClaimExtension,
  type ProductiveEconomicClaimBundle,
} from './claims.ts';

export {
  PRODUCTIVE_EVENT_RELATIONS,
  projectProductiveEventToGraph,
  type ProductiveGraphProjection,
} from './graph.ts';

export {
  WAVE5_FIXTURE_NOW,
  WAVE5_FIXTURE_END,
  SOLAR_GENERATION_EVENT,
  GRID_DELIVERY_EVENT,
  GPU_COMPUTE_EVENT,
  FACTORY_PRODUCTION_EVENT,
  AGRICULTURAL_OUTPUT_EVENT,
  RESOURCE_EXTRACTION_EVENT,
  LOGISTICS_MOVEMENT_EVENT,
  WATER_DELIVERY_EVENT,
  CAPACITY_NOT_PRODUCTION_OBSERVATION,
  STOCK_NOT_FLOW_OBSERVATION,
  TELEMETRY_NOT_EVENT_OBSERVATION,
  MARKET_PRICE_NOT_PRODUCTION_OBSERVATION,
  WAVE5_DOMAIN_FIXTURES,
} from './fixtures.ts';
