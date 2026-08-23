import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { PersonalEconomicSnapshot } from '../../../../personal-economic-graph/src/snapshot.ts';
import type { OpportunityId } from '../../ids.ts';
import type { CompiledEconomicMandate, SerializedMoney } from '../../mandate/types.ts';
import type { PolicyControlPort } from '../../policy-port.ts';
import type {
  ImpactKind,
  LiquidityImpactKind,
  OpportunityCategory,
  OpportunityDetectorKind,
  OpportunityFeedCardKind,
  OpportunityRiskLevel,
  OpportunitySource,
  OpportunityStatus,
  OpportunityTimeHorizon,
} from './taxonomy.ts';

export type OpportunityEvidence = {
  readonly factRefs: readonly string[];
  readonly detector: OpportunityDetectorKind;
  readonly snapshotId?: string;
  readonly notes: readonly string[];
};

export type RateCatalogReference = {
  readonly catalogId: string;
  readonly asOf: UtcInstant;
  readonly basisPoints: number;
  readonly currency: string;
  readonly authority: 'SIMULATION_CATALOG_NOT_A_PROMISE';
};

export type OpportunityImpact = {
  readonly kind: ImpactKind;
  readonly estimatedImpact?: SerializedMoney;
  readonly impactRange?: { readonly low: SerializedMoney; readonly high: SerializedMoney };
  readonly assumptions: readonly string[];
  readonly rateSource?: RateCatalogReference;
  readonly asOf: UtcInstant;
  readonly fees: readonly { readonly code: string; readonly amount: SerializedMoney; readonly description: string }[];
  readonly taxDisclaimer: string;
  readonly achievementPromised: false;
  readonly returnGuaranteed: false;
};

export type OpportunityEligibility = {
  readonly eligible: boolean;
  readonly immediatelyExecutable: false;
  readonly reasons: readonly string[];
  readonly failedChecks: readonly string[];
  readonly productId?: string;
  readonly providerId?: string;
};

export type OpportunityRanking = {
  readonly version: 'OPPORTUNITY_RANKING_V1';
  readonly priority: number;
  readonly total: number;
  readonly goalRelevance: number;
  readonly urgency: number;
  readonly confidence: number;
  readonly impactScore: number;
  readonly liquidityFit: number;
  readonly preferenceFit: number;
  readonly costPenalty: number;
  readonly reasons: readonly string[];
};

export type GoalLink = {
  readonly goalId: string;
  readonly label: string;
  readonly monthlyRequiredContribution?: SerializedMoney;
  readonly currentFunding?: SerializedMoney;
  readonly projectedShortfall?: SerializedMoney;
  readonly availableSurplus?: SerializedMoney;
  readonly achievementPromised: false;
};

export type Opportunity = {
  readonly opportunityId: OpportunityId;
  readonly subjectId: string;
  readonly type: OpportunityCategory;
  readonly detector: OpportunityDetectorKind;
  readonly title: string;
  readonly summary: string;
  readonly source: OpportunitySource;
  readonly eligible: boolean;
  readonly priority: number;
  readonly estimatedImpact?: SerializedMoney;
  readonly impactRange?: { readonly low: SerializedMoney; readonly high: SerializedMoney };
  readonly riskLevel: OpportunityRiskLevel;
  readonly liquidityImpact: LiquidityImpactKind;
  readonly timeHorizon: OpportunityTimeHorizon;
  readonly fees: readonly { readonly code: string; readonly amount: SerializedMoney; readonly description: string }[];
  readonly dependencies: readonly string[];
  readonly goalLinks: readonly GoalLink[];
  readonly evidence: OpportunityEvidence;
  readonly expiresAt: UtcInstant;
  readonly status: OpportunityStatus;
  readonly fingerprint: string;
  readonly impact: OpportunityImpact;
  readonly eligibility: OpportunityEligibility;
  readonly ranking: OpportunityRanking;
  readonly card: OpportunityFeedCardKind;
  readonly productId?: string;
  readonly currency: string;
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
  readonly supersededBy?: OpportunityId;
  readonly dismissalReason?: string;
  readonly proposalId?: string;
};

export type OpportunityPreferences = {
  readonly subjectId: string;
  readonly excludedCategories: readonly OpportunityCategory[];
  readonly liquidityPreference: 'PREFER_LIQUIDITY' | 'NEUTRAL' | 'ACCEPT_LESS_LIQUID';
  readonly maxRiskLevel: OpportunityRiskLevel;
  readonly goalPriorities: readonly string[];
  readonly updatedAt: UtcInstant;
  readonly cannotOverrideSuitability: true;
};

export type ProductCapability = {
  readonly productId: string;
  readonly category: OpportunityCategory;
  readonly available: boolean;
  readonly immediatelyExecutable: false;
  readonly minimumAmount?: SerializedMoney;
  readonly jurisdictions: readonly string[];
  readonly providerId: string;
  readonly providerAvailable: boolean;
  readonly requiresKyc: boolean;
  readonly maxRiskLevel: OpportunityRiskLevel;
};

export type PortfolioHolding = {
  readonly holdingId: string;
  readonly label: string;
  readonly amount: SerializedMoney;
  readonly weightBps?: number;
  readonly accountClass?: string;
};

export type PortfolioFacts = {
  readonly holdings: readonly PortfolioHolding[];
  readonly targetWeightsBps?: Readonly<Record<string, number>>;
  readonly investmentCash?: SerializedMoney;
  readonly concentrationLimitBps?: number;
};

export type LedgerLiquidPosition = {
  readonly accountRef: string;
  readonly currency: string;
  readonly minorUnits: string;
  readonly accountClass?: string;
  readonly restricted: boolean;
  readonly frozen: boolean;
};

export type OpportunityDiscoveryContext = {
  readonly now: UtcInstant;
  readonly jurisdiction: string;
  readonly kycState: 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'RESTRICTED';
  readonly customerRestricted: boolean;
  readonly riskProfile: 'CONSERVATIVE' | 'BALANCED' | 'GROWTH' | 'UNKNOWN';
  readonly suitabilityMaxRisk: OpportunityRiskLevel;
  readonly products: readonly ProductCapability[];
  readonly ledgerPositions?: readonly LedgerLiquidPosition[];
  readonly portfolio?: PortfolioFacts;
  readonly rateCatalog?: readonly RateCatalogReference[];
  readonly feeComparisons?: readonly {
    readonly obligationRef: string;
    readonly current: SerializedMoney;
    readonly alternative?: SerializedMoney;
    readonly alternativeLabel?: string;
  }[];
  readonly policy: PolicyControlPort;
  readonly preferences: OpportunityPreferences;
  readonly previous: readonly Opportunity[];
  readonly lastRecomputeAt?: UtcInstant;
};

export type DetectorFinding = {
  readonly detector: OpportunityDetectorKind;
  readonly title: string;
  readonly summary: string;
  readonly source: OpportunitySource;
  readonly currency: string;
  readonly estimatedImpact?: SerializedMoney;
  readonly impactRange?: { readonly low: SerializedMoney; readonly high: SerializedMoney };
  readonly riskLevel: OpportunityRiskLevel;
  readonly liquidityImpact: LiquidityImpactKind;
  readonly timeHorizon: OpportunityTimeHorizon;
  readonly fees: Opportunity['fees'];
  readonly dependencies: readonly string[];
  readonly goalIds: readonly string[];
  readonly evidence: OpportunityEvidence;
  readonly productId?: string;
  readonly confidence: number;
  readonly urgency: number;
  readonly assumptions: readonly string[];
  readonly rateSource?: RateCatalogReference;
  readonly impactKind: ImpactKind;
  readonly fingerprintAnchor: string;
};

export type OpportunityDiscoveryInput = {
  readonly subjectId: string;
  readonly snapshot: PersonalEconomicSnapshot;
  readonly mandate?: CompiledEconomicMandate;
  readonly context: OpportunityDiscoveryContext;
};

export type OpportunityProposalReceipt = {
  readonly opportunityId: OpportunityId;
  readonly proposalId: string;
  readonly status: 'ACCEPTED_FOR_PROPOSAL';
  readonly executesMoney: false;
  readonly issuesExecutionAuthority: false;
  readonly nextStep: 'USER_CONFIRMATION_THEN_KERNEL';
  readonly acceptedAt: UtcInstant;
};

export type OpportunityExplanationInput = {
  readonly schema: 'sunrey.growth.opportunity.explanation.v1';
  readonly opportunity: Opportunity;
  readonly inventedNumbersForbidden: true;
  readonly returnGuaranteeForbidden: true;
  readonly instructions: readonly string[];
};

export type OpportunityFeedCard = {
  readonly card: OpportunityFeedCardKind;
  readonly opportunityId: OpportunityId;
  readonly title: string;
  readonly summary: string;
  readonly category: OpportunityCategory;
  readonly status: OpportunityStatus;
  readonly eligible: boolean;
  readonly priority: number;
  readonly currency: string;
  readonly estimatedImpact?: SerializedMoney;
  readonly impactRange?: { readonly low: SerializedMoney; readonly high: SerializedMoney };
  readonly impactKind: ImpactKind;
  readonly riskLevel: OpportunityRiskLevel;
  readonly timeHorizon: OpportunityTimeHorizon;
  readonly goalLinks: readonly GoalLink[];
  readonly assumptions: readonly string[];
  readonly achievementPromised: false;
  readonly immediatelyExecutable: false;
};

export type OpportunityFeed = {
  readonly schema: 'sunrey.consumer.grow.opportunities.v1';
  readonly subjectId: string;
  readonly generatedAt: UtcInstant;
  readonly rankingVersion: 'OPPORTUNITY_RANKING_V1';
  readonly cards: readonly OpportunityFeedCard[];
  readonly items: readonly Opportunity[];
  readonly suppressedCount: number;
  readonly productionMoneyMovement: false;
};
