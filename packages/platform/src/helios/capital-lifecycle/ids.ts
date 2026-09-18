import type { Brand } from '../../../../domain/src/brand.ts';

export type HeliosExitRequestId = Brand<string, 'HeliosExitRequestId'>;
export type HeliosWithdrawalRequestId = Brand<string, 'HeliosWithdrawalRequestId'>;
export type CapitalReconciliationRunId = Brand<string, 'CapitalReconciliationRunId'>;
export type CapitalReservationId = Brand<string, 'CapitalReservationId'>;

export function asHeliosExitRequestId(value: string): HeliosExitRequestId {
  return value as HeliosExitRequestId;
}

export function asHeliosWithdrawalRequestId(value: string): HeliosWithdrawalRequestId {
  return value as HeliosWithdrawalRequestId;
}

export function asCapitalReconciliationRunId(value: string): CapitalReconciliationRunId {
  return value as CapitalReconciliationRunId;
}

export function asCapitalReservationId(value: string): CapitalReservationId {
  return value as CapitalReservationId;
}

export function exitRequestIdFor(customerId: string, operationId: string): HeliosExitRequestId {
  return asHeliosExitRequestId(`exit_${customerId}_${operationId}`.slice(0, 64));
}

export function withdrawalRequestIdFor(customerId: string, operationId: string): HeliosWithdrawalRequestId {
  return asHeliosWithdrawalRequestId(`wd_${customerId}_${operationId}`.slice(0, 64));
}

export function reconciliationRunIdFor(investmentAccountId: string, asOf: string): CapitalReconciliationRunId {
  return asCapitalReconciliationRunId(`rec_${investmentAccountId}_${asOf}`.slice(0, 80));
}
