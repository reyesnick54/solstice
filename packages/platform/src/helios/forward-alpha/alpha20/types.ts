import type { UtcInstant } from '@solstice/domain';

import type {
  CohortMemberRole,
  CohortStrategyLane,
  HELIOS_ALPHA20_FORWARD_EXPERIMENTS_SCHEMA,
  OpportunityAssignmentMode,
  StoppingPolicyKind,
} from './taxonomy.ts';

export type ForwardExperimentId = string & { readonly __brand: 'ForwardExperimentId' };

/** One tradable decision window shared across cohort members when economically appropriate. */
export type ChronologicalMarketOpportunity = {
  readonly opportunityId: string;
  readonly chronologicalIndex: number;
  readonly decisionAt: UtcInstant;
  readonly instrumentId: string;
  readonly knowableAt: UtcInstant;
};

export type ChronologicalOpportunitySet = {
  readonly schema: typeof HELIOS_ALPHA20_FORWARD_EXPERIMENTS_SCHEMA;
  readonly opportunitySetId: string;
  readonly opportunities: readonly ChronologicalMarketOpportunity[];
  readonly strictlyChronological: true;
};

export type ForwardExperimentPreregistration = {
  readonly schema: typeof HELIOS_ALPHA20_FORWARD_EXPERIMENTS_SCHEMA;
  readonly preregistrationId: string;
  readonly primaryOutcomeMetricId: string;
  readonly secondaryOutcomeMetricIds: readonly string[];
  readonly benchmarkId: string;
  readonly minimumSampleOpportunities: number;
  readonly stoppingPolicy: {
    readonly kind: StoppingPolicyKind;
    readonly fixedHorizonOpportunities: number | null;
    readonly alpha07CampaignRef: string | null;
  };
  readonly sealedAt: UtcInstant;
  readonly preregistrationFingerprint: string;
};

export type ForwardExperimentLifecycle = {
  readonly state: 'SEALED' | 'ACTIVE' | 'COMPLETED' | 'ABORTED';
  readonly sealedAt: UtcInstant;
  readonly startedAt: UtcInstant | null;
  readonly completedAt: UtcInstant | null;
};

type ForwardCohortStrategyBase = {
  readonly schema: typeof HELIOS_ALPHA20_FORWARD_EXPERIMENTS_SCHEMA;
  readonly memberId: string;
  readonly strategyId: string;
  readonly strategyVersion: string;
  readonly role: CohortMemberRole;
  readonly lane: CohortStrategyLane;
  /** Isolated research shadow capital registration (never customer capital). */
  readonly shadowCapitalRegistrationId: string;
  readonly assignedOpportunityIds: readonly string[];
};

/** Control-arm strategy (benchmarks, cash, naive baselines, factors). */
export type ForwardControlStrategy = ForwardCohortStrategyBase & {
  readonly lane: 'CONTROL';
};

/** Treatment-arm strategy (incumbent, challenger candidates under test). */
export type ForwardTreatmentStrategy = ForwardCohortStrategyBase & {
  readonly lane: 'TREATMENT';
  readonly evolNominationRef: string | null;
};

export type CohortAllocationPolicy = {
  readonly schema: typeof HELIOS_ALPHA20_FORWARD_EXPERIMENTS_SCHEMA;
  readonly policyId: string;
  readonly experimentId: ForwardExperimentId;
  /** Per-member capital weight in basis points; must sum to 10_000 across members. */
  readonly memberWeightBps: Readonly<Record<string, number>>;
  readonly sharedPortfolioCapitalMinor: string;
  readonly isolatedShadowAccounts: true;
  readonly customerCapitalRandomized: false;
  readonly opportunityAssignmentMode: OpportunityAssignmentMode;
  readonly assignmentSeed: number | null;
};

export type ForwardCohort = {
  readonly schema: typeof HELIOS_ALPHA20_FORWARD_EXPERIMENTS_SCHEMA;
  readonly experimentId: ForwardExperimentId;
  readonly cohortId: string;
  readonly preregistration: ForwardExperimentPreregistration;
  readonly lifecycle: ForwardExperimentLifecycle;
  readonly opportunitySet: ChronologicalOpportunitySet;
  readonly allocationPolicy: CohortAllocationPolicy;
  readonly controlStrategies: readonly ForwardControlStrategy[];
  readonly treatmentStrategies: readonly ForwardTreatmentStrategy[];
  readonly simulationOnly: true;
  readonly grantsExecutionAuthority: false;
};

export type CohortMemberOutcomeSlice = {
  readonly memberId: string;
  readonly strategyId: string;
  readonly lane: CohortStrategyLane;
  readonly role: CohortMemberRole;
  readonly opportunityCount: number;
  readonly primaryOutcomeBps: number;
  readonly activeReturnBps: number;
  readonly shadowNavMinor: string;
};

export type CohortComparison = {
  readonly schema: typeof HELIOS_ALPHA20_FORWARD_EXPERIMENTS_SCHEMA;
  readonly experimentId: ForwardExperimentId;
  readonly comparedAt: UtcInstant;
  readonly opportunitySetId: string;
  readonly identicalOpportunitySets: boolean;
  readonly calendarAlignmentVerified: boolean;
  readonly memberOutcomes: readonly CohortMemberOutcomeSlice[];
  readonly treatmentVsControlActiveReturnDeltaBps: number;
  readonly primaryOutcomeTreatmentAdvantageBps: number;
  readonly sampleRequirementMet: boolean;
  readonly stoppingPolicySatisfied: boolean;
};

export type EvolChallengerNomination = {
  readonly nominationId: string;
  readonly genomeId: string;
  readonly parameterVectorFingerprint: string;
  readonly nominatedAt: UtcInstant;
  readonly trialFamilyId: string;
};

export type ForwardCohortExperimentEvidence = {
  readonly schema: typeof HELIOS_ALPHA20_FORWARD_EXPERIMENTS_SCHEMA;
  readonly experimentId: ForwardExperimentId;
  readonly cohort: ForwardCohort;
  readonly comparison: CohortComparison;
  readonly evolNominationsAccepted: readonly EvolChallengerNomination[];
  readonly campaignRewriteAttemptBlocked: boolean;
  readonly qualificationMarker:
    | 'HELIOS_ALPHA20_FORWARD_EXPERIMENTS_QUALIFIED'
    | 'HELIOS_ALPHA20_FORWARD_EXPERIMENTS_BLOCKED';
};
