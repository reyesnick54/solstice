import type { EconomicWorkOrderId } from '../ids.ts';

export type HeliosOrderId = `ord_${string}`;
export type HeliosFillId = `fill_${string}`;
export type HeliosSettlementId = `set_${string}`;
export type HeliosOperationId = `op_${string}`;
export type HeliosProviderEventId = `pev_${string}`;

export function asHeliosOrderId(value: string): HeliosOrderId {
  if (!value.startsWith('ord_')) throw new Error(`invalid HeliosOrderId: ${value}`);
  return value as HeliosOrderId;
}

export function asHeliosFillId(value: string): HeliosFillId {
  if (!value.startsWith('fill_')) throw new Error(`invalid HeliosFillId: ${value}`);
  return value as HeliosFillId;
}

export function asHeliosSettlementId(value: string): HeliosSettlementId {
  if (!value.startsWith('set_')) throw new Error(`invalid HeliosSettlementId: ${value}`);
  return value as HeliosSettlementId;
}

export function asHeliosOperationId(value: string): HeliosOperationId {
  if (!value.startsWith('op_')) throw new Error(`invalid HeliosOperationId: ${value}`);
  return value as HeliosOperationId;
}

export function asHeliosProviderEventId(value: string): HeliosProviderEventId {
  if (!value.startsWith('pev_')) throw new Error(`invalid HeliosProviderEventId: ${value}`);
  return value as HeliosProviderEventId;
}

/**
 * Stable operation identity: one intended operation → at most one financial effect.
 * Derived deterministically from work order, proposal, and client idempotency key.
 */
export function operationIdFor(
  workOrderId: EconomicWorkOrderId | string,
  proposalId: string,
  idempotencyKey: string,
): HeliosOperationId {
  return asHeliosOperationId(`op_${workOrderId}_${proposalId}_${idempotencyKey}`);
}

export function orderIdFor(operationId: HeliosOperationId | string): HeliosOrderId {
  return asHeliosOrderId(`ord_${operationId}`);
}

export function externalOperationIdFor(operationId: HeliosOperationId | string): string {
  return `ext_${operationId}`;
}

export function fillIdFor(orderId: HeliosOrderId | string, providerFillId: string): HeliosFillId {
  return asHeliosFillId(`fill_${orderId}_${providerFillId}`);
}

export function settlementIdFor(orderId: HeliosOrderId | string, fillId: HeliosFillId | string): HeliosSettlementId {
  return asHeliosSettlementId(`set_${orderId}_${fillId}`);
}
