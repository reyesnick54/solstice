import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { containsGuaranteedReturnClaim } from '../packages/platform/src/grow/no-guaranteed-returns.ts';
import { createPhaseEWorld } from './phase-e-world.ts';

describe('Phase E Grow My Money E2E', () => {
  it('runs the sandbox Grow lifecycle through the Consumer BFF', () => {
    const world = createPhaseEWorld('happy');
    const home = world.handle({ method: 'GET', path: '/api/v1/grow', query: {} });
    assert.equal(home.status, 200);
    const homeBody = home.body as { schema: string; screens: string[] };
    assert.equal(homeBody.schema, 'sunrey.consumer.grow.home.v1');
    assert.ok(homeBody.screens.includes('PROPOSAL_DETAIL'));
    assert.equal(containsGuaranteedReturnClaim(home.body), false);

    const accounts = world.handle({ method: 'GET', path: '/api/v1/accounts', query: {} });
    assert.equal(accounts.status, 200);

    const goal = world.handle({
      method: 'POST',
      path: '/api/v1/grow/goals',
      query: {},
      body: { label: 'Vacation', targetMinorUnits: '300000', currency: 'USD' },
    });
    assert.equal(goal.status, 201);

    const snapshot = world.handle({ method: 'GET', path: '/api/v1/grow/snapshot', query: {} });
    assert.equal(snapshot.status, 200);
    assert.equal((snapshot.body as { ledgerWins: boolean }).ledgerWins, true);

    const opportunities = world.handle({ method: 'GET', path: '/api/v1/grow/opportunities', query: {} });
    assert.equal(opportunities.status, 200);

    const plan = world.handle({ method: 'GET', path: '/api/v1/grow/plan', query: {} });
    assert.equal(plan.status, 200);
    const planBody = plan.body as { actions: Array<{ actionId: string; action: string }>; achievementPromised: boolean };
    assert.equal(planBody.achievementPromised, false);
    const investAction =
      planBody.actions.find((row) => row.action === 'PAPER_INVESTMENT_REVIEW_AVAILABLE') ??
      planBody.actions.find((row) => row.action === 'INVESTMENT_ACCOUNT_AVAILABLE') ??
      planBody.actions[0];
    assert.ok(investAction);

    const scenarios = world.handle({ method: 'GET', path: '/api/v1/grow/scenarios', query: {} });
    assert.equal(scenarios.status, 200);
    assert.equal(containsGuaranteedReturnClaim(scenarios.body), false);

    const created = world.handle({
      method: 'POST',
      path: '/api/v1/grow/proposals',
      query: {},
      body: { actionId: investAction.actionId },
    });
    assert.equal(created.status, 201);
    const proposal = created.body as { proposalId: string; contentHash: string; explainability: { canExecuteWithoutAuthority: boolean } };
    assert.equal(proposal.explainability.canExecuteWithoutAuthority, false);

    const detail = world.handle({ method: 'GET', path: `/api/v1/grow/proposals/${proposal.proposalId}`, query: {} });
    assert.equal(detail.status, 200);

    const modified = world.handle({
      method: 'POST',
      path: `/api/v1/grow/proposals/${proposal.proposalId}/modify`,
      query: {},
      body: { amountMinorUnits: '20000' },
    });
    assert.equal(modified.status, 200);
    assert.equal((modified.body as { version: number }).version, 2);

    const needsStepUp = world.handle({
      method: 'POST',
      path: `/api/v1/grow/proposals/${proposal.proposalId}/approve`,
      query: {},
      body: { stepUpSatisfied: false },
    });
    assert.equal(needsStepUp.status, 401);
    assert.equal((needsStepUp.body as { errorCode?: string }).errorCode, 'STEP_UP_REQUIRED');

    const approved = world.handle({
      method: 'POST',
      path: `/api/v1/grow/proposals/${proposal.proposalId}/approve`,
      query: {},
      body: { stepUpSatisfied: true },
    });
    assert.equal(approved.status, 200);

    const executed = world.handle({
      method: 'POST',
      path: `/api/v1/grow/proposals/${proposal.proposalId}/execute`,
      query: {},
      body: { idempotencyKey: 'phase-e-happy-1' },
    });
    assert.equal(executed.status, 200, JSON.stringify(executed.body));
    const execution = executed.body as { executionId: string; state: string; submittedIsNotCompleted: boolean };
    assert.ok(execution.state === 'COMPLETED' || execution.state === 'PARTIALLY_COMPLETED');
    assert.equal(execution.submittedIsNotCompleted, execution.state !== 'COMPLETED');

    const status = world.handle({ method: 'GET', path: `/api/v1/grow/executions/${execution.executionId}`, query: {} });
    assert.equal(status.status, 200);

    const portfolio = world.handle({ method: 'GET', path: '/api/v1/grow/portfolio', query: {} });
    assert.equal(portfolio.status, 200);
    assert.equal((portfolio.body as { liveInvestmentExecution: boolean }).liveInvestmentExecution, false);

    const performance = world.handle({ method: 'GET', path: '/api/v1/grow/performance', query: {} });
    assert.equal(performance.status, 200);
    assert.equal((performance.body as { depositsAreNotPerformance: boolean }).depositsAreNotPerformance, true);

    const progress = world.handle({ method: 'GET', path: '/api/v1/grow/plan/progress', query: {} });
    assert.equal(progress.status, 200);

    const monitor = world.handle({ method: 'POST', path: '/api/v1/grow/monitor', query: {}, body: {} });
    assert.equal(monitor.status, 200);
    assert.equal((monitor.body as { silentInvestmentChange: boolean }).silentInvestmentChange, false);

    const duplicate = world.handle({
      method: 'POST',
      path: `/api/v1/grow/proposals/${proposal.proposalId}/execute`,
      query: {},
      body: { idempotencyKey: 'phase-e-happy-1' },
    });
    assert.equal(duplicate.status, 200);
    assert.equal((duplicate.body as { executionId: string }).executionId, execution.executionId);
  });
});
