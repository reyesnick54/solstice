import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { selectMarketPrice } from '../packages/sunrey-exchange/src/market-data/aggregation.ts';
import {
  createMarketQuoteSourceA,
  createMarketQuoteSourceB,
  runMarketDataContractSuite,
} from '../packages/sunrey-exchange/src/market-data/sandbox.ts';

describe('Phase D market data', () => {
  it('passes the market-data contract suite and labels stale prices', () => {
    const report = runMarketDataContractSuite();
    assert.equal(report.outcome, 'CONTRACT_TEST_PASS');
    const provider = createMarketQuoteSourceA();
    provider.setScenario('stale');
    const stale = provider.getSpotPrice('SUNREY_COIN/USD', '2026-08-21T16:00:00.000Z');
    assert.equal(stale.ok, true);
    if (!stale.ok) throw new Error('stale');
    assert.equal(stale.value.quality, 'STALE');
    assert.equal(stale.value.staleMasqueradingAsCurrent, false);
  });

  it('fails over without averaging incompatible prices', () => {
    const now = '2026-08-21T16:00:00.000Z';
    const primary = createMarketQuoteSourceA();
    const secondary = createMarketQuoteSourceB();
    primary.setScenario('unavailable');
    const failover = selectMarketPrice({
      policy: 'SECONDARY_FAILOVER',
      primary: primary.getSpotPrice('SUNREY_COIN/USD', now),
      secondary: secondary.getSpotPrice('SUNREY_COIN/USD', now),
      nowUtc: now,
    });
    assert.equal(failover.ok, true);
    if (!failover.ok) throw new Error('failover');
    assert.equal(failover.value.provider, 'fixture-market-data-b');

    primary.setScenario('outlier');
    const rejected = selectMarketPrice({
      policy: 'CONSENSUS_IF_COMPATIBLE',
      primary: primary.getSpotPrice('SUNREY_COIN/USD', now),
      secondary: secondary.getSpotPrice('SUNREY_COIN/USD', now),
      nowUtc: now,
    });
    assert.equal(rejected.ok, false);
    if (rejected.ok) throw new Error('should reject outlier');
    assert.equal(rejected.code, 'OUTLIER_DIVERGENCE');
  });
});
