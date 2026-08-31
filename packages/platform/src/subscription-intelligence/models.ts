import type { UtcInstant } from '../../../domain/src/time.ts';
import type { SerializedMoney } from '../../../personal-economic-graph/src/taxonomy.ts';
import type {
  ActionCapabilityLevel,
  ActionLifecycleState,
  ConfidenceLevel,
  DuplicationKind,
  ObligationStatus,
  RecurringFrequency,
  SavingsKind,
  SavingsOpportunityType,
  SubscriptionActionType,
  SubscriptionCategory,
  SubscriptionAuditEventKind,
} from './taxonomy.ts';
import type {
  RecurringObligationId,
  SavingsOpportunityId,
  SubscriptionActionId,
  SubscriptionApprovalId,
} from './ids.ts';

/** Observed transaction fact — never overwritten. */
export type ObservedTransaction = {
  readonly transactionRef: string;
  readonly rawMerchantDescriptor: string;
  readonly amount: SerializedMoney;
  readonly occurredAt: UtcInstant;
  readonly sourceAccount?: string;
};

/** Inferred classification — separate from observed facts. */
export type InferredClassification = {
  readonly category: SubscriptionCategory;
  readonly subscriptionType: string;
  readonly cancellable: boolean;
  readonly confidence: ConfidenceLevel;
  readonly source: 'DETERMINISTIC' | 'AI_ASSISTED';
};

export type MerchantIdentity = {
  readonly rawDescriptor: string;
  readonly normalizedMerchant: string;
  readonly merchantKey: string;
};

export type PriceChange = {
  readonly previousAmount: SerializedMoney;
  readonly currentAmount: SerializedMoney;
  readonly absoluteChangeMinorUnits: string;
  readonly percentageChangeBps: number;
  readonly changeConfidence: ConfidenceLevel;
  readonly detectedAt: UtcInstant;
};

export type ActionCapabilities = {
  readonly cancel: ActionCapabilityLevel;
  readonly downgrade: ActionCapabilityLevel;
  readonly renegotiate: ActionCapabilityLevel;
  readonly switchProvider: ActionCapabilityLevel;
};

export type RecurringObligation = {
  readonly id: RecurringObligationId;
  readonly userId: string;
  readonly merchant: MerchantIdentity;
  readonly category: SubscriptionCategory;
  readonly amount: SerializedMoney;
  readonly currency: string;
  readonly frequency: RecurringFrequency;
  readonly firstObservedAt: UtcInstant;
  readonly lastObservedAt: UtcInstant;
  readonly nextExpectedAt: UtcInstant | null;
  readonly confidence: ConfidenceLevel;
  readonly sourceAccount: string | null;
  readonly transactionReferences: readonly string[];
  readonly priceChange: PriceChange | null;
  readonly status: ObligationStatus;
  readonly subscriptionType: string;
  readonly cancellable: boolean;
  readonly actionCapabilities: ActionCapabilities;
  readonly provenance: 'OBSERVED' | 'INFERRED' | 'MIXED';
  readonly occurrenceCount: number;
  readonly variableAmount: boolean;
};

export type DuplicationEvidence = {
  readonly kind: DuplicationKind;
  readonly obligationIds: readonly RecurringObligationId[];
  readonly category: SubscriptionCategory;
  readonly evidence: readonly string[];
  readonly wasteful: false;
};

export type UsageSignal = {
  readonly obligationId: RecurringObligationId;
  readonly usageLevel: 'ACTIVE' | 'LOW' | 'NONE' | 'UNKNOWN';
  readonly source: 'USER_AUTHORIZED';
  readonly observedAt: UtcInstant;
};

export type SavingsOpportunity = {
  readonly opportunityId: SavingsOpportunityId;
  readonly recurringObligationId: RecurringObligationId;
  readonly opportunityType: SavingsOpportunityType;
  readonly currentCost: SerializedMoney;
  readonly estimatedNewCost: SerializedMoney | null;
  readonly estimatedMonthlySavings: SerializedMoney | null;
  readonly estimatedAnnualSavings: SerializedMoney | null;
  readonly confidence: ConfidenceLevel;
  readonly evidence: readonly string[];
  readonly recommendedAction: SubscriptionActionType;
  readonly providerCapability: ActionCapabilityLevel;
  readonly userApprovalRequired: true;
  readonly savingsKind: 'ESTIMATED';
};

export type VerifiedSavings = {
  readonly obligationId: RecurringObligationId;
  readonly actionId: SubscriptionActionId;
  readonly kind: SavingsKind;
  readonly monthlyAmount: SerializedMoney;
  readonly annualAmount: SerializedMoney;
  readonly verifiedAt: UtcInstant;
  readonly providerEvidenceRef: string;
};

export type SubscriptionActionProposal = {
  readonly actionId: SubscriptionActionId;
  readonly opportunityId: SavingsOpportunityId;
  readonly obligationId: RecurringObligationId;
  readonly userId: string;
  readonly actionType: SubscriptionActionType;
  readonly state: ActionLifecycleState;
  readonly capability: ActionCapabilityLevel;
  readonly idempotencyKey: string;
  readonly proposedAt: UtcInstant;
  readonly authorizedAt: UtcInstant | null;
  readonly completedAt: UtcInstant | null;
  readonly providerId: string | null;
  readonly providerEvidenceRef: string | null;
  readonly failureReason: string | null;
  readonly requestSent: boolean;
  readonly actionConfirmed: boolean;
};

export type SubscriptionApproval = {
  readonly approvalId: SubscriptionApprovalId;
  readonly actionId: SubscriptionActionId;
  readonly userId: string;
  readonly actorId: string;
  readonly approvedAt: UtcInstant;
  readonly stepUpSatisfied: boolean;
};

export type SubscriptionAuditEvent = {
  readonly eventKind: SubscriptionAuditEventKind;
  readonly subjectId: string;
  readonly occurredAt: UtcInstant;
  readonly refs: readonly string[];
  readonly detail: string;
};

export type SubscriptionIntelligenceSnapshot = {
  readonly subjectId: string;
  readonly generatedAt: UtcInstant;
  readonly obligations: readonly RecurringObligation[];
  readonly potentialSubscriptions: readonly RecurringObligation[];
  readonly priceIncreases: readonly RecurringObligation[];
  readonly duplicates: readonly DuplicationEvidence[];
  readonly opportunities: readonly SavingsOpportunity[];
  readonly actions: readonly SubscriptionActionProposal[];
  readonly verifiedSavings: readonly VerifiedSavings[];
};
