import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asCustomerId, createProspect, notStartedVerification } from '../../../packages/domain/src/customer.ts';
import { asJurisdiction, asResidency } from '../../../packages/domain/src/jurisdiction.ts';
import { asLegalEntityId } from '../../../packages/domain/src/legal-entity.ts';
import { asUtcInstant } from '../../../packages/domain/src/time.ts';
import { FrozenClock } from '../../../packages/config/src/clock.ts';
import { addMs } from '../../../packages/config/src/clock.ts';
import { AUTHORITY_TTL_MS } from '../../../packages/permissions/src/execution-authority.ts';
import { PRODUCT_DEMAND_USD_GB, SOLSTICE_UK } from './catalog.ts';
import { activateCustomer, openIntent } from './test-helpers.ts';
import { createSimulationRuntime } from './runtime.ts';

describe('Kernel-gated account opening', () => {
  it('ALLOW creates exactly one account and seals evidence', () => {
    const runtime = createSimulationRuntime();
    const customer = activateCustomer(runtime);
    const first = runtime.accountsService.open(
      openIntent({ id: 'open_1', accountId: 'acct_1', ownerId: customer.id }),
    );
    assert.equal(first.outcome, 'OPENED');
    if (first.outcome !== 'OPENED') {
      return;
    }
    assert.equal(runtime.accountsService.listAccounts().length, 1);
    assert.equal(first.account.id, 'acct_1');
    assert.equal('balance' in first.account, false);
    const evidenceBefore = runtime.evidence.count();
    assert.ok(evidenceBefore >= 2);

    const replay = runtime.accountsService.open(
      openIntent({ id: 'open_1', accountId: 'acct_1', ownerId: customer.id }),
    );
    assert.equal(replay.outcome, 'OPENED');
    if (replay.outcome === 'OPENED') {
      assert.equal(replay.replay, true);
      assert.equal(replay.account.id, first.account.id);
    }
    assert.equal(runtime.accountsService.listAccounts().length, 1);
  });

  it('BLOCK creates none and still seals evidence', () => {
    const runtime = createSimulationRuntime();
    const prospect = createProspect({
      id: asCustomerId('cust_prospect'),
      legalEntityId: asLegalEntityId('le_solstice_uk_ltd'),
      jurisdiction: asJurisdiction('GB'),
      residency: asResidency('GB'),
      verification: notStartedVerification(asUtcInstant('2027-08-13T00:00:00.000Z')),
      createdAt: asUtcInstant('2026-01-15T09:00:00.000Z'),
    });
    runtime.customers.put(prospect.id, prospect);
    const before = runtime.accountsService.listAccounts().length;
    const result = runtime.accountsService.open(
      openIntent({ id: 'open_block', accountId: 'acct_block', ownerId: prospect.id }),
    );
    assert.equal(result.outcome, 'KERNEL_REFUSED');
    if (result.outcome === 'KERNEL_REFUSED') {
      assert.equal(result.decision.status, 'BLOCK');
    }
    assert.equal(runtime.accountsService.listAccounts().length, before);
    assert.ok(runtime.evidence.count() >= 2);
    runtime.evidence.verifyChain();
  });

  it('expired Authority is rejected', () => {
    const clock = new FrozenClock(asUtcInstant('2026-08-13T15:00:00.000Z'));
    const runtime = createSimulationRuntime({ clock });
    const customer = activateCustomer(runtime);
    const intent = openIntent({ id: 'open_exp', accountId: 'acct_exp', ownerId: customer.id });
    const decision = runtime.kernel.submit(intent, {
      actor: { id: intent.actorId, capabilities: [intent.actionType] },
      customer,
      jurisdiction: customer.jurisdiction,
      product: PRODUCT_DEMAND_USD_GB,
      legalEntity: SOLSTICE_UK,
    });
    assert.equal(decision.status, 'ALLOW');
    assert.ok(decision.executionAuthority);
    clock.set(addMs(clock.now(), AUTHORITY_TTL_MS + 1n));
    const verified = runtime.issuer.verify(
      decision.executionAuthority!,
      { actionType: intent.actionType, accountId: intent.payload.accountId, intentId: intent.id },
      clock,
    );
    assert.equal(verified.ok, false);
  });
});
