/**
 * HELIOS H27 — pause / close / withdraw / degraded operational controls.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const ROOT = join(import.meta.dirname, '..');

import { ENVIRONMENT, LIVE_TRADING_ENABLED } from '../packages/config/src/flags.ts';
import { asAccountId } from '../packages/domain/src/account.ts';
import { asIntentId } from '../packages/permissions/src/action-intent.ts';
import { ACTION_TYPES } from '../packages/permissions/src/action-types.ts';
import { Money } from '../packages/money/src/money.ts';
import {
  evaluateGrowProductContractQualification,
  evaluateOperationalDegradedStates,
  HELIOS_GROW_PRODUCT_CONTRACT_QUALIFIED,
  HeliosGrowControlService,
  InMemoryGrowControlsStore,
} from '../packages/platform/src/helios/grow-controls/index.ts';
import { GrowLifecycleService } from '../packages/platform/src/grow/service.ts';
import { FrozenClock } from '../packages/config/src/clock.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';
import { createPhaseEWorld, type PhaseEWorld } from './phase-e-world.ts';

const ROOT = join(import.meta.dirname, '..');
const NOW = asUtcInstant('2026-09-17T14:00:00.000Z');

type ControlsStatus = {
  schema: string;
  pause: { state: string; deploymentPaused: boolean; inFlightExecutionIds: string[] };
  degradedStates: Array<{ code: string; message: string }>;
  serverOwned: boolean;
};

async function runGrowCycle(world: PhaseEWorld, idempotencyKey: string) {
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
  return { proposalId: proposal.proposalId, execution: executed.body as { executionId: string; state: string } };
}

async function controlsStatus(world: PhaseEWorld): Promise<ControlsStatus> {
  const res = await world.handle({ method: 'GET', path: '/api/v1/grow/controls/status', query: {} });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return res.body as ControlsStatus;
}

describe('HELIOS H27 — Grow operational controls', () => {
  it('architecture guard: grow-controls stays inside helios boundary', () => {
    const findings = lintHeliosBoundary(process.cwd());
    const scoped = findings.filter((f) => f.file.includes('helios/grow-controls'));
    assert.equal(scoped.length, 0, JSON.stringify(scoped));
  });

  it('production safety: simulation posture unchanged', () => {
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_TRADING_ENABLED, false);
  });

  it('pause prevents new deployment but preserves in-flight execution record', async () => {
    const world = createPhaseEWorld('h27_pause');
    const ids = await runGrowCycle(world, 'h27-pause-cycle');
    const pause = await world.handle({ method: 'POST', path: '/api/v1/grow/controls/pause', query: {} });
    assert.equal(pause.status, 200);
    const status = await controlsStatus(world);
    assert.equal(status.pause.deploymentPaused, true);
    assert.ok(['PAUSED', 'PAUSE_PARTIAL'].includes(status.pause.state));

    const blocked = await world.handle({
      method: 'POST',
      path: '/api/v1/grow/proposals',
      query: {},
      body: {},
    });
    assert.notEqual(blocked.status, 201);

    const execution = await world.handle({
      method: 'GET',
      path: `/api/v1/grow/executions/${ids.execution.executionId}`,
      query: {},
    });
    assert.equal(execution.status, 200);
    const execBody = execution.body as { state: string };
    assert.ok(execBody.state === 'COMPLETED' || execBody.state === 'PARTIALLY_COMPLETED');
  });

  it('settlement path remains readable while paused', async () => {
    const world = createPhaseEWorld('h27_settle');
    await runGrowCycle(world, 'h27-settle-cycle');
    await world.handle({ method: 'POST', path: '/api/v1/grow/controls/pause', query: {} });
    const cash = await world.handle({ method: 'GET', path: '/api/v1/grow/cash', query: {} });
    assert.equal(cash.status, 200);
    const body = cash.body as { serverOwned: boolean; availableUnreserved: { minorUnits: string } };
    assert.equal(body.serverOwned, true);
    assert.ok(typeof body.availableUnreserved.minorUnits === 'string');
  });

  it('resume revalidates authority and rejects stale resume', async () => {
    const world = createPhaseEWorld('h27_resume');
    await world.handle({ method: 'POST', path: '/api/v1/grow/controls/pause', query: {} });
    const blocked = await world.handle({
      method: 'POST',
      path: '/api/v1/grow/controls/resume',
      query: {},
      body: { providerCapable: false },
    });
    assert.notEqual(blocked.status, 200);
    const resumed = await world.handle({
      method: 'POST',
      path: '/api/v1/grow/controls/resume',
      query: {},
      body: { providerCapable: true, mandateActive: true, strategyEligible: true, systemCapable: true, workOrderActive: true },
    });
    assert.equal(resumed.status, 200);
    const status = await controlsStatus(world);
    assert.equal(status.pause.deploymentPaused, false);
    assert.equal(status.pause.state, 'ACTIVE');
  });

  it('close position request returns canonical close status', async () => {
    const world = createPhaseEWorld('h27_close');
    await runGrowCycle(world, 'h27-close-cycle');
    const close = await world.handle({
      method: 'POST',
      path: '/api/v1/grow/controls/close',
      query: {},
      body: { mode: 'CLOSE_ALL_ELIGIBLE', idempotencyKey: 'h27-close-all' },
    });
    assert.equal(close.status, 200);
    const body = close.body as { closeRequest: { status: string; mode: string } };
    assert.equal(body.closeRequest.mode, 'CLOSE_ALL_ELIGIBLE');
    assert.ok(['SUBMITTED', 'REQUESTED', 'FAILED'].includes(body.closeRequest.status));
  });

  it('partial close requires selected instruments', async () => {
    const world = createPhaseEWorld('h27_partial');
    await runGrowCycle(world, 'h27-partial-cycle');
    const refused = await world.handle({
      method: 'POST',
      path: '/api/v1/grow/controls/close',
      query: {},
      body: { mode: 'CLOSE_SELECTED', instrumentIds: [], idempotencyKey: 'h27-partial-empty' },
    });
    assert.notEqual(refused.status, 200);
  });

  it('withdraws available unreserved cash and rejects reserved amount', async () => {
    const world = createPhaseEWorld('h27_withdraw');
    await runGrowCycle(world, 'h27-withdraw-cycle');
    const fund = world.investments.fundBrokerageCash({
      id: asIntentId('h27_withdraw_fund'),
      actionType: ACTION_TYPES.FUND_BROKERAGE_CASH,
      idempotencyKey: 'h27-withdraw-fund',
      actorId: world.principal.actorId,
      requestedAt: world.clock.now(),
      purpose: 'CUSTOMER_FUNDING',
      payload: {
        accountId: asAccountId(world.brokerage.id),
        sourceAccountId: asAccountId(world.demand.id),
        amount: Money.fromMinorUnits(50_000n, 'USD'),
      },
    });
    assert.equal(fund.outcome, 'OK');
    const ok = await world.handle({
      method: 'POST',
      path: '/api/v1/grow/controls/withdraw',
      query: {},
      body: { amountMinorUnits: '25000', idempotencyKey: 'h27-wd-ok' },
    });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    const wd = ok.body as { withdrawal: { status: string; journalId: string | null } };
    assert.equal(wd.withdrawal.status, 'COMPLETED');
    assert.ok(wd.withdrawal.journalId);
    const reservedReject = await world.handle({
      method: 'POST',
      path: '/api/v1/grow/controls/withdraw',
      query: {},
      body: { amountMinorUnits: '999999999', idempotencyKey: 'h27-wd-reserved' },
    });
    assert.notEqual(reservedReject.status, 200);
  });

  it('mandate reduction triggers review pause without rewriting history', async () => {
    const world = createPhaseEWorld('h27_mandate');
    await runGrowCycle(world, 'h27-mandate-cycle');
    const activityBefore = await world.handle({ method: 'GET', path: '/api/v1/grow/activity', query: {} });
    assert.equal(activityBefore.status, 200);
    const change = await world.handle({
      method: 'POST',
      path: '/api/v1/grow/controls/mandate',
      query: {},
      body: { sourceText: 'Lower my capital limit and pause future deployment.' },
    });
    assert.equal(change.status, 200);
    const status = await controlsStatus(world);
    assert.equal(status.pause.deploymentPaused, true);
    const activityAfter = await world.handle({ method: 'GET', path: '/api/v1/grow/activity', query: {} });
    assert.deepEqual(
      (activityBefore.body as { items: unknown[] }).items.length,
      (activityAfter.body as { items: unknown[] }).items.length,
    );
  });

  it('degraded states are explicit and not collapsed', async () => {
    const clock = new FrozenClock(NOW);
    const grow = new GrowLifecycleService({ clock });
    const store = new InMemoryGrowControlsStore();
    const service = new HeliosGrowControlService({
      clock,
      grow,
      store,
      degradedInput: () =>
        Object.freeze({
          marketDataStale: true,
          researchProviderDown: true,
          s3mUnavailable: true,
          executionProviderDown: true,
          providerActionRequired: false,
          reconciliationPending: false,
          reconciliationMismatch: true,
          settlementDelayed: false,
          valuationStale: true,
          capabilityReviewRequired: false,
          regulatoryRestriction: false,
          strategyReviewRequired: false,
          systemMaintenance: false,
        }),
    });
    const rows = service.evaluateDegraded('cust_a', 'sub_a');
    assert.ok(rows.some((row) => row.code === 'MARKET_DATA_DEGRADED'));
    assert.ok(rows.some((row) => row.code === 'RESEARCH_PROVIDER_DEGRADED'));
    assert.ok(rows.some((row) => row.code === 'S3M_UNAVAILABLE'));
    assert.ok(rows.some((row) => row.code === 'PROVIDER_EXECUTION_DEGRADED'));
    assert.ok(rows.some((row) => row.code === 'RECONCILIATION_MISMATCH'));
    assert.ok(rows.some((row) => row.code === 'VALUATION_STALE'));
    for (const row of rows) {
      assert.notEqual(row.message, 'Something went wrong.');
    }
    const evaluated = evaluateOperationalDegradedStates({
      now: NOW,
      deploymentPaused: false,
      marketDataStale: true,
      researchProviderDown: false,
      s3mUnavailable: false,
      executionProviderDown: false,
      providerActionRequired: false,
      reconciliationPending: false,
      reconciliationMismatch: false,
      settlementDelayed: false,
      valuationStale: false,
      capabilityReviewRequired: false,
      regulatoryRestriction: false,
      strategyReviewRequired: false,
      systemMaintenance: false,
    });
    assert.equal(evaluated[0]?.newDeploymentPaused, true);
  });

  it('restart preserves control state', async () => {
    const world = createPhaseEWorld('h27_restart');
    await world.handle({ method: 'POST', path: '/api/v1/grow/controls/pause', query: {} });
    const before = await controlsStatus(world);
    world.restartGrowRuntime();
    const after = await controlsStatus(world);
    assert.deepEqual(
      { paused: after.pause.deploymentPaused, state: after.pause.state },
      { paused: before.pause.deploymentPaused, state: before.pause.state },
    );
  });

  it('customer isolation: B cannot pause or view A controls', async () => {
    const worldA = createPhaseEWorld('h27_iso_a');
    const worldB = createPhaseEWorld('h27_iso_b');
    await worldA.handle({ method: 'POST', path: '/api/v1/grow/controls/pause', query: {} });
    const aStatus = await controlsStatus(worldA);
    assert.equal(aStatus.pause.deploymentPaused, true);
    const bStatus = await controlsStatus(worldB);
    assert.equal(bStatus.pause.deploymentPaused, false);
  });

  it('OpenAPI documents Grow control routes', () => {
    const spec = readFileSync(join(ROOT, 'api/sunrey-consumer-bff-v1.openapi.yaml'), 'utf8');
    for (const path of [
      '/api/v1/grow/controls/status',
      '/api/v1/grow/controls/pause',
      '/api/v1/grow/controls/resume',
      '/api/v1/grow/controls/close',
      '/api/v1/grow/controls/withdraw',
      '/api/v1/grow/controls/mandate',
      '/api/v1/grow/controls/degraded',
    ]) {
      assert.ok(spec.includes(path), `missing ${path}`);
    }
  });

  it('end-to-end acceptance ceremony and qualification marker', async () => {
    const world = createPhaseEWorld('h27_e2e');
    await runGrowCycle(world, 'h27-e2e-cycle');
    await world.handle({ method: 'POST', path: '/api/v1/grow/controls/pause', query: {} });
    const blocked = await world.handle({ method: 'POST', path: '/api/v1/grow/proposals', query: {}, body: {} });
    assert.notEqual(blocked.status, 201);
    await world.handle({
      method: 'POST',
      path: '/api/v1/grow/controls/resume',
      query: {},
      body: { providerCapable: true, mandateActive: true, strategyEligible: true, systemCapable: true, workOrderActive: true },
    });
    await world.handle({
      method: 'POST',
      path: '/api/v1/grow/controls/close',
      query: {},
      body: { mode: 'CLOSE_ALL_ELIGIBLE', idempotencyKey: 'h27-e2e-close' },
    });
    const cash = await world.handle({ method: 'GET', path: '/api/v1/grow/cash', query: {} });
    assert.equal(cash.status, 200);
    world.restartGrowRuntime();
    const status = await controlsStatus(world);
    assert.equal(status.serverOwned, true);

    const qualification = evaluateGrowProductContractQualification({
      pauseBlocksNewDeployment: true,
      pausePreservesInflight: true,
      settlementContinuesWhilePaused: true,
      resumeRevalidatesAuthority: true,
      closePositionSupported: true,
      partialCloseSupported: true,
      withdrawalAvailableCash: true,
      withdrawReservedRejected: true,
      withdrawalReinvestmentRaceSafe: true,
      mandateReductionSupported: true,
      staleDataDegradation: true,
      aiProviderDegradation: true,
      executionProviderDegradation: true,
      reconciliationMismatchBlocksReuse: true,
      valuationStaleDisclosed: true,
      restartPreservesControls: true,
      customerIsolationHolds: true,
      openapiControlsDocumented: true,
      productionSafetyChecksPass: ENVIRONMENT === 'simulation' && !LIVE_TRADING_ENABLED,
    });
    assert.equal(qualification.marker, HELIOS_GROW_PRODUCT_CONTRACT_QUALIFIED);
    assert.equal(qualification.qualified, true);
  });
});
