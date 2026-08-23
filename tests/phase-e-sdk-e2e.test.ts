import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createSunReyConsumerBffClient } from '../packages/sunrey-sdk/src/consumer-bff/index.ts';
import { createPhaseEWorld, PHASE_E_TOKEN } from './phase-e-world.ts';

describe('Phase E SDK-only Grow E2E', () => {
  it('completes the Grow journey through the public Consumer BFF client', async () => {
    const world = createPhaseEWorld('sdk');
    const server = await world.startHttp();
    const client = createSunReyConsumerBffClient({
      baseUrl: server.url,
      getAccessToken: () => PHASE_E_TOKEN,
    });
    try {
      const home = await client.getGrowHome();
      assert.equal((home as { schema: string }).schema, 'sunrey.consumer.grow.home.v1');
      const snapshot = await client.getGrowSnapshot();
      assert.equal((snapshot as { ledgerWins: boolean }).ledgerWins, true);
      await client.createGoal({ label: 'House deposit', targetMinorUnits: '5000000', currency: 'USD' });
      const goals = await client.getGoals();
      assert.ok(Array.isArray((goals as { items: unknown[] }).items));
      const opportunities = await client.getOpportunities();
      assert.ok((opportunities as { items: unknown[] }).items);
      const plan = (await client.getGrowthPlan()) as { actions: Array<{ actionId: string; action: string }> };
      const investAction =
        plan.actions.find((row) => row.action === 'PAPER_INVESTMENT_REVIEW_AVAILABLE') ??
        plan.actions.find((row) => row.action === 'INVESTMENT_ACCOUNT_AVAILABLE') ??
        plan.actions[0];
      assert.ok(investAction);
      const scenarios = await client.getGrowScenarios();
      assert.ok((scenarios as { items: unknown[] }).items);
      const proposal = (await client.createGrowthProposal({ actionId: investAction.actionId })) as {
        proposalId: string;
      };
      const explained = await client.getGrowthProposal(proposal.proposalId);
      assert.equal((explained as { serverOwned: boolean }).serverOwned, true);
      const modified = (await client.modifyGrowthProposal(proposal.proposalId, { amountMinorUnits: '20000' })) as {
        proposalId: string;
        version: number;
      };
      assert.equal(modified.version, 2);
      await client.approveGrowthProposal(modified.proposalId, { stepUpSatisfied: true });
      const executed = (await client.executeGrowthProposal(modified.proposalId, { idempotencyKey: 'sdk-grow-1' })) as {
        executionId: string;
        state: string;
      };
      assert.ok(executed.executionId);
      const status = await client.getGrowExecution(executed.executionId);
      assert.equal((status as { executionId: string }).executionId, executed.executionId);
      const portfolio = await client.getGrowPortfolio();
      assert.equal((portfolio as { liveInvestmentExecution: boolean }).liveInvestmentExecution, false);
      const performance = await client.getGrowPlanPerformance();
      assert.equal((performance as { depositsAreNotPerformance: boolean }).depositsAreNotPerformance, true);
      await client.getPlanProgress();
      const monitor = await client.runGrowMonitor();
      assert.equal((monitor as { silentInvestmentChange: boolean }).silentInvestmentChange, false);
    } finally {
      await server.close();
    }
  });
});
