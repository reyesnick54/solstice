/**
 * Wave 5 — deterministic productive economy fixtures for tests.
 */

import type { ProductiveEventMaterial } from './types.ts';

export const WAVE5_FIXTURE_NOW = '2026-09-02T12:00:00.000Z' as const;
export const WAVE5_FIXTURE_END = '2026-09-02T13:00:00.000Z' as const;

function flowEvent(input: Omit<ProductiveEventMaterial, 'measurementKind' | 'derivationClass' | 'methodologyId'> & {
  readonly methodologyId?: string;
  readonly derivationClass?: ProductiveEventMaterial['derivationClass'];
}): ProductiveEventMaterial {
  return Object.freeze({
    measurementKind: 'FLOW',
    derivationClass: input.derivationClass ?? 'SENSOR_NETWORK',
    methodologyId: input.methodologyId ?? 'pvm.wave5.sim',
    ...input,
  });
}

export const SOLAR_GENERATION_EVENT = flowEvent({
  eventType: 'EnergyGenerated',
  entityClass: 'SolarInstallation',
  entityRef: 'entity:solar:north-ridge',
  metric: 'ENERGY_GENERATED',
  quantity: 120_000n,
  unit: 'MWh',
  intervalStartUtc: WAVE5_FIXTURE_NOW,
  intervalEndUtc: WAVE5_FIXTURE_END,
  jurisdiction: 'US',
  region: 'TX',
  observationIds: ['obs_solar_a', 'obs_solar_b'],
  evidenceRefs: ['ev:solar:generation'],
  rightsRef: 'rights:solar:ppa-001',
  licenseRef: 'lic:sandbox_fixture',
  consensusReceiptRef: 'ic:solar:consensus-001',
});

export const GRID_DELIVERY_EVENT = flowEvent({
  eventType: 'EnergyDelivered',
  entityClass: 'GridResource',
  entityRef: 'entity:grid:ercot-west',
  metric: 'ENERGY_DELIVERED',
  quantity: 118_000n,
  unit: 'MWh',
  intervalStartUtc: WAVE5_FIXTURE_NOW,
  intervalEndUtc: WAVE5_FIXTURE_END,
  jurisdiction: 'US',
  region: 'TX',
  observationIds: ['obs_grid_delivery'],
  evidenceRefs: ['ev:grid:delivery'],
  rightsRef: null,
  licenseRef: 'lic:sandbox_fixture',
  consensusReceiptRef: 'ic:grid:consensus-001',
});

export const GPU_COMPUTE_EVENT = flowEvent({
  eventType: 'ComputeExecuted',
  entityClass: 'ComputeCluster',
  entityRef: 'entity:compute:orion-east',
  metric: 'COMPUTE_EXECUTED',
  quantity: 4_000n,
  unit: 'GPU_HOUR',
  derivationClass: 'ENTERPRISE_REPORTED',
  intervalStartUtc: WAVE5_FIXTURE_NOW,
  intervalEndUtc: WAVE5_FIXTURE_END,
  jurisdiction: 'US',
  region: null,
  observationIds: ['obs_gpu_exec'],
  evidenceRefs: ['ev:compute:workload'],
  rightsRef: 'rights:compute:sla-42',
  licenseRef: 'lic:sandbox_fixture',
  consensusReceiptRef: 'ic:compute:consensus-001',
});

export const FACTORY_PRODUCTION_EVENT = flowEvent({
  eventType: 'GoodsManufactured',
  entityClass: 'Factory',
  entityRef: 'entity:factory:river-valley',
  metric: 'GOODS_MANUFACTURED',
  quantity: 500n,
  unit: 'units_produced',
  derivationClass: 'OPERATOR_REPORTED',
  intervalStartUtc: WAVE5_FIXTURE_NOW,
  intervalEndUtc: WAVE5_FIXTURE_END,
  jurisdiction: 'US',
  region: 'OH',
  observationIds: ['obs_factory_output'],
  evidenceRefs: ['ev:factory:mes'],
  rightsRef: null,
  licenseRef: 'lic:sandbox_fixture',
  consensusReceiptRef: 'ic:factory:consensus-001',
});

export const AGRICULTURAL_OUTPUT_EVENT = flowEvent({
  eventType: 'AgriculturalOutputProduced',
  entityClass: 'Farm',
  entityRef: 'entity:farm:midwest-cooperative',
  metric: 'AGRICULTURAL_OUTPUT',
  quantity: 12_000n,
  unit: 'kg',
  derivationClass: 'OPERATOR_REPORTED',
  intervalStartUtc: WAVE5_FIXTURE_NOW,
  intervalEndUtc: WAVE5_FIXTURE_END,
  jurisdiction: 'US',
  region: 'IA',
  observationIds: ['obs_harvest_a', 'obs_harvest_b'],
  evidenceRefs: ['ev:ag:harvest'],
  rightsRef: null,
  licenseRef: 'lic:sandbox_fixture',
  consensusReceiptRef: 'ic:ag:consensus-001',
});

export const RESOURCE_EXTRACTION_EVENT = flowEvent({
  eventType: 'ResourceExtracted',
  entityClass: 'Mine',
  entityRef: 'entity:mine:copper-ridge',
  metric: 'RESOURCE_EXTRACTED',
  quantity: 2_500n,
  unit: 'tonnes',
  derivationClass: 'GOVERNMENT_REPORTED',
  intervalStartUtc: WAVE5_FIXTURE_NOW,
  intervalEndUtc: WAVE5_FIXTURE_END,
  jurisdiction: 'CL',
  region: 'Atacama',
  observationIds: ['obs_mine_extract'],
  evidenceRefs: ['ev:mine:regulatory'],
  rightsRef: 'rights:mining:lease-88',
  licenseRef: 'lic:sandbox_fixture',
  consensusReceiptRef: 'ic:mine:consensus-001',
});

export const LOGISTICS_MOVEMENT_EVENT = flowEvent({
  eventType: 'LogisticsMovementCompleted',
  entityClass: 'Port',
  entityRef: 'entity:port:harbor-terminal',
  metric: 'LOGISTICS_MOVEMENT',
  quantity: 8_500n,
  unit: 'tonne_km',
  derivationClass: 'ENTERPRISE_REPORTED',
  intervalStartUtc: WAVE5_FIXTURE_NOW,
  intervalEndUtc: WAVE5_FIXTURE_END,
  jurisdiction: 'US',
  region: 'CA',
  observationIds: ['obs_port_movement'],
  evidenceRefs: ['ev:port:manifest'],
  rightsRef: null,
  licenseRef: 'lic:sandbox_fixture',
  consensusReceiptRef: 'ic:logistics:consensus-001',
});

export const WATER_DELIVERY_EVENT = flowEvent({
  eventType: 'WaterDelivered',
  entityClass: 'WaterPlant',
  entityRef: 'entity:water:metro-plant-3',
  metric: 'WATER_DELIVERED',
  quantity: 45_000n,
  unit: 'cubic_meters',
  intervalStartUtc: WAVE5_FIXTURE_NOW,
  intervalEndUtc: WAVE5_FIXTURE_END,
  jurisdiction: 'US',
  region: 'AZ',
  observationIds: ['obs_water_delivery'],
  evidenceRefs: ['ev:water:meter'],
  rightsRef: null,
  licenseRef: 'lic:sandbox_fixture',
  consensusReceiptRef: 'ic:water:consensus-001',
});

export const CAPACITY_NOT_PRODUCTION_OBSERVATION = Object.freeze({
  observationId: 'obs_solar_capacity_only',
  metric: 'INSTALLED_MW',
  quantity: 100n,
  unit: 'MW',
  entityClass: 'SolarInstallation',
});

export const STOCK_NOT_FLOW_OBSERVATION = Object.freeze({
  observationId: 'obs_reservoir_level',
  metric: 'reservoir_level_ml',
  quantity: 500_000n,
  unit: 'megaliters',
  entityClass: 'Reservoir',
});

export const TELEMETRY_NOT_EVENT_OBSERVATION = Object.freeze({
  observationId: 'obs_cpu_temp',
  metric: 'CPU_TEMPERATURE',
  quantity: 72n,
  unit: 'celsius',
  entityClass: 'ComputeCluster',
});

export const MARKET_PRICE_NOT_PRODUCTION_OBSERVATION = Object.freeze({
  observationId: 'obs_market_price',
  metric: 'MARKET_PRICE_REFERENCE',
  quantity: 42_500n,
  unit: 'USD_minor',
  entityClass: 'Factory',
});

export const WAVE5_DOMAIN_FIXTURES = Object.freeze([
  SOLAR_GENERATION_EVENT,
  GRID_DELIVERY_EVENT,
  GPU_COMPUTE_EVENT,
  FACTORY_PRODUCTION_EVENT,
  AGRICULTURAL_OUTPUT_EVENT,
  RESOURCE_EXTRACTION_EVENT,
  LOGISTICS_MOVEMENT_EVENT,
  WATER_DELIVERY_EVENT,
]);
