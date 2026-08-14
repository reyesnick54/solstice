import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  loadComplianceSnapshot,
  persistComplianceSnapshot,
} from '../../packages/persistence/src/index.ts';
import { createDurableRuntime, persistenceAvailable, preparePersistence } from './helpers.ts';

const describePersistence = persistenceAvailable() ? describe : describe.skip;

describePersistence('compliance persistence', () => {
  it('16. PostgreSQL restart preserves cases', async () => {
    const env = await preparePersistence();
    const first = await createDurableRuntime(env);
    let caseId = '';
    try {
      const screened = first.runtime.compliance.screen({
        type: 'SANCTIONS',
        subjectRef: 'sim_review_persist',
        jurisdiction: 'GB',
      });
      assert.equal(screened.outcome, 'REVIEW');
      const opened = [...first.runtime.compliance.store.cases.values()][0];
      assert.ok(opened);
      caseId = opened.caseId;
      await persistComplianceSnapshot(first.session.pools.customer, first.runtime.compliance.store.snapshot());
    } finally {
      await first.close();
    }

    const second = await createDurableRuntime(env);
    try {
      const loaded = await loadComplianceSnapshot(second.session.pools.customer);
      assert.ok(loaded.cases.some((row) => row.caseId === caseId));
      assert.ok(loaded.screenings.some((row) => row.subjectRef === 'sim_review_persist'));
      second.runtime.compliance.hydrate(loaded);
      assert.ok(second.runtime.compliance.store.cases.get(caseId));
    } finally {
      await second.close();
    }
  });
});
