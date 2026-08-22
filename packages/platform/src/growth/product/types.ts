import type { ApprovalState } from '../../../../permissions/src/approval.ts';
import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { SerializedMoney } from '../../mandate/types.ts';
import type {
  AssumptionSetId,
  FinancialProposalId,
  FinancialProposalVersion,
  GrowMoneyPlanId,
  GrowMoneyPlanVersion,
  GrowPlanComponentId,
  ScenarioRunId,
  SuitabilitySnapshotId,
} from './ids.ts';
import type {
  AlternativeKind,
  AssumptionAvailability,
  FeeCertainty,
  FinancialProposalActionType,
  FinancialProposalStatus,
  GrowExecutionMethod,
  GrowPlanComponentKind,
  GrowPolicyDecision,
  GrowRequiredApproval,
  GrowRiskProfile,
  ProductGrowthPlanStatus,
  ScenarioKind,
  SuitabilityDecision,
} from './taxonomy.ts';

export type GrowMoneyAmount = SerializedMoney;

export type GrowMoneyRange = {
  readonly min: GrowMoneyAmount;
  readonly max: GrowMoneyAmount;
};

export type GrowthProductActor = {
  readonly actorId: string;
  readonly subjectId: string;
  readonly capabilities: readonly string[];
  readonly jurisdiction: string;
  readonly verification: string;
  readonly restricted: boolean;
  readonly principalKind: 'HUMAN' | 'AGENT';
  readonly authenticationStrength: 'STANDARD' | 'STEP_UP';
};

export type ReturnAssumption = {
  readonly assumptionSetId: AssumptionSetId;
  readonly availability: AssumptionAvailability;
  readonly unavailableReason?: string;
  readonly catalogId?: string;
  readonly assetSleeve?: string;
  readonly currency: string;
  readonly riskProfile: GrowRiskProfile;
  readonly dataAsOf?: UtcInstant;
  readonly source?: string;
  readonly methodology?: string;
  readonly conservativeAnnualBps?: number;
  readonly baseAnnualBps?: number;
  readonly upsideAnnualBps?: number;
  readonly volatilityBps?: number;
  readonly feeBpsAnnual?: number;
  readonly guaranteed: false;
  readonly inventedByModel: false;
  readonly environment: 'simulation';
};

export type KnownFee = {
  readonly code: string;
  readonly description: string;
  readonly certainty: FeeCertainty;
  readonly annualBps?: number;
  readonly amount?: GrowMoneyAmount;
  readonly includedInProjection: boolean;
  readonly note: string;
};

export type GrowPlanComponent = {
  readonly componentId: GrowPlanComponentId;
  readonly kind: GrowPlanComponentKind;
  readonly purpose: string;
  readonly amount: GrowMoneyAmount;
  readonly amountRange?: GrowMoneyRange;
  readonly currency: string;
  readonly risk: GrowRiskProfile;
  readonly liquidity: string;
  readonly fees: readonly KnownFee[];
  readonly dependencies: readonly string[];
  readonly executionMethod: GrowExecutionMethod;
  readonly requiredApproval: readonly GrowRequiredApproval[];
  readonly assumptionAvailability: AssumptionAvailability;
  readonly instrument?: string;
  readonly sourceAccountId?: string;
  readonly destination?: string;
};

export type PossibleLossIllustration = {
  readonly illustrated: true;
  readonly guaranteed: false;
  readonly oneYearStress: GrowMoneyAmount;
  readonly note: string;
};

export type ScenarioProjection = {
  readonly kind: ScenarioKind;
  readonly availability: AssumptionAvailability;
  readonly unavailableReason?: string;
  readonly timeHorizonMonths: number;
  readonly illustratedLow: GrowMoneyAmount;
  readonly illustratedMid: GrowMoneyAmount;
  readonly illustratedHigh: GrowMoneyAmount;
  readonly contributionsApplied: GrowMoneyAmount;
  readonly feesApplied: GrowMoneyAmount;
  readonly uncertainty: string;
  readonly risk: GrowRiskProfile;
  readonly possibleLoss: PossibleLossIllustration;
  readonly fees: readonly KnownFee[];
  readonly assumptions: ReturnAssumption;
  readonly dataAsOf?: UtcInstant;
  readonly sourceDate?: UtcInstant;
  readonly guaranteedOutcome: false;
  readonly notAPromise: true;
  readonly illustratedOnly: true;
};

export type MonteCarloPercentiles = {
  readonly pathCount: number;
  readonly seed: number;
  readonly methodology: string;
  readonly p10: GrowMoneyAmount;
  readonly p50: GrowMoneyAmount;
  readonly p90: GrowMoneyAmount;
  readonly pathsBelowStart: number;
  readonly illustratedShareBelowStart: string;
  readonly guaranteedOutcome: false;
  readonly notAPromise: true;
  readonly probabilityLanguage: string;
};

export type ScenarioAnalysis = {
  readonly runId: ScenarioRunId;
  readonly methodology: string;
  readonly inputs: ScenarioInputs;
  readonly conservative: ScenarioProjection;
  readonly base: ScenarioProjection;
  readonly upside: ScenarioProjection;
  readonly monteCarlo?: MonteCarloPercentiles;
  readonly guaranteedOutcome: false;
};

export type ScenarioInputs = {
  readonly startingCapital: GrowMoneyAmount;
  readonly recurringContribution: GrowMoneyAmount;
  readonly contributionCadence: 'MONTHLY';
  readonly timeHorizonMonths: number;
  readonly withdrawals: GrowMoneyAmount;
  readonly assumptionSetId: AssumptionSetId;
  readonly assumptionAvailability: AssumptionAvailability;
  readonly seed: number;
};

export type StartingFinancialSnapshot = {
  readonly asOf: UtcInstant;
  readonly startingCapital: GrowMoneyAmount;
  readonly recurringContribution: GrowMoneyAmount;
  readonly liquidityRequirement?: GrowMoneyAmount;
  readonly sourceAccountId?: string;
  readonly notes: readonly string[];
};

export type ProductGrowthPlan = {
  readonly planId: GrowMoneyPlanId;
  readonly version: GrowMoneyPlanVersion;
  readonly ownerId: string;
  readonly goalRefs: readonly string[];
  readonly startingSnapshot: StartingFinancialSnapshot;
  readonly targetOutcome?: GrowMoneyAmount;
  readonly timeHorizonMonths: number;
  readonly riskProfile: GrowRiskProfile;
  readonly liquidityRequirement?: GrowMoneyAmount;
  readonly components: readonly GrowPlanComponent[];
  readonly assumptions: ReturnAssumption;
  readonly scenarioAnalysis: ScenarioAnalysis;
  readonly fees: readonly KnownFee[];
  readonly status: ProductGrowthPlanStatus;
  readonly createdAt: UtcInstant;
  readonly expiresAt: UtcInstant;
  readonly productionActive: false;
  readonly guaranteedOutcome: false;
  readonly orchestratorPlanId?: string;
};

export type ProposalExplanation = {
  readonly whyThisAction: string;
  readonly whatDataSupportsIt: readonly string[];
  readonly expectedEffect: string;
  readonly whatCouldGoWrong: string;
  readonly fees: string;
  readonly liquidity: string;
  readonly alternatives: string;
  readonly goalImpact: string;
  readonly risks: string;
  readonly dataAssumptions: string;
  readonly inventedByModel: false;
};

export type ProposalAlternative = {
  readonly kind: AlternativeKind;
  readonly actionType: FinancialProposalActionType;
  readonly label: string;
  readonly amount: GrowMoneyAmount;
  readonly risk: GrowRiskProfile;
  readonly reason: string;
};

export type SuitabilitySnapshot = {
  readonly snapshotId: SuitabilitySnapshotId;
  readonly frozenAt: UtcInstant;
  readonly riskProfile: GrowRiskProfile;
  readonly timeHorizonMonths: number;
  readonly liquidityRequirement?: GrowMoneyAmount;
  readonly jurisdiction: string;
  readonly verification: string;
  readonly restricted: boolean;
  readonly circumstanceHash: string;
  readonly decision: SuitabilityDecision;
  readonly notes: readonly string[];
};

export type ExpectedEffect = {
  readonly description: string;
  readonly illustratedMid: GrowMoneyAmount;
  readonly effectRange: GrowMoneyRange;
  readonly guaranteedOutcome: false;
  readonly notAPromise: true;
};

export type FinancialProposal = {
  readonly proposalId: FinancialProposalId;
  readonly version: FinancialProposalVersion;
  readonly planId: GrowMoneyPlanId;
  readonly opportunityId?: string;
  readonly ownerId: string;
  readonly actionType: FinancialProposalActionType;
  readonly instrument: string;
  readonly sourceAccountId?: string;
  readonly destination: string;
  readonly amount: GrowMoneyAmount;
  readonly currency: string;
  readonly expectedEffect: ExpectedEffect;
  readonly effectRange: GrowMoneyRange;
  readonly risk: GrowRiskProfile;
  readonly fees: readonly KnownFee[];
  readonly liquidity: string;
  readonly reason: string;
  readonly alternatives: readonly ProposalAlternative[];
  readonly assumptions: ReturnAssumption;
  readonly explanation: ProposalExplanation;
  readonly requiredApprovals: readonly GrowRequiredApproval[];
  readonly suitability: SuitabilitySnapshot;
  readonly policyDecision: GrowPolicyDecision;
  readonly policyReason: string;
  readonly approvalState: ApprovalState;
  readonly status: FinancialProposalStatus;
  readonly materialTermsHash: string;
  readonly createdAt: UtcInstant;
  readonly expiresAt: UtcInstant;
  readonly presentedAt?: UtcInstant;
  readonly decidedAt?: UtcInstant;
  readonly supersededBy?: FinancialProposalId;
  readonly supersedes?: FinancialProposalId;
  readonly executionAuthorityId: null;
  readonly productionActive: false;
  readonly guaranteedOutcome: false;
  readonly serverIssued: true;
};

export type CreateGrowPlanInput = {
  readonly ownerId: string;
  readonly startingCapitalMinorUnits: string;
  readonly currency: string;
  readonly timeHorizonMonths: number;
  readonly riskProfile: GrowRiskProfile;
  readonly goalTargetMinorUnits?: string;
  readonly goalRefs?: readonly string[];
  readonly liquidityRequirementMinorUnits?: string;
  readonly recurringContributionMinorUnits?: string;
  readonly sourceAccountId?: string;
  readonly opportunityId?: string;
  readonly ttlHours?: number;
};

export type ModifyProposalInput = {
  readonly amountMinorUnits?: string;
  readonly goalAllocationMinorUnits?: string;
  readonly riskProfile?: GrowRiskProfile;
};

export type GrowProductFailure = {
  readonly code:
    | 'ACTOR_REQUIRED'
    | 'CAPABILITY_DENIED'
    | 'CROSS_USER_DENIED'
    | 'PLAN_NOT_FOUND'
    | 'PROPOSAL_NOT_FOUND'
    | 'FABRICATED_PROPOSAL_ID'
    | 'VALIDATION'
    | 'IMMUTABLE'
    | 'EXPIRED'
    | 'ILLEGAL_TRANSITION'
    | 'POLICY_DENIED'
    | 'SUITABILITY_DENIED'
    | 'REVALIDATION_REQUIRED'
    | 'STEP_UP_REQUIRED'
    | 'AGENT_CANNOT_APPROVE'
    | 'AGENT_CANNOT_EXECUTE'
    | 'ASSUMPTION_UNAVAILABLE'
    | 'FRONTEND_CANNOT_ISSUE';
  readonly message: string;
};

export type LovableGrowExperience = {
  readonly schema: 'sunrey.lovable.grow-my-money.v1';
  readonly iHave: GrowMoneyAmount;
  readonly myGoal: GrowMoneyAmount | null;
  readonly timeHorizonMonths: number;
  readonly risk: GrowRiskProfile;
  readonly yourGrowthPlan: {
    readonly cashReserve: GrowPlanComponent | null;
    readonly investments: GrowPlanComponent | null;
    readonly recurringContributions: GrowPlanComponent | null;
    readonly otherEligibleActions: readonly GrowPlanComponent[];
  };
  readonly scenarios: {
    readonly conservative: ScenarioProjection;
    readonly base: ScenarioProjection;
    readonly upside: ScenarioProjection;
  };
  readonly uncertainty: string;
  readonly guaranteedOutcome: false;
  readonly productionActive: false;
};
