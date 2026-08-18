import { randomUUID } from 'node:crypto';

export const NETWORK_ID_PREFIXES = Object.freeze({
  subject: 'hisub_',
  descriptor: 'hidesc_',
  right: 'hiright_',
  permission: 'hiperm_',
  consent: 'higrant_',
  purpose: 'hipurpose_',
  offer: 'hioffer_',
  request: 'hireq_',
  transaction: 'hitx_',
  computation: 'hicomp_',
  result: 'hires_',
  receipt: 'hireceipt_',
  compensation: 'hicompense_',
  revocation: 'hirev_',
  audit: 'hiaudit_',
  incident: 'hiinc_',
  connector: 'hiconn_',
  notification: 'hinotif_',
});

export type HumanInformationSubjectId = string & { readonly __brand: 'HumanInformationSubjectId' };
export type HumanInformationAssetDescriptorId = string & { readonly __brand: 'HumanInformationAssetDescriptorId' };
export type HumanInformationRightId = string & { readonly __brand: 'HumanInformationRightId' };
export type HumanInformationPermissionId = string & { readonly __brand: 'HumanInformationPermissionId' };
export type HumanInformationConsentGrantId = string & { readonly __brand: 'HumanInformationConsentGrantId' };
export type HumanInformationPurposeGrantId = string & { readonly __brand: 'HumanInformationPurposeGrantId' };
export type HumanInformationOfferId = string & { readonly __brand: 'HumanInformationOfferId' };
export type HumanInformationRequestId = string & { readonly __brand: 'HumanInformationRequestId' };
export type HumanInformationTransactionId = string & { readonly __brand: 'HumanInformationTransactionId' };
export type CleanRoomComputationRequestId = string & { readonly __brand: 'CleanRoomComputationRequestId' };
export type CleanRoomComputationResultId = string & { readonly __brand: 'CleanRoomComputationResultId' };
export type HumanInformationUsageReceiptId = string & { readonly __brand: 'HumanInformationUsageReceiptId' };
export type HumanInformationCompensationInstructionId = string & {
  readonly __brand: 'HumanInformationCompensationInstructionId';
};
export type HumanInformationRevocationId = string & { readonly __brand: 'HumanInformationRevocationId' };
export type HumanInformationRightsAuditId = string & { readonly __brand: 'HumanInformationRightsAuditId' };
export type HumanInformationIncidentId = string & { readonly __brand: 'HumanInformationIncidentId' };
export type InformationConnectorId = string & { readonly __brand: 'InformationConnectorId' };
export type ApprovedComputationId = string & { readonly __brand: 'ApprovedComputationId' };

function mint(prefix: string): string {
  return `${prefix}${randomUUID().replace(/-/g, '').slice(0, 20)}`;
}

export const newSubjectId = (): HumanInformationSubjectId => mint(NETWORK_ID_PREFIXES.subject) as HumanInformationSubjectId;
export const newDescriptorId = (): HumanInformationAssetDescriptorId =>
  mint(NETWORK_ID_PREFIXES.descriptor) as HumanInformationAssetDescriptorId;
export const newRightId = (): HumanInformationRightId => mint(NETWORK_ID_PREFIXES.right) as HumanInformationRightId;
export const newPermissionId = (): HumanInformationPermissionId =>
  mint(NETWORK_ID_PREFIXES.permission) as HumanInformationPermissionId;
export const newConsentGrantId = (): HumanInformationConsentGrantId =>
  mint(NETWORK_ID_PREFIXES.consent) as HumanInformationConsentGrantId;
export const newPurposeGrantId = (): HumanInformationPurposeGrantId =>
  mint(NETWORK_ID_PREFIXES.purpose) as HumanInformationPurposeGrantId;
export const newOfferId = (): HumanInformationOfferId => mint(NETWORK_ID_PREFIXES.offer) as HumanInformationOfferId;
export const newRequestId = (): HumanInformationRequestId => mint(NETWORK_ID_PREFIXES.request) as HumanInformationRequestId;
export const newTransactionId = (): HumanInformationTransactionId =>
  mint(NETWORK_ID_PREFIXES.transaction) as HumanInformationTransactionId;
export const newComputationRequestId = (): CleanRoomComputationRequestId =>
  mint(NETWORK_ID_PREFIXES.computation) as CleanRoomComputationRequestId;
export const newComputationResultId = (): CleanRoomComputationResultId =>
  mint(NETWORK_ID_PREFIXES.result) as CleanRoomComputationResultId;
export const newUsageReceiptId = (): HumanInformationUsageReceiptId =>
  mint(NETWORK_ID_PREFIXES.receipt) as HumanInformationUsageReceiptId;
export const newCompensationInstructionId = (): HumanInformationCompensationInstructionId =>
  mint(NETWORK_ID_PREFIXES.compensation) as HumanInformationCompensationInstructionId;
export const newRevocationId = (): HumanInformationRevocationId =>
  mint(NETWORK_ID_PREFIXES.revocation) as HumanInformationRevocationId;
export const newAuditId = (): HumanInformationRightsAuditId => mint(NETWORK_ID_PREFIXES.audit) as HumanInformationRightsAuditId;
export const newIncidentId = (): HumanInformationIncidentId =>
  mint(NETWORK_ID_PREFIXES.incident) as HumanInformationIncidentId;
export const newConnectorId = (): InformationConnectorId =>
  mint(NETWORK_ID_PREFIXES.connector) as InformationConnectorId;
export const newApprovedComputationId = (): ApprovedComputationId =>
  mint('hicode_') as ApprovedComputationId;
