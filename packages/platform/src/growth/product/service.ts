import type { Clock } from '../../../../config/src/clock.ts';
import { isExpired } from '../../../../config/src/clock.ts';
import { err, ok, type Result } from '../../../../domain/src/result.ts';
import type { EvidenceVault } from '../../../../evidence/src/vault.ts';
import { DomainEventLog, type DomainEvent } from '../../../../events/src/events.ts';
import { Money } from '../../../../money/src/money.ts';
import { asFinancialProposalId, asGrowMoneyPlanId } from './ids.ts';
import { assertUnchangedMaterialTerms } from './immutability.ts';
import { toLovableExperience } from './lovable-contract.ts';
import { buildProductGrowthPlan } from './plan.ts';
import { requiresStepUp, simulationGrowPolicy, type GrowProductPolicy } from './policy.ts';
import { buildProposalFromComponent, rebuildModifiedProposal } from './proposal.ts';
import { isMateriallyFrozen, transitionProductProposal } from './proposal-lifecycle.ts';
import { InMemoryProductGrowthStore } from './store.ts';
import { currentCircumstanceHash } from './suitability.ts';
import type { GrowPlanComponentKind } from './taxonomy.ts';
import type {
  CreateGrowPlanInput,
  FinancialProposal,
  GrowProductFailure,
  GrowthProductActor,
  LovableGrowExperience,
  ModifyProposalInput,
  ProductGrowthPlan,
} from './types.ts';

export class ProductGrowthService {
  private readonly clock: Clock;
  private readonly events?: DomainEventLog;
  private readonly evidence?: EvidenceVault;
  private readonly policy: GrowProductPolicy;
  readonly store: InMemoryProductGrowthStore;

  constructor(input: {
    readonly clock: Clock;
    readonly events?: DomainEventLog;
    readonly evidence?: EvidenceVault;
    readonly store?: InMemoryProductGrowthStore;
    readonly policy?: GrowProductPolicy;
  }) {
    this.clock = input.clock;
    if (input.events) this.events = input.events;
    if (input.evidence) this.evidence = input.evidence;
    this.store = input.store ?? new InMemoryProductGrowthStore();
    this.policy = input.policy ?? simulationGrowPolicy;
  }

  createPlan(
    actor: GrowthProductActor,
    input: CreateGrowPlanInput,
  ): Result<ProductGrowthPlan, GrowProductFailure> {
    const access = this.authorize(actor, input.ownerId, 'write');
    if (!access.ok) return access;
    const validated = validateCreate(input);
    if (!validated.ok) return validated;
    const plan = buildProductGrowthPlan({ request: input, now: this.clock.now() });
    this.store.putPlan(plan);
    this.emit('GrowthPlanCreated', {
      planId: plan.planId,
      version: plan.version,
      subjectId: plan.ownerId,
    });
    this.seal('PRODUCT_GROWTH_PLAN_CREATED', {
      planId: plan.planId,
      ownerId: plan.ownerId,
      actorId: actor.actorId,
      guaranteedOutcome: false,
    });
    return ok(plan);
  }

  getPlan(actor: GrowthProductActor, planId: string): Result<ProductGrowthPlan, GrowProductFailure> {
    if (!planId.startsWith('gmp_')) {
      return err({ code: 'PLAN_NOT_FOUND', message: 'unknown growth plan' });
    }
    const plan = this.store.getPlan(asGrowMoneyPlanId(planId));
    if (!plan) {
      return err({ code: 'PLAN_NOT_FOUND', message: 'unknown growth plan' });
    }
    const access = this.authorize(actor, plan.ownerId, 'read');
    if (!access.ok) return access;
    return ok(this.expirePlanIfNeeded(plan));
  }

  listPlans(actor: GrowthProductActor, ownerId: string): Result<readonly ProductGrowthPlan[], GrowProductFailure> {
    const access = this.authorize(actor, ownerId, 'read');
    if (!access.ok) return access;
    return ok(this.store.plansForOwner(ownerId).map((plan) => this.expirePlanIfNeeded(plan)));
  }

  lovableExperience(actor: GrowthProductActor, planId: string): Result<LovableGrowExperience, GrowProductFailure> {
    const plan = this.getPlan(actor, planId);
    if (!plan.ok) return plan;
    return ok(toLovableExperience(plan.value));
  }

  createProposal(
    actor: GrowthProductActor,
    input: { readonly planId: string; readonly componentKind?: GrowPlanComponentKind; readonly opportunityId?: string },
  ): Result<FinancialProposal, GrowProductFailure> {
    const planResult = this.getPlan(actor, input.planId);
    if (!planResult.ok) return planResult;
    const write = this.authorize(actor, planResult.value.ownerId, 'write');
    if (!write.ok) return write;
    const component =
      planResult.value.components.find((item) => item.kind === (input.componentKind ?? 'ELIGIBLE_INVESTMENT_ALLOCATION')) ??
      planResult.value.components[0];
    if (!component) {
      return err({ code: 'VALIDATION', message: 'plan has no components' });
    }
    const proposal = buildProposalFromComponent({
      plan: planResult.value,
      component,
      actor,
      now: this.clock.now(),
      request: {
        ownerId: planResult.value.ownerId,
        startingCapitalMinorUnits: planResult.value.startingSnapshot.startingCapital.minorUnits,
        currency: planResult.value.startingSnapshot.startingCapital.currency,
        timeHorizonMonths: planResult.value.timeHorizonMonths,
        riskProfile: planResult.value.riskProfile,
        ...(input.opportunityId ? { opportunityId: input.opportunityId } : {}),
      },
    });
    this.store.putProposal(proposal);
    this.emit('GrowthActionProposed', {
      planId: proposal.planId,
      action: proposal.actionType,
      subjectId: proposal.ownerId,
    });
    this.seal('FINANCIAL_PROPOSAL_CREATED', {
      proposalId: proposal.proposalId,
      planId: proposal.planId,
      actorId: actor.actorId,
      serverIssued: true,
    });
    return ok(proposal);
  }

  getProposal(actor: GrowthProductActor, proposalId: string): Result<FinancialProposal, GrowProductFailure> {
    if (!this.store.hasProposal(proposalId) || !proposalId.startsWith('fpr_')) {
      return err({
        code: 'FABRICATED_PROPOSAL_ID',
        message: 'proposal id is unknown; agents cannot invent executable proposal ids',
      });
    }
    const proposal = this.store.getProposal(asFinancialProposalId(proposalId));
    if (!proposal) {
      return err({ code: 'PROPOSAL_NOT_FOUND', message: 'unknown proposal' });
    }
    const access = this.authorize(actor, proposal.ownerId, 'read');
    if (!access.ok) return access;
    return ok(this.expireProposalIfNeeded(proposal));
  }

  listProposals(
    actor: GrowthProductActor,
    ownerId: string,
    planId?: string,
  ): Result<readonly FinancialProposal[], GrowProductFailure> {
    const access = this.authorize(actor, ownerId, 'read');
    if (!access.ok) return access;
    const list = this.store.proposalsForOwner(
      ownerId,
      planId && planId.startsWith('gmp_') ? asGrowMoneyPlanId(planId) : undefined,
    );
    return ok(list.map((item) => this.expireProposalIfNeeded(item)));
  }

  presentProposal(actor: GrowthProductActor, proposalId: string): Result<FinancialProposal, GrowProductFailure> {
    const loaded = this.getProposal(actor, proposalId);
    if (!loaded.ok) return loaded;
    const write = this.authorize(actor, loaded.value.ownerId, 'write');
    if (!write.ok) return write;
    let current = this.expireProposalIfNeeded(loaded.value);
    if (current.status === 'EXPIRED') {
      return err({ code: 'EXPIRED', message: 'proposal expired' });
    }
    const ready = this.move(current, 'READY');
    if (!ready.ok) return ready;
    current = ready.value;
    const policy = this.policy.evaluate({
      actor,
      actionType: current.actionType,
      risk: current.risk,
      amountMinorUnits: current.amount.minorUnits,
    });
    current = this.store.putProposal({
      ...current,
      policyDecision: policy.decision,
      policyReason: policy.reason,
    });
    const presented = this.move(current, 'PRESENTED');
    if (!presented.ok) return presented;
    current = { ...presented.value, presentedAt: this.clock.now() };
    this.store.putProposal(current);
    if (policy.decision === 'DENY') {
      return this.move(current, 'REJECTED');
    }
    if (policy.decision === 'REVIEW' || current.suitability.decision === 'INSUFFICIENT_DATA') {
      return this.move(current, 'AWAITING_COMPLIANCE');
    }
    if (requiresStepUp(current)) {
      return this.move(current, 'AWAITING_STEP_UP');
    }
    return this.move(current, 'AWAITING_APPROVAL');
  }

  approveProposal(
    actor: GrowthProductActor,
    proposalId: string,
    input: { readonly stepUpSatisfied?: boolean } = {},
  ): Result<FinancialProposal, GrowProductFailure> {
    if (actor.principalKind === 'AGENT') {
      return err({ code: 'AGENT_CANNOT_APPROVE', message: 'an agent cannot approve a financial proposal' });
    }
    const loaded = this.getProposal(actor, proposalId);
    if (!loaded.ok) return loaded;
    const write = this.authorize(actor, loaded.value.ownerId, 'write');
    if (!write.ok) return write;
    let current = this.expireProposalIfNeeded(loaded.value);
    if (current.status === 'EXPIRED') {
      return err({ code: 'EXPIRED', message: 'proposal expired' });
    }
    if (!assertUnchangedMaterialTerms(current)) {
      return err({ code: 'IMMUTABLE', message: 'material terms no longer match the frozen hash' });
    }
    if (currentCircumstanceHash(actor, current.suitability) !== current.suitability.circumstanceHash) {
      const flagged = this.store.putProposal({
        ...current,
        suitability: { ...current.suitability, decision: 'REVALIDATION_REQUIRED' },
      });
      return err({
        code: 'REVALIDATION_REQUIRED',
        message: `material circumstances changed; proposal ${flagged.proposalId} must be revalidated`,
      });
    }
    if (current.suitability.decision === 'UNSUITABLE') {
      return err({ code: 'SUITABILITY_DENIED', message: 'suitability snapshot is UNSUITABLE' });
    }
    if (current.policyDecision === 'DENY') {
      return err({ code: 'POLICY_DENIED', message: current.policyReason });
    }
    if (current.status === 'DRAFT' || current.status === 'READY') {
      const presented = this.presentProposal(actor, proposalId);
      if (!presented.ok) return presented;
      current = presented.value;
      if (current.status === 'REJECTED') {
        return err({ code: 'POLICY_DENIED', message: current.policyReason });
      }
    }
    if (current.status === 'AWAITING_STEP_UP' && input.stepUpSatisfied !== true && actor.authenticationStrength !== 'STEP_UP') {
      return err({ code: 'STEP_UP_REQUIRED', message: 'step-up authentication is required' });
    }
    if (current.status === 'AWAITING_STEP_UP' && (input.stepUpSatisfied === true || actor.authenticationStrength === 'STEP_UP')) {
      const approvedAfterStepUp = this.move(current, 'APPROVED');
      if (!approvedAfterStepUp.ok) return approvedAfterStepUp;
      const frozenStepUp = this.store.putProposal({
        ...approvedAfterStepUp.value,
        decidedAt: this.clock.now(),
        executionAuthorityId: null,
      });
      this.seal('FINANCIAL_PROPOSAL_APPROVED', {
        proposalId: frozenStepUp.proposalId,
        actorId: actor.actorId,
        executionAuthorityIssued: false,
        stepUpSatisfied: true,
      });
      return ok(frozenStepUp);
    }
    if (current.status === 'AWAITING_COMPLIANCE') {
      return err({ code: 'POLICY_DENIED', message: 'compliance review has not cleared' });
    }
    const approved = this.move(current, 'APPROVED');
    if (!approved.ok) return approved;
    const frozen = this.store.putProposal({
      ...approved.value,
      decidedAt: this.clock.now(),
      executionAuthorityId: null,
    });
    this.seal('FINANCIAL_PROPOSAL_APPROVED', {
      proposalId: frozen.proposalId,
      actorId: actor.actorId,
      executionAuthorityIssued: false,
    });
    return ok(frozen);
  }

  rejectProposal(actor: GrowthProductActor, proposalId: string): Result<FinancialProposal, GrowProductFailure> {
    const loaded = this.getProposal(actor, proposalId);
    if (!loaded.ok) return loaded;
    const write = this.authorize(actor, loaded.value.ownerId, 'write');
    if (!write.ok) return write;
    return this.move(this.expireProposalIfNeeded(loaded.value), 'REJECTED');
  }

  modifyProposal(
    actor: GrowthProductActor,
    proposalId: string,
    patch: ModifyProposalInput,
    clientBody?: unknown,
  ): Result<FinancialProposal, GrowProductFailure> {
    if (clientIssuedProposal(clientBody)) {
      return err({
        code: 'FRONTEND_CANNOT_ISSUE',
        message: 'frontend cannot submit proposal JSON as if the server issued it',
      });
    }
    const loaded = this.getProposal(actor, proposalId);
    if (!loaded.ok) return loaded;
    const write = this.authorize(actor, loaded.value.ownerId, 'write');
    if (!write.ok) return write;
    const previous = this.expireProposalIfNeeded(loaded.value);
    const plan = this.store.getPlan(previous.planId);
    if (!plan) {
      return err({ code: 'PLAN_NOT_FOUND', message: 'plan missing for modification' });
    }
    const amount = Money.fromMinorUnitsString(
      patch.amountMinorUnits ?? patch.goalAllocationMinorUnits ?? previous.amount.minorUnits,
      previous.currency,
    );
    const next = rebuildModifiedProposal({
      previous,
      plan,
      actor,
      now: this.clock.now(),
      amount,
      risk: patch.riskProfile ?? previous.risk,
    });
    if (isMateriallyFrozen(previous.status) && !['REJECTED', 'EXPIRED', 'CANCELLED', 'SUPERSEDED'].includes(previous.status)) {
      const superseded = this.move(previous, 'SUPERSEDED');
      if (!superseded.ok) return superseded;
      this.store.putProposal({ ...superseded.value, supersededBy: next.proposalId });
    }
    this.store.putProposal(next);
    this.seal('FINANCIAL_PROPOSAL_SUPERSEDED', {
      previousProposalId: previous.proposalId,
      proposalId: next.proposalId,
    });
    return ok(next);
  }

  revalidateProposal(actor: GrowthProductActor, proposalId: string): Result<FinancialProposal, GrowProductFailure> {
    const loaded = this.getProposal(actor, proposalId);
    if (!loaded.ok) return loaded;
    const current = loaded.value;
    if (currentCircumstanceHash(actor, current.suitability) !== current.suitability.circumstanceHash) {
      return err({
        code: 'REVALIDATION_REQUIRED',
        message: 'material circumstances changed; create a new proposal version',
      });
    }
    return ok(current);
  }

  private authorize(
    actor: GrowthProductActor,
    ownerId: string,
    mode: 'read' | 'write',
  ): Result<true, GrowProductFailure> {
    if (!actor.actorId || !actor.subjectId) {
      return err({ code: 'ACTOR_REQUIRED', message: 'growth product actor is required' });
    }
    const operator = actor.capabilities.includes('OPERATE_GROWTH_ORCHESTRATOR');
    if (actor.subjectId !== ownerId && !operator) {
      return err({ code: 'CROSS_USER_DENIED', message: 'actor is not the plan owner' });
    }
    const canView = actor.capabilities.includes('VIEW_GROWTH_PLAN') || operator;
    const canWrite =
      actor.capabilities.includes('INVESTMENT_PROPOSE') ||
      actor.capabilities.includes('VIEW_GROWTH_PLAN') ||
      operator;
    if (mode === 'read' && !canView) {
      return err({ code: 'CAPABILITY_DENIED', message: 'VIEW_GROWTH_PLAN is required' });
    }
    if (mode === 'write' && !canWrite) {
      return err({ code: 'CAPABILITY_DENIED', message: 'INVESTMENT_PROPOSE or VIEW_GROWTH_PLAN is required' });
    }
    return ok(true);
  }

  private move(
    proposal: FinancialProposal,
    to: FinancialProposal['status'],
  ): Result<FinancialProposal, GrowProductFailure> {
    const transition = transitionProductProposal(proposal.status, to);
    if (!transition.ok) {
      return err({ code: 'ILLEGAL_TRANSITION', message: transition.message });
    }
    const next: FinancialProposal = {
      ...proposal,
      status: transition.status,
      approvalState: transition.approvalState,
      ...(to === 'REJECTED' || to === 'APPROVED' || to === 'CANCELLED' || to === 'SUPERSEDED'
        ? { decidedAt: this.clock.now() }
        : {}),
    };
    return ok(this.store.putProposal(next));
  }

  private expirePlanIfNeeded(plan: ProductGrowthPlan): ProductGrowthPlan {
    if (plan.status === 'CANCELLED' || plan.status === 'SUPERSEDED' || plan.status === 'COMPLETED') {
      return plan;
    }
    if (!isExpired(plan.expiresAt, this.clock.now())) {
      return plan;
    }
    const expired: ProductGrowthPlan = { ...plan, status: 'CANCELLED' };
    return this.store.putPlan(expired);
  }

  private expireProposalIfNeeded(proposal: FinancialProposal): FinancialProposal {
    if (['APPROVED', 'EXECUTED', 'REJECTED', 'CANCELLED', 'SUPERSEDED', 'FAILED', 'EXPIRED'].includes(proposal.status)) {
      return proposal;
    }
    if (!isExpired(proposal.expiresAt, this.clock.now())) {
      return proposal;
    }
    const moved = transitionProductProposal(proposal.status, 'EXPIRED');
    if (!moved.ok) {
      return proposal;
    }
    return this.store.putProposal({
      ...proposal,
      status: moved.status,
      approvalState: moved.approvalState,
    });
  }

  private emit(eventType: DomainEvent['eventType'], payload: Record<string, unknown>): void {
    this.events?.append({
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

function validateCreate(input: CreateGrowPlanInput): Result<true, GrowProductFailure> {
  if (!/^\d+$/.test(input.startingCapitalMinorUnits)) {
    return err({ code: 'VALIDATION', message: 'starting capital must be an integer minor-unit string' });
  }
  if (!Number.isInteger(input.timeHorizonMonths) || input.timeHorizonMonths < 1) {
    return err({ code: 'VALIDATION', message: 'time horizon months must be a positive integer' });
  }
  if (!/^[A-Z]{3}$/.test(input.currency)) {
    return err({ code: 'VALIDATION', message: 'currency must be ISO 4217' });
  }
  return ok(true);
}

function clientIssuedProposal(body: unknown): boolean {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return false;
  }
  const rec = body as Record<string, unknown>;
  return typeof rec.proposalId === 'string' || typeof rec.materialTermsHash === 'string' || rec.serverIssued === true;
}

export function actorFromVerified(
  actor: {
    readonly actorId: string;
    readonly subjectId: string;
    readonly authorizedCapabilities: readonly string[];
  },
  extras: Partial<GrowthProductActor> = {},
): GrowthProductActor {
  return {
    actorId: actor.actorId,
    subjectId: actor.subjectId,
    capabilities: actor.authorizedCapabilities,
    jurisdiction: extras.jurisdiction ?? 'US',
    verification: extras.verification ?? 'VERIFIED',
    restricted: extras.restricted ?? false,
    principalKind: extras.principalKind ?? 'HUMAN',
    authenticationStrength: extras.authenticationStrength ?? 'STANDARD',
  };
}
