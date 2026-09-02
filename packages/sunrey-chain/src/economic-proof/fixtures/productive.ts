import { economicProofDigest } from '../hash.ts';
import { entityCommitmentFromRefs } from '../entity-identity.ts';

export const PRODUCTIVE_FIXTURE_NOW = '2026-09-01T06:00:00.000Z' as const;
export const PRODUCTIVE_FIXTURE_END = '2026-09-01T07:00:00.000Z' as const;

export const POWER_PLANT_ENTITY = entityCommitmentFromRefs(['power-plant:grid-node-wave3']);
export const FACTORY_ENTITY = entityCommitmentFromRefs(['factory:acme-plant-7']);
export const COMPUTE_CLUSTER_ENTITY = entityCommitmentFromRefs(['compute:dc-east-1']);

export const ENERGY_EVENT_QUANTITY = 500_000_000n; // 500 MWh in Wh minor units (fixture scale)
export const ENERGY_UNIT = 'watt_hour';

export function energyPayloadDigest(source: string, quantity = ENERGY_EVENT_QUANTITY): string {
  return economicProofDigest(['energy-event', source, quantity.toString(), ENERGY_UNIT]);
}

export function factoryProductionDigest(source: string, quantity: bigint): string {
  return economicProofDigest(['factory-production', source, quantity.toString(), 'unit']);
}

export function logisticsDigest(source: string, quantity: bigint): string {
  return economicProofDigest(['logistics-shipment', source, quantity.toString()]);
}

export function computeTelemetryDigest(source: string, gpuSeconds: bigint): string {
  return economicProofDigest(['compute-telemetry', source, gpuSeconds.toString()]);
}

export function workloadReceiptDigest(receiptId: string): string {
  return economicProofDigest(['workload-receipt', receiptId]);
}
