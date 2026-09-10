import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '@solstice/domain';
import { DigitalAssetLifecycle } from './lifecycle.ts';
import {
  captureConsumerAlphaSnapshot,
  decodeConsumerAlphaSnapshot,
  encodeConsumerAlphaSnapshot,
  hydrateConsumerAlphaLifecycle,
} from './persistence.ts';

const NOW = asUtcInstant('2026-09-10T12:00:00.000Z');

describe('consumer alpha exchange persistence snapshot', () => {
  it('round-trips order, trade, and deposit state without duplication markers', () => {
    const world = new DigitalAssetLifecycle({ now: NOW, participantId: 'cust_alpha_1' });
    world.fundQuote();
    world.fundBase(20n);
    const proposal = world.createProposal({ side: 'BUY', quantity: 1n, notionalUsdMinor: '50000' });
    assert.ok(!('ok' in proposal));
    const approved = world.approveProposal({
      proposalId: proposal.proposalId,
      actor: 'HUMAN',
      stepUpSatisfied: true,
    });
    assert.ok(!('ok' in approved));
    const submitted = world.submitOrder(proposal.proposalId, 'clord_alpha_1');
    assert.ok(!('ok' in submitted));
    world.simulateDeposit(10n);

    const snapshot = captureConsumerAlphaSnapshot(world);
    const encoded = encodeConsumerAlphaSnapshot(snapshot);
    const decoded = decodeConsumerAlphaSnapshot(encoded);
    const restored = hydrateConsumerAlphaLifecycle({ snapshot: decoded, now: NOW });

    assert.equal(restored.participantId, world.participantId);
    assert.equal(restored.proposals.size, world.proposals.size);
    assert.equal(restored.engine.orders.size, world.engine.orders.size);
    assert.equal(restored.engine.receipts.size, world.engine.receipts.size);
    assert.equal(restored.deposits.size, world.deposits.size);
    assert.equal(restored.engine.ops.clearing.orders.size, world.engine.ops.clearing.orders.size);
    assert.equal(restored.engine.ops.clearing.trades.size, world.engine.ops.clearing.trades.size);
    assert.equal(
      restored.engine.ops.clearing.chain.issued.get('SUNREY_COIN')?.toString(),
      world.engine.ops.clearing.chain.issued.get('SUNREY_COIN')?.toString(),
    );
  });

  it('preserves idempotent client order binding across hydration', () => {
    const world = new DigitalAssetLifecycle({ now: NOW, participantId: 'cust_alpha_2' });
    world.fundQuote();
    const proposal = world.createProposal({ side: 'BUY', quantity: 1n });
    assert.ok(!('ok' in proposal));
    const approved = world.approveProposal({
      proposalId: proposal.proposalId,
      actor: 'HUMAN',
      stepUpSatisfied: true,
    });
    assert.ok(!('ok' in approved));
    world.submitOrder(proposal.proposalId, 'clord_bound_1');

    const restored = hydrateConsumerAlphaLifecycle({
      snapshot: captureConsumerAlphaSnapshot(world),
      now: NOW,
    });
    assert.equal(restored.engine.ordersByClient.get('clord_bound_1'), world.engine.ordersByClient.get('clord_bound_1'));
  });
});
