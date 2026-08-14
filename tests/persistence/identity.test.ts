import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asJurisdiction } from '../../packages/domain/src/jurisdiction.ts';
import { loadIdentitySnapshot, persistIdentitySnapshot } from '../../packages/persistence/src/index.ts';
import { createDurableRuntime, persistenceAvailable, preparePersistence } from './helpers.ts';

const describePersistence = persistenceAvailable() ? describe : describe.skip;

describePersistence('identity persistence', () => {
  it('identity data survives PostgreSQL restart', async () => {
    const env = await preparePersistence();
    const first = await createDurableRuntime(env);
    try {
      const provisioned = first.runtime.identity.provisionSimulatedActor({
        actorId: 'actor_persist',
        identityId: 'idn_persist_1',
        jurisdiction: asJurisdiction('GB'),
      });
      assert.equal(provisioned.ok, true);
      await persistIdentitySnapshot(
        first.session.pools.customer,
        first.runtime.identity.service.snapshot(),
      );
      const before = first.runtime.identity.service.identityFactsFor('actor_persist');
      assert.equal(before.identityExists, true);
      assert.equal(before.sessionValid, true);
    } finally {
      await first.close();
    }

    const second = await createDurableRuntime(env);
    try {
      const loaded = await loadIdentitySnapshot(second.session.pools.customer);
      assert.ok(loaded);
      assert.ok(loaded.identities.some((identity) => identity.id === 'idn_persist_1'));
      const facts = second.runtime.identity.service.identityFactsFor('actor_persist');
      assert.equal(facts.identityExists, true);
      assert.equal(facts.sessionValid, true);
      const resolved = second.runtime.identity.service.resolveActorContext('actor_persist');
      assert.equal(resolved.ok, true);
    } finally {
      await second.close();
    }
  });
});
