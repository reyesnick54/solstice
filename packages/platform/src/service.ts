import type { AgentProposal } from '../../agent/src/proposal.ts';
import { PersonalEconomyAgent } from '../../agent/src/service.ts';
import type { AgentRuntimePorts } from '../../agent/src/ports.ts';
import type { Clock } from '../../config/src/clock.ts';
import { err, ok, type Result } from '../../domain/src/result.ts';
import type { EvidenceVault } from '../../evidence/src/vault.ts';
import { DomainEventLog, type DomainEvent } from '../../events/src/events.ts';
import { Money } from '../../money/src/money.ts';
import type { ActionIntent } from '../../permissions/src/action-intent.ts';
import type { EconomicGraphService } from '../../personal-economic-graph/src/service.ts';
import type { PersonalEconomicSnapshot } from '../../personal-economic-graph/src/snapshot.ts';
import { authorizeConfirmMandate, authorizeViewGrowthPlan } from './access.ts';
import { generateGrowthCandidates } from './growth/candidates.ts';
import { transitionCycle } from './growth/cycle.ts';
import { explainPlan } from './growth/explainability.ts';
import { evaluateCandidateFeasibility } from './growth/feasibility.ts';
import { evaluateGoalFeasibility } from './growth/goal-feasibility.ts';
import { shouldInvalidatePlan } from './growth/invalidation.ts';
import { materializeGrowthAction, type MaterializeFailure } from './growth/materialize.ts';
import { planningPriorityVersion, rankCandidates } from './growth/ranking.ts';
import type {
  EligibleAccount,
  FeasibilityResult,
  GrowthCycle,
  GrowthPlan,
  PlanningContext,
} from './growth/types.ts';
import {
  asGrowthPlanVersion,
  asMandateVersion,
  cycleIdFor,
  planIdFor,
} from './ids.ts';
import { compileEconomicMandate, mandateDraftFromInterpretation } from './mandate/compiler.ts';
import { recordMandateConfirmation } from './mandate/confirmation.ts';
import { isActiveMandate, transitionMandate } from './mandate/lifecycle.ts';
import type {
  CompiledEconomicMandate,
  MandateCompileFailure,
  MandateDraft,
} from './mandate/types.ts';
import type { PolicyControlPort } from './policy-port.ts';
import { simulationPolicyPort } from './policy-port.ts';
import { InMemoryGrowthStore } from './store.ts';
import type { TreasuryContextPort } from './treasury-port.ts';
import { absentTreasuryContextPort } from './treasury-port.ts';

export type GrowthFailure =
  | MandateCompileFailure
  | { readonly code: 'ACTOR_CONTEXT_REQUIRED' | 'CAPABILITY_DENIED' | 'SUBJECT_MISMATCH'; readonly message: string }
  | { readonly code: 'NO_ACTIVE_MANDATE'; readonly message: string }
  | { readonly code: 'MANDATE_NOT_FOUND'; readonly message: string }
  | { readonly code: 'INVALID_MANDATE_TRANSITION'; readonly message: string }
  | { readonly code: 'CONFIRMATION_FAILED'; readonly message: string }
  | { readonly code: 'PLAN_STALE'; readonly message: string }
  | { readonly code: 'GRAPH_UNAVAILABLE'; readonly message: string }
  | { readonly code: 'AGENT_FAILED'; readonly message: string }
  | { readonly code: 'INTERPRETATION_FAILED'; readonly message: string };

export class GrowthOrchestrator {
  private readonly clock: Clock;
  private readonly events: DomainEventLog;
  private readonly evidence?: EvidenceVault;
  private readonly agent: PersonalEconomyAgent;
  private readonly peg: EconomicGraphService;
  private readonly policy: PolicyControlPort;
  private readonly treasury: TreasuryContextPort;
  readonly store: InMemoryGrowthStore;

  constructor(input: {
    readonly clock: Clock;
    readonly events: DomainEventLog;
    readonly peg: EconomicGraphService;
    readonly agent?: PersonalEconomyAgent;
    readonly evidence?: EvidenceVault;
    readonly policy?: PolicyControlPort;
    readonly treasury?: TreasuryContextPort;
    readonly store?: InMemoryGrowthStore;
  }) {
    this.clock = input.clock;
    this.events = input.events;
    this.peg = input.peg;
    this.agent = input.agent ?? new PersonalEconomyAgent({ clock: input.clock });
    if (input.evidence) {
      this.evidence = input.evidence;
    }
    this.policy = input.policy ?? simulationPolicyPort;
    this.treasury = input.treasury ?? absentTreasuryContextPort;
    this.store = input.store ?? new InMemoryGrowthStore();
  }

  interpretAndCompile(
    actor: unknown,
    input: { readonly subjectId: string; readonly sourceText: string; readonly currency?: string },
  ): Result<{ readonly draft: MandateDraft; readonly mandate: CompiledEconomicMandate }, GrowthFailure> {
    const access = authorizeConfirmMandate(actor, input.subjectId);
    if (!access.ok) {
      return access;
    }
    const interpretation = this.agent.interpretLanguage(actor, input);
    if (!interpretation.ok) {
      return err({ code: 'INTERPRETATION_FAILED', message: interpretation.error.message });
    }
    const existing = this.store.latestMandateFor(input.subjectId);
    const version = (existing?.version ?? 0) + 1;
    const draft = mandateDraftFromInterpretation(interpretation.value, this.clock.now(), version);
    this.store.putDraft(draft);
    this.emit('MandateDraftCreated', {
      mandateId: draft.draftId,
      subjectId: draft.subjectId,
      version,
    });
    const snapshot = this.peg.getEconomicSnapshot(actor, input.subjectId);
    const compiled = compileEconomicMandate({
      draft,
      now: this.clock.now(),
      version,
      ...(snapshot.ok ? { peg: snapshot.value } : {}),
    });
    if (!compiled.ok) {
      return compiled;
    }
    this.store.putMandate(compiled.value);
    this.seal('MANDATE_COMPILED', {
      mandateId: compiled.value.mandateId,
      version: compiled.value.version,
      actorId: access.value.actorId,
      planningVersion: planningPriorityVersion(),
    });
    return ok({ draft, mandate: compiled.value });
  }

  requestConfirmation(
    actor: unknown,
    subjectId: string,
  ): Result<CompiledEconomicMandate, GrowthFailure> {
    const access = authorizeConfirmMandate(actor, subjectId);
    if (!access.ok) {
      return access;
    }
    const mandate = this.store.latestMandateFor(subjectId);
    if (!mandate) {
      return err({ code: 'MANDATE_NOT_FOUND', message: 'no compiled mandate' });
    }
    const next = this.moveMandate(mandate, 'AWAITING_CONFIRMATION');
    if (!next.ok) {
      return next;
    }
    return ok(next.value);
  }

  confirmAndActivate(
    actor: unknown,
    subjectId: string,
  ): Result<CompiledEconomicMandate, GrowthFailure> {
    const access = authorizeConfirmMandate(actor, subjectId);
    if (!access.ok) {
      return access;
    }
    const mandate = this.store.latestMandateFor(subjectId);
    if (!mandate) {
      return err({ code: 'MANDATE_NOT_FOUND', message: 'no compiled mandate' });
    }
    if (mandate.state === 'DRAFT') {
      const waiting = this.moveMandate(mandate, 'AWAITING_CONFIRMATION');
      if (!waiting.ok) {
        return waiting;
      }
    }
    const current = this.store.latestMandateFor(subjectId);
    if (!current) {
      return err({ code: 'MANDATE_NOT_FOUND', message: 'mandate disappeared' });
    }
    const confirmation = recordMandateConfirmation({
      mandate: current,
      actor: access.value,
      now: this.clock.now(),
    });
    if ('ok' in confirmation && confirmation.ok === false) {
      return err({ code: 'CONFIRMATION_FAILED', message: confirmation.reason });
    }
    if (!('confirmationId' in confirmation)) {
      return err({ code: 'CONFIRMATION_FAILED', message: 'confirmation missing' });
    }
    this.store.putConfirmation(confirmation);
    this.emit('MandateConfirmed', {
      mandateId: current.mandateId,
      version: current.version,
      actorId: confirmation.actorId,
      confirmationHash: confirmation.confirmationHash,
    });
    this.seal('MANDATE_CONFIRMED', {
      mandateId: current.mandateId,
      version: current.version,
      actorId: confirmation.actorId,
      sessionId: confirmation.sessionId,
      confirmationHash: confirmation.confirmationHash,
      actorContextHash: confirmation.contextHash,
    });
    const previous = this.store.activeMandateFor(subjectId);
    if (previous && previous.version !== current.version) {
      const superseded = this.moveMandate(previous, 'SUPERSEDED');
      if (!superseded.ok) {
        return superseded;
      }
    }
    const activated = this.moveMandate(
      { ...current, confirmation, planningEligible: false },
      'ACTIVE',
    );
    if (!activated.ok) {
      return activated;
    }
    const live: CompiledEconomicMandate = {
      ...activated.value,
      confirmation,
      planningEligible: true,
    };
    this.store.putMandate(live);
    this.emit('MandateActivated', {
      mandateId: live.mandateId,
      version: live.version,
      subjectId: live.subjectId,
    });
    return ok(live);
  }

  pauseMandate(actor: unknown, subjectId: string): Result<CompiledEconomicMandate, GrowthFailure> {
    const access = authorizeConfirmMandate(actor, subjectId);
    if (!access.ok) {
      return access;
    }
    const mandate = this.store.activeMandateFor(subjectId);
    if (!mandate) {
      return err({ code: 'NO_ACTIVE_MANDATE', message: 'no active mandate to pause' });
    }
    const paused = this.moveMandate(mandate, 'PAUSED');
    if (!paused.ok) {
      return paused;
    }
    this.emit('MandatePaused', { mandateId: paused.value.mandateId, version: paused.value.version });
    this.invalidateCurrentPlan(subjectId, 'mandate_paused');
    return paused;
  }

  revokeMandate(actor: unknown, subjectId: string): Result<CompiledEconomicMandate, GrowthFailure> {
    const access = authorizeConfirmMandate(actor, subjectId);
    if (!access.ok) {
      return access;
    }
    const mandate = this.store.activeMandateFor(subjectId) ?? this.store.latestMandateFor(subjectId);
    if (!mandate) {
      return err({ code: 'MANDATE_NOT_FOUND', message: 'no mandate to revoke' });
    }
    const revoked = this.moveMandate(mandate, 'REVOKED');
    if (!revoked.ok) {
      return revoked;
    }
    this.emit('MandateRevoked', { mandateId: revoked.value.mandateId, version: revoked.value.version });
    this.invalidateCurrentPlan(subjectId, 'mandate_revoked');
    return revoked;
  }

  plan(
    actor: unknown,
    subjectId: string,
  ): Result<{ readonly cycle: GrowthCycle; readonly plan: GrowthPlan }, GrowthFailure> {
    const access = authorizeViewGrowthPlan(actor, subjectId);
    if (!access.ok) {
      return access;
    }
    const mandate = this.store.activeMandateFor(subjectId);
    if (!mandate || !isActiveMandate(mandate.state) || !mandate.planningEligible) {
      return err({ code: 'NO_ACTIVE_MANDATE', message: 'only an ACTIVE confirmed mandate governs planning' });
    }
    const snapshot = this.peg.getEconomicSnapshot(actor, subjectId);
    if (!snapshot.ok) {
      return err({ code: 'GRAPH_UNAVAILABLE', message: snapshot.error.message });
    }
    const now = this.clock.now();
    let cycle: GrowthCycle = {
      cycleId: cycleIdFor(subjectId, now),
      subjectId,
      mandateId: mandate.mandateId,
      mandateVersion: mandate.version,
      state: 'CREATED',
      createdAt: now,
      pegSnapshotId: snapshot.value.snapshotId,
    };
    this.store.putCycle(cycle);
    this.emit('GrowthCycleStarted', { cycleId: cycle.cycleId, subjectId, mandateId: mandate.mandateId });
    cycle = this.advanceCycle(cycle, 'ASSESSING');
    cycle = this.advanceCycle(cycle, 'PLANNING');

    const ports = this.agentPorts(access.value.actorId, mandate, snapshot.value);
    const ideas = this.agent.proposeIdeas(actor, ports);
    if (!ideas.ok) {
      return err({ code: 'AGENT_FAILED', message: ideas.error.message });
    }
    const planning: PlanningContext = {
      eligibleAccounts: this.eligibleAccounts(actor, subjectId),
      investmentExecutionImplemented: false,
    };
    this.treasury.readPublicContext();
    const generated = generateGrowthCandidates({
      mandate,
      snapshot: snapshot.value,
      ideas: ideas.value,
      policy: this.policy,
      planning,
    });
    const feasibility: FeasibilityResult[] = [];
    const accepted = [];
    const rejected = [];
    for (const candidate of generated) {
      const result = evaluateCandidateFeasibility({
        candidate,
        mandate,
        snapshot: snapshot.value,
        policy: this.policy,
        planning,
      });
      this.store.putFeasibility(result);
      feasibility.push(result);
      if (result.accepted) {
        accepted.push(candidate);
      } else {
        rejected.push({ candidate, reasons: result.reasons, detail: result.detail });
      }
    }
    const ordered = rankCandidates(accepted, mandate);
    for (const candidate of ordered) {
      this.emit('GrowthActionProposed', {
        actionId: candidate.actionId,
        action: candidate.action,
        cycleId: cycle.cycleId,
        executionCapability: candidate.executionCapability,
      });
    }
    const deterministic = ordered
      .filter((item) => item.expectedEffect.kind === 'DETERMINISTIC_EFFECT')
      .reduce(
        (sum, item) =>
          sum.plus(
            Money.fromMinorUnitsString(
              item.expectedEffect.kind === 'DETERMINISTIC_EFFECT'
                ? item.expectedEffect.amount.minorUnits
                : '0',
              mandate.currency,
            ),
          ),
        Money.zero(mandate.currency),
      );
    const uncertain = ordered.find((item) => item.expectedEffect.kind === 'UNCERTAIN_MARKET_OUTCOME')?.expectedEffect;
    const plan: GrowthPlan = {
      planId: planIdFor(cycle.cycleId),
      version: asGrowthPlanVersion(1),
      cycleId: cycle.cycleId,
      subjectId,
      mandateId: mandate.mandateId,
      mandateVersion: mandate.version,
      pegSnapshotId: snapshot.value.snapshotId,
      generatedAt: now,
      planningVersion: planningPriorityVersion(),
      state: 'CURRENT',
      goalsAddressed: Object.freeze(mandate.goals.map((goal) => goal.goalId)),
      goalFeasibility: evaluateGoalFeasibility(mandate, snapshot.value),
      candidateActions: generated,
      rejectedCandidates: Object.freeze(rejected),
      orderedProposedActions: ordered,
      expectedDeterministicEffect: deterministic.toJSON(),
      ...(uncertain ? { estimatedUncertainEffect: uncertain } : {}),
      assumptions: Object.freeze([
        'PEG facts are non-authoritative; the ledger wins.',
        'Soft preferences never override hard constraints.',
      ]),
      risks: Object.freeze([
        'Facts can change and stale plans must not be acted on.',
        'Investment outcomes are uncertain and not promised.',
      ]),
      unresolvedQuestions: Object.freeze(
        ordered.length === 0 ? ['No action is required right now.'] : [],
      ),
      dependencies: Object.freeze(['investment_execution_not_implemented']),
      nextReviewTrigger: 'Any material PEG fact change, payment settlement, or mandate revision.',
      explanations: Object.freeze([]),
      agentProposalIds: Object.freeze(ideas.value.map((item) => item.proposalId)),
      zeroProposalsValid: ordered.length === 0,
    };
    const explained: GrowthPlan = { ...plan, explanations: explainPlan(plan) };
    this.store.putPlan(explained);
    this.emit('GrowthPlanCreated', {
      planId: explained.planId,
      version: explained.version,
      cycleId: cycle.cycleId,
      proposedCount: explained.orderedProposedActions.length,
    });
    this.seal('GROWTH_PLAN_GENERATED', {
      planId: explained.planId,
      version: explained.version,
      mandateId: mandate.mandateId,
      mandateVersion: mandate.version,
      pegSnapshotId: snapshot.value.snapshotId,
      actorId: access.value.actorId,
      agentProposalIds: explained.agentProposalIds,
      planningVersion: explained.planningVersion,
      deterministicMinorUnits: explained.expectedDeterministicEffect.minorUnits,
    });
    cycle = this.advanceCycle(cycle, explained.orderedProposedActions.length === 0 ? 'COMPLETED' : 'AWAITING_USER');
    return ok({ cycle, plan: explained });
  }

  ingestPlanningEvent(subjectId: string, event: DomainEvent): GrowthPlan | undefined {
    const plan = this.store.latestPlanFor(subjectId);
    if (!plan) {
      return undefined;
    }
    const mandate = this.store.activeMandateFor(subjectId) ?? this.store.latestMandateFor(subjectId);
    if (shouldInvalidatePlan({ plan, ...(mandate ? { mandate } : {}), event })) {
      return this.invalidateCurrentPlan(subjectId, event.eventType);
    }
    return plan;
  }

  noteFactChange(subjectId: string, reason: string): GrowthPlan | undefined {
    return this.invalidateCurrentPlan(subjectId, reason);
  }

  materializeApprovedAction(
    actor: unknown,
    subjectId: string,
    actionId: string,
    approved: boolean,
  ): Result<ActionIntent, MaterializeFailure | GrowthFailure> {
    const access = authorizeViewGrowthPlan(actor, subjectId);
    if (!access.ok) {
      return access;
    }
    const plan = this.store.latestPlanFor(subjectId);
    if (!plan) {
      return err({ code: 'PLAN_STALE', message: 'no plan' });
    }
    if (plan.state === 'STALE') {
      return err({ code: 'PLAN_STALE', message: 'stale GrowthPlan cannot be treated as current' });
    }
    const candidate = plan.orderedProposedActions.find((item) => item.actionId === actionId)
      ?? plan.candidateActions.find((item) => item.actionId === actionId);
    if (!candidate) {
      return err({ code: 'UNSUPPORTED_ACTION', message: 'candidate not found' });
    }
    return materializeGrowthAction({
      candidate,
      approved,
      actorId: access.value.actorId,
      requestedAt: this.clock.now(),
    });
  }

  explainWithAgent(actor: unknown, subjectId: string): Result<AgentProposal, GrowthFailure> {
    const access = authorizeViewGrowthPlan(actor, subjectId);
    if (!access.ok) {
      return access;
    }
    const plan = this.store.latestPlanFor(subjectId);
    const summary = plan
      ? `${plan.orderedProposedActions.length} proposed actions; zeroProposalsValid=${String(plan.zeroProposalsValid)}`
      : 'no plan';
    const explained = this.agent.explainPlan(actor, { subjectId, planSummary: summary });
    if (!explained.ok) {
      return err({ code: 'AGENT_FAILED', message: explained.error.message });
    }
    return explained;
  }

  private moveMandate(
    mandate: CompiledEconomicMandate,
    to: CompiledEconomicMandate['state'],
  ): Result<CompiledEconomicMandate, GrowthFailure> {
    const transition = transitionMandate(mandate.state, to);
    if (!transition.ok) {
      return err({
        code: 'INVALID_MANDATE_TRANSITION',
        message: transition.error.message,
      });
    }
    const next: CompiledEconomicMandate = {
      ...mandate,
      state: transition.value,
      planningEligible: transition.value === 'ACTIVE' && mandate.confirmation !== undefined,
      ...(to === 'SUPERSEDED' ? { supersededByVersion: asMandateVersion(mandate.version + 1) } : {}),
    };
    this.store.putMandate(next);
    return ok(next);
  }

  private advanceCycle(cycle: GrowthCycle, to: GrowthCycle['state']): GrowthCycle {
    const transition = transitionCycle(cycle.state, to);
    if (!transition.ok) {
      throw new Error(`invalid cycle transition ${cycle.state} -> ${to}`);
    }
    const next = { ...cycle, state: transition.value };
    this.store.putCycle(next);
    return next;
  }

  private invalidateCurrentPlan(subjectId: string, reason: string): GrowthPlan | undefined {
    const plan = this.store.latestPlanFor(subjectId);
    if (!plan || plan.state === 'STALE') {
      return plan;
    }
    const stale: GrowthPlan = { ...plan, state: 'STALE' };
    this.store.putPlan(stale);
    const cycle = this.store.getCycle(plan.cycleId);
    if (cycle && cycle.state !== 'CANCELLED' && cycle.state !== 'STALE') {
      const next = transitionCycle(cycle.state, 'STALE');
      if (next.ok) {
        this.store.putCycle({ ...cycle, state: next.value });
      }
    }
    this.emit('GrowthPlanStale', { planId: plan.planId, version: plan.version, reason });
    return stale;
  }

  private eligibleAccounts(actor: unknown, subjectId: string): readonly EligibleAccount[] {
    const graph = this.peg.getEconomicGraph(actor, subjectId);
    if (!graph.ok) {
      return Object.freeze([]);
    }
    const accounts: EligibleAccount[] = [];
    for (const node of graph.value.nodes) {
      if (node.kind === 'ACCOUNT' && node.attributes.kind === 'ACCOUNT') {
        accounts.push({
          accountRef: node.attributes.canonicalRef.id,
          currency: node.attributes.currency,
          ...(node.attributes.accountClass ? { accountClass: node.attributes.accountClass } : {}),
        });
      }
    }
    return Object.freeze(accounts);
  }

  private agentPorts(
    actorId: string,
    mandate: CompiledEconomicMandate,
    snapshot: PersonalEconomicSnapshot,
  ): AgentRuntimePorts {
    const liquid: Record<string, string> = {};
    for (const item of snapshot.liquidAssetsByCurrency) {
      liquid[item.amount.currency] = item.amount.minorUnits;
    }
    return {
      context: {
        subjectId: mandate.subjectId,
        generatedAt: snapshot.generatedAt,
        writePath: false,
        liquidMinorUnitsByCurrency: liquid,
        incomeLabels: snapshot.income.map((item) => item.label),
        obligationLabels: snapshot.knownRecurringObligations.map((item) => item.label),
        debtLabels: snapshot.debt.map((item) => item.label),
        goalLabels: snapshot.goals.map((item) => item.label),
        opportunityLabels: snapshot.economicOpportunities.map((item) => item.title),
      },
      claims: {
        actorId,
        subjectId: mandate.subjectId,
        authorizedCapabilities: Object.freeze(['VIEW_GROWTH_PLAN']),
        mayProposeOnly: true,
        mayExecute: false,
      },
      mandates: Object.freeze([
        {
          mandateId: mandate.mandateId,
          version: mandate.version,
          status: mandate.state,
          hardConstraintSummaries: mandate.hardConstraints.map((item) => item.kind),
          goalSummaries: mandate.goals.map((item) => item.label),
          softPreferenceSummaries: mandate.softPreferences.map((item) => item.kind),
        },
      ]),
    };
  }

  private emit(eventType: DomainEvent['eventType'], payload: Record<string, unknown>): void {
    this.events.append({
      eventType,
      schemaVersion: 1,
      occurredAt: this.clock.now(),
      payload,
    } as DomainEvent);
  }

  private seal(kind: string, payload: Record<string, unknown>): void {
    this.evidence?.seal(kind, payload);
  }
}
