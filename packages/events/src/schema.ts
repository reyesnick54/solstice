import type { DurableEventEnvelope } from './envelope.ts';
import { EVENT_TYPE_NAMES, type ImplementedEventTypeName } from './taxonomy.ts';

export type SchemaCompatibility = 'CURRENT' | 'DEPRECATED' | 'UPCAST' | 'UNSUPPORTED';

export type EventSchemaRecord = {
  readonly eventType: string;
  readonly version: number;
  readonly status: 'current' | 'deprecated' | 'unsupported';
  readonly upcastFrom?: number;
};

const REGISTRY: readonly EventSchemaRecord[] = [
  { eventType: 'AccountOpened', version: 1, status: 'current' },
  { eventType: 'DepositPosted', version: 1, status: 'current' },
  { eventType: 'WithdrawalPosted', version: 1, status: 'current' },
  { eventType: 'InternalTransferPosted', version: 1, status: 'current' },
  { eventType: 'CustomerStatusChanged', version: 1, status: 'current' },
  { eventType: 'KernelDecisionRecorded', version: 1, status: 'current' },
  { eventType: 'PolicyPackActivated', version: 1, status: 'current' },
  { eventType: 'PolicyPackRetired', version: 1, status: 'current' },
  { eventType: 'PolicyReviewRequested', version: 1, status: 'current' },
  { eventType: 'PolicyReviewDecided', version: 1, status: 'current' },
  { eventType: 'KeyCreated', version: 1, status: 'current' },
  { eventType: 'KeyRotated', version: 1, status: 'current' },
  { eventType: 'KeyRetired', version: 1, status: 'current' },
  { eventType: 'KeyRevoked', version: 1, status: 'current' },
  { eventType: 'IdentityCreated', version: 1, status: 'current' },
  { eventType: 'IdentityActivated', version: 1, status: 'current' },
  { eventType: 'IdentitySuspended', version: 1, status: 'current' },
  { eventType: 'IdentityKycUpdated', version: 1, status: 'current' },
  { eventType: 'IdentitySessionCreated', version: 1, status: 'current' },
  { eventType: 'IdentitySessionRevoked', version: 1, status: 'current' },
  { eventType: 'IdentityDeviceRegistered', version: 1, status: 'current' },
  { eventType: 'IdentityDeviceTrustChanged', version: 1, status: 'current' },
  { eventType: 'IdentityRecoveryRequested', version: 1, status: 'current' },
  { eventType: 'BeneficiaryCreated', version: 1, status: 'current' },
  { eventType: 'PaymentInitiated', version: 1, status: 'current' },
  { eventType: 'PaymentHeld', version: 1, status: 'current' },
  { eventType: 'PaymentSubmitted', version: 1, status: 'current' },
  { eventType: 'PaymentSettled', version: 1, status: 'current' },
  { eventType: 'PaymentFailed', version: 1, status: 'current' },
  { eventType: 'PaymentReturned', version: 1, status: 'current' },
  { eventType: 'PaymentCancelled', version: 1, status: 'current' },
  { eventType: 'FxQuoteCreated', version: 1, status: 'current' },
  { eventType: 'FxQuoteAccepted', version: 1, status: 'current' },
  { eventType: 'FxQuoteExpired', version: 1, status: 'current' },
  { eventType: 'HoldCreated', version: 1, status: 'current' },
  { eventType: 'HoldReleased', version: 1, status: 'current' },
  { eventType: 'HoldCaptured', version: 1, status: 'current' },
  { eventType: 'HoldCancelled', version: 1, status: 'current' },
  { eventType: 'StatementGenerated', version: 1, status: 'current' },
  { eventType: 'ReconciliationMismatch', version: 1, status: 'current' },
  { eventType: 'AccountPositionChanged', version: 1, status: 'current' },
  { eventType: 'FeePosted', version: 1, status: 'current' },
  { eventType: 'InterestPosted', version: 1, status: 'current' },
  { eventType: 'ReversalPosted', version: 1, status: 'current' },
  { eventType: 'PendingSettlementInitiated', version: 1, status: 'current' },
  { eventType: 'PendingSettlementSettled', version: 1, status: 'current' },
  { eventType: 'PendingSettlementReturned', version: 1, status: 'current' },
  { eventType: 'ComplianceScreeningCompleted', version: 1, status: 'current' },
  { eventType: 'ComplianceScreeningReviewRequired', version: 1, status: 'current' },
  { eventType: 'ComplianceCaseOpened', version: 1, status: 'current' },
  { eventType: 'ComplianceCaseDecided', version: 1, status: 'current' },
  { eventType: 'ComplianceAlertCreated', version: 1, status: 'current' },
  { eventType: 'FraudRiskEvaluated', version: 1, status: 'current' },
  { eventType: 'RailSubmissionCreated', version: 1, status: 'current' },
  { eventType: 'RailSubmissionAccepted', version: 1, status: 'current' },
  { eventType: 'RailSubmissionUnknown', version: 1, status: 'current' },
  { eventType: 'RailPaymentProcessing', version: 1, status: 'current' },
  { eventType: 'RailPaymentSettled', version: 1, status: 'current' },
  { eventType: 'RailPaymentRejected', version: 1, status: 'current' },
  { eventType: 'RailPaymentReturned', version: 1, status: 'current' },
  { eventType: 'RailProviderDegraded', version: 1, status: 'current' },
  { eventType: 'RailReconciliationMismatch', version: 1, status: 'current' },
  { eventType: 'CardCreated', version: 1, status: 'current' },
  { eventType: 'CardActivated', version: 1, status: 'current' },
  { eventType: 'CardFrozen', version: 1, status: 'current' },
  { eventType: 'CardUnfrozen', version: 1, status: 'current' },
  { eventType: 'CardClosed', version: 1, status: 'current' },
  { eventType: 'CardAuthorizationApproved', version: 1, status: 'current' },
  { eventType: 'CardAuthorizationDeclined', version: 1, status: 'current' },
  { eventType: 'CardAuthorizationReversed', version: 1, status: 'current' },
  { eventType: 'CardClearingReceived', version: 1, status: 'current' },
  { eventType: 'CardTransactionSettled', version: 1, status: 'current' },
  { eventType: 'CardRefundReceived', version: 1, status: 'current' },
  { eventType: 'CardDisputeOpened', version: 1, status: 'current' },
  { eventType: 'CardDisputeDecided', version: 1, status: 'current' },
  { eventType: 'EconomicGraphNodeCreated', version: 1, status: 'current' },
  { eventType: 'EconomicGraphFactUpdated', version: 1, status: 'current' },
  { eventType: 'EconomicGraphRelationshipCreated', version: 1, status: 'current' },
  { eventType: 'EconomicGraphSnapshotCreated', version: 1, status: 'current' },
  { eventType: 'EconomicGraphOpportunityCreated', version: 1, status: 'current' },
  { eventType: 'WalletProvisioningRequested', version: 1, status: 'current' },
  { eventType: 'WalletProvisioningStepUpRequired', version: 1, status: 'current' },
  { eventType: 'WalletTokenActivated', version: 1, status: 'current' },
  { eventType: 'WalletTokenSuspended', version: 1, status: 'current' },
  { eventType: 'WalletTokenDeleted', version: 1, status: 'current' },
  { eventType: 'AcceptanceDeviceRegistered', version: 1, status: 'current' },
  { eventType: 'AcceptanceSessionCreated', version: 1, status: 'current' },
  { eventType: 'AcceptancePaymentApproved', version: 1, status: 'current' },
  { eventType: 'AcceptancePaymentDeclined', version: 1, status: 'current' },
  { eventType: 'AcceptancePaymentSettled', version: 1, status: 'current' },
  { eventType: 'AcceptanceReconciliationMismatch', version: 1, status: 'current' },
  { eventType: 'MandateDraftCreated', version: 1, status: 'current' },
  { eventType: 'MandateConfirmed', version: 1, status: 'current' },
  { eventType: 'MandateActivated', version: 1, status: 'current' },
  { eventType: 'MandatePaused', version: 1, status: 'current' },
  { eventType: 'MandateRevoked', version: 1, status: 'current' },
  { eventType: 'GrowthCycleStarted', version: 1, status: 'current' },
  { eventType: 'GrowthPlanCreated', version: 1, status: 'current' },
  { eventType: 'GrowthPlanStale', version: 1, status: 'current' },
  { eventType: 'GrowthActionProposed', version: 1, status: 'current' },

];

export class UnsupportedEventVersionError extends Error {
  readonly eventType: string;
  readonly eventVersion: number;
  readonly reasonCode = 'UNSUPPORTED_EVENT_VERSION';

  constructor(eventType: string, eventVersion: number) {
    super(`unsupported event version ${eventType}/${eventVersion}`);
    this.name = 'UnsupportedEventVersionError';
    this.eventType = eventType;
    this.eventVersion = eventVersion;
  }
}

export function listEventSchemas(): readonly EventSchemaRecord[] {
  return REGISTRY;
}

export function resolveEventSchema(eventType: string, version: number): SchemaCompatibility {
  const match = REGISTRY.find((row) => row.eventType === eventType && row.version === version);
  if (match?.status === 'current') {
    return 'CURRENT';
  }
  if (match?.status === 'deprecated') {
    return 'DEPRECATED';
  }
  const upcast = REGISTRY.find(
    (row) => row.eventType === eventType && row.upcastFrom === version && row.status === 'current',
  );
  if (upcast) {
    return 'UPCAST';
  }
  return 'UNSUPPORTED';
}

export function assertSupportedEventVersion(envelope: DurableEventEnvelope): void {
  const compatibility = resolveEventSchema(envelope.eventType, envelope.eventVersion);
  if (compatibility === 'UNSUPPORTED') {
    throw new UnsupportedEventVersionError(envelope.eventType, envelope.eventVersion);
  }
}

/**
 * Compatibility strategy:
 * - new optional field: same version, consumers ignore unknown keys
 * - breaking change: new event version, register it here
 * - deprecated version: keep readable, mark deprecated
 * - upcast: transform an older version into the current shape
 * - unsupported: fail safely, no business effect
 */
export function upcastEnvelope(envelope: DurableEventEnvelope): DurableEventEnvelope {
  const compatibility = resolveEventSchema(envelope.eventType, envelope.eventVersion);
  if (compatibility === 'UNSUPPORTED') {
    throw new UnsupportedEventVersionError(envelope.eventType, envelope.eventVersion);
  }
  return envelope;
}

export function isImplementedEventType(eventType: string): eventType is ImplementedEventTypeName {
  return (EVENT_TYPE_NAMES as readonly string[]).includes(eventType);
}
