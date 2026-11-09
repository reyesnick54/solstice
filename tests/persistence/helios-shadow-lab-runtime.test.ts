import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../packages/config/src/clock.ts';
import { asUtcInstant } from '../../packages/domain/src/time.ts';
import {
  HeliosDurableShadowLabRuntimeService,
} from '../../packages/platform/src/helios/autonomous-shadow-lab/index.ts';
import { PgShadowLabDurableStore } from '../../packages/persistence/src/index.ts';
import { createDurableRuntime, persistenceAvailable, preparePersistence } from './helpers.ts';

const describePersistence = persistenceAvailable() ? describe : describe.skip;
const NOW = asUtcInstant('2026-11-09T08:00:00.000Z');
const CAMPAIGN = 'camp_persist_ops01';

describePersistence('HELIOS OPS01 shadow lab runtime persistence', () => {
  it('sealed decision + evidence + checkpoint + outbox survive restart', async () => {
    const env = await preparePersistence();
    const durable = await createDurableRuntime(env);
    const pool = durable.session.pools.customer;
    const store = new PgShadowLabDurableStore(pool);
    const clock = new FrozenClock(NOW);
    const runtime = new HeliosDurableShadowLabRuntimeService({ clock, store, workerId: 'persist-worker' });

    await runtime.registerCampaign({
      campaignId: CAMPAIGN,
      strategyIds: ['strat-persist'],
      freezeHashes: { 'strat-persist': 'freeze:persist' },
    });
    const lease = await runtime.acquireCampaignLease(CAMPAIGN);
    assert.equal(lease.ok, true);
    if (!lease.ok) {
      return;
    }
    const sealed = await runtime.sealDecision({
      campaignId: CAMPAIGN,
      strategyId: 'strat-persist',
      knowableAt: NOW,
      recordedAt: NOW,
      sequence: 0,
      previousHash: 'GENESIS',
      action: 'SHADOW_ENTER',
      fencingToken: lease.fencingToken,
    });
    assert.equal(sealed.ok, true);

    await store.releaseLease({
      campaignId: CAMPAIGN,
      workerId: 'persist-worker',
      fencingToken: lease.fencingToken,
    });

    const runtime2 = new HeliosDurableShadowLabRuntimeService({
      clock,
      store: new PgShadowLabDurableStore(pool),
      workerId: 'persist-worker-2',
    });
    const evidence = await runtime2.verifyCampaignEvidence(CAMPAIGN);
    assert.equal(evidence.chainIntact, true);
    assert.equal(evidence.duplicateIds.length, 0);
    assert.equal(evidence.missingEvidence.length, 0);

    const lease2 = await runtime2.acquireCampaignLease(CAMPAIGN);
    assert.equal(lease2.ok, true);
    if (!lease2.ok || !sealed.ok) {
      return;
    }
    const dup = await runtime2.sealDecision({
      campaignId: CAMPAIGN,
      strategyId: 'strat-persist',
      knowableAt: NOW,
      recordedAt: NOW,
      sequence: 0,
      previousHash: 'GENESIS',
      action: 'SHADOW_ENTER',
      fencingToken: lease2.fencingToken,
    });
    assert.equal(dup.ok, false);
    if (!dup.ok) {
      assert.equal(dup.reason, 'DUPLICATE_DECISION');
    }
  });
});
