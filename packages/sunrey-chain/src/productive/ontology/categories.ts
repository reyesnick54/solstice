/**
 * Wave 5 — versioned Productive Economy category ontology.
 *
 * Aligns with PRODUCTIVE_ECONOMY_CATEGORIES in economy-data/types.ts.
 * Does not define monetary value formulas.
 */

import type { ProductiveEconomyCategory } from '../economy-data/types.ts';
import type { ProductiveCategoryOntology } from './types.ts';

export const PRODUCTIVE_CATEGORY_ONTOLOGY: Readonly<Record<ProductiveEconomyCategory, ProductiveCategoryOntology>> =
  Object.freeze({
    ENERGY: Object.freeze({
      category: 'ENERGY',
      label: 'Energy',
      entityClasses: ['PowerPlant', 'SolarInstallation', 'WindInstallation', 'GridResource'],
      eventTypes: ['EnergyGenerated', 'EnergyDelivered'],
      canonicalUnits: ['MWh', 'kWh', 'GWh'],
      typicalSourceClasses: ['SENSOR_NETWORK', 'INSTITUTIONAL', 'GOVERNMENT_REPORTED'],
      eventBoundaryNotes: 'Generation interval must be bounded; cumulative meter readings are not events.',
      likelyCorroborationSources: ['grid_operator', 'independent_meter', 'satellite_derived'],
    }),
    COMPUTE: Object.freeze({
      category: 'COMPUTE',
      label: 'Compute',
      entityClasses: ['ComputeCluster', 'DataCenter'],
      eventTypes: ['ComputeExecuted'],
      canonicalUnits: ['GPU_HOUR', 'CPU_HOUR', 'TFLOP_S'],
      typicalSourceClasses: ['ENTERPRISE_REPORTED', 'SENSOR_NETWORK', 'CERTIFIED_CANDIDATE'],
      eventBoundaryNotes: 'Useful execution over a bounded interval; idle capacity is not execution.',
      likelyCorroborationSources: ['scheduler_receipt', 'billing_meter', 'workload_attestation'],
    }),
    AI_COMPUTE: Object.freeze({
      category: 'AI_COMPUTE',
      label: 'AI Compute',
      entityClasses: ['AIAcceleratorPool', 'ComputeCluster', 'DataCenter'],
      eventTypes: ['AIComputeExecuted'],
      canonicalUnits: ['GPU_HOUR', 'INFERENCE_UNIT', 'TRAINING_UNIT'],
      typicalSourceClasses: ['ENTERPRISE_REPORTED', 'CERTIFIED_CANDIDATE'],
      eventBoundaryNotes: 'Inference or training workload completion; prompt logs are not productive events.',
      likelyCorroborationSources: ['accelerator_telemetry', 'billing_receipt', 'model_serving_meter'],
    }),
    MANUFACTURING: Object.freeze({
      category: 'MANUFACTURING',
      label: 'Manufacturing',
      entityClasses: ['Factory', 'ProductionLine', 'MachineCell'],
      eventTypes: ['GoodsManufactured'],
      canonicalUnits: ['units_produced', 'kg', 'tonnes'],
      typicalSourceClasses: ['OPERATOR_REPORTED', 'SENSOR_NETWORK', 'ENTERPRISE_REPORTED'],
      eventBoundaryNotes: 'Finished-goods output over interval; theoretical line capacity is not production.',
      likelyCorroborationSources: ['mes_system', 'quality_inspection', 'inventory_reconciliation'],
    }),
    RESOURCES: Object.freeze({
      category: 'RESOURCES',
      label: 'Resources',
      entityClasses: ['Mine', 'Well', 'Refinery', 'ResourceFacility'],
      eventTypes: ['ResourceExtracted', 'ResourceProcessed'],
      canonicalUnits: ['tonnes', 'barrels', 'cubic_meters'],
      typicalSourceClasses: ['GOVERNMENT_REPORTED', 'OPERATOR_REPORTED', 'SATELLITE_DERIVED'],
      eventBoundaryNotes: 'Extracted or processed quantity over interval; reserve estimates are stock not flow.',
      likelyCorroborationSources: ['regulatory_filing', 'weighbridge', 'satellite_observation'],
    }),
    AGRICULTURE_FOOD: Object.freeze({
      category: 'AGRICULTURE_FOOD',
      label: 'Agriculture and Food',
      entityClasses: ['Farm', 'AgriculturalField', 'FoodProductionFacility'],
      eventTypes: ['AgriculturalOutputProduced'],
      canonicalUnits: ['kg', 'tonnes', 'bushels'],
      typicalSourceClasses: ['OPERATOR_REPORTED', 'GOVERNMENT_REPORTED', 'SENSOR_NETWORK'],
      eventBoundaryNotes: 'Harvest or food output over bounded harvest window; planted acreage is not output.',
      likelyCorroborationSources: ['usda_reference', 'cooperative_report', 'field_sensor'],
    }),
    REAL_ESTATE_INFRASTRUCTURE: Object.freeze({
      category: 'REAL_ESTATE_INFRASTRUCTURE',
      label: 'Real Estate and Infrastructure',
      entityClasses: ['Property', 'Building', 'InfrastructureAsset'],
      eventTypes: ['InfrastructureCapacityProvided'],
      canonicalUnits: ['facility_hour', 'sqm_hour', 'occupancy_hour'],
      typicalSourceClasses: ['OPERATOR_REPORTED', 'INSTITUTIONAL'],
      eventBoundaryNotes: 'Realized use or service output; installed capacity or title is stock.',
      likelyCorroborationSources: ['facility_meter', 'occupancy_sensor', 'utility_billing'],
    }),
    LOGISTICS: Object.freeze({
      category: 'LOGISTICS',
      label: 'Logistics',
      entityClasses: ['Port', 'Warehouse', 'LogisticsHub'],
      eventTypes: ['LogisticsMovementCompleted'],
      canonicalUnits: ['tonne_km', 'TEU', 'pallet_moves'],
      typicalSourceClasses: ['OPERATOR_REPORTED', 'ENTERPRISE_REPORTED'],
      eventBoundaryNotes: 'Completed movement or handling; warehouse square footage is capacity not movement.',
      likelyCorroborationSources: ['carrier_manifest', 'port_authority', 'warehouse_wms'],
    }),
    TRANSPORTATION: Object.freeze({
      category: 'TRANSPORTATION',
      label: 'Transportation',
      entityClasses: ['Vehicle', 'Fleet', 'RailAsset', 'Aircraft', 'Vessel'],
      eventTypes: ['TransportServiceCompleted'],
      canonicalUnits: ['passenger_km', 'tonne_km', 'vehicle_km'],
      typicalSourceClasses: ['OPERATOR_REPORTED', 'GOVERNMENT_REPORTED', 'SENSOR_NETWORK'],
      eventBoundaryNotes: 'Completed transport service; fleet size is capacity not service output.',
      likelyCorroborationSources: ['dispatch_system', 'regulatory_telemetry', 'fuel_receipt'],
    }),
    BANDWIDTH: Object.freeze({
      category: 'BANDWIDTH',
      label: 'Bandwidth',
      entityClasses: ['TelecomNode', 'NetworkSegment'],
      eventTypes: ['BandwidthDelivered'],
      canonicalUnits: ['Gbps_hour', 'Mbps_s', 'bytes_transferred'],
      typicalSourceClasses: ['SENSOR_NETWORK', 'ENTERPRISE_REPORTED'],
      eventBoundaryNotes: 'DATA_RATE is not DATA_VOLUME; delivered throughput over interval only.',
      likelyCorroborationSources: ['network_probe', 'carrier_cdr', 'cdn_meter'],
    }),
    WATER: Object.freeze({
      category: 'WATER',
      label: 'Water',
      entityClasses: ['WaterPlant', 'Reservoir', 'UtilityResource'],
      eventTypes: ['WaterProduced', 'WaterDelivered'],
      canonicalUnits: ['cubic_meters', 'megaliters', 'gallons'],
      typicalSourceClasses: ['GOVERNMENT_REPORTED', 'SENSOR_NETWORK', 'INSTITUTIONAL'],
      eventBoundaryNotes: 'Produced or delivered volume over interval; reservoir level is stock not delivery.',
      likelyCorroborationSources: ['utility_meter', 'regulatory_report', 'independent_audit'],
    }),
    OTHER_GOVERNANCE_APPROVED: Object.freeze({
      category: 'OTHER_GOVERNANCE_APPROVED',
      label: 'Other Governance Approved',
      entityClasses: ['ResourceFacility'],
      eventTypes: ['InfrastructureCapacityProvided'],
      canonicalUnits: ['unit'],
      typicalSourceClasses: ['CERTIFIED_CANDIDATE', 'INSTITUTIONAL'],
      eventBoundaryNotes: 'Requires explicit governance approval; generic telemetry rejected by default.',
      likelyCorroborationSources: ['governance_registry', 'certified_oracle'],
    }),
  });

export function categoryOntology(category: ProductiveEconomyCategory): ProductiveCategoryOntology {
  return PRODUCTIVE_CATEGORY_ONTOLOGY[category];
}

export function listProductiveCategoryOntologies(): readonly ProductiveCategoryOntology[] {
  return Object.freeze(Object.values(PRODUCTIVE_CATEGORY_ONTOLOGY));
}
