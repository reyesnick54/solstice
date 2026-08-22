import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../config/src/clock.ts';
import { asCustomerId } from '../../domain/src/customer.ts';
import { asJurisdiction } from '../../domain/src/jurisdiction.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import { EvidenceVault } from '../../evidence/src/vault.ts';
import { DomainEventLog } from '../../events/src/events.ts';
import { SimulatedIdentityAdapter } from '../../identity/src/simulation.ts';
import { createSimulationKeyProvider } from '../../security/src/simulation.ts';
import { asGrowthActionId, asGrowthPlanId, asGrowthPlanVersion } from '../ids.ts';
import type { GrowthActionCandidate, GrowthPlan } from '../growth/types.ts';
import { containsGuaranteedReturnClaim } from './no-guaranteed-returns.ts';
import { routeProposalType } from './routing.ts';
import { classifyProviderOutcome } from './execution.ts';
import { agentIncreaseRecurringAmount, evaluateRebalance } from './lifecycle.ts';
import { buildGrowScenarios } from './scenarios.ts';
import { GrowLifecycleService } from './service.ts';
import type { SuitabilityFacts } from './suitability.ts';

const NOW = asUtcInstant('2026-08-22T12:00:00.000Z');

function setupActor(actorId: string, identityId: string) {
  const clock = new FrozenClock(NOW);
  const keys = createSimulationKeyProvider({ clock: { now: () => clock.now() } });
  const events = new DomainEventLog();
  const evidence = new EvidenceVault(clock);
  const identity = new SimulatedIdentityAdapter({ clock, keys, events, evidence });
  assert.equal(
    identity.provisionSimulatedActor({
      actorId,
      jurisdiction: asJurisdiction('US'),
      identityId,
      customerId: asCustomerId(`cust_${identityId}`),
      capabilities: ['VIEW_GROWTH_PLAN', 'CONFIRM_ECONOMIC_MANDATE'],
    }).ok,
    true,
  );
  const actor = identity.service.resolveActorContext(actorId);
  if (!actor.ok) {
    throw new Error('actor');
  }
  return { clock, evidence, actor: actor.value };
}

const SUITABLE: SuitabilityFacts = {
  kycComplete: true,
  jurisdictionPermitted: true,
  accountRestricted: false,
  customerEligible: true,
  riskProfile: 'MODERATE',
  proposalRiskClass: 'MODERATE',
};

function candidate(): GrowthActionCandidate {
  return {
    actionId: asGrowthActionId('gac_paper_investment_review_available_demo'),
    action: 'PAPER_INVESTMENT_REVIEW_AVAILABLE',
    source: 'PEG',
    title: 'Paper investment review',
    expectedEffect: {
      kind: 'UNCERTAIN_MARKET_OUTCOME',
      scenario: 'SANDBOX_PAPER',
      low: { minorUnits: '25000', currency: 'USD' },
      high: { minorUnits: '25000', currency: 'USD' },
      assumptions: Object.freeze(['Estimate only.']),
      confidenceScore: 40,
      horizonDays: 30,
      riskClass: 'UNCERTAIN_MARKET',
      achievementPromised: false,
    },
    confidenceScore: 40,
    assumptions: Object.freeze(['Sandbox paper order.']),
    liquidityImpact: { minorUnits: '-25000', currency: 'USD' },
    riskClass: 'UNCERTAIN_MARKET',
    mandateEvaluation: {
      satisfied: true,
      violatedConstraintKinds: Object.freeze([]),
      notes: Object.freeze([]),
    },
    userConfirmationRequired: true,
    policyRequirement: 'KERNEL',
    complianceRequirement: 'KERNEL',
    executionCapability: 'USER_CONFIRMATION_REQUIRED',
    sourceAccountId: 'acct_cash',
    destinationAccountId: 'acct_brokerage',
    proposedAmount: { minorUnits: '25000', currency: 'USD' },
    supportingFactRefs: Object.freeze(['fact_idle_cash']),
    supportingGoalIds: Object.freeze([]),
    agentProposalIds: Object.freeze([]),
    pegOpportunityIds: Object.freeze(['opp_idle_cash']),
  };
}

function plan(subjectId: string): GrowthPlan {
  const item = candidate();
  return {
    planId: asGrowthPlanId('gpl_demo_plan'),
    version: asGrowthPlanVersion(1),
    cycleId: 'gcy_demo' as GrowthPlan['cycleId'],
    subjectId,
    mandateId: 'emd_demo' as GrowthPlan['mandateId'],
    mandateVersion: 1 as GrowthPlan['mandateVersion'],
    pegSnapshotId: 'pegs_demo',
    generatedAt: NOW,
    planningVersion: 'PLANNING_PRIORITY_V1',
    state: 'CURRENT',
    goalsAddressed: Object.freeze([]),
    goalFeasibility: Object.freeze([]),
    candidateActions: Object.freeze([item]),
    rejectedCandidates: Object.freeze([]),
    orderedProposedActions: Object.freeze([item]),
    expectedDeterministicEffect: { minorUnits: '0', currency: 'USD' },
    assumptions: Object.freeze(['PEG is not the ledger.']),
    risks: Object.freeze(['Market outcomes are uncertain.']),
    unresolvedQuestions: Object.freeze([]),
    dependencies: Object.freeze([]),
    nextReviewTrigger: 'material change',
    explanations: Object.freeze([]),
    agentProposalIds: Object.freeze([]),
    zeroProposalsValid: false,
  };
}

describe('Grow lifecycle', () => {
  it('versions a proposal, requires step-up, and refuses forged client instructions', () => {
    const { clock, evidence, actor } = setupActor('actor_grow_1', actorSubject('grow_1'));
    const grow = new GrowLifecycleService({ clock, evidence });
    const created = grow.generateProposal(actor, plan(actor.subjectId), candidate(), `cust_${actor.subjectId}`, SUITABLE);
    assert.equal(created.ok, true);
    if (!created.ok) {
      throw new Error('proposal');
    }
    assert.equal(created.value.serverOwned, true);
    assert.equal(created.value.clientInstructionsTrusted, false);
    assert.equal(created.value.explainability.canExecuteWithoutAuthority, false);
    assert.equal(created.value.scenario.achievementPromised, false);
    assert.equal(containsGuaranteedReturnClaim(created.value), false);

    const modified = grow.modifyAmount(
      actor,
      created.value.proposalId,
      plan(actor.subjectId),
      candidate(),
      { minorUnits: '20000', currency: 'USD' },
      SUITABLE,
    );
    assert.equal(modified.ok, true);
    if (!modified.ok) {
      throw new Error('modify');
    }
    assert.equal(modified.value.version, 2);
    assert.equal(grow.store.getProposal(created.value.proposalId, 1)?.state, 'SUPERSEDED');

    const needsStepUp = grow.approve(actor, modified.value.proposalId, {
      actorKind: 'CUSTOMER',
      authenticationAssurance: 'AAL1',
      stepUpSatisfied: false,
    });
    assert.equal(needsStepUp.ok, false);
    if (needsStepUp.ok) {
      throw new Error('expected step-up');
    }
    assert.equal(needsStepUp.error.code, 'STEP_UP_REQUIRED');

    const approved = grow.approve(actor, modified.value.proposalId, {
      actorKind: 'CUSTOMER',
      authenticationAssurance: 'STEP_UP_SATISFIED',
      stepUpSatisfied: true,
    });
    assert.equal(approved.ok, true);
    if (!approved.ok) {
      throw new Error('approve');
    }
    const command = grow.createCommand(actor, modified.value.proposalId, 'idem_grow_1');
    assert.equal(command.ok, true);
    if (!command.ok) {
      throw new Error('command');
    }
    assert.equal(routeProposalType(command.value.proposalType), 'INVESTMENT_EXECUTION');
    assert.equal(command.value.clientBodyTrusted, false);
    const replay = grow.createCommand(actor, modified.value.proposalId, 'idem_grow_1');
    assert.equal(replay.ok && replay.value.commandId === command.value.commandId, true);

    const forged = grow.revalidate(command.value.commandId, {
      accountStatus: 'ACTIVE',
      availableMinorUnits: '20000',
      productAvailable: true,
      providerAvailable: true,
      suitability: 'SUITABLE',
      kernelPolicy: 'ALLOW',
      complianceClear: true,
      marketQuoteValid: true,
    });
    assert.equal(forged.ok && forged.value.accepted, true);

    const expiredFacts = grow.revalidate(command.value.commandId, {
      accountStatus: 'RESTRICTED',
      availableMinorUnits: '20000',
      productAvailable: true,
      providerAvailable: true,
      suitability: 'SUITABLE',
      kernelPolicy: 'ALLOW',
      complianceClear: true,
      marketQuoteValid: true,
    });
    assert.equal(expiredFacts.ok && expiredFacts.value.accepted, false);
    if (expiredFacts.ok) {
      assert.equal(expiredFacts.value.requireRefreshedProposal || expiredFacts.value.code === 'ACCOUNT_RESTRICTED', true);
    }
    assert.ok(evidence.list().some((row) => row.kind === 'GROW_PROPOSAL_GENERATED'));
    assert.ok(evidence.list().some((row) => row.kind === 'GROW_PROPOSAL_APPROVED'));
  });

  it('refuses agent self-approval and agent amount increases', () => {
    const { clock, actor } = setupActor('actor_grow_2', actorSubject('grow_2'));
    const grow = new GrowLifecycleService({ clock });
    const created = grow.generateProposal(actor, plan(actor.subjectId), candidate(), `cust_${actor.subjectId}`, SUITABLE);
    assert.equal(created.ok, true);
    if (!created.ok) {
      throw new Error('proposal');
    }
    const refused = grow.approve(actor, created.value.proposalId, {
      actorKind: 'AGENT' as never,
      authenticationAssurance: 'AAL1',
      stepUpSatisfied: true,
    });
    assert.equal(refused.ok, false);
    if (!refused.ok) {
      assert.equal(refused.error.code, 'AGENT_CANNOT_SELF_APPROVE');
    }
    const recurring = grow.createRecurring(actor, {
      subjectId: actor.subjectId,
      customerId: `cust_${actor.subjectId}`,
      amount: { minorUnits: '25000', currency: 'USD' },
      frequency: 'MONTHLY',
      sourceAccountId: 'acct_cash',
      destinationAccountId: 'acct_invest',
      startAt: NOW,
      maxAmountMinorUnits: '25000',
      policy: 'EACH_OCCURRENCE_REVALIDATED',
    });
    assert.equal(recurring.ok, true);
    if (!recurring.ok) {
      throw new Error('recurring');
    }
    const increase = grow.refuseAgentAmountIncrease(recurring.value.recurringMandateId, '50000');
    assert.equal(increase.code, 'AMOUNT_EXCEEDS_MANDATE');
    assert.equal(agentIncreaseRecurringAmount(recurring.value, '50000').code, 'AMOUNT_EXCEEDS_MANDATE');
    const revoked = grow.revokeRecurring(actor, actor.subjectId, recurring.value.recurringMandateId);
    assert.equal(revoked.ok, true);
  });

  it('does not encode guaranteed-return claims in Grow templates', () => {
    const items = buildGrowScenarios({ currency: 'USD', contributionMinorUnits: '20000', horizonMonths: 12 });
    assert.equal(containsGuaranteedReturnClaim(items), false);
    assert.equal(items.every((row) => row.achievementPromised === false), true);
  });

  it('classifies partial fill and does not treat submit as complete', () => {
    assert.equal(classifyProviderOutcome({ kind: 'PARTIAL_FILL', requestedMinorUnits: '25000', filledMinorUnits: '10000' }).state, 'PARTIALLY_COMPLETED');
    assert.equal(classifyProviderOutcome({ kind: 'PENDING', requestedMinorUnits: '25000' }).state, 'PROCESSING');
    const rebalance = evaluateRebalance({ targetBps: 6000, currentBps: 7200, thresholdBps: 500 });
    assert.equal(rebalance.exceeded, true);
    assert.equal(rebalance.automaticTrade, false);
  });
});

function actorSubject(suffix: string): string {
  return `id_${suffix}`;
}
