import { type Brand, brandAs } from '../../../domain/src/brand.ts';

export type EconomicWorkOrderId = Brand<string, 'EconomicWorkOrderId'>;
export type WorkOrderRevision = Brand<number, 'WorkOrderRevision'>;
export type WorkOrderTransitionId = Brand<string, 'WorkOrderTransitionId'>;

const PREFIX = {
  EconomicWorkOrderId: 'ewo_',
  WorkOrderTransitionId: 'ewot_',
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

export function asWorkOrderTransitionId(value: string): WorkOrderTransitionId {
  return brandPrefixed(value, 'WorkOrderTransitionId');
}

export function asWorkOrderRevision(value: number): WorkOrderRevision {
  if (!Number.isInteger(value) || value < 1) {
    throw new TypeError('WorkOrderRevision must be a positive integer');
  }
  return brandAs<number, 'WorkOrderRevision'>(value);
}

export function workOrderIdFor(subjectId: string, idempotencyKey: string): EconomicWorkOrderId {
  const compact = `${subjectId}_${idempotencyKey}`.replace(/[^a-zA-Z0-9_]/g, '_');
  return asEconomicWorkOrderId(`ewo_${compact}`);
}

export function transitionIdFor(workOrderId: string, revision: number, toState: string): WorkOrderTransitionId {
  const compact = `${workOrderId}_r${String(revision)}_${toState}`.replace(/[^a-zA-Z0-9_]/g, '_');
  return asWorkOrderTransitionId(`ewot_${compact}`);
}
