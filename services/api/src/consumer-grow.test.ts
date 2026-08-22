import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { handleConsumerBff } from './consumer/handler.ts';
import { createSandboxWorld, sandboxToken } from './consumer/fixtures.ts';

function runtime(world: ReturnType<typeof createSandboxWorld>) {
  return {
    bff: world.bff,
    sessions: world.sessions,
    identity: world.runtime.identity.service,
    payments: world.payments,
    grow: world.grow,
  };
}

function call(
  world: ReturnType<typeof createSandboxWorld>,
  method: string,
  path: string,
  persona: Parameters<typeof sandboxToken>[0] | null,
  body: Record<string, unknown> = {},
) {
  return handleConsumerBff(runtime(world), {
    method,
    path,
    query: {},
    body,
    authorization: persona ? `Bearer ${sandboxToken(persona)}` : undefined,
  });
}

describe('Consumer BFF grow plans and proposals', () => {
  it('creates a plan, returns Lovable experience, and lists it', () => {
    const world = createSandboxWorld();
    const created = call(world, 'POST', '/api/v1/grow/plans', 'basic_verified', {
      startingCapitalMinorUnits: '1000000',
      currency: 'USD',
      timeHorizonMonths: 24,
      riskProfile: 'BALANCED',
      goalTargetMinorUnits: '1300000',
      recurringContributionMinorUnits: '5000',
      liquidityRequirementMinorUnits: '200000',
    });
    assert.equal(created.status, 201);
    const body = created.body as {
      planId: string;
      guaranteedOutcome: false;
      primaryProposal: { proposalId: string } | null;
      experience: { schema: string; guaranteedOutcome: false };
    };
    assert.equal(body.guaranteedOutcome, false);
    assert.equal(body.experience.schema, 'sunrey.lovable.grow-my-money.v1');
    assert.ok(body.primaryProposal?.proposalId.startsWith('fpr_'));
    const loaded = call(world, 'GET', `/api/v1/grow/plans/${body.planId}`, 'basic_verified');
    assert.equal(loaded.status, 200);
    const catalog = call(world, 'GET', '/api/v1/grow', 'basic_verified');
    assert.equal(catalog.status, 200);
    assert.equal((catalog.body as { productionActive: boolean }).productionActive, false);
  });

  it('denies cross-user plan reads', () => {
    const world = createSandboxWorld();
    const created = call(world, 'POST', '/api/v1/grow/plans', 'basic_verified', {
      startingCapitalMinorUnits: '500000',
      currency: 'USD',
      timeHorizonMonths: 12,
      riskProfile: 'CONSERVATIVE',
    });
    const planId = (created.body as { planId: string }).planId;
    const denied = call(world, 'GET', `/api/v1/grow/plans/${planId}`, 'investment');
    assert.equal(denied.status, 403);
  });

  it('approves with step-up and refuses fabricated proposal ids', () => {
    const world = createSandboxWorld();
    const created = call(world, 'POST', '/api/v1/grow/plans', 'basic_verified', {
      startingCapitalMinorUnits: '1000000',
      currency: 'USD',
      timeHorizonMonths: 12,
      riskProfile: 'BALANCED',
    });
    const proposalId = (created.body as { primaryProposal: { proposalId: string } }).primaryProposal.proposalId;
    const blocked = call(world, 'POST', `/api/v1/grow/proposals/${proposalId}/approve`, 'basic_verified', {});
    assert.equal(blocked.status, 403);
    const approved = call(world, 'POST', `/api/v1/grow/proposals/${proposalId}/approve`, 'basic_verified', {
      stepUpSatisfied: true,
    });
    assert.equal(approved.status, 200);
    assert.equal((approved.body as { status: string; executionAuthorityId: null }).status, 'APPROVED');
    assert.equal((approved.body as { executionAuthorityId: null }).executionAuthorityId, null);
    const fake = call(world, 'GET', '/api/v1/grow/proposals/fpr_invented', 'basic_verified');
    assert.equal(fake.status, 404);
  });

  it('modification creates a new proposal version', () => {
    const world = createSandboxWorld();
    const created = call(world, 'POST', '/api/v1/grow/plans', 'basic_verified', {
      startingCapitalMinorUnits: '800000',
      currency: 'USD',
      timeHorizonMonths: 18,
      riskProfile: 'BALANCED',
    });
    const proposalId = (created.body as { primaryProposal: { proposalId: string } }).primaryProposal.proposalId;
    call(world, 'POST', `/api/v1/grow/proposals/${proposalId}/approve`, 'basic_verified', {});
    const modified = call(world, 'POST', `/api/v1/grow/proposals/${proposalId}/modify`, 'basic_verified', {
      amountMinorUnits: '250000',
    });
    assert.equal(modified.status, 200);
    assert.notEqual((modified.body as { proposalId: string }).proposalId, proposalId);
    const previous = call(world, 'GET', `/api/v1/grow/proposals/${proposalId}`, 'basic_verified');
    assert.equal((previous.body as { status: string }).status, 'SUPERSEDED');
  });
});
