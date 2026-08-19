/**
 * Provider-neutral source-family profiles. Named vendors are not connected.
 */

import type { LogisticsMapping, LogisticsSourceFamily } from './types.ts';

export const LOGISTICS_SOURCE_PROFILES: Readonly<Record<LogisticsSourceFamily, LogisticsMapping>> = Object.freeze({
  TMS: Object.freeze({
    sourceFamily: 'TMS',
    factType: 'LOGISTICS_CAPACITY',
    productiveCategory: 'LOGISTICS_TRANSPORTATION',
    claimType: 'USAGE',
    defaultUnit: 'tonne_km',
    realizationState: 'REALIZED',
  }),
  FREIGHT_CARRIER_SYSTEM: Object.freeze({
    sourceFamily: 'FREIGHT_CARRIER_SYSTEM',
    factType: 'LOGISTICS_CAPACITY',
    productiveCategory: 'LOGISTICS_TRANSPORTATION',
    claimType: 'USAGE',
    defaultUnit: 'tonne_km',
    realizationState: 'REALIZED',
  }),
  VEHICLE_TELEMATICS_GATEWAY: Object.freeze({
    sourceFamily: 'VEHICLE_TELEMATICS_GATEWAY',
    factType: 'LOGISTICS_CAPACITY',
    productiveCategory: 'LOGISTICS_TRANSPORTATION',
    claimType: 'CAPACITY',
    defaultUnit: 'tonne_km',
    realizationState: 'CAPACITY',
  }),
  PROOF_OF_DELIVERY_SYSTEM: Object.freeze({
    sourceFamily: 'PROOF_OF_DELIVERY_SYSTEM',
    factType: 'DELIVERY_COMPLETION',
    productiveCategory: 'LOGISTICS_TRANSPORTATION',
    claimType: 'DELIVERY',
    defaultUnit: 'units_produced',
    realizationState: 'REALIZED',
  }),
  CUSTOMS_STATUS_REFERENCE: Object.freeze({
    sourceFamily: 'CUSTOMS_STATUS_REFERENCE',
    factType: 'DELIVERY_COMPLETION',
    productiveCategory: 'LOGISTICS_TRANSPORTATION',
    claimType: 'DELIVERY',
    defaultUnit: 'units_produced',
    realizationState: 'IN_PROGRESS',
  }),
  PORT_TERMINAL_SYSTEM: Object.freeze({
    sourceFamily: 'PORT_TERMINAL_SYSTEM',
    factType: 'DELIVERY_COMPLETION',
    productiveCategory: 'LOGISTICS_TRANSPORTATION',
    claimType: 'DELIVERY',
    defaultUnit: 'units_produced',
    realizationState: 'REALIZED',
  }),
  RAIL_FREIGHT_SYSTEM: Object.freeze({
    sourceFamily: 'RAIL_FREIGHT_SYSTEM',
    factType: 'LOGISTICS_CAPACITY',
    productiveCategory: 'LOGISTICS_TRANSPORTATION',
    claimType: 'USAGE',
    defaultUnit: 'tonne_km',
    realizationState: 'REALIZED',
  }),
  AIR_CARGO_SYSTEM: Object.freeze({
    sourceFamily: 'AIR_CARGO_SYSTEM',
    factType: 'LOGISTICS_CAPACITY',
    productiveCategory: 'LOGISTICS_TRANSPORTATION',
    claimType: 'USAGE',
    defaultUnit: 'tonne_km',
    realizationState: 'REALIZED',
  }),
  MARITIME_CARGO_SYSTEM: Object.freeze({
    sourceFamily: 'MARITIME_CARGO_SYSTEM',
    factType: 'LOGISTICS_CAPACITY',
    productiveCategory: 'LOGISTICS_TRANSPORTATION',
    claimType: 'USAGE',
    defaultUnit: 'tonne_km',
    realizationState: 'REALIZED',
  }),
  WMS: Object.freeze({
    sourceFamily: 'WMS',
    factType: 'STORAGE_CAPACITY',
    productiveCategory: 'STORAGE',
    claimType: 'USAGE',
    defaultUnit: 'm3_hour',
    realizationState: 'REALIZED',
  }),
  WAREHOUSE_METER: Object.freeze({
    sourceFamily: 'WAREHOUSE_METER',
    factType: 'STORAGE_CAPACITY',
    productiveCategory: 'STORAGE',
    claimType: 'CAPACITY',
    defaultUnit: 'm3',
    realizationState: 'CAPACITY',
  }),
  COLD_STORAGE_METER: Object.freeze({
    sourceFamily: 'COLD_STORAGE_METER',
    factType: 'STORAGE_CAPACITY',
    productiveCategory: 'STORAGE',
    claimType: 'USAGE',
    defaultUnit: 'm3_hour',
    realizationState: 'REALIZED',
  }),
});

export function profileFor(family: LogisticsSourceFamily): LogisticsMapping {
  return LOGISTICS_SOURCE_PROFILES[family];
}

export function namedVendorConnected(): false {
  return false;
}
