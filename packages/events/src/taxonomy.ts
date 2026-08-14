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
  'payment',
  'fx',
  'banking',
  'compliance',
  'fraud',

] as const;

export const RESERVED_EVENT_NAMESPACES = [
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
  'BeneficiaryCreated',
  'PaymentInitiated',
  'PaymentHeld',
  'PaymentSubmitted',
  'PaymentSettled',
  'PaymentFailed',
  'PaymentReturned',
  'PaymentCancelled',
  'FxQuoteCreated',
  'FxQuoteAccepted',
  'FxQuoteExpired',
  'HoldCreated',
  'HoldReleased',
  'HoldCaptured',
  'HoldCancelled',
  'StatementGenerated',
  'ReconciliationMismatch',
  'AccountPositionChanged',
  'FeePosted',
  'InterestPosted',
  'ReversalPosted',
  'PendingSettlementInitiated',
  'PendingSettlementSettled',
  'PendingSettlementReturned',
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
  BeneficiaryCreated: 'solstice.payment.beneficiary.created/1',
  PaymentInitiated: 'solstice.payment.initiated/1',
  PaymentHeld: 'solstice.payment.held/1',
  PaymentSubmitted: 'solstice.payment.submitted/1',
  PaymentSettled: 'solstice.payment.settled/1',
  PaymentFailed: 'solstice.payment.failed/1',
  PaymentReturned: 'solstice.payment.returned/1',
  PaymentCancelled: 'solstice.payment.cancelled/1',
  FxQuoteCreated: 'solstice.fx.quote.created/1',
  FxQuoteAccepted: 'solstice.fx.quote.accepted/1',
  FxQuoteExpired: 'solstice.fx.quote.expired/1',
  HoldCreated: 'solstice.banking.hold.created/1',
  HoldReleased: 'solstice.banking.hold.released/1',
  HoldCaptured: 'solstice.banking.hold.captured/1',
  HoldCancelled: 'solstice.banking.hold.cancelled/1',
  StatementGenerated: 'solstice.banking.statement.generated/1',
  ReconciliationMismatch: 'solstice.banking.reconciliation.mismatch/1',
  AccountPositionChanged: 'solstice.account.position.changed/1',
  FeePosted: 'solstice.banking.fee.posted/1',
  InterestPosted: 'solstice.banking.interest.posted/1',
  ReversalPosted: 'solstice.banking.reversal.posted/1',
  PendingSettlementInitiated: 'solstice.banking.pending.initiated/1',
  PendingSettlementSettled: 'solstice.banking.pending.settled/1',
  PendingSettlementReturned: 'solstice.banking.pending.returned/1',
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
  BeneficiaryCreated: 'payment',
  PaymentInitiated: 'payment',
  PaymentHeld: 'payment',
  PaymentSubmitted: 'payment',
  PaymentSettled: 'payment',
  PaymentFailed: 'payment',
  PaymentReturned: 'payment',
  PaymentCancelled: 'payment',
  FxQuoteCreated: 'fx',
  FxQuoteAccepted: 'fx',
  FxQuoteExpired: 'fx',
  HoldCreated: 'banking',
  HoldReleased: 'banking',
  HoldCaptured: 'banking',
  HoldCancelled: 'banking',
  StatementGenerated: 'banking',
  ReconciliationMismatch: 'banking',
  AccountPositionChanged: 'account',
  FeePosted: 'banking',
  InterestPosted: 'banking',
  ReversalPosted: 'banking',
  PendingSettlementInitiated: 'banking',
  PendingSettlementSettled: 'banking',
  PendingSettlementReturned: 'banking',
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
