/**
 * Wave 5 — explicit productive event type semantics.
 *
 * Arbitrary telemetry is not a productive contribution.
 */

import type { ProductiveEconomyCategory } from '../economy-data/types.ts';
import type { ProductiveEventTypeDefinition } from './types.ts';

const EVENT_DEFINITIONS: readonly ProductiveEventTypeDefinition[] = Object.freeze([
  event('EnergyGenerated', 'ENERGY', 'Energy Generated', 'Bounded interval of electricity generation', 'ENERGY_GENERATED', 'MWh', ['PowerPlant', 'SolarInstallation', 'WindInstallation']),
  event('EnergyDelivered', 'ENERGY', 'Energy Delivered', 'Electricity delivered to offtaker or grid', 'ENERGY_DELIVERED', 'MWh', ['PowerPlant', 'GridResource']),
  event('ComputeExecuted', 'COMPUTE', 'Compute Executed', 'Useful general-purpose compute over interval', 'COMPUTE_EXECUTED', 'GPU_HOUR', ['ComputeCluster', 'DataCenter']),
  event('AIComputeExecuted', 'AI_COMPUTE', 'AI Compute Executed', 'Bounded AI inference or training workload', 'AI_COMPUTE_EXECUTED', 'GPU_HOUR', ['AIAcceleratorPool', 'ComputeCluster', 'DataCenter']),
  event('GoodsManufactured', 'MANUFACTURING', 'Goods Manufactured', 'Finished goods output over production interval', 'GOODS_MANUFACTURED', 'units_produced', ['Factory', 'ProductionLine', 'MachineCell']),
  event('ResourceExtracted', 'RESOURCES', 'Resource Extracted', 'Material extracted from natural reserve', 'RESOURCE_EXTRACTED', 'tonnes', ['Mine', 'Well', 'ResourceFacility']),
  event('ResourceProcessed', 'RESOURCES', 'Resource Processed', 'Raw material transformed at processing facility', 'RESOURCE_PROCESSED', 'tonnes', ['Refinery', 'ResourceFacility']),
  event('AgriculturalOutputProduced', 'AGRICULTURE_FOOD', 'Agricultural Output Produced', 'Harvest or food output over bounded window', 'AGRICULTURAL_OUTPUT', 'kg', ['Farm', 'AgriculturalField', 'FoodProductionFacility']),
  event('LogisticsMovementCompleted', 'LOGISTICS', 'Logistics Movement Completed', 'Completed freight or handling movement', 'LOGISTICS_MOVEMENT', 'tonne_km', ['Port', 'Warehouse', 'LogisticsHub']),
  event('TransportServiceCompleted', 'TRANSPORTATION', 'Transport Service Completed', 'Completed passenger or freight transport service', 'TRANSPORT_SERVICE', 'passenger_km', ['Vehicle', 'Fleet', 'RailAsset', 'Aircraft', 'Vessel']),
  event('BandwidthDelivered', 'BANDWIDTH', 'Bandwidth Delivered', 'Realized network throughput over interval', 'BANDWIDTH_DELIVERED', 'Gbps_hour', ['TelecomNode', 'NetworkSegment']),
  event('WaterProduced', 'WATER', 'Water Produced', 'Treated water output from plant', 'WATER_PRODUCED', 'cubic_meters', ['WaterPlant', 'UtilityResource']),
  event('WaterDelivered', 'WATER', 'Water Delivered', 'Water delivered to consumer or network', 'WATER_DELIVERED', 'cubic_meters', ['WaterPlant', 'Reservoir', 'UtilityResource']),
  event('InfrastructureCapacityProvided', 'REAL_ESTATE_INFRASTRUCTURE', 'Infrastructure Capacity Provided', 'Realized infrastructure use or service output', 'INFRASTRUCTURE_USE', 'facility_hour', ['Property', 'Building', 'InfrastructureAsset']),
]);

function event(
  eventType: string,
  category: ProductiveEconomyCategory,
  label: string,
  description: string,
  requiredMetric: string,
  canonicalUnit: string,
  entityClasses: readonly string[],
): ProductiveEventTypeDefinition {
  return Object.freeze({
    eventType,
    category,
    label,
    description,
    measurementKind: 'FLOW',
    requiredMetric,
    canonicalUnit,
    entityClasses,
    rejectsTelemetryAsEvent: true,
  });
}

const BY_TYPE = new Map(EVENT_DEFINITIONS.map((row) => [row.eventType, row]));

export function eventTypeDefinition(eventType: string): ProductiveEventTypeDefinition | undefined {
  return BY_TYPE.get(eventType);
}

export function listEventTypes(category?: ProductiveEconomyCategory): readonly ProductiveEventTypeDefinition[] {
  if (!category) {
    return EVENT_DEFINITIONS;
  }
  return EVENT_DEFINITIONS.filter((row) => row.category === category);
}

export function isKnownEventType(eventType: string): boolean {
  return BY_TYPE.has(eventType);
}

export function eventTypeForMetric(metric: string): ProductiveEventTypeDefinition | undefined {
  return EVENT_DEFINITIONS.find((row) => row.requiredMetric === metric);
}
