import type { Clock } from '../../../config/src/clock.ts';
import { err, ok, type Result } from '../../../domain/src/result.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';
import { isVerifiedActorContext } from '../../../identity/src/actor-context.ts';
import type { EconomicGraphService } from '../../../personal-economic-graph/src/service.ts';
import type { GrowthOrchestrator } from '../service.ts';
import { defaultConstraints, freezeConstraints, type PersonalEconomyConstraints } from './constraints.ts';
import {
  deterministicPlanId,
  deterministicProposalId,
  deterministicSnapshotId,
  objectiveVersionFor,
  type PersonalEconomyPlanId,
  type PersonalEconomyProposalId,
} from './ids.ts';
import { evaluatePersonalEconomyObjective, type PersonalEconomyObjective } from './objective.ts';
import {
  parseScenarioKind,
  scenarioFromNaturalLanguage,
  simulatePersonalEconomyScenario,
  type PersonalEconomyScenarioInput,
  type PersonalEconomyScenarioOutcome,
} from './scenario.ts';
import {
  freezePersonalEconomySnapshot,
  type AccessDemandSummary,
  type AccessEntitlementSummary,
  type ContributionOpportunitySummary,
  type PersonalEconomySnapshot,
  type TokenHoldingSummary,
} from './snapshot.ts';
import {
  PERSONAL_ECONOMY_INVARIANTS,
  PERSONAL_ECONOMY_RECOMMENDATION_TYPES,
  SIMULATION_DISCLAIMER,
  type PersonalEconomyRecommendationType,
  type PersonalEconomyRiskProfile,
} from './taxonomy.ts';

export type PersonalEconomyFailure = {
  readonly code:
    | 'ACTOR_CONTEXT_REQUIRED'
    | 'CAPABILITY_DENIED'
    | 'SUBJECT_MISMATCH'
    | 'GRAPH_UNAVAILABLE'
    | 'INVALID_SCENARIO'
    | 'PLAN_UNAVAILABLE';
  readonly message: string;
};

export type PersonalEconomyRecommendation = {
  readonly proposalId: PersonalEconomyProposalId;
  readonly recommendationType: PersonalEconomyRecommendationType;
  readonly title: string;
  readonly rationale: string;
  readonly relatedGoalRefs: readonly string[];
  readonly executable: false;
  readonly requiresApproval: true;
  readonly autoExecutionPermitted: false;
  readonly createdAt: UtcInstant;
};

export type PersonalEconomyPlan = {
  readonly planId: PersonalEconomyPlanId;
  readonly subjectId: string;
  readonly generatedAt: UtcInstant;
  readonly snapshotId: PersonalEconomySnapshot['snapshotId'];
  readonly objective: PersonalEconomyObjective;
  readonly constraints: PersonalEconomyConstraints;
  readonly recommendations: readonly PersonalEconomyRecommendation[];
  readonly monitoringNotes: readonly string[];
  readonly invariants: typeof PERSONAL_ECONOMY_INVARIANTS;
  readonly guaranteedOutcome: false;
  readonly autoExecution: false;
};

export type PersonalEconomySnapshotPorts = {
  readonly sunReyHoldings?: TokenHoldingSummary | null;
  readonly moonReyHoldings?: TokenHoldingSummary | null;
  readonly accessEntitlements?: readonly AccessEntitlementSummary[];
  readonly upcomingAccessExpirations?: readonly AccessEntitlementSummary[];
  readonly plannedAccessDemand?: readonly AccessDemandSummary[];
  readonly humanContributionOpportunities?: readonly ContributionOpportunitySummary[];
  readonly productiveContributionOpportunities?: readonly ContributionOpportunitySummary[];
  readonly investmentLabels?: readonly { readonly label: string; readonly minorUnits: string; readonly currency: string }[];
  readonly liabilityLabels?: readonly { readonly label: string; readonly minorUnits: string; readonly currency: string }[];
};

export class PersonalEconomyService {
  private readonly clock: Clock;
  private readonly peg: EconomicGraphService;
  private readonly orchestrator: GrowthOrchestrator;

  constructor(input: {
    readonly clock: Clock;
    readonly peg: EconomicGraphService;
    readonly orchestrator: GrowthOrchestrator;
  }) {
    this.clock = input.clock;
    this.peg = input.peg;
    this.orchestrator = input.orchestrator;
  }

  buildSnapshot(
    actor: unknown,
    subjectId: string,
    ports: PersonalEconomySnapshotPorts = {},
  ): Result<PersonalEconomySnapshot, PersonalEconomyFailure> {
    if (!isVerifiedActorContext(actor)) {
      return err({ code: 'ACTOR_CONTEXT_REQUIRED', message: 'verified ActorContext is required' });
    }
    const financial = this.peg.getFinancialSnapshot(actor, subjectId);
    if (!financial.ok) {
      return err({ code: 'GRAPH_UNAVAILABLE', message: financial.error.message });
    }
    const pegSnap = this.peg.getEconomicSnapshot(actor, subjectId);
    if (!pegSnap.ok) {
      return err({ code: 'GRAPH_UNAVAILABLE', message: pegSnap.error.message });
    }
    const at = this.clock.now();
    const cash = financial.value.cash.map((row) => ({
      minorUnits: row.amount.minorUnits,
      currency: row.amount.currency,
    }));
    const liquidity = financial.value.liquidity.map((row) => ({
      minorUnits: row.amount.minorUnits,
      currency: row.amount.currency,
    }));
    const investments =
      ports.investmentLabels?.map((row) =>
        Object.freeze({
          label: row.label,
          estimatedValue: { minorUnits: row.minorUnits, currency: row.currency },
          source: 'projection',
        }),
      ) ??
      financial.value.investments
        .filter((row) => row.estimatedValue)
        .map((row) =>
          Object.freeze({
            label: row.label,
            estimatedValue: row.estimatedValue!,
            source: row.valuationSource ?? 'peg',
          }),
        );
    const liabilities =
      ports.liabilityLabels?.map((row) =>
        Object.freeze({
          label: row.label,
          estimatedBalance: { minorUnits: row.minorUnits, currency: row.currency },
        }),
      ) ??
      financial.value.liabilities
        .filter((row) => row.estimatedBalance)
        .map((row) =>
          Object.freeze({
            label: row.label,
            estimatedBalance: row.estimatedBalance!,
          }),
        );
    const cashFlowSummary = financial.value.cashFlow.map((flow) =>
      Object.freeze({
        currency: flow.currency,
        monthlyIncomeMinorUnits: flow.income.amount.minorUnits,
        monthlyRecurringExpensesMinorUnits: flow.recurringOutflows.amount.minorUnits,
        estimatedSurplusMinorUnits: flow.monthlySurplusOrDeficit.amount.minorUnits,
        derived: true as const,
      }),
    );
    return ok(
      freezePersonalEconomySnapshot({
        snapshotId: deterministicSnapshotId(subjectId, at),
        subjectId,
        generatedAt: at,
        cash,
        liquidity,
        investments,
        liabilities,
        cashFlowSummary,
        sunReyHoldings: ports.sunReyHoldings ?? null,
        moonReyHoldings: ports.moonReyHoldings ?? null,
        accessEntitlements: ports.accessEntitlements ?? Object.freeze([]),
        upcomingAccessExpirations: ports.upcomingAccessExpirations ?? Object.freeze([]),
        plannedAccessDemand: ports.plannedAccessDemand ?? Object.freeze([]),
        humanContributionOpportunities: ports.humanContributionOpportunities ?? Object.freeze([]),
        productiveContributionOpportunities: ports.productiveContributionOpportunities ?? Object.freeze([]),
        authoritativeBalance: false,
        ledgerWins: true,
        guaranteedOutcome: false,
        projectionIsCertainty: false,
      }),
    );
  }

  buildPlan(input: {
    readonly actor: unknown;
    readonly subjectId: string;
    readonly constraints?: PersonalEconomyConstraints;
    readonly riskProfile?: PersonalEconomyRiskProfile;
    readonly ports?: PersonalEconomySnapshotPorts;
    readonly goalSummary?: string;
  }): Result<PersonalEconomyPlan, PersonalEconomyFailure> {
    const snapshot = this.buildSnapshot(input.actor, input.subjectId, input.ports);
    if (!snapshot.ok) {
      return snapshot;
    }
    const constraints = freezeConstraints(input.constraints ?? defaultConstraints());
    const riskProfile = input.riskProfile ?? constraints.maximumInvestmentRisk ?? 'MODERATE';
    const at = this.clock.now();
    const objective = evaluatePersonalEconomyObjective({
      snapshot: snapshot.value,
      constraints,
      riskProfile,
      versionNumber: 1,
      version: objectiveVersionFor(input.subjectId, 1),
    });
    const recommendations = this.recommendationsFor({
      snapshot: snapshot.value,
      constraints,
      riskProfile,
      ...(input.goalSummary ? { goalSummary: input.goalSummary } : {}),
      at,
    });
    const monitoringNotes = Object.freeze([
      'Continuously monitor liquidity, access expirations, and portfolio concentration.',
      'Identify opportunities aligned with goals; never promise guaranteed growth.',
      'Execute only after customer approval or an explicit valid mandate.',
      SIMULATION_DISCLAIMER,
    ]);
    return ok(
      Object.freeze({
        planId: deterministicPlanId(input.subjectId, at),
        subjectId: input.subjectId,
        generatedAt: at,
        snapshotId: snapshot.value.snapshotId,
        objective,
        constraints,
        recommendations,
        monitoringNotes,
        invariants: PERSONAL_ECONOMY_INVARIANTS,
        guaranteedOutcome: false,
        autoExecution: false,
      }),
    );
  }

  simulateScenario(input: {
    readonly actor: unknown;
    readonly subjectId: string;
    readonly scenario: PersonalEconomyScenarioInput | string;
    readonly constraints?: PersonalEconomyConstraints;
    readonly ports?: PersonalEconomySnapshotPorts;
  }): Result<PersonalEconomyScenarioOutcome, PersonalEconomyFailure> {
    const snapshot = this.buildSnapshot(input.actor, input.subjectId, input.ports);
    if (!snapshot.ok) {
      return snapshot;
    }
    const parsed =
      typeof input.scenario === 'string'
        ? scenarioFromNaturalLanguage(input.scenario) ??
          (parseScenarioKind(input.scenario) ? { kind: parseScenarioKind(input.scenario)! } : null)
        : input.scenario;
    if (!parsed?.kind || !parseScenarioKind(parsed.kind)) {
      return err({ code: 'INVALID_SCENARIO', message: 'scenario kind is not supported' });
    }
    return ok(
      simulatePersonalEconomyScenario({
        snapshot: snapshot.value,
        constraints: freezeConstraints(input.constraints ?? defaultConstraints()),
        scenario: parsed as PersonalEconomyScenarioInput,
        at: this.clock.now(),
      }),
    );
  }

  proposeFromPlan(input: {
    readonly actor: unknown;
    readonly subjectId: string;
    readonly constraints?: PersonalEconomyConstraints;
    readonly riskProfile?: PersonalEconomyRiskProfile;
    readonly ports?: PersonalEconomySnapshotPorts;
    readonly goalSummary?: string;
  }): Result<readonly PersonalEconomyRecommendation[], PersonalEconomyFailure> {
    const plan = this.buildPlan(input);
    if (!plan.ok) {
      return plan;
    }
    return ok(plan.value.recommendations);
  }

  private recommendationsFor(input: {
    readonly snapshot: PersonalEconomySnapshot;
    readonly constraints: PersonalEconomyConstraints;
    readonly riskProfile: PersonalEconomyRiskProfile;
    readonly goalSummary?: string;
    readonly at: UtcInstant;
  }): readonly PersonalEconomyRecommendation[] {
    const recs: PersonalEconomyRecommendation[] = [];
    const currency = input.constraints.minimumEmergencyCash?.currency ?? 'USD';
    const liquidity = input.snapshot.liquidity
      .filter((row) => row.currency === currency)
      .reduce((acc, row) => acc + BigInt(row.minorUnits), 0n);
    const emergency = BigInt(input.constraints.minimumEmergencyCash?.minorUnits ?? '0');
    const investTotal = input.snapshot.investments
      .filter((row) => row.estimatedValue.currency === currency)
      .reduce((acc, row) => acc + BigInt(row.estimatedValue.minorUnits), 0n);

    if (emergency > 0n && liquidity < emergency) {
      recs.push(
        this.freezeRecommendation({
          subjectId: input.snapshot.subjectId,
          type: 'LIQUIDITY_ADJUSTMENT',
          title: 'Replenish emergency reserve',
          rationale: `Liquidity ${liquidity.toString()} is below the ${emergency.toString()} emergency target.`,
          refs: ['MINIMUM_EMERGENCY_CASH'],
          at: input.at,
        }),
      );
    } else if (liquidity > emergency + 500000n && investTotal < liquidity) {
      recs.push(
        this.freezeRecommendation({
          subjectId: input.snapshot.subjectId,
          type: 'FIAT_INVESTMENT',
          title: 'Consider measured fiat investment',
          rationale:
            'Excess cash above emergency reserve may be allocated toward goal-aligned investments subject to risk constraints. Markets can lose value.',
          refs: ['GROW_STRATEGY'],
          at: input.at,
        }),
      );
    }

    const desiredTravel = input.constraints.desiredTravelAccessUnits ?? 0;
    const travelCoverage = input.snapshot.accessEntitlements
      .filter((row) => row.category === 'TRAVEL' || row.category === 'HOSPITALITY')
      .reduce((acc, row) => acc + row.remainingUnits, 0);
    if (desiredTravel > travelCoverage) {
      recs.push(
        this.freezeRecommendation({
          subjectId: input.snapshot.subjectId,
          type: 'ACCESS_RESERVATION',
          title: 'Plan travel access for upcoming trips',
          rationale: `Reserve or top up travel access for ${desiredTravel} planned experiences while preserving liquidity.`,
          refs: ['ACCESS_TRAVEL'],
          at: input.at,
        }),
      );
    }

    if (input.snapshot.productiveContributionOpportunities.length > 0) {
      recs.push(
        this.freezeRecommendation({
          subjectId: input.snapshot.subjectId,
          type: 'PRODUCTIVE_CAPACITY_CONTRIBUTION',
          title: input.snapshot.productiveContributionOpportunities[0]!.title,
          rationale: input.snapshot.productiveContributionOpportunities[0]!.rationale,
          refs: [input.snapshot.productiveContributionOpportunities[0]!.opportunityId],
          at: input.at,
        }),
      );
    }

    if (input.snapshot.humanContributionOpportunities.length > 0) {
      recs.push(
        this.freezeRecommendation({
          subjectId: input.snapshot.subjectId,
          type: 'DATA_OPPORTUNITY_PARTICIPATION',
          title: input.snapshot.humanContributionOpportunities[0]!.title,
          rationale: input.snapshot.humanContributionOpportunities[0]!.rationale,
          refs: [input.snapshot.humanContributionOpportunities[0]!.opportunityId],
          at: input.at,
        }),
      );
    }

    const sr = BigInt(input.snapshot.sunReyHoldings?.quantityMinorUnits ?? '0');
    const maxSr = BigInt(input.constraints.maximumSunReyExposureMinorUnits ?? '0');
    if (maxSr > 0n && sr < maxSr / 2n && desiredTravel > 0) {
      recs.push(
        this.freezeRecommendation({
          subjectId: input.snapshot.subjectId,
          type: 'SR_ACQUISITION',
          title: 'Evaluate SunRey participation for access utility',
          rationale:
            'SunRey holdings may support network access goals when aligned with portfolio constraints — not because price is expected to rise.',
          refs: ['SR_UTILITY'],
          at: input.at,
        }),
      );
    }

    if (recs.length === 0) {
      recs.push(
        this.freezeRecommendation({
          subjectId: input.snapshot.subjectId,
          type: 'NO_ACTION',
          title: 'Continue monitoring',
          rationale: input.goalSummary
            ? `Current posture fits stated goal: ${input.goalSummary}. Keep monitoring; no immediate action proposed.`
            : 'Current posture fits constraints. Keep monitoring without promising returns.',
          refs: [],
          at: input.at,
        }),
      );
    }

    for (const type of PERSONAL_ECONOMY_RECOMMENDATION_TYPES) {
      void type;
    }
    return Object.freeze(recs.map((row) => Object.freeze(row)));
  }

  private freezeRecommendation(input: {
    readonly subjectId: string;
    readonly type: PersonalEconomyRecommendationType;
    readonly title: string;
    readonly rationale: string;
    readonly refs: readonly string[];
    readonly at: UtcInstant;
  }): PersonalEconomyRecommendation {
    return Object.freeze({
      proposalId: deterministicProposalId(input.subjectId, input.type, input.at),
      recommendationType: input.type,
      title: input.title,
      rationale: input.rationale,
      relatedGoalRefs: Object.freeze([...input.refs]),
      executable: false,
      requiresApproval: true,
      autoExecutionPermitted: false,
      createdAt: input.at,
    });
  }
}

export {
  PERSONAL_ECONOMY_INVARIANTS,
  PERSONAL_ECONOMY_RECOMMENDATION_TYPES,
  PERSONAL_ECONOMY_SCENARIO_KINDS,
  SIMULATION_DISCLAIMER,
} from './taxonomy.ts';
