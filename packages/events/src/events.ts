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
  readonly trustState?: string;
};

export type IdentityCreatedV1 = VersionedEvent<'IdentityCreated', 1, IdentityAuditPayload>;
export type IdentityActivatedV1 = VersionedEvent<'IdentityActivated', 1, IdentityAuditPayload>;
export type IdentitySuspendedV1 = VersionedEvent<'IdentitySuspended', 1, IdentityAuditPayload>;
export type IdentityKycUpdatedV1 = VersionedEvent<'IdentityKycUpdated', 1, IdentityAuditPayload>;
export type IdentitySessionCreatedV1 = VersionedEvent<'IdentitySessionCreated', 1, IdentityAuditPayload>;
export type IdentitySessionRevokedV1 = VersionedEvent<'IdentitySessionRevoked', 1, IdentityAuditPayload>;
export type IdentityDeviceRegisteredV1 = VersionedEvent<'IdentityDeviceRegistered', 1, IdentityAuditPayload>;
export type IdentityDeviceTrustChangedV1 = VersionedEvent<'IdentityDeviceTrustChanged', 1, IdentityAuditPayload>;
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
  readonly tokenId?: string;
  readonly deviceId?: string;
  readonly walletProvider?: string;
  readonly merchantId?: string;
  readonly sessionId?: string;
  readonly providerTransactionRef?: string;
  readonly reconciliationStatus?: string;
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
export type WalletProvisioningRequestedV1 = VersionedEvent<'WalletProvisioningRequested', 1, CardAuditPayload>;
export type WalletProvisioningStepUpRequiredV1 = VersionedEvent<'WalletProvisioningStepUpRequired', 1, CardAuditPayload>;
export type WalletTokenActivatedV1 = VersionedEvent<'WalletTokenActivated', 1, CardAuditPayload>;
export type WalletTokenSuspendedV1 = VersionedEvent<'WalletTokenSuspended', 1, CardAuditPayload>;
export type WalletTokenDeletedV1 = VersionedEvent<'WalletTokenDeleted', 1, CardAuditPayload>;
export type AcceptanceDeviceRegisteredV1 = VersionedEvent<'AcceptanceDeviceRegistered', 1, CardAuditPayload>;
export type AcceptanceSessionCreatedV1 = VersionedEvent<'AcceptanceSessionCreated', 1, CardAuditPayload>;
export type AcceptancePaymentApprovedV1 = VersionedEvent<'AcceptancePaymentApproved', 1, CardAuditPayload>;
export type AcceptancePaymentDeclinedV1 = VersionedEvent<'AcceptancePaymentDeclined', 1, CardAuditPayload>;
export type AcceptancePaymentSettledV1 = VersionedEvent<'AcceptancePaymentSettled', 1, CardAuditPayload>;
export type AcceptanceReconciliationMismatchV1 = VersionedEvent<'AcceptanceReconciliationMismatch', 1, CardAuditPayload>;

export type TreasuryAuditPayload = {
  readonly reservationId?: string;
  readonly paymentId?: string;
  readonly treasuryAccountId?: string;
  readonly amountMinorUnits?: string;
  readonly currency?: string;
  readonly selectedRouteId?: string | null;
  readonly routingVersion?: string;
  readonly whySelected?: string;
  readonly killSwitchId?: string;
  readonly scope?: string;
  readonly target?: string;
  readonly enabled?: boolean;
  readonly state?: string;
  readonly kind?: string;
  readonly proposalId?: string;
  readonly sourceTreasuryAccountId?: string;
  readonly destinationTreasuryAccountId?: string;
  readonly reconciliationId?: string;
  readonly status?: string;
  readonly mismatches?: readonly string[];
};

export type TreasuryLiquidityReservedV1 = VersionedEvent<'TreasuryLiquidityReserved', 1, TreasuryAuditPayload>;
export type TreasuryLiquidityReleasedV1 = VersionedEvent<'TreasuryLiquidityReleased', 1, TreasuryAuditPayload>;
export type TreasuryLiquidityCommittedV1 = VersionedEvent<'TreasuryLiquidityCommitted', 1, TreasuryAuditPayload>;
export type TreasuryRouteSelectedV1 = VersionedEvent<'TreasuryRouteSelected', 1, TreasuryAuditPayload>;
export type TreasuryProviderRestrictedV1 = VersionedEvent<'TreasuryProviderRestricted', 1, TreasuryAuditPayload>;
export type TreasuryCorridorHaltedV1 = VersionedEvent<'TreasuryCorridorHalted', 1, TreasuryAuditPayload>;
export type TreasuryExposureElevatedV1 = VersionedEvent<'TreasuryExposureElevated', 1, TreasuryAuditPayload>;
export type TreasuryRebalanceProposedV1 = VersionedEvent<'TreasuryRebalanceProposed', 1, TreasuryAuditPayload>;
export type TreasuryReconciliationMismatchV1 = VersionedEvent<'TreasuryReconciliationMismatch', 1, TreasuryAuditPayload>;

export type InvestmentAuditPayload = {
  readonly investmentAccountId?: string;
  readonly customerId?: string;
  readonly brokerageCashAccountId?: string;
  readonly securitiesAccountId?: string;
  readonly orderId?: string;
  readonly fillId?: string;
  readonly journalId?: string;
  readonly instrumentId?: string;
  readonly side?: string;
  readonly quantityUnits?: string;
  readonly amountMinorUnits?: string;
  readonly currency?: string;
  readonly settlementId?: string;
  readonly corporateActionId?: string;
  readonly reconciliationId?: string;
  readonly result?: string;
  readonly findings?: readonly string[];
};

export type InvestmentAccountOpenedV1 = VersionedEvent<'InvestmentAccountOpened', 1, InvestmentAuditPayload>;
export type InvestmentCashFundedV1 = VersionedEvent<'InvestmentCashFunded', 1, InvestmentAuditPayload>;
export type InvestmentCashWithdrawnV1 = VersionedEvent<'InvestmentCashWithdrawn', 1, InvestmentAuditPayload>;
export type InvestmentOrderCreatedV1 = VersionedEvent<'InvestmentOrderCreated', 1, InvestmentAuditPayload>;
export type InvestmentOrderAcceptedV1 = VersionedEvent<'InvestmentOrderAccepted', 1, InvestmentAuditPayload>;
export type InvestmentOrderPartiallyFilledV1 = VersionedEvent<'InvestmentOrderPartiallyFilled', 1, InvestmentAuditPayload>;
export type InvestmentOrderFilledV1 = VersionedEvent<'InvestmentOrderFilled', 1, InvestmentAuditPayload>;
export type InvestmentOrderCancelledV1 = VersionedEvent<'InvestmentOrderCancelled', 1, InvestmentAuditPayload>;
export type InvestmentPositionChangedV1 = VersionedEvent<'InvestmentPositionChanged', 1, InvestmentAuditPayload>;
export type InvestmentSettlementCompletedV1 = VersionedEvent<'InvestmentSettlementCompleted', 1, InvestmentAuditPayload>;
export type InvestmentDividendReceivedV1 = VersionedEvent<'InvestmentDividendReceived', 1, InvestmentAuditPayload>;
export type InvestmentReconciliationMismatchV1 = VersionedEvent<'InvestmentReconciliationMismatch', 1, InvestmentAuditPayload>;
export type RegulatoryTwinAuditPayload = {
  readonly scenarioId?: string;
  readonly runId?: string;
  readonly category?: string;
  readonly invariant?: boolean;
  readonly factSourceKinds?: readonly string[];
  readonly changed?: boolean;
  readonly transition?: string;
  readonly restrictiveness?: string;
  readonly executionAuthorityIssued?: false;
  readonly suiteId?: string;
  readonly totalEvaluated?: number;
  readonly unchanged?: number;
  readonly newReview?: number;
  readonly newBlock?: number;
  readonly insufficientFacts?: number;
  readonly candidateSetId?: string;
  readonly failureCount?: number;
  readonly assessmentId?: string;
  readonly kind?: string;
  readonly state?: string;
};

export type RegulatoryTwinScenarioCreatedV1 = VersionedEvent<
  'RegulatoryTwinScenarioCreated',
  1,
  RegulatoryTwinAuditPayload
>;
export type RegulatoryTwinRunCompletedV1 = VersionedEvent<
  'RegulatoryTwinRunCompleted',
  1,
  RegulatoryTwinAuditPayload
>;
export type RegulatoryTwinImpactDetectedV1 = VersionedEvent<
  'RegulatoryTwinImpactDetected',
  1,
  RegulatoryTwinAuditPayload
>;
export type RegulatoryTwinInvariantFailedV1 = VersionedEvent<
  'RegulatoryTwinInvariantFailed',
  1,
  RegulatoryTwinAuditPayload
>;
export type RegulatoryTwinReadinessAssessedV1 = VersionedEvent<
  'RegulatoryTwinReadinessAssessed',
  1,
  RegulatoryTwinAuditPayload
>;

export type RiskAuditPayload = {
  readonly assessmentId?: string;
  readonly snapshotId?: string;
  readonly portfolioId?: string;
  readonly proposedActionRef?: string;
  readonly outcome?: string;
  readonly runId?: string;
  readonly scenarioId?: string;
  readonly estimatedLossMinor?: string;
  readonly triggered?: readonly string[];
  readonly mutatesFinancialState?: false;
};

export type RiskAssessmentCompletedV1 = VersionedEvent<'RiskAssessmentCompleted', 1, RiskAuditPayload>;
export type RiskLimitBreachedV1 = VersionedEvent<'RiskLimitBreached', 1, RiskAuditPayload>;
export type RiskPortfolioSnapshotCreatedV1 = VersionedEvent<'RiskPortfolioSnapshotCreated', 1, RiskAuditPayload>;
export type RiskStressCompletedV1 = VersionedEvent<'RiskStressCompleted', 1, RiskAuditPayload>;

export type ModelAuditPayload = {
  readonly modelId?: string;
  readonly version?: string;
  readonly type?: string;
  readonly lifecycle?: string;
  readonly validationId?: string;
  readonly artifactRef?: string;
  readonly sha256?: string;
  readonly actorId?: string;
  readonly simulationOnly?: true;
  readonly liveApproved?: false;
};

export type ModelRegisteredV1 = VersionedEvent<'ModelRegistered', 1, ModelAuditPayload>;
export type ModelVersionCreatedV1 = VersionedEvent<'ModelVersionCreated', 1, ModelAuditPayload>;
export type ModelValidatedV1 = VersionedEvent<'ModelValidated', 1, ModelAuditPayload>;
export type ModelApprovedForSimulationV1 = VersionedEvent<'ModelApprovedForSimulation', 1, ModelAuditPayload>;
export type ModelRetiredV1 = VersionedEvent<'ModelRetired', 1, ModelAuditPayload>;

export type DataVaultAuditPayload = {
  readonly vaultId?: string;
  readonly assetId?: string;
  readonly subjectId?: string;
  readonly schemaId?: string;
  readonly schemaVersion?: string;
  readonly contentSha256?: string;
  readonly category?: string;
  readonly provenanceKind?: string;
  readonly versionId?: string;
  readonly derivationId?: string;
  readonly sourceAssetIds?: readonly string[];
  readonly method?: string;
  readonly methodVersion?: string;
  readonly exportId?: string;
  readonly assetCount?: number;
  readonly manifestSha256?: string;
  readonly operation?: string;
  readonly purposeRef?: string;
  readonly decision?: string;
  readonly reason?: string;
  readonly kekVersion?: number;
  readonly deletionRequestId?: string;
  readonly technicalGuarantee?: string;
  readonly customerLinked?: boolean;
};

export type DataVaultCreatedV1 = VersionedEvent<'DataVaultCreated', 1, DataVaultAuditPayload>;
export type DataVaultAssetIngestedV1 = VersionedEvent<'DataVaultAssetIngested', 1, DataVaultAuditPayload>;
export type DataVaultAssetVersionedV1 = VersionedEvent<'DataVaultAssetVersioned', 1, DataVaultAuditPayload>;
export type DataVaultAssetDeletedV1 = VersionedEvent<'DataVaultAssetDeleted', 1, DataVaultAuditPayload>;
export type DataVaultAccessAllowedV1 = VersionedEvent<'DataVaultAccessAllowed', 1, DataVaultAuditPayload>;
export type DataVaultAccessDeniedV1 = VersionedEvent<'DataVaultAccessDenied', 1, DataVaultAuditPayload>;
export type DataVaultExportCreatedV1 = VersionedEvent<'DataVaultExportCreated', 1, DataVaultAuditPayload>;
export type DataVaultDerivationCreatedV1 = VersionedEvent<'DataVaultDerivationCreated', 1, DataVaultAuditPayload>;
export type DataVaultKeyRotatedV1 = VersionedEvent<'DataVaultKeyRotated', 1, DataVaultAuditPayload>;
export type StrategyAuditPayload = {
  readonly strategyId?: string;
  readonly version?: string;
  readonly compiledHash?: string;
  readonly compilerVersion?: string;
  readonly runId?: string;
  readonly outputHash?: string;
  readonly datasetId?: string;
  readonly validationId?: string;
  readonly actorId?: string;
  readonly reason?: string;
  readonly sendsOrders?: false;
  readonly liveBroker?: false;
  readonly partition?: string;
};

export type StrategyCreatedV1 = VersionedEvent<'StrategyCreated', 1, StrategyAuditPayload>;
export type StrategyCompiledV1 = VersionedEvent<'StrategyCompiled', 1, StrategyAuditPayload>;
export type StrategyBacktestStartedV1 = VersionedEvent<'StrategyBacktestStarted', 1, StrategyAuditPayload>;
export type StrategyBacktestCompletedV1 = VersionedEvent<'StrategyBacktestCompleted', 1, StrategyAuditPayload>;
export type StrategyValidationFailedV1 = VersionedEvent<'StrategyValidationFailed', 1, StrategyAuditPayload>;
export type StrategyShadowApprovedV1 = VersionedEvent<'StrategyShadowApproved', 1, StrategyAuditPayload>;
export type StrategyShadowStartedV1 = VersionedEvent<'StrategyShadowStarted', 1, StrategyAuditPayload>;
export type StrategyPaperApprovedV1 = VersionedEvent<'StrategyPaperApproved', 1, StrategyAuditPayload>;
export type StrategyPaperStartedV1 = VersionedEvent<'StrategyPaperStarted', 1, StrategyAuditPayload>;
export type StrategyPaperHaltedV1 = VersionedEvent<'StrategyPaperHalted', 1, StrategyAuditPayload>;
export type StrategyRetiredV1 = VersionedEvent<'StrategyRetired', 1, StrategyAuditPayload>;
export type CapitalMeshAuditPayload = {
  readonly runId?: string;
  readonly subjectId?: string;
  readonly thesisId?: string;
  readonly candidateId?: string;
  readonly reviewId?: string;
  readonly proposalId?: string;
  readonly reasons?: readonly string[];
  readonly mutatesFinancialState?: false;
};

export type CapitalMeshRunStartedV1 = VersionedEvent<'CapitalMeshRunStarted', 1, CapitalMeshAuditPayload>;
export type CapitalMeshThesisCreatedV1 = VersionedEvent<'CapitalMeshThesisCreated', 1, CapitalMeshAuditPayload>;
export type CapitalMeshCandidateCreatedV1 = VersionedEvent<'CapitalMeshCandidateCreated', 1, CapitalMeshAuditPayload>;
export type CapitalMeshReviewCompletedV1 = VersionedEvent<'CapitalMeshReviewCompleted', 1, CapitalMeshAuditPayload>;
export type CapitalMeshVetoAppliedV1 = VersionedEvent<'CapitalMeshVetoApplied', 1, CapitalMeshAuditPayload>;
export type CapitalMeshProposalCreatedV1 = VersionedEvent<'CapitalMeshProposalCreated', 1, CapitalMeshAuditPayload>;
export type CapitalMeshProposalStaleV1 = VersionedEvent<'CapitalMeshProposalStale', 1, CapitalMeshAuditPayload>;

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

export type MandateAuditPayload = {
  readonly mandateId?: string;
  readonly subjectId?: string;
  readonly version?: number;
  readonly actorId?: string;
  readonly confirmationHash?: string;
};

export type MandateDraftCreatedV1 = VersionedEvent<'MandateDraftCreated', 1, MandateAuditPayload>;
export type MandateConfirmedV1 = VersionedEvent<'MandateConfirmed', 1, MandateAuditPayload>;
export type MandateActivatedV1 = VersionedEvent<'MandateActivated', 1, MandateAuditPayload>;
export type MandatePausedV1 = VersionedEvent<'MandatePaused', 1, MandateAuditPayload>;
export type MandateRevokedV1 = VersionedEvent<'MandateRevoked', 1, MandateAuditPayload>;

export type GrowthAuditPayload = {
  readonly cycleId?: string;
  readonly planId?: string;
  readonly version?: number;
  readonly subjectId?: string;
  readonly mandateId?: string;
  readonly actionId?: string;
  readonly action?: string;
  readonly executionCapability?: string;
  readonly proposedCount?: number;
  readonly reason?: string;
};

export type GrowthCycleStartedV1 = VersionedEvent<'GrowthCycleStarted', 1, GrowthAuditPayload>;
export type GrowthPlanCreatedV1 = VersionedEvent<'GrowthPlanCreated', 1, GrowthAuditPayload>;
export type GrowthPlanStaleV1 = VersionedEvent<'GrowthPlanStale', 1, GrowthAuditPayload>;
export type GrowthActionProposedV1 = VersionedEvent<'GrowthActionProposed', 1, GrowthAuditPayload>;

export type EconomicValueAuditPayload = {
  readonly snapshotId?: string;
  readonly subjectId?: string;
  readonly formulaVersion?: string;
  readonly modelVersion?: string;
  readonly pegSnapshotId?: string;
  readonly completeness?: string;
  readonly compositePoints?: string;
  readonly dimensionId?: string;
  readonly kind?: string;
  readonly points?: string;
  readonly priorPoints?: string;
  readonly entryId?: string;
  readonly sourceEventId?: string;
  readonly realization?: string;
  readonly attributionType?: string;
  readonly minorUnits?: string;
  readonly currency?: string;
  readonly groupId?: string;
  readonly goalCount?: number;
  readonly lifecycle?: string;
};

export type EconomicValueSnapshotCreatedV1 = VersionedEvent<
  'EconomicValueSnapshotCreated',
  1,
  EconomicValueAuditPayload
>;
export type EconomicValueDimensionChangedV1 = VersionedEvent<
  'EconomicValueDimensionChanged',
  1,
  EconomicValueAuditPayload
>;
export type EconomicValueAttributionRecordedV1 = VersionedEvent<
  'EconomicValueAttributionRecorded',
  1,
  EconomicValueAuditPayload
>;
export type EconomicValueGoalProgressUpdatedV1 = VersionedEvent<
  'EconomicValueGoalProgressUpdated',
  1,
  EconomicValueAuditPayload
>;
export type EconomicValueModelActivatedV1 = VersionedEvent<
  'EconomicValueModelActivated',
  1,
  EconomicValueAuditPayload
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
  | IdentityDeviceTrustChangedV1
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
  | EconomicGraphOpportunityCreatedV1
  | WalletProvisioningRequestedV1
  | WalletProvisioningStepUpRequiredV1
  | WalletTokenActivatedV1
  | WalletTokenSuspendedV1
  | WalletTokenDeletedV1
  | AcceptanceDeviceRegisteredV1
  | AcceptanceSessionCreatedV1
  | AcceptancePaymentApprovedV1
  | AcceptancePaymentDeclinedV1
  | AcceptancePaymentSettledV1
  | AcceptanceReconciliationMismatchV1
  | MandateDraftCreatedV1
  | MandateConfirmedV1
  | MandateActivatedV1
  | MandatePausedV1
  | MandateRevokedV1
  | GrowthCycleStartedV1
  | GrowthPlanCreatedV1
  | GrowthPlanStaleV1
  | GrowthActionProposedV1
  | EconomicValueSnapshotCreatedV1
  | EconomicValueDimensionChangedV1
  | EconomicValueAttributionRecordedV1
  | EconomicValueGoalProgressUpdatedV1
  | EconomicValueModelActivatedV1
  | TreasuryLiquidityReservedV1
  | TreasuryLiquidityReleasedV1
  | TreasuryLiquidityCommittedV1
  | TreasuryRouteSelectedV1
  | TreasuryProviderRestrictedV1
  | TreasuryCorridorHaltedV1
  | TreasuryExposureElevatedV1
  | TreasuryRebalanceProposedV1
  | TreasuryReconciliationMismatchV1
  | InvestmentAccountOpenedV1
  | InvestmentCashFundedV1
  | InvestmentCashWithdrawnV1
  | InvestmentOrderCreatedV1
  | InvestmentOrderAcceptedV1
  | InvestmentOrderPartiallyFilledV1
  | InvestmentOrderFilledV1
  | InvestmentOrderCancelledV1
  | InvestmentPositionChangedV1
  | InvestmentSettlementCompletedV1
  | InvestmentDividendReceivedV1
  | InvestmentReconciliationMismatchV1
  | RegulatoryTwinScenarioCreatedV1
  | RegulatoryTwinRunCompletedV1
  | RegulatoryTwinImpactDetectedV1
  | RegulatoryTwinInvariantFailedV1
  | RegulatoryTwinReadinessAssessedV1
  | RiskAssessmentCompletedV1
  | RiskLimitBreachedV1
  | RiskPortfolioSnapshotCreatedV1
  | RiskStressCompletedV1
  | ModelRegisteredV1
  | ModelVersionCreatedV1
  | ModelValidatedV1
  | ModelApprovedForSimulationV1
  | ModelRetiredV1
  | DataVaultCreatedV1
  | DataVaultAssetIngestedV1
  | DataVaultAssetVersionedV1
  | DataVaultAssetDeletedV1
  | DataVaultAccessAllowedV1
  | DataVaultAccessDeniedV1
  | DataVaultExportCreatedV1
  | DataVaultDerivationCreatedV1
  | DataVaultKeyRotatedV1
  | StrategyCreatedV1
  | StrategyCompiledV1
  | StrategyBacktestStartedV1
  | StrategyBacktestCompletedV1
  | StrategyValidationFailedV1
  | StrategyShadowApprovedV1
  | StrategyShadowStartedV1
  | StrategyPaperApprovedV1
  | StrategyPaperStartedV1
  | StrategyPaperHaltedV1
  | StrategyRetiredV1
  | CapitalMeshRunStartedV1
  | CapitalMeshThesisCreatedV1
  | CapitalMeshCandidateCreatedV1
  | CapitalMeshReviewCompletedV1
  | CapitalMeshVetoAppliedV1
  | CapitalMeshProposalCreatedV1
  | CapitalMeshProposalStaleV1;

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
