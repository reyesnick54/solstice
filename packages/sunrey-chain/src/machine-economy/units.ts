/**
 * Machine-economy UnitRegistry.
 *
 * Resource quantities are exact integers in a named unit. This is not
 * Money and not a second asset ledger.
 */

import { RESOURCE_UNITS, type ResourceUnit } from './types.ts';

export type UnitRecord = {
  readonly unit: ResourceUnit;
  readonly dimension: 'COMPUTE' | 'ENERGY' | 'STORAGE' | 'BANDWIDTH' | 'PRODUCTION' | 'LOGISTICS' | 'SERVICE';
  readonly description: string;
};

const RECORDS: { readonly [K in ResourceUnit]: UnitRecord } = {
  GPU_SECOND: { unit: 'GPU_SECOND', dimension: 'COMPUTE', description: 'One GPU-second of compute' },
  INFERENCE_UNIT: { unit: 'INFERENCE_UNIT', dimension: 'COMPUTE', description: 'One inference work unit' },
  KWH: { unit: 'KWH', dimension: 'ENERGY', description: 'One kilowatt-hour' },
  GB_MONTH: { unit: 'GB_MONTH', dimension: 'STORAGE', description: 'One gigabyte-month of storage' },
  BYTE: { unit: 'BYTE', dimension: 'BANDWIDTH', description: 'One byte of transfer' },
  MANUFACTURED_UNIT: {
    unit: 'MANUFACTURED_UNIT',
    dimension: 'PRODUCTION',
    description: 'One manufactured output unit',
  },
  LOGISTICS_METER: { unit: 'LOGISTICS_METER', dimension: 'LOGISTICS', description: 'One meter of logistics distance' },
  SERVICE_SECOND: { unit: 'SERVICE_SECOND', dimension: 'SERVICE', description: 'One second of machine service' },
};

export const UnitRegistry = Object.freeze({
  id: 'sunrey.machine.unit-registry.v1',
  get(unit: ResourceUnit): UnitRecord {
    return RECORDS[unit];
  },
  known(value: string): value is ResourceUnit {
    return (RESOURCE_UNITS as readonly string[]).includes(value);
  },
  all(): readonly UnitRecord[] {
    return RESOURCE_UNITS.map((unit) => RECORDS[unit]);
  },
});
