import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { handleConsumerBff } from './consumer/handler.ts';
import { createSandboxWorld, sandboxToken } from './consumer/fixtures.ts';
import { unwrapBff } from './consumer/bff-test-utils.ts';

function runtime(world: ReturnType<typeof createSandboxWorld>) {
  return {
    bff: world.bff,
    sessions: world.sessions,
    identity: world.runtime.identity.service,
    payments: world.payments,
    grow: world.grow,
    personalEconomy: world.personalEconomy,
  };
}

function call(
  world: ReturnType<typeof createSandboxWorld>,
  method: string,
  path: string,
  persona: Parameters<typeof sandboxToken>[0] | null,
  body: Record<string, unknown> = {},
) {
  return unwrapBff(handleConsumerBff(runtime(world), {
    method,
    path,
    query: {},
    body,
    authorization: persona ? `Bearer ${sandboxToken(persona)}` : undefined,
  }));
}

describe('Consumer BFF personal economy ACCESS-20', () => {
  it('returns unified overview projection', () => {
    const world = createSandboxWorld();
    const response = call(world, 'GET', '/api/v1/personal-economy/overview', 'personal_economy');
    assert.equal(response.status, 200);
    const body = response.body as {
      schema: string;
      guaranteedOutcome: false;
      autoExecution: false;
      snapshot: { authoritativeBalance: false; ledgerWins: true };
    };
    assert.equal(body.schema, 'sunrey.consumer.personal-economy.overview.v1');
    assert.equal(body.guaranteedOutcome, false);
    assert.equal(body.autoExecution, false);
    assert.equal(body.snapshot.authoritativeBalance, false);
    assert.equal(body.snapshot.ledgerWins, true);
  });

  it('returns a simulation plan and proposal-only recommendations', () => {
    const world = createSandboxWorld();
    const plan = call(world, 'GET', '/api/v1/personal-economy/plan', 'personal_economy');
    assert.equal(plan.status, 200);
    const planBody = plan.body as {
      plan: { autoExecution: false; recommendations: { executable: false; requiresApproval: true }[] };
    };
    assert.equal(planBody.plan.autoExecution, false);
    assert.ok(planBody.plan.recommendations.length > 0);
    for (const rec of planBody.plan.recommendations) {
      assert.equal(rec.executable, false);
      assert.equal(rec.requiresApproval, true);
    }
    const proposals = call(world, 'POST', '/api/v1/personal-economy/proposals', 'personal_economy', {
      goalSummary: 'Grow wealth while preserving access for two vacations next year',
    });
    assert.equal(proposals.status, 201);
    assert.equal((proposals.body as { resultKind: string }).resultKind, 'PROPOSAL');
  });

  it('runs what-if scenarios without promising outcomes', () => {
    const world = createSandboxWorld();
    const scenario = call(world, 'POST', '/api/v1/personal-economy/scenarios', 'personal_economy', {
      scenario: 'What if I invest $5,000?',
    });
    assert.equal(scenario.status, 200);
    const body = scenario.body as {
      guaranteedOutcome: false;
      simulationOnly: true;
      outcome: { guaranteedOutcome: false };
    };
    assert.equal(body.guaranteedOutcome, false);
    assert.equal(body.simulationOnly, true);
    assert.equal(body.outcome.guaranteedOutcome, false);
  });
});
