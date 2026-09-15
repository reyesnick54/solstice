import { type Brand, brandAs } from '../../../domain/src/brand.ts';

export type EconomicWorkOrderId = Brand<string, 'EconomicWorkOrderId'>;
export type HeliosTaskId = Brand<string, 'HeliosTaskId'>;
export type ResearchBudgetReservationId = Brand<string, 'ResearchBudgetReservationId'>;
export type ResearchSpendRecordId = Brand<string, 'ResearchSpendRecordId'>;
export type HeliosProgramId = Brand<string, 'HeliosProgramId'>;

const PREFIX = {
  EconomicWorkOrderId: 'ewo_',
  HeliosTaskId: 'htk_',
  ResearchBudgetReservationId: 'rbr_',
  ResearchSpendRecordId: 'rsp_',
  HeliosProgramId: 'hpg_',
} as const;

function brandPrefixed<Name extends keyof typeof PREFIX>(value: string, name: Name): Brand<string, Name> {
  if (value.length === 0 || !value.startsWith(PREFIX[name])) {
    throw new TypeError(`${name} must start with ${PREFIX[name]}`);
  }
  return brandAs<string, Name>(value);
}

export function asEconomicWorkOrderId(value: string): EconomicWorkOrderId {
  return brandPrefixed(value, 'EconomicWorkOrderId');
}

export function asHeliosTaskId(value: string): HeliosTaskId {
  return brandPrefixed(value, 'HeliosTaskId');
}

export function asResearchBudgetReservationId(value: string): ResearchBudgetReservationId {
  return brandPrefixed(value, 'ResearchBudgetReservationId');
}

export function asResearchSpendRecordId(value: string): ResearchSpendRecordId {
  return brandPrefixed(value, 'ResearchSpendRecordId');
}

export function asHeliosProgramId(value: string): HeliosProgramId {
  return brandPrefixed(value, 'HeliosProgramId');
}

export function workOrderIdFor(programId: string, sequence: number): EconomicWorkOrderId {
  return asEconomicWorkOrderId(`ewo_${programId}_${String(sequence)}`);
}

export function taskIdFor(workOrderId: string, operationKey: string): HeliosTaskId {
  const safe = operationKey.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 48);
  return asHeliosTaskId(`htk_${workOrderId}_${safe}`);
}
