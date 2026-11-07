/**
 * HELIOS MD11 — deterministic replay qualification (repository harness).
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  HELIOS_MD11_DETERMINISTIC_REPLAY_QUALIFIED,
  evaluateMd11DeterministicReplayQualification,
  createImmutableTickStore,
} from '../packages/sunrey-exchange/src/market-data/md11/index.ts';

describe('HELIOS MD11 deterministic replay qualification', () => {
  it('never retains bars without underlying ticks', () => {
    assert.equal(createImmutableTickStore().retainsBarsOnly(), false);
  });

  it('emits HELIOS_MD11_DETERMINISTIC_REPLAY_QUALIFIED', () => {
    const result = evaluateMd11DeterministicReplayQualification();
    assert.equal(result.qualified, true, result.blockers.join('; '));
    assert.equal(result.marker, HELIOS_MD11_DETERMINISTIC_REPLAY_QUALIFIED);
  });
});
