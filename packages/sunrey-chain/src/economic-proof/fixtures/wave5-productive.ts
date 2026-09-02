import { economicProofDigest } from '../hash.ts';
import { entityCommitmentFromRefs } from '../entity-identity.ts';

export const WAVE5_FIXTURE_NOW = '2026-09-01T06:00:00.000Z' as const;
export const WAVE5_FIXTURE_HOUR_END = '2026-09-01T07:00:00.000Z' as const;
export const WAVE5_FIXTURE_DAY_END = '2026-09-02T06:00:00.000Z' as const;

export const WAVE5_POWER_PLANT = entityCommitmentFromRefs(['power-plant:wave5-tx-main']);
export const WAVE5_FACTORY = entityCommitmentFromRefs(['factory:wave5-acme-plant']);
export const WAVE5_FACTORY_LINE_A = entityCommitmentFromRefs(['factory-line:wave5-acme-line-a']);
export const WAVE5_DATACENTER = entityCommitmentFromRefs(['compute:wave5-dc-west']);
export const WAVE5_FARM = entityCommitmentFromRefs(['farm:wave5-midwest-field-3']);
export const WAVE5_LOGISTICS_HUB = entityCommitmentFromRefs(['logistics:wave5-hub-chicago']);
export const WAVE5_MINE = entityCommitmentFromRefs(['mine:wave5-copper-pit-1']);
export const WAVE5_WATER_PLANT = entityCommitmentFromRefs(['water-plant:wave5-municipal']);

export const WAVE5_ENERGY_500_MWH = 500_000_000n;
export const WAVE5_ENERGY_UNIT = 'watt_hour';

export function wave5EnergyDigest(source: string, quantity = WAVE5_ENERGY_500_MWH): string {
  return economicProofDigest(['wave5-energy', source, quantity.toString()]);
}

export function wave5ManufacturingDigest(source: string, quantity: bigint): string {
  return economicProofDigest(['wave5-manufacturing', source, quantity.toString()]);
}

export function wave5ComputeDigest(source: string, gpuSeconds: bigint): string {
  return economicProofDigest(['wave5-compute', source, gpuSeconds.toString()]);
}

export function wave5AgricultureDigest(source: string, bushels: bigint): string {
  return economicProofDigest(['wave5-agriculture', source, bushels.toString()]);
}

export function wave5LogisticsDigest(source: string, units: bigint): string {
  return economicProofDigest(['wave5-logistics', source, units.toString()]);
}

export function wave5ResourcesDigest(source: string, tonnes: bigint): string {
  return economicProofDigest(['wave5-resources', source, tonnes.toString()]);
}

export function wave5WaterDigest(source: string, liters: bigint): string {
  return economicProofDigest(['wave5-water', source, liters.toString()]);
}
