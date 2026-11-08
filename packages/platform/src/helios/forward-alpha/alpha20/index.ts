export {
  HELIOS_ALPHA20_FORWARD_EXPERIMENTS_SCHEMA,
  COHORT_MEMBER_ROLES,
  COHORT_STRATEGY_LANES,
  OPPORTUNITY_ASSIGNMENT_MODES,
  STOPPING_POLICY_KINDS,
  EVOL_NOMINATION_PHASES,
  HELIOS_ALPHA20_FORWARD_EXPERIMENTS_QUALIFIED,
  HELIOS_ALPHA20_FORWARD_EXPERIMENTS_BLOCKED,
  type CohortMemberRole,
  type CohortStrategyLane,
  type OpportunityAssignmentMode,
  type StoppingPolicyKind,
  type EvolNominationPhase,
} from './taxonomy.ts';

export type {
  ForwardExperimentId,
  ChronologicalMarketOpportunity,
  ChronologicalOpportunitySet,
  ForwardExperimentPreregistration,
  ForwardExperimentLifecycle,
  ForwardControlStrategy,
  ForwardTreatmentStrategy,
  CohortAllocationPolicy,
  ForwardCohort,
  CohortMemberOutcomeSlice,
  CohortComparison,
  EvolChallengerNomination,
  ForwardCohortExperimentEvidence,
} from './types.ts';

export { mulberry32 } from './rng.ts';

export {
  sealForwardExperimentPreregistration,
  assertPreregistrationUnchanged,
} from './preregistration.ts';

export {
  createChronologicalOpportunitySet,
  sharedOpportunityIdsForCohort,
  assertMembersShareIdenticalOpportunityCalendar,
  rejectUnequalOpportunitySets,
} from './opportunity-alignment.ts';

export {
  isControlRole,
  isTreatmentRole,
  createForwardControlStrategy,
  createForwardTreatmentStrategy,
} from './strategies.ts';

export {
  buildCohortAllocationPolicy,
  deterministicOpportunityPermutation,
  assertCustomerCapitalNeverRandomized,
} from './allocation.ts';

export {
  asForwardExperimentId,
  createForwardCohort,
  startForwardCohortExperiment,
} from './cohort.ts';

export {
  bootstrapCohortShadowCapital,
  memberShadowNavMinor,
  verifyIsolatedShadowPosture,
  sumMemberWeightsConserved,
  type CohortShadowCapitalLedger,
} from './shadow-capital.ts';

export {
  acceptEvolChallengerNomination,
  rejectCampaignRewriteAfterStart,
  assertEvolCannotMutateActiveCampaign,
  type AcceptEvolChallengerInput,
} from './evol-nomination.ts';

export {
  buildCohortComparison,
  evaluateStoppingPolicySatisfied,
  type MemberOutcomeInput,
} from './comparison.ts';

export { runForwardCohortExperimentPipeline } from './engine.ts';

export {
  evaluateAlpha20ForwardExperimentsQualification,
  type Alpha20QualificationResult,
} from './qualification.ts';

export {
  alpha20FixtureOpportunities,
  alpha20QualifiedForwardCohort,
  alpha20FixtureMemberOutcomes,
} from './fixtures.ts';
