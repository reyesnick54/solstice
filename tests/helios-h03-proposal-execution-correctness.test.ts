import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../packages/config/src/clock.ts';
import { asCustomerId } from '../packages/domain/src/customer.ts';
import { asJurisdiction } from '../packages/domain/src/jurisdiction.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import { EvidenceVault } from '../packages/evidence/src/vault.ts';
import { DomainEventLog } from '../packages/events/src/events.ts';
import { SimulatedIdentityAdapter } from '../packages/identity/src/simulation.ts';
import { createSimulationKeyProvider } from '../packages/security/src/simulation.ts';
import {
  bindGrowthProposalEvidence,
  parseStructuredOutput,
  toolRunReferenceForIntent,
  validateGrowthProposalEvidenceBinding,
} from '../packages/ai-runtime/src/index.ts';
import { asGrowthActionId, asGrowthPlanId, asGrowthPlanVersion } from '../packages/platform/src/ids.ts';
import type { GrowthActionCandidate, GrowthPlan } from '../packages/platform/src/growth/types.ts';
import {
  GrowLifecycleService,
  idempotentExecutionKey,
  projectGrowExecutionForClient,
  projectGrowProposalForClient,
  submittedIsNotCompleted,
  transitionExecution,
} from '../packages/platform/src/grow/index.ts';
import { refusePrivilegedGrowExecution } from '../packages/sunrey-agent/src/grow-tools.ts';
import { lintGrowthBoundary } from '../tools/architectural-linter/src/growth-guards.ts';

const NOW = asUtcInstant('2026-09-15T12:00:00.000Z');

function setupGrow(subjectSuffix: string) {
  const clock = new FrozenClock(NOW);
  const keys = createSimulationKeyProvider({ clock: { now: () => clock.now() } });
  const events = new DomainEventLog();
  const evidence = new EvidenceVault(clock);
  const identity = new SimulatedIdentityAdapter({ clock, keys, events, evidence });
  const actorId = `actor_h03_${subjectSuffix}`;
  const subjectId = `id_${subjectSuffix}`;
  assert.equal(
    identity.provisionSimulatedActor({
      actorId,
      jurisdiction: asJurisdiction('US'),
      identityId: subjectId,
      customerId: asCustomerId(`cust_${subjectSuffix}`),
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
    planId: asGrowthPlanId('gpl_h03_plan'),
    version: asGrowthPlanVersion(1),
    cycleId: 'gcy_h03' as GrowthPlan['cycleId'],
    subjectId,
    mandateId: 'emd_h03' as GrowthPlan['mandateId'],
    mandateVersion: 1 as GrowthPlan['mandateVersion'],
    pegSnapshotId: 'pegs_h03',
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

describe('HELIOS H03 proposal and execution state correctness', () => {
  it('1. agent proposal creates no financial effect', () => {
    const { grow, actor, subjectId } = setupGrow('no_effect');
    const created = grow.generateProposal(actor, plan(subjectId), candidate(), `cust_${subjectId}`, {
      kycComplete: true,
      jurisdictionPermitted: true,
      accountRestricted: false,
      customerEligible: true,
      riskProfile: 'MODERATE',
      proposalRiskClass: 'MODERATE',
    });
    assert.equal(created.ok, true);
    if (!created.ok) {
      throw new Error('proposal');
    }
    const projection = projectGrowProposalForClient(created.value);
    assert.equal(projection.executesMoney, false);
    assert.equal(projection.proposalIsNotExecution, true);
    assert.equal(grow.store.listExecutions(`cust_${subjectId}`).length, 0);
  });

  it('2. model cannot self-authorize', () => {
    const structured = parseStructuredOutput({
      kind: 'GROWTH_AGENT_PROPOSAL',
      proposalType: 'INVESTMENT_BUY',
      summary: 'Buy index fund',
      rationale: 'Idle cash',
      evidence: ['tool:ait_missing'],
      riskLevel: 'MEDIUM',
      assumptions: ['Market risk'],
      recommendedAmount: { minorUnits: '25000', currency: 'USD' },
      currency: 'USD',
      timeHorizon: '12M',
      requiredUserApproval: true,
      providerDataReferences: ['ait_missing'],
      confidence: 'MEDIUM',
      guaranteedReturn: false,
    });
    assert.equal(structured.ok, true);
    if (!structured.ok || structured.value.kind !== 'GROWTH_AGENT_PROPOSAL') {
      throw new Error('structured');
    }
    const refused = validateGrowthProposalEvidenceBinding({
      proposal: structured.value,
      completedToolRuns: [],
    });
    assert.equal(refused.ok, false);
    if (refused.ok) {
      throw new Error('expected refusal');
    }
    assert.match(refused.detail, /tool runs/);
  });

  it('3-5. approval and authorization do not imply submission or acknowledgement', () => {
    const { grow, actor, subjectId } = setupGrow('approval_boundary');
    const created = grow.generateProposal(actor, plan(subjectId), candidate(), `cust_${subjectId}`, {
      kycComplete: true,
      jurisdictionPermitted: true,
      accountRestricted: false,
      customerEligible: true,
      riskProfile: 'MODERATE',
      proposalRiskClass: 'MODERATE',
    });
    assert.equal(created.ok, true);
    if (!created.ok) {
      throw new Error('proposal');
    }
    const approved = grow.approve(actor, created.value.proposalId, {
      actorKind: 'CUSTOMER',
      authenticationAssurance: 'STEP_UP_SATISFIED',
      stepUpSatisfied: true,
    });
    assert.equal(approved.ok, true);
    if (!approved.ok) {
      throw new Error('approve');
    }
    const proposalProjection = projectGrowProposalForClient(approved.value.proposal);
    assert.equal(proposalProjection.canonicalLifecycleState, 'AUTHORIZED');
    assert.equal(proposalProjection.approvalIsNotExecution, true);
    assert.equal(grow.store.listExecutions(`cust_${subjectId}`).length, 0);

    const command = grow.createCommand(actor, created.value.proposalId, 'idem_h03_auth');
    assert.equal(command.ok, true);
    if (!command.ok) {
      throw new Error('command');
    }
    const execution = grow.store.executionForCommand(command.value.commandId);
    assert.ok(execution);
    const authorizedProjection = projectGrowExecutionForClient(execution);
    assert.equal(authorizedProjection.canonicalLifecycleState, 'PROPOSED');
    assert.equal(authorizedProjection.submissionIsNotAcknowledgement, true);
  });

  it('6-9. submission, acknowledgement, fill, and settlement semantics remain distinct', () => {
    const { grow, actor, subjectId } = setupGrow('execution_semantics');
    const created = grow.generateProposal(actor, plan(subjectId), candidate(), `cust_${subjectId}`, {
      kycComplete: true,
      jurisdictionPermitted: true,
      accountRestricted: false,
      customerEligible: true,
      riskProfile: 'MODERATE',
      proposalRiskClass: 'MODERATE',
    });
    assert.equal(created.ok, true);
    if (!created.ok) {
      throw new Error('proposal');
    }
    grow.approve(actor, created.value.proposalId, {
      actorKind: 'CUSTOMER',
      authenticationAssurance: 'STEP_UP_SATISFIED',
      stepUpSatisfied: true,
    });
    const command = grow.createCommand(actor, created.value.proposalId, 'idem_h03_exec');
    assert.equal(command.ok, true);
    if (!command.ok) {
      throw new Error('command');
    }
    const base = grow.store.executionForCommand(command.value.commandId);
    assert.ok(base);
    const submitted = grow.recordExecutionTransition(base.executionId, 'SUBMITTED', { providerId: 'sim_sandbox' });
    assert.equal(submitted.ok, true);
    if (!submitted.ok) {
      throw new Error('submitted');
    }
    const submittedProjection = projectGrowExecutionForClient(submitted.value);
    assert.equal(submittedProjection.canonicalLifecycleState, 'SUBMITTED');
    assert.equal(submittedProjection.submittedIsNotCompleted, true);
    assert.equal(submittedProjection.providerConfirmed, false);
    assert.equal(submittedProjection.acknowledgementIsNotFill, true);

    const skipFill = transitionExecution(submitted.value, 'COMPLETED', NOW);
    assert.equal('code' in skipFill, true);

    const processing = grow.recordExecutionTransition(base.executionId, 'PROCESSING');
    assert.equal(processing.ok, true);
    if (!processing.ok) {
      throw new Error('processing');
    }
    const processingProjection = projectGrowExecutionForClient(processing.value);
    assert.equal(processingProjection.canonicalLifecycleState, 'ACKNOWLEDGED');
    assert.equal(processingProjection.acknowledgementIsNotFill, true);

    const partial = grow.recordExecutionTransition(base.executionId, 'PARTIALLY_COMPLETED', {
      filledMinorUnits: '10000',
    });
    assert.equal(partial.ok, true);
    if (!partial.ok) {
      throw new Error('partial');
    }
    const partialProjection = projectGrowExecutionForClient(partial.value);
    assert.equal(partialProjection.canonicalLifecycleState, 'PARTIALLY_FILLED');
    assert.equal(partialProjection.fillIsNotSettlement, true);

    const completed = grow.recordExecutionTransition(base.executionId, 'COMPLETED', {
      filledMinorUnits: '25000',
    });
    assert.equal(completed.ok, true);
    if (!completed.ok) {
      throw new Error('completed');
    }
    const completedProjection = projectGrowExecutionForClient(completed.value);
    assert.equal(completedProjection.canonicalLifecycleState, 'FILLED');
    assert.equal(completedProjection.settlementIsNotReconciliation, true);
    assert.equal(completedProjection.submittedIsNotCompleted, false);
  });

  it('10-11. paper/simulation execution remains labeled and cannot appear live', () => {
    const projection = projectGrowExecutionForClient({
      executionId: 'gxe_demo',
      commandId: 'gxc_demo',
      proposalId: 'fpr_demo',
      state: 'COMPLETED',
      providerId: 'sim_sandbox_provider',
      filledMinorUnits: '25000',
      requestedMinorUnits: '25000',
      authorityId: 'ea_demo',
      ledgerJournalId: 'jnl_demo',
    });
    assert.equal(projection.executionMode, 'SIMULATION_SANDBOX');
    assert.equal(projection.liveExecution, false);
    assert.equal(projection.productionMoneyMovement, false);
  });

  it('12. duplicate submission does not create duplicate financial effect', () => {
    const { grow, actor, subjectId } = setupGrow('idempotent');
    const created = grow.generateProposal(actor, plan(subjectId), candidate(), `cust_${subjectId}`, {
      kycComplete: true,
      jurisdictionPermitted: true,
      accountRestricted: false,
      customerEligible: true,
      riskProfile: 'MODERATE',
      proposalRiskClass: 'MODERATE',
    });
    assert.equal(created.ok, true);
    if (!created.ok) {
      throw new Error('proposal');
    }
    grow.approve(actor, created.value.proposalId, {
      actorKind: 'CUSTOMER',
      authenticationAssurance: 'STEP_UP_SATISFIED',
      stepUpSatisfied: true,
    });
    const key = idempotentExecutionKey(created.value.proposalId, created.value.version, 'dup_key');
    const first = grow.createCommand(actor, created.value.proposalId, key);
    const second = grow.createCommand(actor, created.value.proposalId, key);
    assert.equal(first.ok && second.ok && first.value.commandId === second.value.commandId, true);
    assert.equal(grow.store.listExecutions(`cust_${subjectId}`).length, 1);
  });

  it('13. timeout after submission does not blindly resubmit', () => {
    const { grow, actor, subjectId } = setupGrow('unknown');
    const created = grow.generateProposal(actor, plan(subjectId), candidate(), `cust_${subjectId}`, {
      kycComplete: true,
      jurisdictionPermitted: true,
      accountRestricted: false,
      customerEligible: true,
      riskProfile: 'MODERATE',
      proposalRiskClass: 'MODERATE',
    });
    assert.equal(created.ok, true);
    if (!created.ok) {
      throw new Error('proposal');
    }
    grow.approve(actor, created.value.proposalId, {
      actorKind: 'CUSTOMER',
      authenticationAssurance: 'STEP_UP_SATISFIED',
      stepUpSatisfied: true,
    });
    const command = grow.createCommand(actor, created.value.proposalId, 'idem_unknown');
    assert.equal(command.ok, true);
    if (!command.ok) {
      throw new Error('command');
    }
    const execution = grow.store.executionForCommand(command.value.commandId);
    assert.ok(execution);
    grow.recordExecutionTransition(execution.executionId, 'SUBMITTED', { providerId: 'sim_sandbox' });
    const unknown = grow.recordExecutionTransition(execution.executionId, 'REQUIRES_REVIEW', {
      failureCode: 'PROVIDER_UNKNOWN',
    });
    assert.equal(unknown.ok, true);
    if (!unknown.ok) {
      throw new Error('unknown');
    }
    assert.equal(unknown.value.state, 'REQUIRES_REVIEW');
    assert.equal(projectGrowExecutionForClient(unknown.value).canonicalLifecycleState, 'UNKNOWN');
    assert.equal(submittedIsNotCompleted('REQUIRES_REVIEW'), true);
  });

  it('14-15. durable lifecycle and evidence reconstruct transitions', () => {
    const { grow, evidence, actor, subjectId } = setupGrow('evidence');
    const created = grow.generateProposal(actor, plan(subjectId), candidate(), `cust_${subjectId}`, {
      kycComplete: true,
      jurisdictionPermitted: true,
      accountRestricted: false,
      customerEligible: true,
      riskProfile: 'MODERATE',
      proposalRiskClass: 'MODERATE',
    });
    assert.equal(created.ok, true);
    if (!created.ok) {
      throw new Error('proposal');
    }
    grow.approve(actor, created.value.proposalId, {
      actorKind: 'CUSTOMER',
      authenticationAssurance: 'STEP_UP_SATISFIED',
      stepUpSatisfied: true,
    });
    assert.ok(evidence.list().some((row) => row.kind === 'GROW_PROPOSAL_GENERATED'));
    assert.ok(evidence.list().some((row) => row.kind === 'GROW_PROPOSAL_APPROVED'));
  });

  it('16-18. customer isolation and stale approval protections', () => {
    const worldA = setupGrow('iso_a');
    const worldB = setupGrow('iso_b');
    const createdA = worldA.grow.generateProposal(
      worldA.actor,
      plan(worldA.subjectId),
      candidate(),
      `cust_${worldA.subjectId}`,
      {
        kycComplete: true,
        jurisdictionPermitted: true,
        accountRestricted: false,
        customerEligible: true,
        riskProfile: 'MODERATE',
        proposalRiskClass: 'MODERATE',
      },
    );
    assert.equal(createdA.ok, true);
    if (!createdA.ok) {
      throw new Error('proposal');
    }
    worldB.grow.store.putProposal(createdA.value);
    const foreignApprove = worldB.grow.approve(worldB.actor, createdA.value.proposalId, {
      actorKind: 'CUSTOMER',
      authenticationAssurance: 'STEP_UP_SATISFIED',
      stepUpSatisfied: true,
    });
    assert.equal(foreignApprove.ok, false);
    if (!foreignApprove.ok) {
      assert.equal(foreignApprove.error.code, 'USER_INELIGIBLE');
    }

    const { grow, actor, subjectId } = worldA;
    const created = grow.generateProposal(actor, plan(subjectId), candidate(), `cust_${subjectId}`, {
      kycComplete: true,
      jurisdictionPermitted: true,
      accountRestricted: false,
      customerEligible: true,
      riskProfile: 'MODERATE',
      proposalRiskClass: 'MODERATE',
    });
    assert.equal(created.ok, true);
    if (!created.ok) {
      throw new Error('proposal');
    }
    grow.approve(actor, created.value.proposalId, {
      actorKind: 'CUSTOMER',
      authenticationAssurance: 'STEP_UP_SATISFIED',
      stepUpSatisfied: true,
    });
    grow.modifyAmount(
      actor,
      created.value.proposalId,
      plan(subjectId),
      candidate(),
      { minorUnits: '15000', currency: 'USD' },
      {
        kycComplete: true,
        jurisdictionPermitted: true,
        accountRestricted: false,
        customerEligible: true,
        riskProfile: 'MODERATE',
        proposalRiskClass: 'MODERATE',
      },
    );
    const staleCommand = grow.createCommand(actor, created.value.proposalId, 'stale_key');
    assert.equal(staleCommand.ok, false);

    const refused = grow.approve(actor, created.value.proposalId, {
      actorKind: 'AGENT' as never,
      authenticationAssurance: 'AAL1',
      stepUpSatisfied: true,
    });
    assert.equal(refused.ok, false);
    if (!refused.ok) {
      assert.equal(refused.error.code, 'AGENT_CANNOT_SELF_APPROVE');
    }

    const privileged = refusePrivilegedGrowExecution();
    assert.equal(privileged.ok, false);
    if (!privileged.ok) {
      assert.equal(privileged.code, 'AGENT_CANNOT_EXECUTE');
    }
  });

  it('binds growth proposal evidence to completed tool runs', () => {
    const structured = parseStructuredOutput({
      kind: 'GROWTH_AGENT_PROPOSAL',
      proposalType: 'INVESTMENT_BUY',
      summary: 'Buy index fund',
      rationale: 'Idle cash',
      evidence: ['tool:ait_demo_1'],
      riskLevel: 'LOW',
      assumptions: ['Conservative'],
      recommendedAmount: { minorUnits: '10000', currency: 'USD' },
      currency: 'USD',
      timeHorizon: '6M',
      requiredUserApproval: true,
      providerDataReferences: ['ait_demo_1'],
      confidence: 'HIGH',
      guaranteedReturn: false,
    });
    assert.equal(structured.ok, true);
    if (!structured.ok || structured.value.kind !== 'GROWTH_AGENT_PROPOSAL') {
      throw new Error('structured');
    }
    const bound = bindGrowthProposalEvidence({
      proposal: structured.value,
      completedToolRuns: [toolRunReferenceForIntent({
        intentId: 'ait_demo_1',
        name: 'getMarketData',
        rationale: 'sandbox quote',
        assetId: 'SUNREY_COIN',
        quantity: null,
        destinationOrMarket: null,
        fees: null,
        executes: false,
      })],
    });
    assert.equal(bound.ok, true);
  });

  it('architecture guard rejects model-as-authorization booleans in agent paths', () => {
    const findings = lintGrowthBoundary(process.cwd());
    assert.equal(
      findings.some((row) => row.rule === 'model-output-is-not-authorization'),
      false,
      findings
        .filter((row) => row.rule === 'model-output-is-not-authorization')
        .map((row) => `${row.file}:${String(row.line)} ${row.message}`)
        .join('\n'),
    );
  });
});
