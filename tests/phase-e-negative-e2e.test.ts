import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createPhaseEWorld } from './phase-e-world.ts';

async function proposalFor(world: ReturnType<typeof createPhaseEWorld>): Promise<string> {
  await world.handle({ method: 'GET', path: '/api/v1/grow/plan', query: {} });
  const created = await world.handle({ method: 'POST', path: '/api/v1/grow/proposals', query: {}, body: {} });
  assert.equal(created.status, 201);
  return (created.body as { proposalId: string }).proposalId;
}

describe('Phase E Grow negative E2E', () => {
  it('fails safely for ineligible, forged, expired, agent, and provider cases', async () => {
    const world = createPhaseEWorld('neg');
    const proposalId = await proposalFor(world);

    const ineligible = await world.handle({
      method: 'POST',
      path: `/api/v1/grow/proposals/${proposalId}/approve`,
      query: {},
      body: { stepUpSatisfied: true },
      authorization: 'Bearer missing',
    });
    assert.equal(ineligible.status, 401);

    const forged = await world.handle({
      method: 'POST',
      path: `/api/v1/grow/proposals/${proposalId}/modify`,
      query: {},
      body: { amountMinorUnits: '20000', contentHash: 'forged-hash' },
    });
    assert.ok(forged.status >= 400);

    const executeForged = await world.handle({
      method: 'POST',
      path: `/api/v1/grow/proposals/${proposalId}/execute`,
      query: {},
      body: { clientIntent: { amount: '999999' } },
    });
    assert.ok(executeForged.status >= 400);

    const agent = await world.handle({
      method: 'POST',
      path: '/api/v1/grow/agent-tools',
      query: {},
      body: { tool: 'submitProposalForApproval', proposalId, selfApprove: true },
    });
    assert.ok(agent.status >= 400);

    const privileged = await world.handle({
      method: 'POST',
      path: '/api/v1/grow/agent-tools',
      query: {},
      body: { tool: 'executeProposal' },
    });
    assert.ok(privileged.status >= 400);

    await world.handle({
      method: 'POST',
      path: `/api/v1/grow/proposals/${proposalId}/modify`,
      query: {},
      body: { amountMinorUnits: '20000' },
    });
    const approved = await world.handle({
      method: 'POST',
      path: `/api/v1/grow/proposals/${proposalId}/approve`,
      query: {},
      body: { stepUpSatisfied: true },
    });
    assert.equal(approved.status, 200);

    const insufficient = await world.handle({
      method: 'POST',
      path: `/api/v1/grow/proposals/${proposalId}/modify`,
      query: {},
      body: { amountMinorUnits: '999999999' },
    });
    assert.equal(insufficient.status, 200);
    const approveHuge = await world.handle({
      method: 'POST',
      path: `/api/v1/grow/proposals/${proposalId}/approve`,
      query: {},
      body: { stepUpSatisfied: true },
    });
    assert.equal(approveHuge.status, 200);
    const executeHuge = await world.handle({
      method: 'POST',
      path: `/api/v1/grow/proposals/${proposalId}/execute`,
      query: {},
      body: { idempotencyKey: 'phase-e-huge' },
    });
    assert.ok(executeHuge.status >= 400);

    const recurring = await world.handle({
      method: 'POST',
      path: '/api/v1/grow/recurring',
      query: {},
      body: {
        amountMinorUnits: '25000',
        currency: 'USD',
        frequency: 'MONTHLY',
        sourceAccountId: world.demand.id,
        destinationAccountId: world.brokerage.id,
        maxAmountMinorUnits: '25000',
      },
    });
    assert.equal(recurring.status, 201);
    const recurringId = (recurring.body as { recurringMandateId: string }).recurringMandateId;
    const revoked = await world.handle({
      method: 'POST',
      path: `/api/v1/grow/recurring/${recurringId}/cancel`,
      query: {},
      body: {},
    });
    assert.equal(revoked.status, 200);
    const reuse = world.grow.refuseAgentAmountIncrease(recurringId, '50000');
    assert.equal(reuse.code, 'AMOUNT_EXCEEDS_MANDATE');
  });

  it('refuses expired proposals and unavailable providers without substituting a new action', async () => {
    const world = createPhaseEWorld('exp');
    const proposalId = await proposalFor(world);
    world.clock.advanceMs(31n * 60n * 1000n);
    const expired = await world.handle({
      method: 'POST',
      path: `/api/v1/grow/proposals/${proposalId}/approve`,
      query: {},
      body: { stepUpSatisfied: true },
    });
    assert.ok(expired.status >= 400);
    assert.equal((expired.body as { detailsSafeForClient?: { growCode?: string } }).detailsSafeForClient?.growCode, 'PROPOSAL_EXPIRED');

    const providerWorld = createPhaseEWorld('noprov');
    providerWorld.providers.applyKillSwitch({
      switchId: 'ks_phase_e_invest',
      providerId: 'sim-investments',
      scope: 'PROVIDER',
      target: 'sim-investments',
      actorId: 'ops',
      reason: 'phase-e negative provider unavailable',
      nowUtc: providerWorld.clock.now(),
    });
    await providerWorld.handle({ method: 'GET', path: '/api/v1/grow/plan', query: {} });
    const created = await providerWorld.handle({ method: 'POST', path: '/api/v1/grow/proposals', query: {}, body: {} });
    assert.equal(created.status, 201);
    const id = (created.body as { proposalId: string }).proposalId;
    const modified = await providerWorld.handle({
      method: 'POST',
      path: `/api/v1/grow/proposals/${id}/modify`,
      query: {},
      body: { amountMinorUnits: '20000' },
    });
    assert.equal(modified.status, 200);
    const approved = await providerWorld.handle({
      method: 'POST',
      path: `/api/v1/grow/proposals/${id}/approve`,
      query: {},
      body: { stepUpSatisfied: true },
    });
    assert.equal(approved.status, 200);
    const executed = await providerWorld.handle({
      method: 'POST',
      path: `/api/v1/grow/proposals/${id}/execute`,
      query: {},
      body: { idempotencyKey: 'phase-e-no-provider' },
    });
    assert.ok(executed.status >= 400);
  });

  it('refuses restricted and incomplete KYC suitability', async () => {
    const world = createPhaseEWorld('kyc');
    const plannedResult = world.orchestrator.plan(world.actor, world.principal.identityId);
    assert.equal(plannedResult.ok, true);
    const planned = plannedResult.ok ? plannedResult.value.plan : world.orchestrator.store.latestPlanFor(world.principal.identityId);
    assert.ok(planned);
    const candidate = planned.candidateActions[0];
    assert.ok(candidate);
    const unsuitable = world.grow.generateProposal(
      world.actor,
      planned,
      candidate,
      world.principal.customerId,
      {
        kycComplete: false,
        jurisdictionPermitted: true,
        accountRestricted: false,
        customerEligible: true,
        riskProfile: 'MODERATE',
        proposalRiskClass: 'MODERATE',
      },
    );
    assert.equal(unsuitable.ok, true);
    if (unsuitable.ok) {
      assert.equal(unsuitable.value.suitability, 'KYC_INCOMPLETE');
    }
    const mismatch = world.grow.generateProposal(
      world.actor,
      planned,
      candidate,
      world.principal.customerId,
      {
        kycComplete: true,
        jurisdictionPermitted: false,
        accountRestricted: false,
        customerEligible: true,
        riskProfile: 'LOW',
        proposalRiskClass: 'HIGH',
      },
    );
    assert.equal(mismatch.ok, true);
    if (mismatch.ok) {
      assert.equal(mismatch.value.suitability, 'JURISDICTION_BLOCKED');
    }
  });
});
