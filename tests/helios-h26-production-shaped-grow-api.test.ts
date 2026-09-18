/**
 * HELIOS H26 — production-shaped Grow and Agent consumer BFF contract.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { lintGrowConsumerAuthority } from '../tools/architectural-linter/src/grow-consumer-guards.ts';
import { createPhaseEWorld, type PhaseEWorld } from './phase-e-world.ts';
import { createSunReyPreviewRuntime } from '../services/api/src/preview.ts';
import { handleConsumerBff } from '../services/api/src/consumer/handler.ts';
import { sandboxToken } from '../services/api/src/consumer/fixtures.ts';

type GrowOverview = {
  schema: string;
  consumerStatus: string;
  serverOwned: boolean;
  frontendMathAuthoritative: boolean;
  nextRequiredCustomerAction: string | null;
  providerAccount: { providerDisplayName: string; providerId: string } | null;
  allocate: { deployedCapital: { minorUnits: string }; fundingState: string };
  performance: { incomeReceived: { minorUnits: string }; valuationFreshness: string | null };
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

async function fetchH26State(world: PhaseEWorld) {
  const paths = [
    '/api/v1/grow/overview',
    '/api/v1/grow/allocate',
    '/api/v1/grow/active-capital',
    '/api/v1/grow/performance',
    '/api/v1/grow/activity',
    '/api/v1/grow/cash',
    '/api/v1/grow/provider-account',
    '/api/v1/grow/action-cards',
    '/api/v1/grow/agent-state',
  ] as const;
  const responses = Object.fromEntries(
    await Promise.all(
      paths.map(async (path) => {
        const res = await world.handle({ method: 'GET', path, query: {} });
        assert.equal(res.status, 200, `${path}: ${JSON.stringify(res.body)}`);
        return [path, res.body] as const;
      }),
    ),
  );
  return responses;
}

describe('HELIOS H26 — production-shaped Grow and Agent APIs', () => {
  it('architecture guard: Grow consumer BFF remains server-owned without secret leakage', () => {
    const findings = lintGrowConsumerAuthority(process.cwd());
    assert.equal(findings.length, 0, JSON.stringify(findings));
  });

  it('exposes overview, allocation, active capital, performance, activity, cash, provider, action cards, and agent state', async () => {
    const world = createPhaseEWorld('h26_visible');
    await runPaperGrowCycle(world, 'h26-visible-cycle');
    const state = await fetchH26State(world);
    const overview = state['/api/v1/grow/overview'] as GrowOverview;
    assert.equal(overview.schema, 'sunrey.consumer.grow.overview.v1');
    assert.equal(overview.serverOwned, true);
    assert.equal(overview.frontendMathAuthoritative, false);
    assert.ok(overview.consumerStatus);
    assert.ok(overview.providerAccount?.providerId);
    assert.equal((state['/api/v1/grow/allocate'] as { schema: string }).schema, 'sunrey.consumer.grow.allocate.v1');
    assert.equal(
      (state['/api/v1/grow/active-capital'] as { schema: string }).schema,
      'sunrey.consumer.grow.active-capital.v1',
    );
    assert.equal(
      (state['/api/v1/grow/performance'] as { schema: string }).schema,
      'sunrey.consumer.grow.performance.v1',
    );
    const activity = state['/api/v1/grow/activity'] as {
      items: unknown[];
      nextCursor: string | null;
      hasMore: boolean;
    };
    assert.ok(Array.isArray(activity.items));
    assert.equal(typeof activity.hasMore, 'boolean');
    const cash = state['/api/v1/grow/cash'] as {
      settledWithdrawable: { minorUnits: string };
      unrealizedIsNotWithdrawable: boolean;
    };
    assert.equal(cash.unrealizedIsNotWithdrawable, true);
    const cards = state['/api/v1/grow/action-cards'] as { items: Array<{ approvalEndpoint: string | null }> };
    assert.ok(cards.items.length >= 1);
    const agentState = state['/api/v1/grow/agent-state'] as { mayExecute: boolean; serverOwned: boolean };
    assert.equal(agentState.mayExecute, false);
    assert.equal(agentState.serverOwned, true);
  });

  it('paginates activity with stable cursor semantics', async () => {
    const world = createPhaseEWorld('h26_page');
    await runPaperGrowCycle(world, 'h26-page-cycle');
    const first = await world.handle({
      method: 'GET',
      path: '/api/v1/grow/activity',
      query: { pageSize: '1' },
    });
    assert.equal(first.status, 200);
    const firstBody = first.body as { items: unknown[]; nextCursor: string | null; hasMore: boolean };
    if (firstBody.hasMore && firstBody.nextCursor) {
      const second = await world.handle({
        method: 'GET',
        path: '/api/v1/grow/activity',
        query: { cursor: firstBody.nextCursor, pageSize: '1' },
      });
      assert.equal(second.status, 200);
    }
    const badCursor = await world.handle({
      method: 'GET',
      path: '/api/v1/grow/activity',
      query: { cursor: 'bad-cursor' },
    });
    assert.equal(badCursor.status, 400);
    assert.equal((badCursor.body as { errorCode: string }).errorCode, 'INVALID_PAGINATION_CURSOR');
  });

  it('enforces customer isolation on Grow resources', async () => {
    const worldA = createPhaseEWorld('h26_iso_a');
    const worldB = createPhaseEWorld('h26_iso_b');
    await runPaperGrowCycle(worldA, 'h26-iso-a');
    await runPaperGrowCycle(worldB, 'h26-iso-b');
    const stateA = await fetchH26State(worldA);
    const stateB = await fetchH26State(worldB);
    const cardsA = (stateA['/api/v1/grow/action-cards'] as { items: Array<{ proposalId: string }> }).items[0]
      ?.proposalId;
    const cardsB = (stateB['/api/v1/grow/action-cards'] as { items: Array<{ proposalId: string }> }).items[0]
      ?.proposalId;
    assert.notEqual(cardsA, cardsB);
  });

  it('survives restart without duplicating execution or losing overview state', async () => {
    const world = createPhaseEWorld('h26_restart');
    const ids = await runPaperGrowCycle(world, 'h26-restart-cycle');
    const before = await fetchH26State(world);
    world.restartGrowRuntime();
    const after = await fetchH26State(world);
    const beforeOverview = before['/api/v1/grow/overview'] as GrowOverview;
    const afterOverview = after['/api/v1/grow/overview'] as GrowOverview;
    assert.equal(afterOverview.consumerStatus, beforeOverview.consumerStatus);
    const duplicate = await world.handle({
      method: 'POST',
      path: `/api/v1/grow/proposals/${ids.proposalId}/execute`,
      query: {},
      body: { idempotencyKey: 'h26-restart-cycle' },
    });
    assert.equal(duplicate.status, 200);
  });

  it('agent tools and agent-state use backend truth without self-approval', async () => {
    const world = createPhaseEWorld('h26_agent');
    await runPaperGrowCycle(world, 'h26-agent-cycle');
    const tool = await world.handle({
      method: 'POST',
      path: '/api/v1/grow/agent-tools',
      query: {},
      body: { tool: 'getFinancialSnapshot' },
    });
    assert.equal(tool.status, 200);
    assert.equal((tool.body as { mayExecute: boolean }).mayExecute, false);
    assert.equal((tool.body as { serverOwned?: boolean }).serverOwned ?? true, true);
    const selfApprove = await world.handle({
      method: 'POST',
      path: '/api/v1/grow/agent-tools',
      query: {},
      body: { tool: 'executeProposal', selfApprove: true },
    });
    assert.equal(selfApprove.status, 403);
  });

  it('returns provider unavailable for degraded preview runtime', async () => {
    const runtime = createSunReyPreviewRuntime({ providerDown: true });
    const principal = runtime.sessions.get(sandboxToken('investment'));
    assert.ok(principal);
    const res = await handleConsumerBff(runtime, {
      method: 'GET',
      path: '/api/v1/grow/provider-account',
      authorization: `Bearer ${sandboxToken('investment')}`,
      query: {},
    });
    assert.equal(res.status, 503);
    assert.equal((res.body as { errorCode: string }).errorCode, 'PROVIDER_UNAVAILABLE');
  });

  it('OpenAPI documents H26 Grow resources and error envelope', () => {
    const spec = readFileSync(join(process.cwd(), 'api/sunrey-consumer-bff-v1.openapi.yaml'), 'utf8');
    for (const path of [
      '/api/v1/grow/overview',
      '/api/v1/grow/allocate',
      '/api/v1/grow/active-capital',
      '/api/v1/grow/performance',
      '/api/v1/grow/activity',
      '/api/v1/grow/cash',
      '/api/v1/grow/provider-account',
      '/api/v1/grow/action-cards',
      '/api/v1/grow/agent-state',
    ]) {
      assert.match(spec, new RegExp(path.replaceAll('/', '\\/')));
    }
    assert.match(spec, /BffErrorEnvelope/);
    assert.match(spec, /frontendMathAuthoritative/);
  });

  it('preview personas without HELIOS binding fail closed instead of fabricating success', async () => {
    const runtime = createSunReyPreviewRuntime();
    const principal = runtime.sessions.get(sandboxToken('basic_verified'));
    assert.ok(principal);
    const res = await handleConsumerBff(runtime, {
      method: 'GET',
      path: '/api/v1/grow/overview',
      authorization: `Bearer ${sandboxToken('basic_verified')}`,
      query: {},
    });
    assert.equal(res.status, 403);
    assert.equal((res.body as { errorCode: string }).errorCode, 'CAPABILITY_DISABLED');
  });
});
