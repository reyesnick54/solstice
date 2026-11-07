import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  BROKER_ORDER_STATES,
  brokerOrderCommandFixture,
  validateBrokerProtocolCommand,
} from './index.ts';

describe('broker-execution-capability', () => {
  it('validates order command fixture', () => {
    assert.equal(BROKER_ORDER_STATES.includes('PENDING_NEW'), true);
    assert.deepEqual(validateBrokerProtocolCommand(brokerOrderCommandFixture()), []);
  });
});
