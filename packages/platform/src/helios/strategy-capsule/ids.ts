import type { EconomicWorkOrderId } from '../ids.ts';

export type StrategyCapsuleId = `scap_${string}`;

export function asStrategyCapsuleId(value: string): StrategyCapsuleId {
  if (!value.startsWith('scap_')) {
    throw new Error(`invalid StrategyCapsuleId: ${value}`);
  }
  return value as StrategyCapsuleId;
}

export function strategyCapsuleIdFor(workOrderId: EconomicWorkOrderId, key: string): StrategyCapsuleId {
  return asStrategyCapsuleId(`scap_${workOrderId}_${key}`);
}
