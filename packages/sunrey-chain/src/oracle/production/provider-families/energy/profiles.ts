/**
 * Provider-neutral energy source profiles.
 *
 * Profiles name measurement classes, not vendors. A future endpoint
 * mapping can bind a commercial API onto one of these profiles without
 * changing the domain model.
 */

import {
  ENERGY_FABRIC_ID,
  ENERGY_FABRIC_VERSION,
  type EnergySourceClass,
  type EnergySourceProfile,
} from './types.ts';

function profile(input: Omit<EnergySourceProfile, 'schemaVersion' | 'fabricId' | 'canMintMoonRey' | 'productionActive'>): EnergySourceProfile {
  return Object.freeze({
    ...input,
    schemaVersion: ENERGY_FABRIC_VERSION,
    fabricId: ENERGY_FABRIC_ID,
    canMintMoonRey: false,
    productionActive: false,
  });
}

export const ENERGY_SOURCE_PROFILES: Readonly<Record<string, EnergySourceProfile>> = Object.freeze({
  generator_interval_production: profile({
    profileId: 'generator_interval_production',
    sourceClass: 'GENERATOR_METER',
    sourceCategory: 'energy',
    factType: 'ENERGY_PRODUCTION',
    productiveCategory: 'ENERGY',
    claimType: 'OUTPUT',
    meterSemantics: 'INTERVAL_ENERGY',
    defaultChannel: 'LOCAL_PRODUCTION',
    schemaId: 'ENERGY_INTERVAL_V1',
    acceptedUnits: ['Wh', 'kWh', 'MWh'],
    canCreateProductiveClaim: true,
  }),
  plant_telemetry_production: profile({
    profileId: 'plant_telemetry_production',
    sourceClass: 'PLANT_TELEMETRY',
    sourceCategory: 'energy',
    factType: 'ENERGY_PRODUCTION',
    productiveCategory: 'ENERGY',
    claimType: 'OUTPUT',
    meterSemantics: 'INTERVAL_ENERGY',
    defaultChannel: 'LOCAL_PRODUCTION',
    schemaId: 'ENERGY_INTERVAL_V1',
    acceptedUnits: ['Wh', 'kWh', 'MWh'],
    canCreateProductiveClaim: true,
  }),
  generator_cumulative_register: profile({
    profileId: 'generator_cumulative_register',
    sourceClass: 'GENERATOR_METER',
    sourceCategory: 'energy',
    factType: 'ENERGY_PRODUCTION',
    productiveCategory: 'ENERGY',
    claimType: 'OUTPUT',
    meterSemantics: 'CUMULATIVE_REGISTER',
    defaultChannel: 'LOCAL_PRODUCTION',
    schemaId: 'ENERGY_CUMULATIVE_REGISTER_V1',
    acceptedUnits: ['Wh', 'kWh', 'MWh'],
    canCreateProductiveClaim: true,
  }),
  utility_consumption_interval: profile({
    profileId: 'utility_consumption_interval',
    sourceClass: 'UTILITY_METER',
    sourceCategory: 'energy',
    factType: 'ENERGY_CONSUMPTION',
    productiveCategory: 'ENERGY',
    claimType: 'USAGE',
    meterSemantics: 'INTERVAL_ENERGY',
    defaultChannel: 'LOCAL_CONSUMPTION',
    schemaId: 'ENERGY_CONSUMPTION_INTERVAL_V1',
    acceptedUnits: ['Wh', 'kWh', 'MWh'],
    canCreateProductiveClaim: true,
  }),
  commercial_building_consumption: profile({
    profileId: 'commercial_building_consumption',
    sourceClass: 'COMMERCIAL_BUILDING_METER',
    sourceCategory: 'energy',
    factType: 'ENERGY_CONSUMPTION',
    productiveCategory: 'ENERGY',
    claimType: 'USAGE',
    meterSemantics: 'INTERVAL_ENERGY',
    defaultChannel: 'LOCAL_CONSUMPTION',
    schemaId: 'ENERGY_CONSUMPTION_INTERVAL_V1',
    acceptedUnits: ['Wh', 'kWh', 'MWh'],
    canCreateProductiveClaim: true,
  }),
  industrial_consumption: profile({
    profileId: 'industrial_consumption',
    sourceClass: 'INDUSTRIAL_ENERGY_METER',
    sourceCategory: 'energy',
    factType: 'ENERGY_CONSUMPTION',
    productiveCategory: 'ENERGY',
    claimType: 'USAGE',
    meterSemantics: 'INTERVAL_ENERGY',
    defaultChannel: 'LOCAL_CONSUMPTION',
    schemaId: 'ENERGY_CONSUMPTION_INTERVAL_V1',
    acceptedUnits: ['Wh', 'kWh', 'MWh'],
    canCreateProductiveClaim: true,
  }),
  grid_export_interval: profile({
    profileId: 'grid_export_interval',
    sourceClass: 'GENERATOR_METER',
    sourceCategory: 'energy',
    factType: 'ENERGY_PRODUCTION',
    productiveCategory: 'ENERGY',
    claimType: 'OUTPUT',
    meterSemantics: 'INTERVAL_ENERGY',
    defaultChannel: 'GRID_EXPORT',
    schemaId: 'ENERGY_EXPORT_INTERVAL_V1',
    acceptedUnits: ['Wh', 'kWh', 'MWh'],
    canCreateProductiveClaim: false,
  }),
  grid_import_interval: profile({
    profileId: 'grid_import_interval',
    sourceClass: 'UTILITY_METER',
    sourceCategory: 'energy',
    factType: 'ENERGY_CONSUMPTION',
    productiveCategory: 'ENERGY',
    claimType: 'USAGE',
    meterSemantics: 'INTERVAL_ENERGY',
    defaultChannel: 'GRID_IMPORT',
    schemaId: 'ENERGY_CONSUMPTION_INTERVAL_V1',
    acceptedUnits: ['Wh', 'kWh', 'MWh'],
    canCreateProductiveClaim: false,
  }),
  grid_operator_aggregate: profile({
    profileId: 'grid_operator_aggregate',
    sourceClass: 'GRID_OPERATOR_AGGREGATE',
    sourceCategory: 'energy',
    factType: 'ENERGY_PRODUCTION',
    productiveCategory: 'ENERGY',
    claimType: 'OUTPUT',
    meterSemantics: 'INTERVAL_ENERGY',
    defaultChannel: 'LOCAL_PRODUCTION',
    schemaId: 'ENERGY_INTERVAL_V1',
    acceptedUnits: ['Wh', 'kWh', 'MWh'],
    canCreateProductiveClaim: true,
  }),
  distribution_operator_aggregate: profile({
    profileId: 'distribution_operator_aggregate',
    sourceClass: 'DISTRIBUTION_OPERATOR_AGGREGATE',
    sourceCategory: 'energy',
    factType: 'ENERGY_CONSUMPTION',
    productiveCategory: 'ENERGY',
    claimType: 'USAGE',
    meterSemantics: 'INTERVAL_ENERGY',
    defaultChannel: 'LOCAL_CONSUMPTION',
    schemaId: 'ENERGY_CONSUMPTION_INTERVAL_V1',
    acceptedUnits: ['Wh', 'kWh', 'MWh'],
    canCreateProductiveClaim: true,
  }),
  storage_charge: profile({
    profileId: 'storage_charge',
    sourceClass: 'ENERGY_STORAGE_METER',
    sourceCategory: 'energy',
    factType: 'ENERGY_CONSUMPTION',
    productiveCategory: 'ENERGY',
    claimType: 'USAGE',
    meterSemantics: 'INTERVAL_ENERGY',
    defaultChannel: 'STORAGE_CHARGE',
    schemaId: 'ENERGY_CONSUMPTION_INTERVAL_V1',
    acceptedUnits: ['Wh', 'kWh', 'MWh'],
    canCreateProductiveClaim: false,
  }),
  storage_discharge: profile({
    profileId: 'storage_discharge',
    sourceClass: 'ENERGY_STORAGE_METER',
    sourceCategory: 'energy',
    factType: 'ENERGY_PRODUCTION',
    productiveCategory: 'ENERGY',
    claimType: 'OUTPUT',
    meterSemantics: 'INTERVAL_ENERGY',
    defaultChannel: 'STORAGE_DISCHARGE',
    schemaId: 'ENERGY_INTERVAL_V1',
    acceptedUnits: ['Wh', 'kWh', 'MWh'],
    canCreateProductiveClaim: false,
  }),
  microgrid_meter: profile({
    profileId: 'microgrid_meter',
    sourceClass: 'MICROGRID_METER',
    sourceCategory: 'energy',
    factType: 'ENERGY_PRODUCTION',
    productiveCategory: 'ENERGY',
    claimType: 'OUTPUT',
    meterSemantics: 'INTERVAL_ENERGY',
    defaultChannel: 'LOCAL_PRODUCTION',
    schemaId: 'ENERGY_INTERVAL_V1',
    acceptedUnits: ['Wh', 'kWh', 'MWh'],
    canCreateProductiveClaim: true,
  }),
  nameplate_capacity_reference: profile({
    profileId: 'nameplate_capacity_reference',
    sourceClass: 'PLANT_TELEMETRY',
    sourceCategory: 'energy',
    factType: 'ENERGY_CAPACITY',
    productiveCategory: null,
    claimType: null,
    meterSemantics: 'INSTANTANEOUS_CAPACITY_REFERENCE',
    defaultChannel: null,
    schemaId: 'ENERGY_CAPACITY_REFERENCE_V1',
    acceptedUnits: ['Wh', 'kWh', 'MWh'],
    canCreateProductiveClaim: false,
  }),
  energy_market_reference_price: profile({
    profileId: 'energy_market_reference_price',
    sourceClass: 'ENERGY_MARKET_REFERENCE',
    sourceCategory: 'reference_price',
    factType: 'REFERENCE_PRICE',
    productiveCategory: null,
    claimType: null,
    meterSemantics: 'INTERVAL_ENERGY',
    defaultChannel: null,
    schemaId: 'ENERGY_REFERENCE_PRICE_V1',
    acceptedUnits: ['units_produced'],
    canCreateProductiveClaim: false,
  }),
});

export function profileFor(profileId: string): EnergySourceProfile | null {
  return ENERGY_SOURCE_PROFILES[profileId] ?? null;
}

export function profilesForClass(sourceClass: EnergySourceClass): readonly EnergySourceProfile[] {
  return Object.freeze(Object.values(ENERGY_SOURCE_PROFILES).filter((row) => row.sourceClass === sourceClass));
}

export function energyProfilesDoNotNameVendors(): true {
  const unnamed = Object.values(ENERGY_SOURCE_PROFILES).every((row) => !/caiso|eia|iso-ne|pjm|ercot|nationalgrid|siemens|schneider/i.test(row.profileId));
  if (!unnamed) {
    throw new Error('energy profiles must remain vendor-neutral');
  }
  return true;
}
