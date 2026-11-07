import { createHash } from 'node:crypto';

export type ParentOrderId = string & { readonly __brand: 'ParentOrderId' };
export type ChildOrderId = string & { readonly __brand: 'ChildOrderId' };
export type ExecutionScheduleId = string & { readonly __brand: 'ExecutionScheduleId' };

export function asParentOrderId(value: string): ParentOrderId {
  return value as ParentOrderId;
}

export function asChildOrderId(value: string): ChildOrderId {
  return value as ChildOrderId;
}

export function asExecutionScheduleId(value: string): ExecutionScheduleId {
  return value as ExecutionScheduleId;
}

export function parentOrderIdFor(material: string): ParentOrderId {
  return asParentOrderId(`por_${createHash('sha256').update(material).digest('hex').slice(0, 24)}`);
}

export function childOrderIdFor(material: string): ChildOrderId {
  return asChildOrderId(`cho_${createHash('sha256').update(material).digest('hex').slice(0, 24)}`);
}

export function executionScheduleIdFor(material: string): ExecutionScheduleId {
  return asExecutionScheduleId(`esc_${createHash('sha256').update(material).digest('hex').slice(0, 24)}`);
}
