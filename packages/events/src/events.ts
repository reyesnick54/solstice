import type { AccountClass } from '../../domain/src/account-class.ts';
import type { AccountId } from '../../domain/src/account.ts';
import type { CustomerId, CustomerStatus } from '../../domain/src/customer.ts';
import type { UtcInstant } from '../../domain/src/time.ts';

import {
  sealEnvelope,
  type DurableEventEnvelope,
  type EnvelopeHints,
  type EventId,
} from './envelope.ts';

/**
 * Versioned domain events. schemaVersion is incremented when the payload
 * shape changes; readers must switch on both eventType and schemaVersion.
 *
 * Durable delivery adds the canonical envelope (eventId, correlation,
 * aggregate sequence, schemaRef). Those fields are sealed by
 * DomainEventLog.append — this is an extension of VersionedEvent, not a
 * second event model.
 */
export type VersionedEvent<T extends string, V extends number, P> = {
  readonly eventType: T;
  readonly schemaVersion: V;
  readonly occurredAt: UtcInstant;
  readonly payload: P;
} & EnvelopeHints;

export type AccountOpenedV1 = VersionedEvent<
  'AccountOpened',
  1,
  {
    readonly accountId: AccountId;
    readonly ownerId: CustomerId;
    readonly accountClass: AccountClass;
    readonly executionAuthorityId: string;
    readonly intentId: string;
  }
>;

export type DepositPostedV1 = VersionedEvent<
  'DepositPosted',
  1,
  {
    readonly journalId: string;
    readonly accountId: AccountId;
    readonly amountMinorUnits: string;
    readonly currency: string;
  }
>;

export type WithdrawalPostedV1 = VersionedEvent<
  'WithdrawalPosted',
  1,
  {
    readonly journalId: string;
    readonly accountId: AccountId;
    readonly amountMinorUnits: string;
    readonly currency: string;
  }
>;

export type InternalTransferPostedV1 = VersionedEvent<
  'InternalTransferPosted',
  1,
  {
    readonly journalId: string;
    readonly sourceAccountId: AccountId;
    readonly destinationAccountId: AccountId;
    readonly amountMinorUnits: string;
    readonly currency: string;
    readonly classBridgeName: string | null;
  }
>;

export type CustomerStatusChangedV1 = VersionedEvent<
  'CustomerStatusChanged',
  1,
  {
    readonly customerId: CustomerId;
    readonly fromStatus: CustomerStatus;
    readonly toStatus: CustomerStatus;
    readonly customerVersion: number;
  }
>;

export type KernelDecisionRecordedV1 = VersionedEvent<
  'KernelDecisionRecorded',
  1,
  {
    readonly intentId: string;
    readonly actionType: string;
    readonly status: string;
    readonly evidenceRecordId: string;
    readonly executionAuthorityId: string | null;
  }
>;

export type PolicyPackActivatedV1 = VersionedEvent<
  'PolicyPackActivated',
  1,
  {
    readonly packId: string;
    readonly versionId: string;
    readonly packHash: string;
    readonly lifecycle: string;
  }
>;

export type PolicyPackRetiredV1 = VersionedEvent<
  'PolicyPackRetired',
  1,
  {
    readonly packId: string;
    readonly versionId: string;
    readonly packHash: string;
    readonly lifecycle: string;
  }
>;

export type PolicyReviewRequestedV1 = VersionedEvent<
  'PolicyReviewRequested',
  1,
  {
    readonly reviewId: string;
    readonly decision: string;
    readonly packId: string | null;
    readonly versionId: string | null;
    readonly factsHash: string;
  }
>;

export type PolicyReviewDecidedV1 = VersionedEvent<
  'PolicyReviewDecided',
  1,
  {
    readonly reviewId: string;
    readonly status: string;
    readonly decidedByKind: string;
    readonly packId: string | null;
    readonly factsHash: string;
  }
>;
export type SecurityKeyAuditPayload = {
  readonly keyId: string;
  readonly purpose: string;
  readonly version: number;
  readonly previousVersion: number | null;
  readonly status: string;
  readonly provider: string;
  readonly providerRef: string;
};

export type KeyCreatedV1 = VersionedEvent<'KeyCreated', 1, SecurityKeyAuditPayload>;
export type KeyRotatedV1 = VersionedEvent<'KeyRotated', 1, SecurityKeyAuditPayload>;
export type KeyRetiredV1 = VersionedEvent<'KeyRetired', 1, SecurityKeyAuditPayload>;
export type KeyRevokedV1 = VersionedEvent<'KeyRevoked', 1, SecurityKeyAuditPayload>;

export type IdentityAuditPayload = {
  readonly identityId: string;
  readonly sessionId?: string;
  readonly deviceId?: string;
  readonly kycRecordId?: string;
  readonly recoveryRequestId?: string;
  readonly verificationState?: string;
  readonly version?: number;
  readonly status?: string;
  readonly kind?: string;
  readonly reason?: string;
};

export type IdentityCreatedV1 = VersionedEvent<'IdentityCreated', 1, IdentityAuditPayload>;
export type IdentityActivatedV1 = VersionedEvent<'IdentityActivated', 1, IdentityAuditPayload>;
export type IdentitySuspendedV1 = VersionedEvent<'IdentitySuspended', 1, IdentityAuditPayload>;
export type IdentityKycUpdatedV1 = VersionedEvent<'IdentityKycUpdated', 1, IdentityAuditPayload>;
export type IdentitySessionCreatedV1 = VersionedEvent<'IdentitySessionCreated', 1, IdentityAuditPayload>;
export type IdentitySessionRevokedV1 = VersionedEvent<'IdentitySessionRevoked', 1, IdentityAuditPayload>;
export type IdentityDeviceRegisteredV1 = VersionedEvent<'IdentityDeviceRegistered', 1, IdentityAuditPayload>;
export type IdentityRecoveryRequestedV1 = VersionedEvent<'IdentityRecoveryRequested', 1, IdentityAuditPayload>;

export type BeneficiaryCreatedV1 = VersionedEvent<
  'BeneficiaryCreated',
  1,
  {
    readonly beneficiaryId: string;
    readonly ownerId: string;
    readonly destinationCountry: string;
    readonly currency: string;
    readonly status: string;
    readonly screeningRef: string | null;
    readonly coordinateHint: string;
  }
>;

export type PaymentInitiatedV1 = VersionedEvent<
  'PaymentInitiated',
  1,
  {
    readonly paymentId: string;
    readonly quoteId: string;
    readonly beneficiaryId: string;
    readonly sourceMinorUnits: string;
    readonly destinationMinorUnits: string;
  }
>;

export type PaymentHeldV1 = VersionedEvent<
  'PaymentHeld',
  1,
  {
    readonly paymentId: string;
    readonly reason?: string;
    readonly holdId?: string | null;
    readonly phase?: string;
  }
>;

export type PaymentSubmittedV1 = VersionedEvent<
  'PaymentSubmitted',
  1,
  {
    readonly paymentId: string;
    readonly routeId: string;
  }
>;

export type PaymentSettledV1 = VersionedEvent<
  'PaymentSettled',
  1,
  {
    readonly paymentId: string;
    readonly settlementRef: string | null;
    readonly destinationMinorUnits: string;
    readonly reconciliation: string;
  }
>;

export type PaymentFailedV1 = VersionedEvent<
  'PaymentFailed',
  1,
  {
    readonly paymentId: string;
    readonly reason: string;
    readonly phase?: string;
  }
>;

export type PaymentReturnedV1 = VersionedEvent<
  'PaymentReturned',
  1,
  {
    readonly paymentId: string;
    readonly policy: string;
  }
>;

export type PaymentCancelledV1 = VersionedEvent<
  'PaymentCancelled',
  1,
  {
    readonly paymentId: string;
  }
>;

export type FxQuoteCreatedV1 = VersionedEvent<
  'FxQuoteCreated',
  1,
  {
    readonly quoteId: string;
    readonly baseCurrency: string;
    readonly quoteCurrency: string;
    readonly sourceMinorUnits: string;
    readonly destinationMinorUnits: string;
    readonly feeMinorUnits: string;
    readonly customerRate: string;
    readonly rateSource: string;
    readonly expiresAt: string;
  }
>;

export type FxQuoteAcceptedV1 = VersionedEvent<
  'FxQuoteAccepted',
  1,
  {
    readonly quoteId: string;
    readonly customerRate: string;
  }
>;

export type FxQuoteExpiredV1 = VersionedEvent<
  'FxQuoteExpired',
  1,
  {
    readonly quoteId: string;
    readonly expiresAt: string;
  }
>;
export type BankingAmountPayload = {
  readonly accountId: AccountId;
  readonly amountMinorUnits: string;
  readonly currency: string;
  readonly holdId?: string;
  readonly journalId?: string;
  readonly statementId?: string;
  readonly reconciliationId?: string;
  readonly feeId?: string;
  readonly reversalId?: string;
  readonly pendingId?: string;
};

export type HoldCreatedV1 = VersionedEvent<'HoldCreated', 1, BankingAmountPayload>;
export type HoldReleasedV1 = VersionedEvent<'HoldReleased', 1, BankingAmountPayload>;
export type HoldCapturedV1 = VersionedEvent<'HoldCaptured', 1, BankingAmountPayload>;
export type HoldCancelledV1 = VersionedEvent<'HoldCancelled', 1, BankingAmountPayload>;
export type StatementGeneratedV1 = VersionedEvent<'StatementGenerated', 1, BankingAmountPayload>;
export type ReconciliationMismatchV1 = VersionedEvent<'ReconciliationMismatch', 1, BankingAmountPayload>;
export type AccountPositionChangedV1 = VersionedEvent<'AccountPositionChanged', 1, BankingAmountPayload>;
export type FeePostedV1 = VersionedEvent<'FeePosted', 1, BankingAmountPayload>;
export type InterestPostedV1 = VersionedEvent<'InterestPosted', 1, BankingAmountPayload>;
export type ReversalPostedV1 = VersionedEvent<'ReversalPosted', 1, BankingAmountPayload>;
export type PendingSettlementInitiatedV1 = VersionedEvent<'PendingSettlementInitiated', 1, BankingAmountPayload>;
export type PendingSettlementSettledV1 = VersionedEvent<'PendingSettlementSettled', 1, BankingAmountPayload>;
export type PendingSettlementReturnedV1 = VersionedEvent<'PendingSettlementReturned', 1, BankingAmountPayload>;
export type ComplianceAuditPayload = {
  readonly screeningId?: string;
  readonly caseId?: string;
  readonly alertId?: string;
  readonly evaluationId?: string;
  readonly screeningType?: string;
  readonly caseType?: string;
  readonly outcome?: string;
  readonly decision?: string;
  readonly reasonCodes?: readonly string[];
  readonly subjectRef?: string;
  readonly providerRef?: string;
  readonly providerHash?: string;
  readonly policyVersionId?: string;
  readonly jurisdiction?: string;
};

export type ComplianceScreeningCompletedV1 = VersionedEvent<
  'ComplianceScreeningCompleted',
  1,
  ComplianceAuditPayload
>;
export type ComplianceScreeningReviewRequiredV1 = VersionedEvent<
  'ComplianceScreeningReviewRequired',
  1,
  ComplianceAuditPayload
>;
export type ComplianceCaseOpenedV1 = VersionedEvent<'ComplianceCaseOpened', 1, ComplianceAuditPayload>;
export type ComplianceCaseDecidedV1 = VersionedEvent<'ComplianceCaseDecided', 1, ComplianceAuditPayload>;
export type ComplianceAlertCreatedV1 = VersionedEvent<'ComplianceAlertCreated', 1, ComplianceAuditPayload>;
export type FraudRiskEvaluatedV1 = VersionedEvent<'FraudRiskEvaluated', 1, ComplianceAuditPayload>;

export type CardAuditPayload = {
  readonly cardId?: string;
  readonly customerId?: string;
  readonly programId?: string;
  readonly processorCardRef?: string;
  readonly formFactor?: string;
  readonly status?: string;
  readonly authorizationId?: string;
  readonly holdId?: string | null;
  readonly amountMinorUnits?: string;
  readonly currency?: string;
  readonly reasonCode?: string;
  readonly externalReason?: string;
  readonly clearingId?: string;
  readonly scenario?: string;
  readonly journalId?: string;
  readonly settlementId?: string | null;
  readonly reconciliation?: string;
  readonly refundId?: string;
  readonly disputeId?: string;
  readonly transactionRef?: string;
  readonly outcome?: string;
};

export type CardCreatedV1 = VersionedEvent<'CardCreated', 1, CardAuditPayload>;
export type CardActivatedV1 = VersionedEvent<'CardActivated', 1, CardAuditPayload>;
export type CardFrozenV1 = VersionedEvent<'CardFrozen', 1, CardAuditPayload>;
export type CardUnfrozenV1 = VersionedEvent<'CardUnfrozen', 1, CardAuditPayload>;
export type CardClosedV1 = VersionedEvent<'CardClosed', 1, CardAuditPayload>;
export type CardAuthorizationApprovedV1 = VersionedEvent<'CardAuthorizationApproved', 1, CardAuditPayload>;
export type CardAuthorizationDeclinedV1 = VersionedEvent<'CardAuthorizationDeclined', 1, CardAuditPayload>;
export type CardAuthorizationReversedV1 = VersionedEvent<'CardAuthorizationReversed', 1, CardAuditPayload>;
export type CardClearingReceivedV1 = VersionedEvent<'CardClearingReceived', 1, CardAuditPayload>;
export type CardTransactionSettledV1 = VersionedEvent<'CardTransactionSettled', 1, CardAuditPayload>;
export type CardRefundReceivedV1 = VersionedEvent<'CardRefundReceived', 1, CardAuditPayload>;
export type CardDisputeOpenedV1 = VersionedEvent<'CardDisputeOpened', 1, CardAuditPayload>;
export type CardDisputeDecidedV1 = VersionedEvent<'CardDisputeDecided', 1, CardAuditPayload>;

export type EconomicGraphAuditPayload = {
  readonly graphId?: string;
  readonly nodeId?: string;
  readonly kind?: string;
  readonly from?: string;
  readonly to?: string;
  readonly key?: string;
  readonly snapshotId?: string;
  readonly opportunityId?: string;
  readonly executable?: boolean;
};

export type EconomicGraphNodeCreatedV1 = VersionedEvent<
  'EconomicGraphNodeCreated',
  1,
  EconomicGraphAuditPayload
>;
export type EconomicGraphFactUpdatedV1 = VersionedEvent<
  'EconomicGraphFactUpdated',
  1,
  EconomicGraphAuditPayload
>;
export type EconomicGraphRelationshipCreatedV1 = VersionedEvent<
  'EconomicGraphRelationshipCreated',
  1,
  EconomicGraphAuditPayload
>;
export type EconomicGraphSnapshotCreatedV1 = VersionedEvent<
  'EconomicGraphSnapshotCreated',
  1,
  EconomicGraphAuditPayload
>;
export type EconomicGraphOpportunityCreatedV1 = VersionedEvent<
  'EconomicGraphOpportunityCreated',
  1,
  EconomicGraphAuditPayload
>;

export type RailAuditPayload = {
  readonly paymentId?: string;
  readonly railSubmissionId?: string;
  readonly inboundId?: string;
  readonly provider?: string;
  readonly rail?: string;
  readonly settlementRef?: string | null;
  readonly status?: string;
  readonly rejectionClass?: string;
  readonly reconciliation?: string;
  readonly mismatches?: readonly string[];
  readonly direction?: string;
  readonly policy?: string;
};

export type RailSubmissionCreatedV1 = VersionedEvent<'RailSubmissionCreated', 1, RailAuditPayload>;
export type RailSubmissionAcceptedV1 = VersionedEvent<'RailSubmissionAccepted', 1, RailAuditPayload>;
export type RailSubmissionUnknownV1 = VersionedEvent<'RailSubmissionUnknown', 1, RailAuditPayload>;
export type RailPaymentProcessingV1 = VersionedEvent<'RailPaymentProcessing', 1, RailAuditPayload>;
export type RailPaymentSettledV1 = VersionedEvent<'RailPaymentSettled', 1, RailAuditPayload>;
export type RailPaymentRejectedV1 = VersionedEvent<'RailPaymentRejected', 1, RailAuditPayload>;
export type RailPaymentReturnedV1 = VersionedEvent<'RailPaymentReturned', 1, RailAuditPayload>;
export type RailProviderDegradedV1 = VersionedEvent<'RailProviderDegraded', 1, RailAuditPayload>;
export type RailReconciliationMismatchV1 = VersionedEvent<'RailReconciliationMismatch', 1, RailAuditPayload>;

export type DomainEvent =
  | AccountOpenedV1
  | DepositPostedV1
  | WithdrawalPostedV1
  | InternalTransferPostedV1
  | CustomerStatusChangedV1
  | KernelDecisionRecordedV1
  | PolicyPackActivatedV1
  | PolicyPackRetiredV1
  | PolicyReviewRequestedV1
  | PolicyReviewDecidedV1
  | KeyCreatedV1
  | KeyRotatedV1
  | KeyRetiredV1
  | KeyRevokedV1
  | IdentityCreatedV1
  | IdentityActivatedV1
  | IdentitySuspendedV1
  | IdentityKycUpdatedV1
  | IdentitySessionCreatedV1
  | IdentitySessionRevokedV1
  | IdentityDeviceRegisteredV1
  | IdentityRecoveryRequestedV1
  | BeneficiaryCreatedV1
  | PaymentInitiatedV1
  | PaymentHeldV1
  | PaymentSubmittedV1
  | PaymentSettledV1
  | PaymentFailedV1
  | PaymentReturnedV1
  | PaymentCancelledV1
  | FxQuoteCreatedV1
  | FxQuoteAcceptedV1
  | FxQuoteExpiredV1
  | HoldCreatedV1
  | HoldReleasedV1
  | HoldCapturedV1
  | HoldCancelledV1
  | StatementGeneratedV1
  | ReconciliationMismatchV1
  | AccountPositionChangedV1
  | FeePostedV1
  | InterestPostedV1
  | ReversalPostedV1
  | PendingSettlementInitiatedV1
  | PendingSettlementSettledV1
  | PendingSettlementReturnedV1
  | ComplianceScreeningCompletedV1
  | ComplianceScreeningReviewRequiredV1
  | ComplianceCaseOpenedV1
  | ComplianceCaseDecidedV1
  | ComplianceAlertCreatedV1
  | FraudRiskEvaluatedV1
  | RailSubmissionCreatedV1
  | RailSubmissionAcceptedV1
  | RailSubmissionUnknownV1
  | RailPaymentProcessingV1
  | RailPaymentSettledV1
  | RailPaymentRejectedV1
  | RailPaymentReturnedV1
  | RailProviderDegradedV1
  | RailReconciliationMismatchV1
  | CardCreatedV1
  | CardActivatedV1
  | CardFrozenV1
  | CardUnfrozenV1
  | CardClosedV1
  | CardAuthorizationApprovedV1
  | CardAuthorizationDeclinedV1
  | CardAuthorizationReversedV1
  | CardClearingReceivedV1
  | CardTransactionSettledV1
  | CardRefundReceivedV1
  | CardDisputeOpenedV1
  | CardDisputeDecidedV1
  | EconomicGraphNodeCreatedV1
  | EconomicGraphFactUpdatedV1
  | EconomicGraphRelationshipCreatedV1
  | EconomicGraphSnapshotCreatedV1
  | EconomicGraphOpportunityCreatedV1;

export type SealedDomainEvent = DomainEvent & DurableEventEnvelope<DomainEvent['eventType'], DomainEvent['schemaVersion']>;

export type EventPersistSink = {
  appendEvent(event: DomainEvent): void;
};

export class DomainEventLog {
  private readonly events: SealedDomainEvent[] = [];
  private readonly persist: EventPersistSink | undefined;
  private readonly sequences = new Map<string, number>();

  constructor(persist?: EventPersistSink) {
    this.persist = persist;
  }

  hydrateFromPersisted(events: readonly DomainEvent[]): void {
    if (this.events.length !== 0) {
      throw new Error('cannot hydrate a domain event log that already has events');
    }
    this.replacePersistedEvents(events);
  }

  reloadFromPersisted(events: readonly DomainEvent[]): void {
    this.events.length = 0;
    this.sequences.clear();
    this.replacePersistedEvents(events);
  }

  private replacePersistedEvents(events: readonly DomainEvent[]): void {
    for (const event of events) {
      const sealed = this.seal(event);
      this.events.push(sealed);
      this.noteSequence(sealed);
    }
  }

  append<E extends DomainEvent>(event: E): E & DurableEventEnvelope<E['eventType'], E['schemaVersion']> {
    const sealed = this.seal(event);
    this.events.push(sealed);
    this.noteSequence(sealed);
    this.persist?.appendEvent(sealed);
    return sealed as E & DurableEventEnvelope<E['eventType'], E['schemaVersion']>;
  }

  list(): readonly SealedDomainEvent[] {
    return this.events.slice();
  }

  getById(eventId: EventId | string): SealedDomainEvent | undefined {
    return this.events.find((event) => event.eventId === eventId);
  }

  private seal(event: DomainEvent): SealedDomainEvent {
    const inferred = `${event.aggregateType ?? ''}:${event.aggregateId ?? ''}`;
    const next = (event.aggregateSequence ?? (this.sequences.get(inferred) ?? 0) + 1);
    return sealEnvelope(
      {
        eventType: event.eventType,
        schemaVersion: event.schemaVersion,
        occurredAt: event.occurredAt,
        payload: event.payload,
        eventId: event.eventId,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        aggregateSequence: event.aggregateSequence,
        correlationId: event.correlationId,
        causationId: event.causationId,
        intentId: event.intentId,
        evidenceId: event.evidenceId,
        jurisdiction: event.jurisdiction,
        cellId: event.cellId,
        schemaRef: event.schemaRef,
        metadata: event.metadata,
      },
      next,
    ) as SealedDomainEvent;
  }

  private noteSequence(event: SealedDomainEvent): void {
    const key = `${event.aggregateType}:${event.aggregateId}`;
    const current = this.sequences.get(key) ?? 0;
    if (event.aggregateSequence > current) {
      this.sequences.set(key, event.aggregateSequence);
    }
  }
}

export function isSealedEvent(event: DomainEvent): event is SealedDomainEvent {
  return typeof event.eventId === 'string' && typeof event.aggregateSequence === 'number';
}
