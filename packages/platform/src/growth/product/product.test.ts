import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../../../config/src/clock.ts';
import { asUtcInstant } from '../../../../domain/src/time.ts';
import { EvidenceVault } from '../../../../evidence/src/vault.ts';
import { DomainEventLog } from '../../../../events/src/events.ts';
import { Money } from '../../../../money/src/money.ts';
import { PRODUCT_TO_APPROVAL, transitionProductProposal } from './proposal-lifecycle.ts';
import {
  compareAlternatives,
  explainProposal,
  getGrowthPlan,
  getProposal,
  requestProposalModification,
} from './agent-tools.ts';
import { lookupReturnAssumption } from './assumptions.ts';
import { toLovableExperience } from './lovable-contract.ts';
import { conservativeOnlyPolicy } from './policy.ts';
import { defaultScenarioSeed, projectScenarios, rollForward } from './scenarios.ts';
import { ProductGrowthService } from './service.ts';
import { asScenarioRunId } from './ids.ts';
import type { CreateGrowPlanInput, GrowthProductActor } from './types.ts';

const NOW = asUtcInstant('2026-08-22T12:00:00.000Z');

function actor(overrides: Partial<GrowthProductActor> = {}): GrowthProductActor {
  return {
    actorId: 'actor_grow_1',
    subjectId: 'cust_grow_1',
    capabilities: ['VIEW_GROWTH_PLAN', 'INVESTMENT_PROPOSE'],
    jurisdiction: 'US',
    verification: 'VERIFIED',
    restricted: false,
    principalKind: 'HUMAN',
    authenticationStrength: 'STANDARD',
    ...overrides,
  };
}

function createInput(overrides: Partial<CreateGrowPlanInput> = {}): CreateGrowPlanInput {
  return {
    ownerId: 'cust_grow_1',
    startingCapitalMinorUnits: '1000000',
    currency: 'USD',
    timeHorizonMonths: 36,
    riskProfile: 'BALANCED',
    goalTargetMinorUnits: '1500000',
    goalRefs: ['goal_emergency'],
    liquidityRequirementMinorUnits: '200000',
    recurringContributionMinorUnits: '10000',
    sourceAccountId: 'acct_usd_checking',
    ...overrides,
  };
}

function service(policy?: ReturnType<typeof conservativeOnlyPolicy>) {
  const clock = new FrozenClock(NOW);
  const events = new DomainEventLog();
  const evidence = new EvidenceVault(clock);
  return {
    clock,
    events,
    evidence,
    svc: new ProductGrowthService({
      clock,
      events,
      evidence,
      ...(policy ? { policy } : {}),
    }),
  };
}

describe('product Growth Plan', () => {
  it('creates a plan with goal linkage, components, fees, and scenarios', () => {
    const { svc } = service();
    const created = svc.createPlan(actor(), createInput());
    assert.equal(created.ok, true);
    if (!created.ok) throw new Error('plan');
    assert.equal(created.value.status, 'PROPOSED');
    assert.equal(created.value.ownerId, 'cust_grow_1');
    assert.deepEqual(created.value.goalRefs, ['goal_emergency']);
    assert.equal(created.value.guaranteedOutcome, false);
    assert.equal(created.value.productionActive, false);
    assert.ok(created.value.components.some((item) => item.kind === 'CASH_RESERVE_TARGET'));
    assert.ok(created.value.components.some((item) => item.kind === 'ELIGIBLE_INVESTMENT_ALLOCATION'));
    assert.ok(created.value.components.some((item) => item.kind === 'RECURRING_SAVINGS'));
    assert.ok(created.value.components.some((item) => item.kind === 'GOAL_CONTRIBUTION'));
    assert.ok(created.value.fees.some((fee) => fee.code === 'SIMULATION_SLEEVE_FEE'));
    assert.ok(created.value.fees.some((fee) => fee.certainty === 'ESTIMATE'));
    assert.equal(created.value.scenarioAnalysis.conservative.kind, 'CONSERVATIVE');
    assert.equal(created.value.scenarioAnalysis.base.kind, 'BASE');
    assert.equal(created.value.scenarioAnalysis.upside.kind, 'UPSIDE');
    assert.equal(created.value.scenarioAnalysis.guaranteedOutcome, false);
    assert.ok(created.value.scenarioAnalysis.monteCarlo);
    const loaded = svc.getPlan(actor(), created.value.planId);
    assert.equal(loaded.ok, true);
  });

  it('denies cross-user plan reads', () => {
    const { svc } = service();
    const created = svc.createPlan(actor(), createInput());
    if (!created.ok) throw new Error('plan');
    const denied = svc.getPlan(actor({ subjectId: 'cust_other', actorId: 'actor_other' }), created.value.planId);
    assert.equal(denied.ok, false);
    if (denied.ok) throw new Error('expected deny');
    assert.equal(denied.error.code, 'CROSS_USER_DENIED');
  });
});

describe('return assumptions', () => {
  it('loads catalog rows and marks unsupported combinations unavailable', () => {
    const available = lookupReturnAssumption({
      currency: 'USD',
      riskProfile: 'BALANCED',
      timeHorizonMonths: 36,
    });
    assert.equal(available.availability, 'AVAILABLE');
    assert.equal(available.inventedByModel, false);
    assert.equal(available.guaranteed, false);
    const missing = lookupReturnAssumption({
      currency: 'JPY',
      riskProfile: 'BALANCED',
      timeHorizonMonths: 36,
    });
    assert.equal(missing.availability, 'UNAVAILABLE');
    assert.equal(missing.unavailableReason, 'NO_CATALOG_ENTRY_FOR_CURRENCY');
  });
});

describe('scenario engine', () => {
  it('is deterministic, includes uncertainty and possible loss, and never guarantees', () => {
    const assumption = lookupReturnAssumption({
      currency: 'USD',
      riskProfile: 'BALANCED',
      timeHorizonMonths: 12,
    });
    const starting = Money.fromMinorUnitsString('1000000', 'USD');
    const monthly = Money.fromMinorUnitsString('10000', 'USD');
    const first = projectScenarios({
      runId: asScenarioRunId('scn_test_v1'),
      starting,
      monthlyContribution: monthly,
      withdrawals: Money.zero('USD'),
      timeHorizonMonths: 12,
      assumption,
      riskProfile: 'BALANCED',
      seed: defaultScenarioSeed(),
    });
    const second = projectScenarios({
      runId: asScenarioRunId('scn_test_v1'),
      starting,
      monthlyContribution: monthly,
      withdrawals: Money.zero('USD'),
      timeHorizonMonths: 12,
      assumption,
      riskProfile: 'BALANCED',
      seed: defaultScenarioSeed(),
    });
    assert.deepEqual(first.monteCarlo, second.monteCarlo);
    assert.equal(first.base.guaranteedOutcome, false);
    assert.equal(first.base.notAPromise, true);
    assert.ok(first.base.possibleLoss.illustrated);
    assert.equal(first.base.possibleLoss.guaranteed, false);
    assert.ok(first.base.dataAsOf);
    assert.notEqual(first.base.illustratedLow.minorUnits, first.base.illustratedHigh.minorUnits);
    assert.ok(first.monteCarlo);
    assert.equal(first.monteCarlo?.guaranteedOutcome, false);
    assert.match(first.monteCarlo?.probabilityLanguage ?? '', /Not a real-world probability/);
    const cash = rollForward({
      starting,
      monthlyContribution: monthly,
      withdrawals: Money.zero('USD'),
      months: 12,
      annualBps: 0,
      feeBps: 0,
    });
    assert.equal(cash.ending.minorUnits, 1000000n + 10000n * 12n);
  });
});

describe('financial proposal contract', () => {
  it('creates an immutable presented proposal with explanation, alternatives, and fees', () => {
    const { svc } = service();
    const plan = svc.createPlan(actor(), createInput());
    if (!plan.ok) throw new Error('plan');
    const draft = svc.createProposal(actor(), { planId: plan.value.planId });
    if (!draft.ok) throw new Error('proposal');
    assert.equal(draft.value.serverIssued, true);
    assert.equal(draft.value.executionAuthorityId, null);
    assert.equal(draft.value.explanation.inventedByModel, false);
    assert.ok(draft.value.alternatives.length >= 3);
    assert.ok(draft.value.fees.some((fee) => fee.certainty === 'ESTIMATE'));
    const presented = svc.presentProposal(actor(), draft.value.proposalId);
    if (!presented.ok) throw new Error(presented.error.message);
    assert.equal(presented.value.status, 'AWAITING_STEP_UP');
    assert.equal(presented.value.approvalState, PRODUCT_TO_APPROVAL.AWAITING_STEP_UP);
    const mutate = { ...presented.value, amount: { minorUnits: '1', currency: 'USD' } };
    assert.notEqual(mutate.amount.minorUnits, presented.value.amount.minorUnits);
    const stored = svc.getProposal(actor(), presented.value.proposalId);
    if (!stored.ok) throw new Error('stored');
    assert.equal(stored.value.amount.minorUnits, presented.value.amount.minorUnits);
  });

  it('expires a proposal when the clock passes expiresAt', () => {
    const { svc, clock } = service();
    const plan = svc.createPlan(actor(), createInput());
    if (!plan.ok) throw new Error('plan');
    const draft = svc.createProposal(actor(), { planId: plan.value.planId });
    if (!draft.ok) throw new Error('proposal');
    clock.set(asUtcInstant('2026-12-01T00:00:00.000Z'));
    const expired = svc.getProposal(actor(), draft.value.proposalId);
    if (!expired.ok) throw new Error('expired');
    assert.equal(expired.value.status, 'EXPIRED');
    const approve = svc.approveProposal(actor(), draft.value.proposalId, { stepUpSatisfied: true });
    assert.equal(approve.ok, false);
    if (approve.ok) throw new Error('expected expire');
    assert.equal(approve.error.code, 'EXPIRED');
  });

  it('creates a new version on modification instead of editing the frozen proposal', () => {
    const { svc } = service();
    const plan = svc.createPlan(actor(), createInput());
    if (!plan.ok) throw new Error('plan');
    const draft = svc.createProposal(actor(), { planId: plan.value.planId });
    if (!draft.ok) throw new Error('proposal');
    const presented = svc.presentProposal(actor(), draft.value.proposalId);
    if (!presented.ok) throw new Error(presented.error.message);
    const modified = svc.modifyProposal(actor(), presented.value.proposalId, {
      amountMinorUnits: '250000',
    });
    if (!modified.ok) throw new Error(modified.error.message);
    assert.notEqual(modified.value.proposalId, presented.value.proposalId);
    assert.equal(modified.value.supersedes, presented.value.proposalId);
    assert.equal(modified.value.amount.minorUnits, '250000');
    const previous = svc.getProposal(actor(), presented.value.proposalId);
    if (!previous.ok) throw new Error('previous');
    assert.equal(previous.value.status, 'SUPERSEDED');
    assert.equal(previous.value.supersededBy, modified.value.proposalId);
    const forged = svc.modifyProposal(
      actor(),
      modified.value.proposalId,
      { amountMinorUnits: '1' },
      { proposalId: 'fpr_forged', serverIssued: true },
    );
    assert.equal(forged.ok, false);
    if (forged.ok) throw new Error('expected frontend refuse');
    assert.equal(forged.error.code, 'FRONTEND_CANNOT_ISSUE');
  });
});

describe('suitability, policy, approval, and step-up', () => {
  it('denies a high-risk allocation under conservative-only policy', () => {
    const { svc } = service(conservativeOnlyPolicy());
    const plan = svc.createPlan(actor(), createInput({ riskProfile: 'GROWTH' }));
    if (!plan.ok) throw new Error('plan');
    const draft = svc.createProposal(actor(), { planId: plan.value.planId });
    if (!draft.ok) throw new Error('proposal');
    const presented = svc.presentProposal(actor(), draft.value.proposalId);
    if (!presented.ok) throw new Error(presented.error.message);
    assert.equal(presented.value.status, 'REJECTED');
    assert.equal(presented.value.policyDecision, 'DENY');
    const approve = svc.approveProposal(actor(), draft.value.proposalId, { stepUpSatisfied: true });
    assert.equal(approve.ok, false);
    if (approve.ok) throw new Error('expected policy deny');
    assert.equal(approve.error.code, 'POLICY_DENIED');
  });

  it('requires step-up then approves without issuing Execution Authority', () => {
    const { svc, evidence } = service();
    const plan = svc.createPlan(actor(), createInput());
    if (!plan.ok) throw new Error('plan');
    const draft = svc.createProposal(actor(), { planId: plan.value.planId });
    if (!draft.ok) throw new Error('proposal');
    const presented = svc.presentProposal(actor(), draft.value.proposalId);
    if (!presented.ok) throw new Error(presented.error.message);
    const blocked = svc.approveProposal(actor(), presented.value.proposalId);
    assert.equal(blocked.ok, false);
    if (blocked.ok) throw new Error('expected step-up');
    assert.equal(blocked.error.code, 'STEP_UP_REQUIRED');
    const approved = svc.approveProposal(actor(), presented.value.proposalId, { stepUpSatisfied: true });
    if (!approved.ok) throw new Error(approved.error.message);
    assert.equal(approved.value.status, 'APPROVED');
    assert.equal(approved.value.approvalState, 'APPROVED');
    assert.equal(approved.value.executionAuthorityId, null);
    assert.ok(evidence.list().some((item) => item.kind === 'FINANCIAL_PROPOSAL_APPROVED'));
  });

  it('requires revalidation when circumstances change', () => {
    const { svc } = service();
    const owner = actor();
    const plan = svc.createPlan(owner, createInput());
    if (!plan.ok) throw new Error('plan');
    const draft = svc.createProposal(owner, { planId: plan.value.planId });
    if (!draft.ok) throw new Error('proposal');
    const presented = svc.presentProposal(owner, draft.value.proposalId);
    if (!presented.ok) throw new Error(presented.error.message);
    const changed = actor({ restricted: true });
    const approve = svc.approveProposal(changed, presented.value.proposalId, { stepUpSatisfied: true });
    assert.equal(approve.ok, false);
    if (approve.ok) throw new Error('expected revalidation');
    assert.equal(approve.error.code, 'REVALIDATION_REQUIRED');
  });
});

describe('agent tool boundary', () => {
  it('refuses fabricated proposal ids and cannot approve or execute', () => {
    const { svc } = service();
    const owner = actor();
    const plan = svc.createPlan(owner, createInput());
    if (!plan.ok) throw new Error('plan');
    const knownPlan = getGrowthPlan(svc, owner, plan.value.planId);
    assert.equal(knownPlan.ok, true);
    const fabricated = getProposal(svc, owner, 'fpr_invented_by_model');
    assert.equal(fabricated.ok, false);
    if (fabricated.ok) throw new Error('expected fabricated');
    assert.equal(fabricated.error.code, 'FABRICATED_PROPOSAL_ID');
    const draft = svc.createProposal(owner, { planId: plan.value.planId });
    if (!draft.ok) throw new Error('proposal');
    const explained = explainProposal(svc, owner, draft.value.proposalId);
    assert.equal(explained.ok, true);
    const alts = compareAlternatives(svc, owner, draft.value.proposalId);
    assert.equal(alts.ok, true);
    const modified = requestProposalModification(svc, owner, draft.value.proposalId, {
      amountMinorUnits: '300000',
    });
    assert.equal(modified.ok, true);
    const agentApprove = svc.approveProposal(
      { ...owner, principalKind: 'AGENT' },
      draft.value.proposalId,
      { stepUpSatisfied: true },
    );
    assert.equal(agentApprove.ok, false);
    if (agentApprove.ok) throw new Error('expected agent deny');
    assert.equal(agentApprove.error.code, 'AGENT_CANNOT_APPROVE');
  });
});

describe('no guaranteed-return language or data state', () => {
  it('keeps every projection and proposal marked not-a-promise', () => {
    const { svc } = service();
    const plan = svc.createPlan(actor(), createInput());
    if (!plan.ok) throw new Error('plan');
    const experience = toLovableExperience(plan.value);
    assert.equal(experience.guaranteedOutcome, false);
    assert.equal(experience.productionActive, false);
    assert.equal(experience.scenarios.base.guaranteedOutcome, false);
    const blob = JSON.stringify({ plan: plan.value, experience });
    assert.equal(/\bAPY\b|\bAPR\b|guaranteed profit|guaranteedOutcome":true/i.test(blob), false);
  });
});

describe('Phase B approval mapping', () => {
  it('refuses illegal product transitions that would skip the Phase B machine', () => {
    const illegal = transitionProductProposal('APPROVED', 'DRAFT');
    assert.equal(illegal.ok, false);
    const legal = transitionProductProposal('AWAITING_APPROVAL', 'APPROVED');
    assert.equal(legal.ok, true);
    if (legal.ok) {
      assert.equal(legal.approvalState, 'APPROVED');
    }
  });
});
