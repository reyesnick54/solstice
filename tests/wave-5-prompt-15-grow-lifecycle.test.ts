import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../packages/config/src/clock.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import { EvidenceVault } from '../packages/evidence/src/vault.ts';
import { DomainEventLog } from '../packages/events/src/events.ts';
import { SimulatedIdentityAdapter } from '../packages/identity/src/simulation.ts';
import { createSimulationKeyProvider } from '../packages/security/src/simulation.ts';
import { invokeGrowAgentTool, refusePrivilegedGrowExecution, type GrowAgentToolPort } from '../packages/sunrey-agent/src/grow-tools.ts';
import { AGENT_EVAL_CATEGORIES } from '../packages/sunrey-agent/src/productization/taxonomy.ts';
import { evalCasesByCategory } from '../packages/sunrey-agent/src/productization/evaluations.ts';
import { asGrowthActionId, asGrowthPlanId, asGrowthPlanVersion } from '../packages/platform/src/ids.ts';
import type { GrowthActionCandidate, GrowthPlan } from '../packages/platform/src/growth/types.ts';
import {
  GrowLifecycleService,
  evaluateGrowComplianceCheckpoint,
  evaluateGrowSuitability,
  idempotentExecutionKey,
  materialProposalTermsChanged,
  normalizeFinancialOpportunity,
  projectedVsRealized,
  SimulationGrowExecutionAdapter,
  staleDataBlocksProposal,
  sourcedFact,
  shouldReassess,
  submittedIsNotCompleted,
  UnavailableGrowExecutionAdapter,
  allocationWeightBps,
  assertAiRuntimeIsolation,
  deriveCapabilityMatrixJson,
  GROW_BUILD_STATUS,
  growAgentById,
} from '../packages/platform/src/grow/index.ts';
import { createPhaseEWorld } from './phase-e-world.ts';

const NOW = asUtcInstant('2026-08-31T12:00:00.000Z');

function setupGrow(subjectSuffix: string) {
  const clock = new FrozenClock(NOW);
  const keys = createSimulationKeyProvider({ clock: { now: () => clock.now() } });
  const events = new DomainEventLog();
  const evidence = new EvidenceVault(clock);
  const identity = new SimulatedIdentityAdapter({ clock, keys, events, evidence });
  const actorId = `actor_w5_${subjectSuffix}`;
  const subjectId = `id_${subjectSuffix}`;
  assert.equal(
    identity.provisionSimulatedActor({
      actorId,
      jurisdiction: 'US' as never,
      identityId: subjectId,
      customerId: `cust_${subjectSuffix}` as never,
      capabilities: ['VIEW_GROWTH_PLAN', 'CONFIRM_ECONOMIC_MANDATE'],
    }).ok,
    true,
  );
  const actor = identity.service.resolveActorContext(actorId);
  if (!actor.ok) {
    throw new Error('actor');
  }
  return { clock, evidence, grow: new GrowLifecycleService({ clock, evidence }), actor: actor.value, subjectId };
}

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
    mandateEvaluation: { satisfied: true, violatedConstraintKinds: Object.freeze([]), notes: Object.freeze([]) },
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

describe('Wave 5 Prompt 15 — Grow My Money lifecycle', () => {
  it('maps opportunity discovery to canonical FinancialOpportunity without inventing returns', async () => {
    const normalized = normalizeFinancialOpportunity(
      {
        opportunityId: 'opp_idle_cash' as never,
        subjectId: 'id_demo',
        type: 'CASH_OPTIMIZATION',
        detector: 'EXCESS_IDLE_CASH',
        title: 'Idle cash',
        summary: 'Move excess cash within eligible accounts',
        source: 'PEG',
        eligible: true,
        priority: 1,
        estimatedImpact: { minorUnits: '50000', currency: 'USD' },
        riskLevel: 'LOW',
        liquidityImpact: 'DECREASES',
        timeHorizon: 'NEAR_TERM',
        fees: Object.freeze([]),
        dependencies: Object.freeze([]),
        goalLinks: Object.freeze([]),
        evidence: { factRefs: Object.freeze(['acct_cash']), detector: 'EXCESS_IDLE_CASH', notes: Object.freeze([]) },
        expiresAt: NOW,
        status: 'ELIGIBLE',
        fingerprint: 'fp_idle',
        impact: {
          kind: 'KNOWN_FINANCIAL_EFFECT',
          estimatedImpact: { minorUnits: '50000', currency: 'USD' },
          assumptions: Object.freeze(['Simulation only.']),
          asOf: NOW,
          fees: Object.freeze([]),
          taxDisclaimer: 'Not tax advice.',
          achievementPromised: false,
          returnGuaranteed: false,
        },
        eligibility: {
          eligible: true,
          immediatelyExecutable: false,
          reasons: Object.freeze([]),
          failedChecks: Object.freeze([]),
        },
        ranking: {
          version: 'OPPORTUNITY_RANKING_V1',
          priority: 1,
          total: 80,
          goalRelevance: 70,
          urgency: 60,
          confidence: 80,
          impactScore: 75,
          liquidityFit: 90,
          preferenceFit: 80,
          costPenalty: 0,
          reasons: Object.freeze(['idle cash above reserve']),
        },
        card: 'PUT_IDLE_CASH_TO_WORK',
        currency: 'USD',
        createdAt: NOW,
        updatedAt: NOW,
      },
      NOW,
    );
    assert.equal(normalized.immediatelyExecutable, false);
    assert.equal(normalized.achievementPromised, false);
    assert.equal(normalized.expectedReturnData.kind, 'DETERMINISTIC_EFFECT');
  });

  it('SCENARIO A: excess cash → proposal → authorization → simulated execution → monitoring', async () => {
    const world = createPhaseEWorld('happy');
    const opportunities = await world.handle({ method: 'GET', path: '/api/v1/grow/opportunities', query: {} });
    assert.equal(opportunities.status, 200);
    const planRes = await world.handle({ method: 'GET', path: '/api/v1/grow/plan', query: {} });
    assert.equal(planRes.status, 200);
    const planBody = planRes.body as { actions: Array<{ actionId: string; action: string }> };
    const action =
      planBody.actions.find((row) => row.action === 'PAPER_INVESTMENT_REVIEW_AVAILABLE') ??
      planBody.actions.find((row) => row.action === 'INVESTMENT_ACCOUNT_AVAILABLE') ??
      planBody.actions[0]!;
    const created = await world.handle({
      method: 'POST',
      path: '/api/v1/grow/proposals',
      query: {},
      body: { actionId: action.actionId },
    });
    assert.equal(created.status, 201);
    const proposalId = (created.body as { proposalId: string }).proposalId;
    const modified = await world.handle({
      method: 'POST',
      path: `/api/v1/grow/proposals/${proposalId}/modify`,
      query: {},
      body: { amountMinorUnits: '20000' },
    });
    assert.equal(modified.status, 200);
    const approved = await world.handle({
      method: 'POST',
      path: `/api/v1/grow/proposals/${proposalId}/approve`,
      query: {},
      body: { stepUpSatisfied: true },
    });
    assert.equal(approved.status, 200);
    const executed = await world.handle({
      method: 'POST',
      path: `/api/v1/grow/proposals/${proposalId}/execute`,
      query: {},
      body: { idempotencyKey: 'w5-scenario-a' },
    });
    assert.equal(executed.status, 200, JSON.stringify(executed.body));
    const monitor = await world.handle({ method: 'POST', path: '/api/v1/grow/monitor', query: {}, body: {} });
    assert.equal(monitor.status, 200);
  });

  it('SCENARIO B: investment proposal blocked by compliance rejection', async () => {
    const blocked = evaluateGrowComplianceCheckpoint({
      suitability: evaluateGrowSuitability({
        kycComplete: true,
        jurisdictionPermitted: true,
        accountRestricted: false,
        customerEligible: true,
        riskProfile: 'LOW',
        proposalRiskClass: 'HIGH',
      }),
      kernelPolicy: 'ALLOW',
      jurisdictionPermitted: true,
      kycComplete: true,
      accountRestricted: false,
      providerAvailable: true,
      productAvailable: true,
    });
    assert.equal(blocked.allowed, false);
    if (!blocked.allowed) {
      assert.equal(blocked.code, 'SUITABILITY_MISMATCH');
    }
  });

  it('SCENARIO C: material quote change invalidates authorization via proposal versioning', async () => {
    const { grow, actor, subjectId } = setupGrow('scenario_c');
    const created = grow.generateProposal(actor, plan(subjectId), candidate(), `cust_${subjectId}`, {
      kycComplete: true,
      jurisdictionPermitted: true,
      accountRestricted: false,
      customerEligible: true,
      riskProfile: 'MODERATE',
      proposalRiskClass: 'MODERATE',
    });
    assert.equal(created.ok, true);
    if (!created.ok) throw new Error('proposal');
    const approvedV1 = grow.approve(actor, created.value.proposalId, {
      actorKind: 'CUSTOMER',
      authenticationAssurance: 'STEP_UP_SATISFIED',
      stepUpSatisfied: true,
    });
    assert.equal(approvedV1.ok, true);
    if (!approvedV1.ok) throw new Error('approve v1');
    const modified = grow.modifyAmount(
      actor,
      created.value.proposalId,
      plan(subjectId),
      candidate(),
      { minorUnits: '20000', currency: 'USD' },
      {
        kycComplete: true,
        jurisdictionPermitted: true,
        accountRestricted: false,
        customerEligible: true,
        riskProfile: 'MODERATE',
        proposalRiskClass: 'MODERATE',
      },
    );
    assert.equal(modified.ok, true);
    if (!modified.ok) throw new Error('modify');
    assert.equal(materialProposalTermsChanged(created.value, modified.value), true);
    const staleApprovalCommand = grow.createCommand(actor, modified.value.proposalId, 'idem_stale');
    assert.equal(staleApprovalCommand.ok, false);
    if (!staleApprovalCommand.ok) {
      assert.equal(staleApprovalCommand.error.code, 'APPROVAL_INVALID');
    }
  });

  it('SCENARIO D: provider timeout reconciles without duplicate trade via idempotency', async () => {
    const adapter = new SimulationGrowExecutionAdapter();
    const key = idempotentExecutionKey('prop_demo', 1, 'client-key');
    assert.match(key, /prop_demo/);
    const { grow, actor, subjectId } = setupGrow('scenario_d');
    const created = grow.generateProposal(actor, plan(subjectId), candidate(), `cust_${subjectId}`, {
      kycComplete: true,
      jurisdictionPermitted: true,
      accountRestricted: false,
      customerEligible: true,
      riskProfile: 'MODERATE',
      proposalRiskClass: 'MODERATE',
    });
    if (!created.ok) throw new Error('proposal');
    const approved = grow.approve(actor, created.value.proposalId, {
      actorKind: 'CUSTOMER',
      authenticationAssurance: 'STEP_UP_SATISFIED',
      stepUpSatisfied: true,
    });
    if (!approved.ok) throw new Error('approve');
    const command1 = grow.createCommand(actor, created.value.proposalId, key);
    const command2 = grow.createCommand(actor, created.value.proposalId, key);
    assert.equal(command1.ok && command2.ok && command1.value.commandId === command2.value.commandId, true);
    if (!command1.ok) throw new Error('command');
    const execution = grow.store.executionForCommand(command1.value.commandId);
    if (!execution) throw new Error('execution');
    const submitted = await Promise.resolve(adapter.submitExecution(command1.value, execution, NOW));
    assert.equal('ok' in submitted && submitted.ok, true);
    const reconciled = adapter.reconcile(execution.executionId, {
      kind: 'TIMEOUT',
      requestedMinorUnits: command1.value.financialResource.amount.minorUnits,
    });
    assert.equal(reconciled, 'REQUIRES_REVIEW');
    assert.equal(submittedIsNotCompleted('SUBMITTED'), true);
  });

  it('SCENARIO E: AI unsupported execution action rejected at backend boundary', async () => {
    const port: GrowAgentToolPort = {
      getFinancialSnapshot: () => ({}),
      getGoals: () => ({}),
      getOpportunities: () => ({}),
      getGrowthPlan: () => ({}),
      getPortfolio: () => ({}),
      explainOpportunity: () => ({}),
      createGrowthProposal: () => ({}),
      modifyGrowthProposal: () => ({}),
      submitProposalForApproval: () => ({}),
      getExecutionStatus: () => ({}),
    };
    const refused = invokeGrowAgentTool(port, {
      tool: 'executeProposal' as never,
      subjectId: 'id_demo',
      actorId: 'agent_demo',
      actorKind: 'AGENT',
      payload: {},
    });
    assert.equal(refused.ok, false);
    if (!refused.ok) {
      assert.equal(refused.code, 'AGENT_CANNOT_EXECUTE');
    }
    assert.equal(refusePrivilegedGrowExecution().ok, false);
    const refusedPrivileged = refusePrivilegedGrowExecution();
    if (!refusedPrivileged.ok) {
      assert.equal(refusedPrivileged.code, 'AGENT_CANNOT_EXECUTE');
    }
  });

  it('SCENARIO F: revoked recurring mandate prevents future action', async () => {
    const { grow, actor, subjectId } = setupGrow('scenario_f');
    const recurring = grow.createRecurring(actor, {
      subjectId,
      customerId: `cust_${subjectId}`,
      amount: { minorUnits: '25000', currency: 'USD' },
      frequency: 'MONTHLY',
      sourceAccountId: 'acct_cash',
      destinationAccountId: 'acct_invest',
      startAt: NOW,
      maxAmountMinorUnits: '25000',
      policy: 'EACH_OCCURRENCE_REVALIDATED',
    });
    assert.equal(recurring.ok, true);
    if (!recurring.ok) throw new Error('recurring');
    const revoked = grow.revokeRecurring(actor, subjectId, recurring.value.recurringMandateId);
    assert.equal(revoked.ok, true);
    if (!revoked.ok) throw new Error('revoke');
    assert.equal(revoked.value.state, 'REVOKED');
  });

  it('blocks actionable proposals from stale market facts', async () => {
    const stale = sourcedFact({
      source: 'PUBLIC_MARKET_RESEARCH',
      retrievedAt: asUtcInstant('2026-08-31T10:00:00.000Z'),
      now: asUtcInstant('2026-08-31T12:30:00.000Z'),
      maxAgeMs: 30 * 60 * 1000,
    });
    const gate = staleDataBlocksProposal([stale]);
    assert.equal(gate.blocked, true);
    assert.equal(gate.labelRequired, true);
  });

  it('uses deterministic analysis engine for allocation math', async () => {
    assert.equal(allocationWeightBps('2500', '10000', 'USD'), 2500);
  });

  it('separates projected and realized outcomes', async () => {
    const attribution = projectedVsRealized({
      metric: 'interest',
      projectedMinorUnits: '500',
      realizedMinorUnits: '420',
      currency: 'USD',
    });
    assert.equal(attribution.projectedNotRealized, true);
    assert.notEqual(attribution.projected?.minorUnits, attribution.realized?.minorUnits);
  });

  it('enforces reassessment cooldown to avoid proposal spam', async () => {
    const decision = shouldReassess({
      finding: {
        kind: 'PORTFOLIO_DRIFT',
        summary: 'drift exceeded',
        createsOpportunity: true,
        silentTradeForbidden: true,
      },
      lastProposalAt: NOW,
      now: asUtcInstant('2026-08-31T12:10:00.000Z'),
      thresholdExceeded: true,
    });
    assert.equal(decision.shouldPropose, false);
    assert.equal(decision.cooldownActive, true);
  });

  it('stops honestly when no execution provider exists', async () => {
    const unavailable = new UnavailableGrowExecutionAdapter();
    const prepare = unavailable.prepareExecution();
    assert.equal('code' in prepare && prepare.code, 'PROVIDER_UNAVAILABLE');
  });

  it('proves AI/execution credential separation', async () => {
    const report = assertAiRuntimeIsolation();
    assert.equal(report.pass, true);
    assert.equal(report.aiReceivesMasterKey, false);
  });

  it('exports a truthful Grow capability matrix and build status', async () => {
    const matrix = deriveCapabilityMatrixJson();
    assert.equal(matrix.schema, 'sunrey.grow.agent-capability-matrix.v1');
    assert.equal(matrix.environment, 'simulation');
    assert.ok(matrix.agents.length >= 10);
    const investment = growAgentById('investment');
    assert.ok(investment);
    assert.equal(investment!.stages.EXECUTE, 'PROVIDER_GATED');
    assert.ok(GROW_BUILD_STATUS.some((row) => row.subsystem.includes('Investment execution (live)')));
  });

  it('extends financial agent evaluation coverage for Grow safety cases', async () => {
    const growCases = evalCasesByCategory('GROW_MY_MONEY');
    assert.ok(growCases.length >= 4);
    assert.ok(AGENT_EVAL_CATEGORIES.includes('GROW_MY_MONEY'));
    assert.ok(growCases.some((row) => row.forbiddenBehavior.includes('certain_return_claim')));
  });
});
