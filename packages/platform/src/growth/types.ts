import type { AgentProposalId } from '../../../agent/src/ids.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';
import type {
  EconomicMandateId,
  GrowthActionId,
  GrowthCycleId,
  GrowthPlanId,
  GrowthPlanVersion,
  MandateGoalId,
  MandateVersion,
} from '../ids.ts';
import type { SerializedMoney } from '../mandate/types.ts';
import type { EconomicEffect } from './effects.ts';
import type {
  CandidateSource,
  ExecutionCapabilityState,
  FeasibilityRejectionReason,
  GoalFeasibilityState,
  GrowthActionKind,
  GrowthCycleState,
  GrowthPlanState,
  RiskClass,
} from './taxonomy.ts';

export type MandateConstraintEvaluation = {
  readonly satisfied: boolean;
  readonly violatedConstraintKinds: readonly string[];
  readonly notes: readonly string[];
};

export type GrowthActionCandidate = {
  readonly actionId: GrowthActionId;
  readonly action: GrowthActionKind;
  readonly source: CandidateSource;
  readonly title: string;
  readonly expectedEffect: EconomicEffect;
  readonly confidenceScore: number;
  readonly assumptions: readonly string[];
  readonly liquidityImpact: SerializedMoney;
  readonly riskClass: RiskClass;
  readonly mandateEvaluation: MandateConstraintEvaluation;
  readonly userConfirmationRequired: boolean;
  readonly policyRequirement: string;
  readonly complianceRequirement: string;
  readonly executionCapability: ExecutionCapabilityState;
  readonly sourceAccountId?: string;
  readonly destinationAccountId?: string;
  readonly proposedAmount?: SerializedMoney;
  readonly supportingFactRefs: readonly string[];
  readonly supportingGoalIds: readonly MandateGoalId[];
  readonly agentProposalIds: readonly AgentProposalId[];
  readonly pegOpportunityIds: readonly string[];
};

export type FeasibilityResult = {
  readonly actionId: GrowthActionId;
  readonly accepted: boolean;
  readonly deferred: boolean;
  readonly reasons: readonly FeasibilityRejectionReason[];
  readonly detail: string;
};

export type GoalFeasibility = {
  readonly goalId: MandateGoalId;
  readonly state: GoalFeasibilityState;
  readonly requiredChange?: SerializedMoney;
  readonly limitations: readonly string[];
  readonly uncertaintyNotes: readonly string[];
  readonly achievementPromised: false;
  readonly investmentExecutionAvailable: boolean;
};

export type ActionExplanation = {
  readonly actionId: GrowthActionId;
  readonly whyThis: string;
  readonly whyNow: string;
  readonly supportedGoal: string;
  readonly supportingFacts: readonly string[];
  readonly mandateRule: string;
  readonly rejectedAlternatives: readonly string[];
  readonly whatCouldGoWrong: string;
  readonly requiresConfirmation: boolean;
  readonly canExecuteToday: false | true;
};

export type GrowthCycle = {
  readonly cycleId: GrowthCycleId;
  readonly subjectId: string;
  readonly mandateId: EconomicMandateId;
  readonly mandateVersion: MandateVersion;
  readonly state: GrowthCycleState;
  readonly createdAt: UtcInstant;
  readonly pegSnapshotId?: string;
};

export type GrowthPlan = {
  readonly planId: GrowthPlanId;
  readonly version: GrowthPlanVersion;
  readonly cycleId: GrowthCycleId;
  readonly subjectId: string;
  readonly mandateId: EconomicMandateId;
  readonly mandateVersion: MandateVersion;
  readonly pegSnapshotId: string;
  readonly generatedAt: UtcInstant;
  readonly planningVersion: 'PLANNING_PRIORITY_V1';
  readonly state: GrowthPlanState;
  readonly goalsAddressed: readonly MandateGoalId[];
  readonly goalFeasibility: readonly GoalFeasibility[];
  readonly candidateActions: readonly GrowthActionCandidate[];
  readonly rejectedCandidates: readonly {
    readonly candidate: GrowthActionCandidate;
    readonly reasons: readonly FeasibilityRejectionReason[];
    readonly detail: string;
  }[];
  readonly orderedProposedActions: readonly GrowthActionCandidate[];
  readonly expectedDeterministicEffect: SerializedMoney;
  readonly estimatedUncertainEffect?: EconomicEffect;
  readonly assumptions: readonly string[];
  readonly risks: readonly string[];
  readonly unresolvedQuestions: readonly string[];
  readonly dependencies: readonly string[];
  readonly nextReviewTrigger: string;
  readonly explanations: readonly ActionExplanation[];
  readonly agentProposalIds: readonly AgentProposalId[];
  readonly zeroProposalsValid: boolean;
};

export type EligibleAccount = {
  readonly accountRef: string;
  readonly currency: string;
  readonly accountClass?: string;
};

export type PevePlanningSignals = {
  readonly resiliencePoints?: string;
  readonly opportunityMinorUnits?: string;
  readonly currency?: string;
  readonly completeness?: string;
  readonly mayExecute: false;
};

export type PlanningRiskAnnotation = {
  readonly candidateRef: string;
  readonly compatible: boolean;
  readonly outcome: string;
  readonly reason: string;
};

export type PlanningContext = {
  readonly frozenAccountIds?: readonly string[];
  readonly eligibleAccounts?: readonly EligibleAccount[];
  readonly investmentExecutionImplemented: false;
  readonly peve?: PevePlanningSignals;
  readonly riskAnnotations?: readonly PlanningRiskAnnotation[];
};
