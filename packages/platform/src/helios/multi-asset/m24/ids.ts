import { createHash } from 'node:crypto';

import type { HeliosOrderId } from '../../order-lifecycle/ids.ts';

export type M24ExecutionPlanId = string & { readonly __brand: 'M24ExecutionPlanId' };
export type M24ExitPlanId = string & { readonly __brand: 'M24ExitPlanId' };

export function asM24ExecutionPlanId(value: string): M24ExecutionPlanId {
  return value as M24ExecutionPlanId;
}

export function asM24ExitPlanId(value: string): M24ExitPlanId {
  return value as M24ExitPlanId;
}

export function executionPlanIdFor(workOrderId: string, proposalId: string, idempotencyKey: string): M24ExecutionPlanId {
  const digest = createHash('sha256')
    .update(`${workOrderId}:${proposalId}:${idempotencyKey}`)
    .digest('hex')
    .slice(0, 16);
  return asM24ExecutionPlanId(`m24_plan_${digest}`);
}

export function exitPlanIdFor(customerId: string, instrumentId: string, idempotencyKey: string): M24ExitPlanId {
  const digest = createHash('sha256')
    .update(`${customerId}:${instrumentId}:${idempotencyKey}`)
    .digest('hex')
    .slice(0, 16);
  return asM24ExitPlanId(`m24_exit_${digest}`);
}

export function providerPayloadHash(payload: string): string {
  return createHash('sha256').update(payload).digest('hex');
}

export function canonicalOrderKey(orderId: HeliosOrderId): string {
  return `m24_ord_${orderId}`;
}
