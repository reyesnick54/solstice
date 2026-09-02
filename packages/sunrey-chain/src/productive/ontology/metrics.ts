/**
 * Wave 5 — productive metric classification.
 *
 * Derived estimates remain distinguishable from direct measurements.
 */

import type { ProductiveEconomyCategory } from '../economy-data/types.ts';
import type { ProductiveMetricDefinition, ProductiveMeasurementKind, ProductiveMetricDerivationClass } from './types.ts';
import { entityClassDefinition } from './entities.ts';

const METRIC_ROWS: readonly ProductiveMetricDefinition[] = Object.freeze([
  // Capacity metrics (not productive events)
  metric('INSTALLED_MW', 'ENERGY', 'CAPACITY', 'MW', 'DIRECT_MEASUREMENT', false),
  metric('GPU_COUNT', 'COMPUTE', 'CAPACITY', 'count', 'OPERATOR_REPORTED', false),
  metric('THEORETICAL_UNITS_PER_DAY', 'MANUFACTURING', 'CAPACITY', 'units_per_day', 'OPERATOR_REPORTED', false),
  metric('PROVEN_RESERVE_TONNES', 'RESOURCES', 'STOCK', 'tonnes', 'GOVERNMENT_REPORTED', false),
  metric('reservoir_level_ml', 'WATER', 'STOCK', 'megaliters', 'SENSOR_NETWORK', false),
  metric('STORAGE_CAPACITY_SQM', 'LOGISTICS', 'CAPACITY', 'sqm', 'OPERATOR_REPORTED', false),
  metric('FLEET_SIZE', 'TRANSPORTATION', 'CAPACITY', 'count', 'OPERATOR_REPORTED', false),
  metric('PORT_CAPACITY_GBPS', 'BANDWIDTH', 'CAPACITY', 'Gbps', 'OPERATOR_REPORTED', false),
  // Flow metrics (eligible productive events)
  metric('ENERGY_GENERATED', 'ENERGY', 'FLOW', 'MWh', 'SENSOR_NETWORK', true),
  metric('ENERGY_DELIVERED', 'ENERGY', 'FLOW', 'MWh', 'SENSOR_NETWORK', true),
  metric('COMPUTE_EXECUTED', 'COMPUTE', 'FLOW', 'GPU_HOUR', 'ENTERPRISE_REPORTED', true),
  metric('AI_COMPUTE_EXECUTED', 'AI_COMPUTE', 'FLOW', 'GPU_HOUR', 'ENTERPRISE_REPORTED', true),
  metric('GOODS_MANUFACTURED', 'MANUFACTURING', 'FLOW', 'units_produced', 'OPERATOR_REPORTED', true),
  metric('RESOURCE_EXTRACTED', 'RESOURCES', 'FLOW', 'tonnes', 'GOVERNMENT_REPORTED', true),
  metric('RESOURCE_PROCESSED', 'RESOURCES', 'FLOW', 'tonnes', 'OPERATOR_REPORTED', true),
  metric('AGRICULTURAL_OUTPUT', 'AGRICULTURE_FOOD', 'FLOW', 'kg', 'OPERATOR_REPORTED', true),
  metric('LOGISTICS_MOVEMENT', 'LOGISTICS', 'FLOW', 'tonne_km', 'ENTERPRISE_REPORTED', true),
  metric('TRANSPORT_SERVICE', 'TRANSPORTATION', 'FLOW', 'passenger_km', 'OPERATOR_REPORTED', true),
  metric('BANDWIDTH_DELIVERED', 'BANDWIDTH', 'FLOW', 'Gbps_hour', 'SENSOR_NETWORK', true),
  metric('WATER_PRODUCED', 'WATER', 'FLOW', 'cubic_meters', 'SENSOR_NETWORK', true),
  metric('WATER_DELIVERED', 'WATER', 'FLOW', 'cubic_meters', 'SENSOR_NETWORK', true),
  metric('INFRASTRUCTURE_USE', 'REAL_ESTATE_INFRASTRUCTURE', 'FLOW', 'facility_hour', 'OPERATOR_REPORTED', true),
  // Derived / reference (not direct production)
  metric('MARKET_PRICE_REFERENCE', 'OTHER_GOVERNANCE_APPROVED', 'STOCK', 'USD_minor', 'MARKET_REFERENCE', false),
  metric('MODEL_ESTIMATED_OUTPUT', 'MANUFACTURING', 'FLOW', 'units_produced', 'MODEL_DERIVED', true),
  metric('SATELLITE_ESTIMATED_GENERATION', 'ENERGY', 'FLOW', 'MWh', 'SATELLITE_DERIVED', true),
  // Telemetry (never productive events)
  metric('CPU_TEMPERATURE', 'COMPUTE', 'STOCK', 'celsius', 'DIRECT_MEASUREMENT', false),
  metric('HEARTBEAT', 'COMPUTE', 'STOCK', 'count', 'DIRECT_MEASUREMENT', false),
  metric('RAW_TELEMETRY', 'OTHER_GOVERNANCE_APPROVED', 'STOCK', 'unit', 'OTHER', false),
]);

function metric(
  metricName: string,
  category: ProductiveEconomyCategory,
  measurementKind: ProductiveMeasurementKind,
  canonicalUnit: string,
  derivationClass: ProductiveMetricDerivationClass,
  eligibleForProductiveEvent: boolean,
): ProductiveMetricDefinition {
  return Object.freeze({
    metric: metricName,
    category,
    measurementKind,
    canonicalUnit,
    derivationClass,
    eligibleForProductiveEvent,
  });
}

const BY_METRIC = new Map(METRIC_ROWS.map((row) => [row.metric, row]));

export function metricDefinition(metric: string): ProductiveMetricDefinition | undefined {
  return BY_METRIC.get(metric);
}

export function classifyMetric(
  metric: string,
  entityClass?: string,
): ProductiveMetricDefinition | undefined {
  const direct = BY_METRIC.get(metric);
  if (direct) {
    return direct;
  }
  if (!entityClass) {
    return undefined;
  }
  const entity = entityClassDefinition(entityClass);
  if (!entity) {
    return undefined;
  }
  if (entity.capacityMetrics.includes(metric)) {
    return Object.freeze({
      metric,
      category: entity.category,
      measurementKind: 'CAPACITY' as const,
      canonicalUnit: 'unit',
      derivationClass: 'OPERATOR_REPORTED' as const,
      eligibleForProductiveEvent: false,
    });
  }
  if (entity.stockMetrics.includes(metric)) {
    return Object.freeze({
      metric,
      category: entity.category,
      measurementKind: 'STOCK' as const,
      canonicalUnit: 'unit',
      derivationClass: 'DIRECT_MEASUREMENT' as const,
      eligibleForProductiveEvent: false,
    });
  }
  if (entity.flowMetrics.includes(metric)) {
    return Object.freeze({
      metric,
      category: entity.category,
      measurementKind: 'FLOW' as const,
      canonicalUnit: 'unit',
      derivationClass: 'DIRECT_MEASUREMENT' as const,
      eligibleForProductiveEvent: true,
    });
  }
  return undefined;
}

export function isDerivedMetric(derivationClass: ProductiveMetricDerivationClass): boolean {
  return derivationClass === 'MODEL_DERIVED' || derivationClass === 'SATELLITE_DERIVED' || derivationClass === 'MARKET_REFERENCE';
}

export function listMetrics(category?: ProductiveEconomyCategory): readonly ProductiveMetricDefinition[] {
  if (!category) {
    return METRIC_ROWS;
  }
  return METRIC_ROWS.filter((row) => row.category === category);
}
