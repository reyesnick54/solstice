import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import { MARKET_FAILURE_MODES, runAllMarketFailures } from '../packages/sunrey-exchange/src/productization/failures.ts';

const NOW = asUtcInstant('2026-08-23T12:00:00.000Z');

describe('Phase G market failure modes', () => {
  it('maps every declared failure to a safe client state', () => {
    const outcomes = runAllMarketFailures(NOW);
    assert.equal(outcomes.length, MARKET_FAILURE_MODES.length);
    for (const outcome of outcomes) {
      assert.equal(outcome.clientState, 'SAFE_REFUSED', outcome.mode);
      assert.equal(outcome.unauthorizedMutation, false, outcome.mode);
      assert.ok(outcome.reason.length > 0, outcome.mode);
    }
  });
});
