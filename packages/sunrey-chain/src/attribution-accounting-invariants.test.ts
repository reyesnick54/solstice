import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ATTRIBUTION_SHARE_SCALE,
  ProductiveAttributionBook,
  DEMO_HOUR_END,
  DEMO_HOUR_START,
  goodsObservation,
  manufacturingObservation,
  simulationAttributionDecision,
} from './productive/policy-governance/attribution-accounting/index.ts';

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function reserve(
  book: ProductiveAttributionBook,
  observation: ReturnType<typeof manufacturingObservation>,
  decisionId: string,
  allocatedShare: bigint,
) {
  return book.reserve({
    observation,
    decision: simulationAttributionDecision(observation, {
      attributionDecisionId: decisionId,
      allocatedShare,
    }),
    expectedPolicyVersion: 1,
  });
}

describe('Chunk 122 attribution invariants', () => {
  it('sumShares <= maximumAggregateShare for randomized reservations', () => {
    const random = mulberry32(122);
    for (let trial = 0; trial < 32; trial += 1) {
      const book = new ProductiveAttributionBook();
      const eventId = `event.inv.${trial}`;
      let accepted = 0n;
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const share = BigInt(Math.floor(random() * Number(ATTRIBUTION_SHARE_SCALE / 4n)) + 1);
        const observation = manufacturingObservation({
          economicEventId: eventId,
          claimId: `claim.${trial}.${attempt}`,
          contributionId: `contrib.${trial}.${attempt}`,
          oracleFactIds: [`fact.${trial}`],
          sourceQuantity: 10n + BigInt(trial),
        });
        const result = reserve(book, observation, `d.${trial}.${attempt}`, share);
        if (result.ok) {
          accepted += share;
        }
      }
      assert.ok(accepted <= ATTRIBUTION_SHARE_SCALE, `trial ${trial} accepted ${accepted}`);
      assert.ok(book.allocatedShareForEvent(eventId) <= ATTRIBUTION_SHARE_SCALE);
      assert.equal(book.reconcile().overAllocatedEvents, 0);
    }
  });

  it('replay does not change total attribution', () => {
    const book = new ProductiveAttributionBook();
    const observation = manufacturingObservation();
    const first = reserve(book, observation, 'd-replay', ATTRIBUTION_SHARE_SCALE / 2n);
    assert.equal(first.ok, true);
    const before = book.allocatedShareForEvent(observation.economicEventId);
    for (let i = 0; i < 5; i += 1) {
      reserve(book, observation, 'd-replay', ATTRIBUTION_SHARE_SCALE / 2n);
      reserve(
        book,
        manufacturingObservation({
          claimId: `claim.replay.${i}`,
          contributionId: `contrib.replay.${i}`,
          economicEventId: `event.replay.${i}`,
        }),
        `d-replay-new.${i}`,
        ATTRIBUTION_SHARE_SCALE,
      );
    }
    assert.equal(book.allocatedShareForEvent(observation.economicEventId), before);
  });

  it('idempotent retry does not change state', () => {
    const book = new ProductiveAttributionBook();
    const observation = manufacturingObservation();
    const first = reserve(book, observation, 'd-idemp', 250_000n);
    const retry = reserve(book, observation, 'd-idemp', 250_000n);
    assert.equal(first.ok && retry.ok, true);
    if (first.ok && retry.ok) {
      assert.equal(retry.idempotentReplay, true);
      assert.deepEqual(book.getEntry(first.value.entryId), first.value);
    }
    assert.equal(book.snapshotEntries().length, 1);
  });

  it('correction preserves history', () => {
    const book = new ProductiveAttributionBook();
    const first = reserve(book, manufacturingObservation(), 'd1', ATTRIBUTION_SHARE_SCALE);
    if (!first.ok) {
      throw new Error('expected ok');
    }
    book.finalize(first.value.entryId);
    const historyBefore = book.snapshotEntries();
    book.correct({
      targetEntryId: first.value.entryId,
      reason: 'invariant correction',
      evidenceIds: ['ev.1'],
      supersede: false,
    });
    const after = book.snapshotEntries();
    assert.ok(after.length >= historyBefore.length);
    assert.equal(book.getEntry(first.value.entryId)?.status, 'RELEASED_BY_CORRECTION');
    assert.equal(book.snapshotCorrections()[0]?.silentlyErasesFinalizedEvidence, false);
  });

  it('batch split does not create extra aggregate attribution', () => {
    const book = new ProductiveAttributionBook();
    const parent = manufacturingObservation({
      economicEventId: 'event.parent',
      batchId: 'batch.P',
      oracleFactIds: ['fact.parent'],
    });
    assert.equal(reserve(book, parent, 'd-parent', ATTRIBUTION_SHARE_SCALE).ok, true);
    const childShare = ATTRIBUTION_SHARE_SCALE / 2n;
    for (const child of ['A1', 'A2'] as const) {
      reserve(
        book,
        manufacturingObservation({
          economicEventId: `event.${child}`,
          claimId: `claim.${child}`,
          contributionId: `contrib.${child}`,
          batchId: `batch.${child}`,
          oracleFactIds: [`fact.${child}`],
          lineage: {
            kind: 'SPLIT',
            parentEventIds: ['event.parent'],
            childEventIds: ['event.A1', 'event.A2'],
          },
        }),
        `d-${child}`,
        childShare,
      );
    }
    const parentAllocated = book.allocatedShareForEvent('event.parent');
    const children = book.allocatedShareForEvent('event.A1') + book.allocatedShareForEvent('event.A2');
    assert.ok(parentAllocated + children <= ATTRIBUTION_SHARE_SCALE || children === 0n);
    assert.equal(book.reconcile().overAllocatedEvents, 0);
  });

  it('batch merge does not create extra aggregate attribution', () => {
    const book = new ProductiveAttributionBook();
    assert.equal(
      reserve(
        book,
        manufacturingObservation({
          economicEventId: 'event.A1',
          claimId: 'claim.a1',
          contributionId: 'contrib.a1',
          oracleFactIds: ['fact.a1'],
          batchId: 'A1',
        }),
        'd-a1',
        400_000n,
      ).ok,
      true,
    );
    assert.equal(
      reserve(
        book,
        manufacturingObservation({
          economicEventId: 'event.A2',
          claimId: 'claim.a2',
          contributionId: 'contrib.a2',
          oracleFactIds: ['fact.a2'],
          batchId: 'A2',
        }),
        'd-a2',
        400_000n,
      ).ok,
      true,
    );
    reserve(
      book,
      manufacturingObservation({
        economicEventId: 'event.B',
        claimId: 'claim.b',
        contributionId: 'contrib.b',
        oracleFactIds: ['fact.a1', 'fact.a2'],
        batchId: 'B',
        lineage: {
          kind: 'MERGE',
          parentEventIds: ['event.A1', 'event.A2'],
          childEventIds: ['event.B'],
        },
      }),
      'd-b',
      ATTRIBUTION_SHARE_SCALE,
    );
    const total =
      book.allocatedShareForEvent('event.A1') +
      book.allocatedShareForEvent('event.A2') +
      book.allocatedShareForEvent('event.B');
    assert.ok(total <= ATTRIBUTION_SHARE_SCALE * 2n);
    assert.equal(book.allocatedShareForEvent('event.B') === 0n || total <= 800_000n, true);
  });

  it('category relabel cannot increase aggregate attribution', () => {
    const book = new ProductiveAttributionBook();
    const manufacturing = manufacturingObservation();
    assert.equal(reserve(book, manufacturing, 'd-mfg', ATTRIBUTION_SHARE_SCALE).ok, true);
    const before = book.allocatedShareForEvent(manufacturing.economicEventId);
    reserve(book, goodsObservation(), 'd-goods', ATTRIBUTION_SHARE_SCALE);
    const family =
      book.allocatedShareForEvent(manufacturing.economicEventId) + book.allocatedShareForEvent('event.goods.hour-1');
    assert.ok(family <= ATTRIBUTION_SHARE_SCALE || book.allocatedShareForEvent('event.goods.hour-1') === 0n);
    assert.equal(book.allocatedShareForEvent(manufacturing.economicEventId), before);
  });

  it('object relabel cannot increase aggregate attribution where same-event evidence exists', () => {
    const book = new ProductiveAttributionBook();
    const original = manufacturingObservation();
    assert.equal(reserve(book, original, 'd-obj', 600_000n).ok, true);
    const before = book.snapshotEntries().reduce((sum, entry) => sum + (entry.status === 'RESERVED' || entry.status === 'FINALIZED' ? entry.allocatedShare : 0n), 0n);
    reserve(
      book,
      manufacturingObservation({
        objectId: 'object.line-relabel',
        claimId: 'claim.relabel',
        contributionId: 'contrib.relabel',
        economicEventId: 'event.relabel.object',
      }),
      'd-relabel',
      600_000n,
    );
    const after = book.snapshotEntries().reduce((sum, entry) => sum + (entry.status === 'RESERVED' || entry.status === 'FINALIZED' ? entry.allocatedShare : 0n), 0n);
    assert.equal(after, before);
    void DEMO_HOUR_START;
    void DEMO_HOUR_END;
  });
});
