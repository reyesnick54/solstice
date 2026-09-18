import type { CustomerId } from '../../../../domain/src/customer.ts';
import type { Jurisdiction } from '../../../../domain/src/jurisdiction.ts';
import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { EconomicWorkOrderId } from '../ids.ts';
import type { EconomicWorkOrder } from '../types.ts';
import type { WorkOrderAuthorityBinding } from '../execution-types.ts';
import type { CompiledEconomicMandate } from '../../mandate/types.ts';
import type { ExecutableOpportunityId, OpportunityCandidateId } from '../executable-opportunity/ids.ts';
import type {
  EvidenceRegistryPort,
  ExecutionRouteDescriptor,
  ExecutionRouteRegistryPort,
  MarketTermsPort,
  OpportunityCandidate,
  QualificationTermsSnapshot,
} from '../executable-opportunity/types.ts';
import type { MetaAllocatorRecommendation } from '../meta-allocator/types.ts';
import type { StrategyCapsuleRef, StrategyCapsuleRegistryPort } from '../strategy-capsule/types.ts';
import type { HeliosJurisdictionCapabilityResult } from '../jurisdiction-capability/types.ts';
import type { DecisionValidityEnvelopeId } from './ids.ts';
import type {
  EnvelopeComponentKind,
  EnvelopeFailureAction,
  EnvelopeReasonCode,
  EnvelopeValidityStatus,
} from './taxonomy.ts';

export type ComponentCheckStatus = EnvelopeValidityStatus;

export type ComponentCheckResult = {
  readonly component: EnvelopeComponentKind;
  readonly status: ComponentCheckStatus;
  readonly reasonCodes: readonly EnvelopeReasonCode[];
  readonly inputRefs: readonly string[];
  readonly outputRef: string | null;
  readonly policyVersion: string;
  readonly evaluatedAt: UtcInstant;
  readonly validUntil: UtcInstant;
  readonly critical: boolean;
};

export type DecisionLatencyMarkers = {
  readonly evidenceArrivedAt: UtcInstant | null;
  readonly candidateDiscoveredAt: UtcInstant;
  readonly researchCompletedAt: UtcInstant | null;
  readonly qualificationAt: UtcInstant | null;
  readonly envelopeEvaluatedAt: UtcInstant;
  readonly proposalReadyAt: UtcInstant | null;
};

export type DecisionValidityEnvelope = {
  readonly envelopeId: DecisionValidityEnvelopeId;
  readonly candidateId: OpportunityCandidateId;
  readonly executableOpportunityId: ExecutableOpportunityId | null;
  readonly strategyCapsuleRef: StrategyCapsuleRef;
  readonly strategyCapsuleHash: string;
  readonly workOrderId: EconomicWorkOrderId;
  readonly customerId: CustomerId;
  readonly accountId: string;
  readonly proposedActionRef: string | null;
  readonly metaAllocatorRecommendationId: string;
  readonly createdAt: UtcInstant;
  readonly evaluatedAt: UtcInstant;
  readonly validUntil: UtcInstant;
  readonly policyVersion: string;
  readonly componentChecks: readonly ComponentCheckResult[];
  readonly overallStatus: EnvelopeValidityStatus;
  readonly failureAction: EnvelopeFailureAction | null;
  readonly reasonCodes: readonly EnvelopeReasonCode[];
  readonly evidenceRefs: readonly string[];
  readonly latencyMarkers: DecisionLatencyMarkers;
  readonly revision: number;
  readonly supersedesEnvelopeId: DecisionValidityEnvelopeId | null;
  readonly grantsFinancialEffect: false;
  readonly grantsExecutionAuthority: false;
  readonly authorizesFinancialExecution: false;
};

export type EnvelopeEvaluationContext = {
  readonly now: UtcInstant;
  readonly candidate: OpportunityCandidate;
  readonly recommendation: MetaAllocatorRecommendation;
  readonly capsule: StrategyCapsuleRef;
  readonly workOrder: EconomicWorkOrder | null;
  readonly mandate: CompiledEconomicMandate | null;
  readonly authorityBinding: WorkOrderAuthorityBinding | null;
  readonly jurisdiction: Jurisdiction;
  readonly accountId: string;
  readonly terms: QualificationTermsSnapshot | null;
  readonly route: ExecutionRouteDescriptor | null;
  readonly venueSession: 'OPEN' | 'CLOSED' | 'PRE_MARKET' | 'POST_MARKET' | 'UNKNOWN';
  readonly availableFundsMinor: string;
  readonly reservedFundsMinor: string;
  readonly deployedCapitalMinor: string;
  readonly strategyCapacityMinor: string;
  readonly proposedNotionalMinor: string;
  readonly currency: string;
  readonly instrumentActive: boolean;
  readonly instrumentHalted: boolean;
  readonly jurisdictionCapabilityEnabled: boolean;
  /** H28 — when provided, overrides jurisdictionCapabilityEnabled boolean. */
  readonly jurisdictionCapabilityResult?: HeliosJurisdictionCapabilityResult | null;
  readonly modelVersionQualified: boolean;
  readonly researchExpiresAt: UtcInstant | null;
  readonly researchCompletedAt: UtcInstant | null;
  readonly qualificationAt: UtcInstant | null;
  readonly evidenceArrivedAt: UtcInstant | null;
  readonly executableOpportunityId?: ExecutableOpportunityId;
  readonly proposedActionRef?: string;
  readonly afterRestart?: boolean;
};

export type EnvelopeEvaluationPorts = {
  readonly evidenceRegistry: EvidenceRegistryPort;
  readonly routeRegistry: ExecutionRouteRegistryPort;
  readonly marketTerms: MarketTermsPort;
  readonly capsuleRegistry: StrategyCapsuleRegistryPort;
  readonly riskPort?: RiskAssessmentPort;
};

export type RiskAssessmentPort = {
  assess(input: {
    readonly proposedNotionalMinor: bigint;
    readonly instrumentId: string;
    readonly customerId: string;
  }): {
    readonly outcome: 'ALLOW' | 'BLOCK' | 'REQUIRE_REVIEW' | 'UNKNOWN';
    readonly assessmentId?: string;
  };
};

export type EnvelopeEvaluationResult = {
  readonly envelope: DecisionValidityEnvelope;
  readonly proposalEligible: boolean;
  readonly failureAction: EnvelopeFailureAction | null;
  readonly grantsFinancialEffect: false;
};

export type ProposalEligibilityResult =
  | { readonly eligible: true; readonly envelope: DecisionValidityEnvelope }
  | {
      readonly eligible: false;
      readonly envelope: DecisionValidityEnvelope;
      readonly failureAction: EnvelopeFailureAction;
      readonly reasonCodes: readonly EnvelopeReasonCode[];
    };

export type DecisionValidityStoreSnapshot = {
  readonly envelopes: readonly DecisionValidityEnvelope[];
};
