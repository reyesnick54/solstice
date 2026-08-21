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
  { eventType: 'AccountActivated', version: 1, status: 'current' },
  { eventType: 'AccountRestricted', version: 1, status: 'current' },
  { eventType: 'AccountClosed', version: 1, status: 'current' },
  { eventType: 'CustomerActivityRecorded', version: 1, status: 'current' },
  { eventType: 'DepositPosted', version: 1, status: 'current' },
  { eventType: 'WithdrawalPosted', version: 1, status: 'current' },
  { eventType: 'InternalTransferPosted', version: 1, status: 'current' },
  { eventType: 'JournalPosted', version: 1, status: 'current' },
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
  { eventType: 'IdentitySecurityRecorded', version: 1, status: 'current' },
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
  { eventType: 'HoldAdjusted', version: 1, status: 'current' },
  { eventType: 'HoldExpired', version: 1, status: 'current' },
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
  { eventType: 'EconomicValueSnapshotCreated', version: 1, status: 'current' },
  { eventType: 'EconomicValueDimensionChanged', version: 1, status: 'current' },
  { eventType: 'EconomicValueAttributionRecorded', version: 1, status: 'current' },
  { eventType: 'EconomicValueGoalProgressUpdated', version: 1, status: 'current' },
  { eventType: 'EconomicValueModelActivated', version: 1, status: 'current' },

  { eventType: 'TreasuryLiquidityReserved', version: 1, status: 'current' },
  { eventType: 'TreasuryLiquidityReleased', version: 1, status: 'current' },
  { eventType: 'TreasuryLiquidityCommitted', version: 1, status: 'current' },
  { eventType: 'TreasuryRouteSelected', version: 1, status: 'current' },
  { eventType: 'TreasuryProviderRestricted', version: 1, status: 'current' },
  { eventType: 'TreasuryCorridorHalted', version: 1, status: 'current' },
  { eventType: 'TreasuryExposureElevated', version: 1, status: 'current' },
  { eventType: 'TreasuryRebalanceProposed', version: 1, status: 'current' },
  { eventType: 'TreasuryReconciliationMismatch', version: 1, status: 'current' },
  { eventType: 'InvestmentAccountOpened', version: 1, status: 'current' },
  { eventType: 'InvestmentCashFunded', version: 1, status: 'current' },
  { eventType: 'InvestmentCashWithdrawn', version: 1, status: 'current' },
  { eventType: 'InvestmentOrderCreated', version: 1, status: 'current' },
  { eventType: 'InvestmentOrderAccepted', version: 1, status: 'current' },
  { eventType: 'InvestmentOrderPartiallyFilled', version: 1, status: 'current' },
  { eventType: 'InvestmentOrderFilled', version: 1, status: 'current' },
  { eventType: 'InvestmentOrderCancelled', version: 1, status: 'current' },
  { eventType: 'InvestmentPositionChanged', version: 1, status: 'current' },
  { eventType: 'InvestmentSettlementCompleted', version: 1, status: 'current' },
  { eventType: 'InvestmentDividendReceived', version: 1, status: 'current' },
  { eventType: 'InvestmentReconciliationMismatch', version: 1, status: 'current' },
  { eventType: 'RegulatoryTwinScenarioCreated', version: 1, status: 'current' },
  { eventType: 'RegulatoryTwinRunCompleted', version: 1, status: 'current' },
  { eventType: 'RegulatoryTwinImpactDetected', version: 1, status: 'current' },
  { eventType: 'RegulatoryTwinInvariantFailed', version: 1, status: 'current' },
  { eventType: 'RegulatoryTwinReadinessAssessed', version: 1, status: 'current' },
  { eventType: 'RiskAssessmentCompleted', version: 1, status: 'current' },
  { eventType: 'RiskLimitBreached', version: 1, status: 'current' },
  { eventType: 'RiskPortfolioSnapshotCreated', version: 1, status: 'current' },
  { eventType: 'RiskStressCompleted', version: 1, status: 'current' },
  { eventType: 'ModelRegistered', version: 1, status: 'current' },
  { eventType: 'ModelVersionCreated', version: 1, status: 'current' },
  { eventType: 'ModelValidated', version: 1, status: 'current' },
  { eventType: 'ModelApprovedForSimulation', version: 1, status: 'current' },
  { eventType: 'ModelRetired', version: 1, status: 'current' },
  { eventType: 'DataVaultCreated', version: 1, status: 'current' },
  { eventType: 'DataVaultAssetIngested', version: 1, status: 'current' },
  { eventType: 'DataVaultAssetVersioned', version: 1, status: 'current' },
  { eventType: 'DataVaultAssetDeleted', version: 1, status: 'current' },
  { eventType: 'DataVaultAccessAllowed', version: 1, status: 'current' },
  { eventType: 'DataVaultAccessDenied', version: 1, status: 'current' },
  { eventType: 'DataVaultExportCreated', version: 1, status: 'current' },
  { eventType: 'DataVaultDerivationCreated', version: 1, status: 'current' },
  { eventType: 'DataVaultKeyRotated', version: 1, status: 'current' },
  { eventType: 'StrategyCreated', version: 1, status: 'current' },
  { eventType: 'StrategyCompiled', version: 1, status: 'current' },
  { eventType: 'StrategyBacktestStarted', version: 1, status: 'current' },
  { eventType: 'StrategyBacktestCompleted', version: 1, status: 'current' },
  { eventType: 'StrategyValidationFailed', version: 1, status: 'current' },
  { eventType: 'StrategyShadowApproved', version: 1, status: 'current' },
  { eventType: 'StrategyShadowStarted', version: 1, status: 'current' },
  { eventType: 'StrategyPaperApproved', version: 1, status: 'current' },
  { eventType: 'StrategyPaperStarted', version: 1, status: 'current' },
  { eventType: 'StrategyPaperHalted', version: 1, status: 'current' },
  { eventType: 'StrategyRetired', version: 1, status: 'current' },
  { eventType: 'CapitalMeshRunStarted', version: 1, status: 'current' },
  { eventType: 'CapitalMeshThesisCreated', version: 1, status: 'current' },
  { eventType: 'CapitalMeshCandidateCreated', version: 1, status: 'current' },
  { eventType: 'CapitalMeshReviewCompleted', version: 1, status: 'current' },
  { eventType: 'CapitalMeshVetoApplied', version: 1, status: 'current' },
  { eventType: 'CapitalMeshProposalCreated', version: 1, status: 'current' },
  { eventType: 'CapitalMeshProposalStale', version: 1, status: 'current' },
  { eventType: 'ConsentDraftCreated', version: 1, status: 'current' },
  { eventType: 'ConsentGranted', version: 1, status: 'current' },
  { eventType: 'ConsentRevoked', version: 1, status: 'current' },
  { eventType: 'ConsentExpired', version: 1, status: 'current' },
  { eventType: 'ConsentSuperseded', version: 1, status: 'current' },
  { eventType: 'ConsentPermitIssued', version: 1, status: 'current' },
  { eventType: 'ConsentAccessDenied', version: 1, status: 'current' },
  { eventType: 'ConsentPurposeVersioned', version: 1, status: 'current' },
  { eventType: 'CleanRoomSessionCreated', version: 1, status: 'current' },
  { eventType: 'CleanRoomSessionAuthorized', version: 1, status: 'current' },
  { eventType: 'CleanRoomSessionDenied', version: 1, status: 'current' },
  { eventType: 'CleanRoomJobStarted', version: 1, status: 'current' },
  { eventType: 'CleanRoomJobCompleted', version: 1, status: 'current' },
  { eventType: 'CleanRoomJobFailed', version: 1, status: 'current' },
  { eventType: 'CleanRoomEgressReleased', version: 1, status: 'current' },
  { eventType: 'CleanRoomEgressSuppressed', version: 1, status: 'current' },
  { eventType: 'CleanRoomEgressDenied', version: 1, status: 'current' },
  { eventType: 'CleanRoomContributionRecorded', version: 1, status: 'current' },
  { eventType: 'SunReyCoinContributionEvaluated', version: 1, status: 'current' },
  { eventType: 'SunReyCoinIssuanceProposed', version: 1, status: 'current' },
  { eventType: 'SunReyCoinIssued', version: 1, status: 'current' },
  { eventType: 'SunReyCoinTransferCompleted', version: 1, status: 'current' },
  { eventType: 'SunReyCoinBurned', version: 1, status: 'current' },
  { eventType: 'SunReyCoinSupplyReconciled', version: 1, status: 'current' },
  { eventType: 'SunReyCoinReconciliationMismatch', version: 1, status: 'current' },
  { eventType: 'InformationMarketRequestPublished', version: 1, status: 'current' },
  { eventType: 'InformationMarketOpportunityOffered', version: 1, status: 'current' },
  { eventType: 'InformationMarketOpportunityAccepted', version: 1, status: 'current' },
  { eventType: 'InformationMarketContributionAuthorized', version: 1, status: 'current' },
  { eventType: 'InformationMarketContributionCompleted', version: 1, status: 'current' },
  { eventType: 'InformationMarketCompensationPending', version: 1, status: 'current' },
  { eventType: 'InformationMarketCompensationSettled', version: 1, status: 'current' },
  { eventType: 'InformationMarketRequestClosed', version: 1, status: 'current' },
  { eventType: 'OracleAttestationIssued', version: 1, status: 'current' },
  { eventType: 'OracleAttestationExpired', version: 1, status: 'current' },
  { eventType: 'ProofOfContributionCreated', version: 1, status: 'current' },
  { eventType: 'SunReyChainIntentCreated', version: 1, status: 'current' },
  { eventType: 'SunReyChainOperationSubmitted', version: 1, status: 'current' },
  { eventType: 'SunReyChainOperationUnknown', version: 1, status: 'current' },
  { eventType: 'SunReyChainOperationFinalized', version: 1, status: 'current' },
  { eventType: 'SunReyChainAnchorRecorded', version: 1, status: 'current' },
  { eventType: 'SunReyChainAnchorReorgObserved', version: 1, status: 'current' },
  { eventType: 'SunReyChainReconciliationMismatch', version: 1, status: 'current' },
  { eventType: 'SunReyChainHealthDegraded', version: 1, status: 'current' },
  { eventType: 'ExchangeAccountCreated', version: 1, status: 'current' },
  { eventType: 'ExchangeOrderAccepted', version: 1, status: 'current' },
  { eventType: 'ExchangeOrderOpened', version: 1, status: 'current' },
  { eventType: 'ExchangeOrderPartiallyFilled', version: 1, status: 'current' },
  { eventType: 'ExchangeOrderFilled', version: 1, status: 'current' },
  { eventType: 'ExchangeOrderCancelled', version: 1, status: 'current' },
  { eventType: 'ExchangeTradeMatched', version: 1, status: 'current' },
  { eventType: 'ExchangeTradeSettled', version: 1, status: 'current' },
  { eventType: 'ExchangeMarketHalted', version: 1, status: 'current' },
  { eventType: 'ExchangeMarketResumed', version: 1, status: 'current' },
  { eventType: 'ExchangeReconciliationMismatch', version: 1, status: 'current' },
  { eventType: 'ExchangeListingDecided', version: 1, status: 'current' },
  { eventType: 'CustodyDepositNoticeReceived', version: 1, status: 'current' },
  { eventType: 'CustodyDepositCredited', version: 1, status: 'current' },
  { eventType: 'CustodyDestinationAdded', version: 1, status: 'current' },
  { eventType: 'CustodyWithdrawalBlocked', version: 1, status: 'current' },
  { eventType: 'CustodyWithdrawalUnknown', version: 1, status: 'current' },
  { eventType: 'CustodyWithdrawalSettled', version: 1, status: 'current' },
  { eventType: 'SurveillanceAlertRaised', version: 1, status: 'current' },
  { eventType: 'SurveillanceCaseOpened', version: 1, status: 'current' },
  { eventType: 'WorkflowStarted', version: 1, status: 'current' },
  { eventType: 'WorkflowCompleted', version: 1, status: 'current' },
  { eventType: 'WorkflowFailed', version: 1, status: 'current' },
  { eventType: 'JobEnqueued', version: 1, status: 'current' },
  { eventType: 'JobDeadLettered', version: 1, status: 'current' },
  { eventType: 'ProviderWebhookAccepted', version: 1, status: 'current' },
  { eventType: 'ProviderWebhookRejected', version: 1, status: 'current' },
  { eventType: 'OutboundWebhookDelivered', version: 1, status: 'current' },
  { eventType: 'OutboundWebhookFailed', version: 1, status: 'current' },
];

export const EVENT_COMPATIBILITY_POLICY = Object.freeze({
  optionalFieldSameVersion: true,
  breakingChangeRequiresNewVersion: true,
  silentPayloadSemanticChangeForbidden: true,
  deprecatedVersionsRemainReadable: true,
  unsupportedFailsClosed: true,
});

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
