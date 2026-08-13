import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  assertSimulationOnly,
  CAPABILITIES,
  ENVIRONMENT,
  LIVE_CRYPTO_ENABLED,
  LIVE_DATA_MARKET_ENABLED,
  LIVE_EXCHANGE_ENABLED,
  LIVE_TRADING_ENABLED,
  REAL_MONEY_ENABLED,
} from './index.ts';

describe('capability flags', () => {
  it('keeps every live capability fail-closed', () => {
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(REAL_MONEY_ENABLED, false);
    assert.equal(LIVE_TRADING_ENABLED, false);
    assert.equal(LIVE_CRYPTO_ENABLED, false);
    assert.equal(LIVE_EXCHANGE_ENABLED, false);
    assert.equal(LIVE_DATA_MARKET_ENABLED, false);
    assert.equal(CAPABILITIES.REAL_MONEY_ENABLED, false);
    assert.doesNotThrow(() => assertSimulationOnly());
  });
});
