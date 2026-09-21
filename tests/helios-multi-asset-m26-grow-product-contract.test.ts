/**
 * HELIOS Multi-Asset M26 — production-shaped Grow product contract and Consumer BFF.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { ENVIRONMENT, LIVE_TRADING_ENABLED } from '../packages/config/src/flags.ts';
import {
  evaluateMultiAssetM26GrowProductContractQualification,
  HELIOS_MULTI_ASSET_M26_GROW_PRODUCT_CONTRACT_QUALIFIED,
} from '../packages/platform/src/helios/multi-asset/grow-product-contract/index.ts';
import { lintGrowConsumerAuthority } from '../tools/architectural-linter/src/grow-consumer-guards.ts';
import { createPhaseEWorld, type PhaseEWorld } from './phase-e-world.ts';
import { createSunReyPreviewRuntime } from '../services/api/src/preview.ts';
import { handleConsumerBff } from '../services/api/src/consumer/handler.ts';
import { sandboxToken } from '../services/api/src/consumer/fixtures.ts';

type GrowSummary = {
  schema: string;
  customerId: string;
  operatingMode: string;
  operatingState: string;
  riskState: string;
  totalAuthorizedGrowCapital: { minorUnits: string };
  withdrawableCash: { minorUnits: string };
  realizedPnl: { minorUnits: string };
  unrealizedPnl: { minorUnits: string };
  economicImprovement: {
    deposits: { minorUnits: string };
    principalDepositsAreNotGrowth: true;
    unrealizedIsNotWithdrawable: true;
  };
  frontendMathAuthoritative: boolean;
  serverOwned: boolean;
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
  return { proposalId: proposal.proposalId };
}

async function fetchM26State(world: PhaseEWorld) {
  const paths = [
    '/api/v1/grow/summary',
    '/api/v1/grow/positions',
    '/api/v1/grow/events',
    '/api/v1/grow/strategies',
    '/api/v1/grow/product-performance?period=since_inception',
  ] as const;
  return Object.fromEntries(
    await Promise.all(
      paths.map(async (path) => {
        const queryIndex = path.indexOf('?');
        const pathname = queryIndex >= 0 ? path.slice(0, queryIndex) : path;
        const queryString = queryIndex >= 0 ? path.slice(queryIndex + 1) : '';
        const query = Object.fromEntries(new URLSearchParams(queryString)) as Record<string, string>;
        const res = await world.handle({ method: 'GET', path: pathname, query });
        assert.equal(res.status, 200, `${path}: ${JSON.stringify(res.body)}`);
        return [path, res.body] as const;
      }),
    ),
  );
}

describe('HELIOS Multi-Asset M26 — Grow product contract', () => {
  it('architecture guard: Grow consumer BFF remains server-owned without secret leakage', () => {
    const findings = lintGrowConsumerAuthority(process.cwd());
    assert.equal(findings.length, 0, JSON.stringify(findings));
  });

  it('production safety: simulation posture unchanged', () => {
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_TRADING_ENABLED, false);
  });

  it('exposes summary, positions, events, strategies, and period performance', async () => {
    const world = createPhaseEWorld('m26_visible');
    await runPaperGrowCycle(world, 'm26-visible-cycle');
    const state = await fetchM26State(world);
    const summary = state['/api/v1/grow/summary'] as GrowSummary;
    assert.equal(summary.schema, 'sunrey.consumer.grow.summary.v1');
    assert.equal(summary.serverOwned, true);
    assert.equal(summary.frontendMathAuthoritative, false);
    assert.ok(['SIMULATION', 'PAPER', 'SANDBOX'].includes(summary.operatingMode));
    assert.notEqual(summary.operatingMode, 'LIVE');
    assert.equal(summary.economicImprovement.principalDepositsAreNotGrowth, true);
    assert.equal(summary.economicImprovement.unrealizedIsNotWithdrawable, true);
    assert.equal(
      (state['/api/v1/grow/positions'] as { schema: string }).schema,
      'sunrey.consumer.grow.positions.v1',
    );
    assert.equal((state['/api/v1/grow/events'] as { schema: string }).schema, 'sunrey.consumer.grow.events.v1');
    assert.equal(
      (state['/api/v1/grow/strategies'] as { schema: string }).schema,
      'sunrey.consumer.grow.strategies.v1',
    );
    const perf = state['/api/v1/grow/product-performance?period=since_inception'] as {
      schema: string;
      period: string;
      slice: { depositsAreNotPerformance: boolean; unrealizedIsNotWithdrawable: boolean };
    };
    assert.equal(perf.schema, 'sunrey.consumer.grow.product-performance.v1');
    assert.equal(perf.period, 'since_inception');
    assert.equal(perf.slice.depositsAreNotPerformance, true);
    assert.equal(perf.slice.unrealizedIsNotWithdrawable, true);
  });

  it('distinguishes settled vs unsettled and realized vs unrealized in summary', async () => {
    const world = createPhaseEWorld('m26_pnl');
    await runPaperGrowCycle(world, 'm26-pnl-cycle');
    const summary = (await world.handle({ method: 'GET', path: '/api/v1/grow/summary', query: {} }))
      .body as GrowSummary;
    const cash = await world.handle({ method: 'GET', path: '/api/v1/grow/cash', query: {} });
    assert.equal(cash.status, 200);
    const cashBody = cash.body as { unsettled: { minorUnits: string }; settledWithdrawable: { minorUnits: string } };
    assert.ok(typeof summary.realizedPnl.minorUnits === 'string');
    assert.ok(typeof summary.unrealizedPnl.minorUnits === 'string');
    assert.notEqual(summary.withdrawableCash.minorUnits, summary.unrealizedPnl.minorUnits);
    assert.ok(BigInt(cashBody.settledWithdrawable.minorUnits) >= 0n);
  });

  it('supports performance period query on /grow/performance', async () => {
    const world = createPhaseEWorld('m26_period');
    await runPaperGrowCycle(world, 'm26-period-cycle');
    for (const period of ['daily', 'weekly', 'monthly', 'since_inception'] as const) {
      const res = await world.handle({
        method: 'GET',
        path: '/api/v1/grow/performance',
        query: { period },
      });
      assert.equal(res.status, 200, period);
      assert.equal(
        (res.body as { schema: string }).schema,
        'sunrey.consumer.grow.product-performance.v1',
      );
    }
    const bad = await world.handle({
      method: 'GET',
      path: '/api/v1/grow/performance',
      query: { period: 'yearly' },
    });
    assert.equal(bad.status, 400);
  });

  it('pause, resume, close request, and withdrawal request use governed controls', async () => {
    const world = createPhaseEWorld('m26_controls');
    await runPaperGrowCycle(world, 'm26-controls-cycle');
    const pause = await world.handle({ method: 'POST', path: '/api/v1/grow/controls/pause', query: {} });
    assert.equal(pause.status, 200);
    const pausedSummary = await world.handle({ method: 'GET', path: '/api/v1/grow/summary', query: {} });
    assert.equal(pausedSummary.status, 200);
    assert.equal((pausedSummary.body as GrowSummary).riskState, 'PAUSED');
    const eventsWhilePaused = await world.handle({ method: 'GET', path: '/api/v1/grow/events', query: {} });
    assert.equal(eventsWhilePaused.status, 200);
    const eventKinds = (eventsWhilePaused.body as { items: Array<{ kind: string }> }).items.map((row) => row.kind);
    assert.ok(eventKinds.includes('USER_PAUSE'));

    const resume = await world.handle({
      method: 'POST',
      path: '/api/v1/grow/controls/resume',
      query: {},
      body: { stepUpSatisfied: true },
    });
    assert.equal(resume.status, 200);

    const close = await world.handle({
      method: 'POST',
      path: '/api/v1/grow/controls/close',
      query: {},
      body: { mode: 'ALL_ELIGIBLE', idempotencyKey: 'm26-close' },
    });
    assert.equal(close.status, 200);

    const withdraw = await world.handle({
      method: 'POST',
      path: '/api/v1/grow/controls/withdraw',
      query: {},
      body: {
        amountMinorUnits: '1000',
        currency: 'USD',
        idempotencyKey: 'm26-withdraw',
      },
    });
    assert.ok(withdraw.status === 200 || withdraw.status === 400 || withdraw.status === 403);
  });

  it('paginates events and rejects malformed cursors', async () => {
    const world = createPhaseEWorld('m26_page');
    await runPaperGrowCycle(world, 'm26-page-cycle');
    const first = await world.handle({
      method: 'GET',
      path: '/api/v1/grow/events',
      query: { pageSize: '1' },
    });
    assert.equal(first.status, 200);
    const badCursor = await world.handle({
      method: 'GET',
      path: '/api/v1/grow/events',
      query: { cursor: 'bad-cursor' },
    });
    assert.equal(badCursor.status, 400);
  });

  it('enforces customer isolation', async () => {
    const worldA = createPhaseEWorld('m26_iso_a');
    const worldB = createPhaseEWorld('m26_iso_b');
    await runPaperGrowCycle(worldA, 'm26-iso-a');
    await runPaperGrowCycle(worldB, 'm26-iso-b');
    const summaryA = (await worldA.handle({ method: 'GET', path: '/api/v1/grow/summary', query: {} }))
      .body as GrowSummary;
    const summaryB = (await worldB.handle({ method: 'GET', path: '/api/v1/grow/summary', query: {} }))
      .body as GrowSummary;
    assert.notEqual(summaryA.customerId, summaryB.customerId);
  });

  it('survives restart without losing product contract state', async () => {
    const world = createPhaseEWorld('m26_restart');
    await runPaperGrowCycle(world, 'm26-restart-cycle');
    const before = await fetchM26State(world);
    world.restartGrowRuntime();
    const after = await fetchM26State(world);
    assert.equal(
      (after['/api/v1/grow/summary'] as GrowSummary).operatingState,
      (before['/api/v1/grow/summary'] as GrowSummary).operatingState,
    );
  });

  it('uses no-store cache policy for financial product contract responses', async () => {
    const world = createPhaseEWorld('m26_cache');
    await runPaperGrowCycle(world, 'm26-cache-cycle');
    const res = await world.handle({ method: 'GET', path: '/api/v1/grow/summary', query: {} });
    assert.match(String(res.headers['cache-control']), /no-store/);
  });

  it('preview personas without HELIOS binding fail closed', async () => {
    const runtime = createSunReyPreviewRuntime();
    const res = await handleConsumerBff(runtime, {
      method: 'GET',
      path: '/api/v1/grow/summary',
      authorization: `Bearer ${sandboxToken('basic_verified')}`,
      query: {},
      body: undefined,
    });
    assert.equal(res.status, 403);
    assert.equal((res.body as { errorCode: string }).errorCode, 'CAPABILITY_DISABLED');
  });

  it('OpenAPI documents M26 Grow product contract resources', () => {
    const spec = readFileSync(join(process.cwd(), 'api/sunrey-consumer-bff-v1.openapi.yaml'), 'utf8');
    for (const path of [
      '/api/v1/grow/summary',
      '/api/v1/grow/positions',
      '/api/v1/grow/events',
      '/api/v1/grow/strategies',
      '/api/v1/grow/product-performance',
    ]) {
      assert.match(spec, new RegExp(path.replaceAll('/', '\\/')));
    }
    assert.match(spec, /GrowProductSummaryResponse/);
    assert.match(spec, /frontendMathAuthoritative/);
  });

  it('HELIOS_MULTI_ASSET_M26_GROW_PRODUCT_CONTRACT_QUALIFIED when checks pass', () => {
    const result = evaluateMultiAssetM26GrowProductContractQualification({
      summaryEndpoint: true,
      positionsEndpoint: true,
      normalizedActivityEvents: true,
      strategySummary: true,
      performancePeriods: true,
      controlsWired: true,
      depositsNotGrowth: true,
      unrealizedNotWithdrawable: true,
      paperLabelingTruthful: true,
      customerIsolation: true,
      noFrontendFinancialTruth: true,
      noSecretLeakage: true,
      malformedRequestsRejected: true,
      staleCacheNoStore: true,
      restartPreservesState: true,
      openapiDocumented: true,
      productionSafetyChecksPass: true,
    });
    assert.equal(result.marker, HELIOS_MULTI_ASSET_M26_GROW_PRODUCT_CONTRACT_QUALIFIED);
    assert.equal(result.qualified, true);
    assert.equal(result.blockers.length, 0);
  });
});
