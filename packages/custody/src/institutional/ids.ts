export type VaultId = string & { readonly __brand: 'VaultId' };
export type CustodyWalletId = string & { readonly __brand: 'CustodyWalletId' };
export type InstitutionalDestinationId = string & { readonly __brand: 'InstitutionalDestinationId' };
export type NativeWithdrawalId = string & { readonly __brand: 'NativeWithdrawalId' };
export type ApprovalId = string & { readonly __brand: 'ApprovalId' };
export type PreviewId = string & { readonly __brand: 'PreviewId' };
export type RebalanceProposalId = string & { readonly __brand: 'RebalanceProposalId' };
export type CompromiseIncidentId = string & { readonly __brand: 'CompromiseIncidentId' };

export function asVaultId(value: string): VaultId {
  return value as VaultId;
}
export function asCustodyWalletId(value: string): CustodyWalletId {
  return value as CustodyWalletId;
}
export function asInstitutionalDestinationId(value: string): InstitutionalDestinationId {
  return value as InstitutionalDestinationId;
}
export function asNativeWithdrawalId(value: string): NativeWithdrawalId {
  return value as NativeWithdrawalId;
}

export function newVaultId(): VaultId {
  return asVaultId(`vault_${crypto.randomUUID().replace(/-/g, '')}`);
}
export function newCustodyWalletId(): CustodyWalletId {
  return asCustodyWalletId(`cwal_${crypto.randomUUID().replace(/-/g, '')}`);
}
export function newInstitutionalDestinationId(): InstitutionalDestinationId {
  return asInstitutionalDestinationId(`idst_${crypto.randomUUID().replace(/-/g, '')}`);
}
export function newNativeWithdrawalId(): NativeWithdrawalId {
  return asNativeWithdrawalId(`nwdl_${crypto.randomUUID().replace(/-/g, '')}`);
}
export function newApprovalId(): ApprovalId {
  return `appr_${crypto.randomUUID().replace(/-/g, '')}` as ApprovalId;
}
export function newPreviewId(): PreviewId {
  return `prev_${crypto.randomUUID().replace(/-/g, '')}` as PreviewId;
}
export function newRebalanceProposalId(): RebalanceProposalId {
  return `rbal_${crypto.randomUUID().replace(/-/g, '')}` as RebalanceProposalId;
}
export function newCompromiseIncidentId(): CompromiseIncidentId {
  return `cmp_${crypto.randomUUID().replace(/-/g, '')}` as CompromiseIncidentId;
}
