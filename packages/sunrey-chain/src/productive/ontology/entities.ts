/**
 * Wave 5 — productive entity class registry.
 *
 * Entity classes are category-scoped. Fields are not forced identical across classes.
 */

import type { ProductiveEconomyCategory } from '../economy-data/types.ts';
import type { ProductiveEntityClassDefinition } from './types.ts';

const ENTITY_DEFINITIONS: readonly ProductiveEntityClassDefinition[] = Object.freeze([
  // Energy
  def('PowerPlant', 'ENERGY', 'Power Plant', 'Grid-connected or isolated generation facility', ['ENERGY_GENERATED', 'ENERGY_DELIVERED'], ['INSTALLED_MW'], ['MWh', 'kWh'], ['fuel_reserve_mwh']),
  def('SolarInstallation', 'ENERGY', 'Solar Installation', 'Photovoltaic or concentrated solar asset', ['ENERGY_GENERATED'], ['INSTALLED_MW'], ['MWh'], ['panel_count']),
  def('WindInstallation', 'ENERGY', 'Wind Installation', 'Onshore or offshore wind turbine array', ['ENERGY_GENERATED'], ['INSTALLED_MW'], ['MWh'], []),
  def('GridResource', 'ENERGY', 'Grid Resource', 'Transmission or distribution grid segment', ['ENERGY_DELIVERED'], ['TRANSMISSION_CAPACITY_MW'], ['MWh_delivered'], []),
  // Compute
  def('ComputeCluster', 'COMPUTE', 'Compute Cluster', 'General-purpose compute fleet', ['COMPUTE_EXECUTED'], ['GPU_COUNT', 'CPU_CORES'], ['GPU_HOUR', 'CPU_HOUR'], []),
  def('DataCenter', 'COMPUTE', 'Data Center', 'Facility hosting compute infrastructure', ['COMPUTE_EXECUTED', 'AI_COMPUTE_EXECUTED'], ['RACK_CAPACITY'], ['GPU_HOUR'], ['facility_sqft']),
  def('AIAcceleratorPool', 'AI_COMPUTE', 'AI Accelerator Pool', 'GPU/TPU pool for AI workloads', ['AI_COMPUTE_EXECUTED'], ['ACCELERATOR_COUNT'], ['GPU_HOUR', 'INFERENCE_UNIT'], []),
  // Manufacturing
  def('Factory', 'MANUFACTURING', 'Factory', 'Industrial manufacturing site', ['GOODS_MANUFACTURED'], ['THEORETICAL_UNITS_PER_DAY'], ['units_produced'], ['wip_inventory']),
  def('ProductionLine', 'MANUFACTURING', 'Production Line', 'Bounded manufacturing line', ['GOODS_MANUFACTURED'], ['LINE_CAPACITY'], ['units_produced'], []),
  def('MachineCell', 'MANUFACTURING', 'Machine Cell', 'Robotic or CNC cell', ['GOODS_MANUFACTURED'], ['CELL_CYCLE_TIME'], ['units_produced'], []),
  // Resources
  def('Mine', 'RESOURCES', 'Mine', 'Extraction site for minerals', ['RESOURCE_EXTRACTED'], ['PROVEN_RESERVE_TONNES'], ['tonnes_extracted'], ['reserve_tonnes']),
  def('Well', 'RESOURCES', 'Well', 'Oil, gas, or water well', ['RESOURCE_EXTRACTED'], ['WELL_CAPACITY'], ['barrels_extracted'], ['reservoir_volume']),
  def('Refinery', 'RESOURCES', 'Refinery', 'Processing facility for raw materials', ['RESOURCE_PROCESSED'], ['PROCESSING_CAPACITY'], ['tonnes_processed'], ['feedstock_inventory']),
  def('ResourceFacility', 'RESOURCES', 'Resource Facility', 'Generic governed resource site', ['RESOURCE_EXTRACTED', 'RESOURCE_PROCESSED'], ['FACILITY_CAPACITY'], ['tonnes'], ['stock_level']),
  // Agriculture
  def('Farm', 'AGRICULTURE_FOOD', 'Farm', 'Agricultural production operation', ['AGRICULTURAL_OUTPUT'], ['CULTIVATED_HECTARES'], ['kg_harvested'], ['stored_crop_kg']),
  def('AgriculturalField', 'AGRICULTURE_FOOD', 'Agricultural Field', 'Bounded cultivation area', ['AGRICULTURAL_OUTPUT'], ['FIELD_AREA'], ['kg_harvested'], []),
  def('FoodProductionFacility', 'AGRICULTURE_FOOD', 'Food Production Facility', 'Food processing or packaging plant', ['AGRICULTURAL_OUTPUT'], ['PLANT_CAPACITY'], ['kg_processed'], ['cold_storage_kg']),
  // Real estate / infrastructure
  def('Property', 'REAL_ESTATE_INFRASTRUCTURE', 'Property', 'Real estate parcel or building', ['INFRASTRUCTURE_USE'], ['FLOOR_AREA_SQM'], ['occupancy_hour'], ['title_sqm']),
  def('Building', 'REAL_ESTATE_INFRASTRUCTURE', 'Building', 'Structure providing use or service output', ['INFRASTRUCTURE_USE'], ['GROSS_SQM'], ['facility_hour'], []),
  def('InfrastructureAsset', 'REAL_ESTATE_INFRASTRUCTURE', 'Infrastructure Asset', 'Road, bridge, pipeline, or similar asset', ['INFRASTRUCTURE_USE'], ['DESIGN_CAPACITY'], ['facility_hour'], ['asset_book_value_ref']),
  // Logistics
  def('Port', 'LOGISTICS', 'Port', 'Maritime or inland port terminal', ['LOGISTICS_MOVEMENT'], ['BERTH_CAPACITY'], ['TEU_handled'], ['yard_capacity_teu']),
  def('Warehouse', 'LOGISTICS', 'Warehouse', 'Storage and distribution facility', ['LOGISTICS_MOVEMENT'], ['STORAGE_CAPACITY_SQM'], ['pallet_moves'], ['inventory_units']),
  def('LogisticsHub', 'LOGISTICS', 'Logistics Hub', 'Multi-modal logistics coordination site', ['LOGISTICS_MOVEMENT'], ['THROUGHPUT_CAPACITY'], ['tonne_km'], []),
  // Transportation
  def('Vehicle', 'TRANSPORTATION', 'Vehicle', 'Single transport vehicle', ['TRANSPORT_SERVICE'], ['PAYLOAD_CAPACITY'], ['vehicle_km'], []),
  def('Fleet', 'TRANSPORTATION', 'Fleet', 'Managed vehicle fleet', ['TRANSPORT_SERVICE'], ['FLEET_SIZE'], ['passenger_km', 'tonne_km'], []),
  def('RailAsset', 'TRANSPORTATION', 'Rail Asset', 'Locomotive or rolling stock', ['TRANSPORT_SERVICE'], ['TRAIN_CAPACITY'], ['tonne_km'], []),
  def('Aircraft', 'TRANSPORTATION', 'Aircraft', 'Fixed-wing or rotary aircraft', ['TRANSPORT_SERVICE'], ['SEAT_CAPACITY'], ['passenger_km'], []),
  def('Vessel', 'TRANSPORTATION', 'Vessel', 'Maritime vessel', ['TRANSPORT_SERVICE'], ['DEADWEIGHT_TONNAGE'], ['tonne_km'], []),
  // Bandwidth
  def('TelecomNode', 'BANDWIDTH', 'Telecom Node', 'Network access or switching node', ['BANDWIDTH_DELIVERED'], ['PORT_CAPACITY_GBPS'], ['Gbps_hour'], []),
  def('NetworkSegment', 'BANDWIDTH', 'Network Segment', 'Logical or physical network path', ['BANDWIDTH_DELIVERED'], ['LINK_CAPACITY'], ['bytes_transferred'], []),
  // Water
  def('WaterPlant', 'WATER', 'Water Plant', 'Treatment or desalination plant', ['WATER_PRODUCED', 'WATER_DELIVERED'], ['PLANT_CAPACITY_MLD'], ['cubic_meters'], []),
  def('Reservoir', 'WATER', 'Reservoir', 'Stored water body', ['WATER_DELIVERED'], ['STORAGE_CAPACITY_ML'], ['cubic_meters_delivered'], ['reservoir_level_ml']),
  def('UtilityResource', 'WATER', 'Utility Resource', 'Municipal or regional water utility asset', ['WATER_PRODUCED', 'WATER_DELIVERED'], ['SERVICE_CAPACITY'], ['cubic_meters'], ['network_inventory']),
]);

function def(
  entityClass: string,
  category: ProductiveEconomyCategory,
  label: string,
  description: string,
  typicalMetrics: readonly string[],
  capacityMetrics: readonly string[],
  flowMetrics: readonly string[],
  stockMetrics: readonly string[],
): ProductiveEntityClassDefinition {
  return Object.freeze({
    entityClass,
    category,
    label,
    description,
    typicalMetrics,
    capacityMetrics,
    flowMetrics,
    stockMetrics,
  });
}

const BY_CLASS = new Map(ENTITY_DEFINITIONS.map((row) => [row.entityClass, row]));

export function entityClassDefinition(entityClass: string): ProductiveEntityClassDefinition | undefined {
  return BY_CLASS.get(entityClass);
}

export function listEntityClasses(category?: ProductiveEconomyCategory): readonly ProductiveEntityClassDefinition[] {
  if (!category) {
    return ENTITY_DEFINITIONS;
  }
  return ENTITY_DEFINITIONS.filter((row) => row.category === category);
}

export function isKnownEntityClass(entityClass: string): boolean {
  return BY_CLASS.has(entityClass);
}
