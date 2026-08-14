/**
 * Canonical event namespace / taxonomy.
 *
 * Implemented namespaces match functionality that exists on this tree.
 * Reserved namespaces are documented only — they do not invent product
 * behavior.
 */

export const IMPLEMENTED_EVENT_NAMESPACES = [
  'customer',
  'account',
  'ledger',
  'kernel',
  'evidence',
  'policy',
  'security',
  'identity',
  'compliance',
  'fraud',
] as const;

export const RESERVED_EVENT_NAMESPACES = [
  'payment',
  'fx',
  'card',
  'investment',
  'agent',
  'consent',
  'data',
  'pyr',
  'exchange',
  'regulatory',
  'notification',
  'analytics',
] as const;

export type ImplementedEventNamespace = (typeof IMPLEMENTED_EVENT_NAMESPACES)[number];
export type ReservedEventNamespace = (typeof RESERVED_EVENT_NAMESPACES)[number];

export const EVENT_TYPE_NAMES = [
  'AccountOpened',
  'DepositPosted',
  'WithdrawalPosted',
  'InternalTransferPosted',
  'CustomerStatusChanged',
  'KernelDecisionRecorded',
  'PolicyPackActivated',
  'PolicyPackRetired',
  'PolicyReviewRequested',
  'PolicyReviewDecided',
  'KeyCreated',
  'KeyRotated',
  'KeyRetired',
  'KeyRevoked',
  'IdentityCreated',
  'IdentityActivated',
  'IdentitySuspended',
  'IdentityKycUpdated',
  'IdentitySessionCreated',
  'IdentitySessionRevoked',
  'IdentityDeviceRegistered',
  'IdentityRecoveryRequested',
  'ComplianceScreeningCompleted',
  'ComplianceScreeningReviewRequired',
  'ComplianceCaseOpened',
  'ComplianceCaseDecided',
  'ComplianceAlertCreated',
  'FraudRiskEvaluated',
] as const;

export type ImplementedEventTypeName = (typeof EVENT_TYPE_NAMES)[number];

export const EVENT_SCHEMA_REFS = {
  AccountOpened: 'solstice.account.opened/1',
  DepositPosted: 'solstice.ledger.deposit_posted/1',
  WithdrawalPosted: 'solstice.ledger.withdrawal_posted/1',
  InternalTransferPosted: 'solstice.ledger.internal_transfer_posted/1',
  CustomerStatusChanged: 'solstice.customer.status_changed/1',
  KernelDecisionRecorded: 'solstice.kernel.decision_recorded/1',
  PolicyPackActivated: 'solstice.policy.pack_activated/1',
  PolicyPackRetired: 'solstice.policy.pack_retired/1',
  PolicyReviewRequested: 'solstice.policy.review_requested/1',
  PolicyReviewDecided: 'solstice.policy.review_decided/1',
  KeyCreated: 'solstice.security.key_created/1',
  KeyRotated: 'solstice.security.key_rotated/1',
  KeyRetired: 'solstice.security.key_retired/1',
  KeyRevoked: 'solstice.security.key_revoked/1',
  IdentityCreated: 'solstice.identity.created/1',
  IdentityActivated: 'solstice.identity.activated/1',
  IdentitySuspended: 'solstice.identity.suspended/1',
  IdentityKycUpdated: 'solstice.identity.kyc.updated/1',
  IdentitySessionCreated: 'solstice.identity.session.created/1',
  IdentitySessionRevoked: 'solstice.identity.session.revoked/1',
  IdentityDeviceRegistered: 'solstice.identity.device.registered/1',
  IdentityRecoveryRequested: 'solstice.identity.recovery.requested/1',
  ComplianceScreeningCompleted: 'solstice.compliance.screening.completed/1',
  ComplianceScreeningReviewRequired: 'solstice.compliance.screening.review_required/1',
  ComplianceCaseOpened: 'solstice.compliance.case.opened/1',
  ComplianceCaseDecided: 'solstice.compliance.case.decided/1',
  ComplianceAlertCreated: 'solstice.compliance.alert.created/1',
  FraudRiskEvaluated: 'solstice.fraud.risk.evaluated/1',
} as const;

export const EVENT_NAMESPACES_BY_TYPE: {
  readonly [K in ImplementedEventTypeName]: ImplementedEventNamespace;
} = {
  AccountOpened: 'account',
  DepositPosted: 'ledger',
  WithdrawalPosted: 'ledger',
  InternalTransferPosted: 'ledger',
  CustomerStatusChanged: 'customer',
  KernelDecisionRecorded: 'kernel',
  PolicyPackActivated: 'policy',
  PolicyPackRetired: 'policy',
  PolicyReviewRequested: 'policy',
  PolicyReviewDecided: 'policy',
  KeyCreated: 'security',
  KeyRotated: 'security',
  KeyRetired: 'security',
  KeyRevoked: 'security',
  IdentityCreated: 'identity',
  IdentityActivated: 'identity',
  IdentitySuspended: 'identity',
  IdentityKycUpdated: 'identity',
  IdentitySessionCreated: 'identity',
  IdentitySessionRevoked: 'identity',
  IdentityDeviceRegistered: 'identity',
  IdentityRecoveryRequested: 'identity',
  ComplianceScreeningCompleted: 'compliance',
  ComplianceScreeningReviewRequired: 'compliance',
  ComplianceCaseOpened: 'compliance',
  ComplianceCaseDecided: 'compliance',
  ComplianceAlertCreated: 'compliance',
  FraudRiskEvaluated: 'fraud',
};

export function schemaRefFor(eventType: string, version: number): string {
  const known = EVENT_SCHEMA_REFS[eventType as ImplementedEventTypeName];
  if (known && version === 1) {
    return known;
  }
  const ns = EVENT_NAMESPACES_BY_TYPE[eventType as ImplementedEventTypeName] ?? 'unknown';
  return `solstice.${ns}.${camelToSnake(eventType)}/${version}`;
}

function camelToSnake(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
    .toLowerCase();
}
