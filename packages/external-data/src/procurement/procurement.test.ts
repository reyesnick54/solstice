import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { assertNoParentRollupForJointVenture, resolveProcurementCounterparty } from './entity-resolution.ts';
import { ingestProcurementObservation } from './ingest.ts';
import { DUPLICATE_AWARD_SUBSIDIARY, AWARD_SUBSIDIARY_INITIAL } from './fixtures/adversarial-timeline.ts';
import { sealProcurementObservation } from './ingest.ts';

describe('procurement external-data', () => {
  it('resolves joint venture without parent rollup attribution', () => {
    const jv = resolveProcurementCounterparty({
      sourceLegalName: 'Example JV LLC',
      role: 'joint_venture',
      parentSourceLegalName: 'Parent Co',
    });
    assert.equal(
      assertNoParentRollupForJointVenture({
        counterparty: jv,
        attributionEntityId: jv.canonicalEntityId,
      }),
      true,
    );
  });

  it('dedupes duplicate award observations', () => {
    const seeded = [sealProcurementObservation(AWARD_SUBSIDIARY_INITIAL)];
    const out = ingestProcurementObservation(seeded, DUPLICATE_AWARD_SUBSIDIARY);
    assert.equal(out.result.deduplicated, true);
    assert.equal(out.next.length, 1);
  });
});
