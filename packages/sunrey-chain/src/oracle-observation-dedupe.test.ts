import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  OracleObservationDedupe,
  admitCollectedObservation,
} from './oracle/production/observation-dedupe.ts';

describe('oracle observation retry dedupe', () => {
  it('admits one draft per provider/source/feed/sourceObservationId', () => {
    const ledger = new OracleObservationDedupe();
    const observation = {
      providerId: 'prov_1',
      sourceId: 'src_1',
      feedId: 'feed_1',
      sourceObservationId: 'obs_99',
    };
    assert.equal(admitCollectedObservation(ledger, observation), 'accepted');
    assert.equal(admitCollectedObservation(ledger, observation), 'duplicate');
    assert.equal(
      admitCollectedObservation(ledger, { ...observation, sourceObservationId: 'obs_100' }),
      'accepted',
    );
  });
});
