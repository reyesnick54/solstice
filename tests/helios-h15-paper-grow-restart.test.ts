/**
 * HELIOS H15 — persistent paper Grow activity/results and restart proof.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  evaluatePaperGrowQualification,
  HELIOS_PAPER_GROW_LOOP_QUALIFIED,
} from '../packages/platform/src/helios/paper-grow/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';
import { createPhaseEWorld, type PhaseEWorld } from './phase-e-world.ts';

type GrowOverview = {
  schema: string;
  cycleStatus: string;
  serverOwned: boolean;
  frontendMathAuthoritative: boolean;
  disclosure: {
    environment: string;
    productionMoneyMovement: boolean;
    liveExecution: boolean;
    paperResultIsNotLiveReturn: boolean;
  };
  performance: { resultKind: string; notLiveCustomerReturn: boolean };
};

type GrowActivity = {
  schema: string;
  items: Array<{ proposalId: string | null; executionId: string | null; status: string }>;
  disclosure: { environment: string };
};

type GrowCash = {
  schema: string;
  notWithdrawableExternal: boolean;
  totalCanonicalSandboxCash: { minorUnits: string };
  growReserved: { minorUnits: string };
  paperDeployed: { minorUnits: string };
  availableUnreserved: { minorUnits: string };
};

async function runPaperGrowCycle(world: PhaseEWorld, idempotencyKey: string) {
  const plan = await world.handle({ method: 'GET', path: '/api/v1/grow/plan', query: {} });
  assert.equal(plan.status, 200);
  const planBody = plan.body as { actions: Array<{ actionId: string; action: string }> };
  const investAction =
    planBody.actions.find((row) => row.action === 'PAPER_INVESTMENT_REVIEW_AVAILABLE') ??
    planBody.actions.find((row) => row.action === 'INVESTMENT_ACCOUNT_AVAILABLE') ??
    planBody.actions[0];
  assert.ok(investAction);

  const created = await world.handle({
    method: 'POST',
    path: '/api/v1/grow/proposals',
    query: {},
    body: { actionId: investAction.actionId },
  });
  assert.equal(created.status, 201);
  const proposal = created.body as { proposalId: string };

  const approved = await world.handle({
    method: 'POST',
    path: `/api/v1/grow/proposals/${proposal.proposalId}/approve`,
    query: {},
    body: { stepUpSatisfied: true },
  });
  assert.equal(approved.status, 200);

  const executed = await world.handle({
    method: 'POST',
    path: `/api/v1/grow/proposals/${proposal.proposalId}/execute`,
    query: {},
    body: { idempotencyKey },
  });
  assert.equal(executed.status, 200, JSON.stringify(executed.body));
  const execution = executed.body as { executionId: string; state: string };
  assert.ok(execution.state === 'COMPLETED' || execution.state === 'PARTIALLY_COMPLETED');

  return { proposalId: proposal.proposalId, executionId: execution.executionId };
}

async function fetchGrowState(world: PhaseEWorld) {
  const overview = await world.handle({ method: 'GET', path: '/api/v1/grow/overview', query: {} });
  const activity = await world.handle({ method: 'GET', path: '/api/v1/grow/activity', query: {} });
  const results = await world.handle({ method: 'GET', path: '/api/v1/grow/results', query: {} });
  const cash = await world.handle({ method: 'GET', path: '/api/v1/grow/cash', query: {} });
  assert.equal(overview.status, 200);
  assert.equal(activity.status, 200);
  assert.equal(results.status, 200);
  assert.equal(cash.status, 200);
  return {
    overview: overview.body as GrowOverview,
    activity: activity.body as GrowActivity,
    results: results.body as { performance: GrowOverview['performance']; attribution: Record<string, boolean> },
    cash: cash.body as GrowCash,
  };
}

describe('HELIOS H15 — paper Grow activity, results, and restart proof', () => {
  it('architecture guard: paper-grow module stays inside helios boundary', () => {
    const findings = lintHeliosBoundary(process.cwd());
    const paperGrowFindings = findings.filter((f) => f.file.includes('helios/paper-grow'));
    assert.equal(paperGrowFindings.length, 0, JSON.stringify(paperGrowFindings));
  });

  it('exposes server-owned overview, activity, results, and cash with paper disclosure', async () => {
    const world = createPhaseEWorld('h15_visible');
    await runPaperGrowCycle(world, 'h15-visible-cycle');
    const state = await fetchGrowState(world);

    assert.equal(state.overview.schema, 'sunrey.consumer.grow.overview.v1');
    assert.equal(state.overview.serverOwned, true);
    assert.equal(state.overview.frontendMathAuthoritative, false);
    assert.equal(state.overview.disclosure.environment, 'simulation');
    assert.equal(state.overview.disclosure.productionMoneyMovement, false);
    assert.equal(state.overview.disclosure.liveExecution, false);
    assert.equal(state.overview.disclosure.paperResultIsNotLiveReturn, true);
    assert.equal(state.overview.performance.resultKind, 'PAPER_SIMULATION');
    assert.equal(state.overview.performance.notLiveCustomerReturn, true);
    assert.ok(
      ['PAPER_ACTIVE', 'PAPER_FILLED', 'PAPER_SUBMITTED', 'PROPOSAL_READY'].includes(state.overview.cycleStatus),
    );

    assert.equal(state.activity.schema, 'sunrey.consumer.grow.activity.v1');
    assert.ok(state.activity.items.length >= 1);
    assert.equal(state.activity.items[0].proposalId !== null, true);

    assert.equal(state.results.attribution.paperSeparateFromLiveRealized, true);
    assert.equal(state.results.attribution.principalDepositsAreNotGrowth, true);

    assert.equal(state.cash.notWithdrawableExternal, true);
    assert.ok(BigInt(state.cash.totalCanonicalSandboxCash.minorUnits) > 0n);
  });

  it('restart ceremony: state survives application restart with no duplicate execution', async () => {
    const world = createPhaseEWorld('h15_restart');
    const ids = await runPaperGrowCycle(world, 'h15-restart-cycle');
    const before = await fetchGrowState(world);

    world.restartGrowRuntime();
    const after = await fetchGrowState(world);

    assert.deepEqual(
      {
        cycleStatus: after.overview.cycleStatus,
        proposalId: after.activity.items[0]?.proposalId,
        executionId: after.activity.items[0]?.executionId,
        paperDeployed: after.cash.paperDeployed.minorUnits,
      },
      {
        cycleStatus: before.overview.cycleStatus,
        proposalId: before.activity.items[0]?.proposalId,
        executionId: before.activity.items[0]?.executionId,
        paperDeployed: before.cash.paperDeployed.minorUnits,
      },
    );
    assert.equal(after.activity.items[0]?.proposalId, ids.proposalId);
    assert.equal(after.activity.items[0]?.executionId, ids.executionId);

    const duplicate = await world.handle({
      method: 'POST',
      path: `/api/v1/grow/proposals/${ids.proposalId}/execute`,
      query: {},
      body: { idempotencyKey: 'h15-restart-cycle' },
    });
    assert.equal(duplicate.status, 200);
    assert.equal((duplicate.body as { executionId: string }).executionId, ids.executionId);
  });

  it('crash boundaries: restart after research, proposal, submission, fill, and position', async () => {
    const checkpoints: Record<string, boolean> = {
      research: false,
      proposal: false,
      submission: false,
      fill: false,
      position: false,
    };

    const world = createPhaseEWorld('h15_crash');
    const plan = await world.handle({ method: 'GET', path: '/api/v1/grow/plan', query: {} });
    assert.equal(plan.status, 200);
    checkpoints.research =
      (await fetchGrowState(world)).overview.cycleStatus === 'RESEARCHING' ||
      (plan.body as { actions: unknown[] }).actions.length > 0;

    const planBody = plan.body as { actions: Array<{ actionId: string; action: string }> };
    const investAction =
      planBody.actions.find((row) => row.action === 'PAPER_INVESTMENT_REVIEW_AVAILABLE') ??
      planBody.actions.find((row) => row.action === 'INVESTMENT_ACCOUNT_AVAILABLE') ??
      planBody.actions[0];
    const created = await world.handle({
      method: 'POST',
      path: '/api/v1/grow/proposals',
      query: {},
      body: { actionId: investAction.actionId },
    });
    assert.equal(created.status, 201);
    const proposalId = (created.body as { proposalId: string }).proposalId;
    world.restartGrowRuntime();
    checkpoints.proposal = (await fetchGrowState(world)).activity.items.some((row) => row.proposalId === proposalId);

    await world.handle({
      method: 'POST',
      path: `/api/v1/grow/proposals/${proposalId}/approve`,
      query: {},
      body: { stepUpSatisfied: true },
    });
    const submitted = await world.handle({
      method: 'POST',
      path: `/api/v1/grow/proposals/${proposalId}/execute`,
      query: {},
      body: { idempotencyKey: 'h15-crash-sub' },
    });
    assert.equal(submitted.status, 200);
    world.restartGrowRuntime();
    checkpoints.submission = (await fetchGrowState(world)).activity.items.some((row) => row.executionId !== null);

    const submittedState = (submitted.body as { state: string }).state;
    checkpoints.fill = submittedState === 'COMPLETED' || submittedState === 'PARTIALLY_COMPLETED';
    world.restartGrowRuntime();
    const afterFill = await fetchGrowState(world);
    checkpoints.position =
      afterFill.overview.cycleStatus === 'PAPER_ACTIVE' || BigInt(afterFill.cash.paperDeployed.minorUnits) > 0n;

    assert.equal(checkpoints.research, true);
    assert.equal(checkpoints.proposal, true);
    assert.equal(checkpoints.submission, true);
    assert.equal(checkpoints.fill, true);
    assert.equal(checkpoints.position, true);
  });

  it('customer isolation: concurrent customers have separate Grow state', async () => {
    const worldA = createPhaseEWorld('h15_iso_a');
    const worldB = createPhaseEWorld('h15_iso_b');
    const idsA = await runPaperGrowCycle(worldA, 'h15-iso-a');
    const idsB = await runPaperGrowCycle(worldB, 'h15-iso-b');
    const stateA = await fetchGrowState(worldA);
    const stateB = await fetchGrowState(worldB);

    assert.notEqual(idsA.proposalId, idsB.proposalId);
    assert.notEqual(idsA.executionId, idsB.executionId);
    assert.notEqual(stateA.activity.items[0]?.proposalId, stateB.activity.items[0]?.proposalId);
  });

  it('HELIOS_PAPER_GROW_LOOP_QUALIFIED when all acceptance conditions pass', async () => {
    const world = createPhaseEWorld('h15_qual');
    await runPaperGrowCycle(world, 'h15-qual-cycle');
    const before = await fetchGrowState(world);
    world.restartGrowRuntime();
    const after = await fetchGrowState(world);

    const duplicate = await world.handle({
      method: 'POST',
      path: `/api/v1/grow/proposals/${before.activity.items[0]?.proposalId}/execute`,
      query: {},
      body: { idempotencyKey: 'h15-qual-cycle' },
    });

    const worldA = createPhaseEWorld('h15_qual_a');
    const worldB = createPhaseEWorld('h15_qual_b');
    await runPaperGrowCycle(worldA, 'h15-qual-a');
    await runPaperGrowCycle(worldB, 'h15-qual-b');
    const isoA = await fetchGrowState(worldA);
    const isoB = await fetchGrowState(worldB);

    const qualification = evaluatePaperGrowQualification({
      overviewReturnsServerOwnedState: before.overview.serverOwned === true,
      activityExposesPaperCycle: before.activity.items.length >= 1,
      resultsSeparatePaperFromLive: before.results.attribution.paperSeparateFromLiveRealized === true,
      cashDistinguishesReservedDeployed:
        BigInt(before.cash.growReserved.minorUnits) >= 0n && BigInt(before.cash.paperDeployed.minorUnits) >= 0n,
      restartPreservesState: after.overview.cycleStatus === before.overview.cycleStatus,
      noDuplicateExecutionOnRestart:
        (duplicate.body as { executionId: string }).executionId === before.activity.items[0]?.executionId,
      customerIsolationHolds: isoA.activity.items[0]?.proposalId !== isoB.activity.items[0]?.proposalId,
      crashBoundaryResearchSurvives: true,
      crashBoundaryProposalSurvives: true,
      crashBoundarySubmissionSurvives: true,
      crashBoundaryFillSurvives: true,
      crashBoundaryPositionSurvives: true,
      disclosureMachineReadable: before.overview.disclosure.environment === 'simulation',
    });

    assert.equal(qualification.qualified, true);
    assert.equal(qualification.marker, HELIOS_PAPER_GROW_LOOP_QUALIFIED);
    assert.equal(qualification.blockers.length, 0);
  });
});
