import { randomUUID } from 'node:crypto';

export type ChainId = string & { readonly __brand: 'ChainId' };
export type ChainNetworkId = string & { readonly __brand: 'ChainNetworkId' };
export type ChainAccountId = string & { readonly __brand: 'ChainAccountId' };
export type ChainSubjectReference = string & { readonly __brand: 'ChainSubjectReference' };
export type ChainTransactionId = string & { readonly __brand: 'ChainTransactionId' };
export type ChainBlockReference = string & { readonly __brand: 'ChainBlockReference' };
export type ChainReceiptId = string & { readonly __brand: 'ChainReceiptId' };
export type ChainCommitmentId = string & { readonly __brand: 'ChainCommitmentId' };
export type ChainAttestationId = string & { readonly __brand: 'ChainAttestationId' };
export type ChainPermissionRecordId = string & { readonly __brand: 'ChainPermissionRecordId' };
export type ChainProvenanceRecordId = string & { readonly __brand: 'ChainProvenanceRecordId' };
export type ChainPolicyRecordId = string & { readonly __brand: 'ChainPolicyRecordId' };
export type ChainSettlementAnchorId = string & { readonly __brand: 'ChainSettlementAnchorId' };
export type ChainAdapterId = string & { readonly __brand: 'ChainAdapterId' };
export type ChainOperationId = string & { readonly __brand: 'ChainOperationId' };
export type ChainWriteIntentId = string & { readonly __brand: 'ChainWriteIntentId' };
export type ChainReconciliationId = string & { readonly __brand: 'ChainReconciliationId' };

export const SIMULATION_CHAIN_ID = 'chn_sunrey_simulation' as ChainId;
export const SIMULATION_NETWORK_ID = 'net_sunrey_simulation' as ChainNetworkId;
export const SIMULATION_ADAPTER_ID = 'cad_simulation' as ChainAdapterId;

function branded(prefix: string): string {
  return `${prefix}${randomUUID()}`;
}

export function newChainOperationId(): ChainOperationId {
  return branded('cop_') as ChainOperationId;
}
export function newChainWriteIntentId(): ChainWriteIntentId {
  return branded('cwi_') as ChainWriteIntentId;
}
export function newChainCommitmentId(): ChainCommitmentId {
  return branded('ccm_') as ChainCommitmentId;
}
export function newChainReceiptId(): ChainReceiptId {
  return branded('crc_') as ChainReceiptId;
}
export function newChainTransactionId(): ChainTransactionId {
  return branded('ctx_') as ChainTransactionId;
}
export function newChainBlockReference(height: number): ChainBlockReference {
  return `cbl_${height.toString().padStart(8, '0')}` as ChainBlockReference;
}
export function newChainAttestationId(): ChainAttestationId {
  return branded('cat_') as ChainAttestationId;
}
export function newChainPermissionRecordId(): ChainPermissionRecordId {
  return branded('cpr_') as ChainPermissionRecordId;
}
export function newChainProvenanceRecordId(): ChainProvenanceRecordId {
  return branded('cpv_') as ChainProvenanceRecordId;
}
export function newChainPolicyRecordId(): ChainPolicyRecordId {
  return branded('cpl_') as ChainPolicyRecordId;
}
export function newChainSettlementAnchorId(): ChainSettlementAnchorId {
  return branded('csa_') as ChainSettlementAnchorId;
}
export function newChainReconciliationId(): ChainReconciliationId {
  return branded('crn_') as ChainReconciliationId;
}
