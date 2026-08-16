export type CustodyAccountId = string & { readonly __brand: 'CustodyAccountId' };
export type DepositId = string & { readonly __brand: 'DepositId' };
export type WithdrawalId = string & { readonly __brand: 'WithdrawalId' };
export type DestinationId = string & { readonly __brand: 'DestinationId' };
export type TravelRuleMessageId = string & { readonly __brand: 'TravelRuleMessageId' };
export type VaspId = string & { readonly __brand: 'VaspId' };
export type CustodyReconciliationId = string & { readonly __brand: 'CustodyReconciliationId' };

export function asCustodyAccountId(value: string): CustodyAccountId {
  return value as CustodyAccountId;
}
export function asDepositId(value: string): DepositId {
  return value as DepositId;
}
export function asWithdrawalId(value: string): WithdrawalId {
  return value as WithdrawalId;
}
export function asDestinationId(value: string): DestinationId {
  return value as DestinationId;
}
export function asVaspId(value: string): VaspId {
  return value as VaspId;
}

export function newDepositId(): DepositId {
  return asDepositId(`dep_${crypto.randomUUID().replace(/-/g, '')}`);
}
export function newWithdrawalId(): WithdrawalId {
  return asWithdrawalId(`wdl_${crypto.randomUUID().replace(/-/g, '')}`);
}
export function newDestinationId(): DestinationId {
  return asDestinationId(`dst_${crypto.randomUUID().replace(/-/g, '')}`);
}
export function newTravelRuleMessageId(): TravelRuleMessageId {
  return `trm_${crypto.randomUUID().replace(/-/g, '')}` as TravelRuleMessageId;
}
export function newCustodyReconciliationId(): CustodyReconciliationId {
  return `crec_${crypto.randomUUID().replace(/-/g, '')}` as CustodyReconciliationId;
}

export const SIMULATION_EXTERNAL_INBOUND_BOOK = 'SIMULATION.EXTERNAL_INBOUND';
export const SIMULATION_EXTERNAL_OUTBOUND_BOOK = 'SIMULATION.EXTERNAL_OUTBOUND';
