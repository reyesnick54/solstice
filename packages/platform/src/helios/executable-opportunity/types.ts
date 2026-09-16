import type { CustomerId } from '../../../../domain/src/customer.ts';
import type { Jurisdiction } from '../../../../domain/src/jurisdiction.ts';
import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { OpportunityId } from '../../ids.ts';
import type { SerializedMoney } from '../../mandate/types.ts';
import type { EconomicWorkOrderId } from '../ids.ts';
import type { EconomicWorkOrder } from '../types.ts';
import type {
  CandidateSource,
  EvidenceEntitlementScope,
  EvidenceSourceKind,
  ExecutableOpportunityState,
  QualificationOutcome,
  QualificationReasonCode,
  RouteAvailabilityState,
  SupportedOrderActionType,
  VenueSessionState,
} from './taxonomy.ts';
import type {
  ExecutableOpportunityId,
  OpportunityCandidateId,
  QualificationDecisionId,
} from './ids.ts';

export type AdmissibleEvidenceRecord = {
  readonly evidenceRef: string;
  readonly sourceKind: EvidenceSourceKind;
  readonly provenanceId: string;
  readonly observedAt: UtcInstant;
  readonly arrivedAt: UtcInstant;
  readonly entitlementScope: EvidenceEntitlementScope;
  readonly subjectId?: string;
  readonly customerId?: string;
  readonly freshnessHorizonSeconds: number;
  readonly dataQualityOk: boolean;
  readonly unresolvedQualityFailures: readonly string[];
};

export type CanonicalInstrumentCandidate = {
  readonly instrumentId: string;
  readonly productId: string;
  readonly symbol: string;
  readonly assetClass: string;
};

export type CanonicalInstrumentBinding = {
  readonly instrumentId: string;
  readonly productId: string;
  readonly symbol: string;
  readonly providerSymbol: string;
  readonly assetClass: string;
  readonly mappingVerified: true;
};

export type OpportunityCandidate = {
  readonly candidateId: OpportunityCandidateId;
  readonly workOrderId: EconomicWorkOrderId;
  readonly customerId: CustomerId;
  readonly subjectId: string;
  readonly source: CandidateSource;
  readonly hypothesisType: string;
  readonly evidenceRefs: readonly string[];
  readonly instrumentCandidate: CanonicalInstrumentCandidate;
  readonly discoveredAt: UtcInstant;
  readonly originatingOpportunityId?: OpportunityId;
};

export type EvidenceVerificationDecision = {
  readonly decisionId: QualificationDecisionId;
  readonly verified: boolean;
  readonly admissibleRefs: readonly string[];
  readonly rejectedRefs: readonly string[];
  readonly reasonCodes: readonly QualificationReasonCode[];
  readonly decidedAt: UtcInstant;
};

export type CustomerEligibilityDecision = {
  readonly decisionId: QualificationDecisionId;
  readonly eligible: boolean;
  readonly reasonCodes: readonly QualificationReasonCode[];
  readonly failedChecks: readonly string[];
  readonly workOrderState: EconomicWorkOrder['state'];
  readonly mandateState: string;
  readonly decidedAt: UtcInstant;
};

export type ExecutionRouteDescriptor = {
  readonly routeId: string;
  readonly providerId: string;
  readonly executorId: string;
  readonly productId: string;
  readonly instrumentId: string;
  readonly providerSymbol: string;
  readonly venueId: string;
  readonly availability: RouteAvailabilityState;
  readonly providerEnvironment: 'simulation' | 'sandbox' | 'production_candidate';
  readonly supportedOrderActions: readonly SupportedOrderActionType[];
  readonly minimumNotional?: SerializedMoney;
  readonly minimumQuantity?: string;
  readonly accountClassRequired?: string;
  readonly feeMetadata?: readonly { readonly code: string; readonly basisPoints: number; readonly description: string }[];
};

export type ExecutionRouteDecision = {
  readonly decisionId: QualificationDecisionId;
  readonly routeReady: boolean;
  readonly route: ExecutionRouteDescriptor | null;
  readonly availability: RouteAvailabilityState;
  readonly reasonCodes: readonly QualificationReasonCode[];
  readonly decidedAt: UtcInstant;
};

export type QualificationTermsSnapshot = {
  readonly snapshotId: string;
  readonly capturedAt: UtcInstant;
  readonly validUntil: UtcInstant;
  readonly priceReference?: { readonly symbol: string; readonly minorUnits: string; readonly currency: string; readonly asOf: UtcInstant };
  readonly spreadBps?: number;
  readonly minimumSize?: SerializedMoney;
  readonly feeMetadata?: readonly { readonly code: string; readonly basisPoints: number; readonly description: string }[];
  readonly liquidityState: 'ADEQUATE' | 'THIN' | 'UNKNOWN';
  readonly venueSession: VenueSessionState;
  readonly providerAvailability: RouteAvailabilityState;
};

export type ExecutableOpportunityTransition = {
  readonly from: ExecutableOpportunityState;
  readonly to: ExecutableOpportunityState;
  readonly reasonCodes: readonly QualificationReasonCode[];
  readonly occurredAt: UtcInstant;
  readonly decisionId?: QualificationDecisionId;
};

export type ExecutableOpportunity = {
  readonly executableOpportunityId: ExecutableOpportunityId;
  readonly candidateId: OpportunityCandidateId;
  readonly workOrderId: EconomicWorkOrderId;
  readonly customerId: CustomerId;
  readonly subjectId: string;
  readonly state: ExecutableOpportunityState;
  readonly candidate: OpportunityCandidate;
  readonly instrument: CanonicalInstrumentBinding | null;
  readonly evidenceDecision: EvidenceVerificationDecision | null;
  readonly eligibilityDecision: CustomerEligibilityDecision | null;
  readonly routeDecision: ExecutionRouteDecision | null;
  readonly terms: QualificationTermsSnapshot | null;
  readonly qualificationExpiresAt: UtcInstant | null;
  readonly reasonCodes: readonly QualificationReasonCode[];
  readonly grantsExecutionAuthority: false;
  readonly authorizesFinancialExecution: false;
  readonly proposalPath: 'GROW_OPPORTUNITY_PROPOSAL';
  readonly transitionHistory: readonly ExecutableOpportunityTransition[];
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
  readonly discoveredAt: UtcInstant;
  readonly qualifiedAt: UtcInstant | null;
  readonly originatingOpportunityId?: OpportunityId;
};

export type QualificationPipelineResult = {
  readonly outcome: QualificationOutcome;
  readonly opportunity: ExecutableOpportunity;
  readonly reasonCodes: readonly QualificationReasonCode[];
  readonly grantsExecutionAuthority: false;
  readonly authorizesFinancialExecution: false;
};

export type ExecutableOpportunityMetricsSnapshot = {
  readonly discoveredCount: number;
  readonly evidenceRejectedCount: number;
  readonly staleCount: number;
  readonly customerIneligibleCount: number;
  readonly noRouteCount: number;
  readonly routeReadyCount: number;
  readonly qualifiedForProposalCount: number;
  readonly averageObservationToQualificationMs: number | null;
};

export type EvidenceRegistryPort = {
  resolve(ref: string): AdmissibleEvidenceRecord | null;
};

export type ExecutionRouteRegistryPort = {
  routeFor(input: {
    readonly productId: string;
    readonly instrumentId: string;
    readonly jurisdiction: Jurisdiction;
  }): ExecutionRouteDescriptor | null;
};

export type MarketTermsPort = {
  currentTerms(input: {
    readonly route: ExecutionRouteDescriptor;
    readonly now: UtcInstant;
  }): QualificationTermsSnapshot | { readonly ok: false; readonly reason: QualificationReasonCode };
};
