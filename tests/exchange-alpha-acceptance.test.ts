import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  EXCHANGE_ALPHA_PERSONA,
  runExchangeAlphaAcceptanceLocal,
} from '../scripts/lib/exchange-alpha-acceptance.ts';

describe('SunRey Internal Alpha Exchange acceptance', () => {
  it('qualifies the full local simulation exchange lifecycle', async () => {
    const report = await runExchangeAlphaAcceptanceLocal();
    assert.equal(report.mode, 'local');
    assert.ok(report.checks.length >= 20);
    assert.equal(report.chain.networkId.length > 0, true);
    assert.equal(report.chain.blockHeight > 0, true);
    assert.ok(report.providers.some((row) => row.name === 'CoinGecko'));
    const failed = report.checks.filter(
      (row) => row.status !== 'PASS' && row.status !== 'LIVE_REFERENCE' && row.status !== 'DISABLED',
    );
    assert.deepEqual(
      failed.map((row) => `${row.label}:${row.status}${row.detail ? `:${row.detail}` : ''}`),
      [],
      `acceptance failures: ${failed.map((row) => row.label).join(', ')}`,
    );
    assert.equal(report.ready, true);
  });

  it('uses the exchange sandbox persona for alpha qualification', () => {
    assert.equal(EXCHANGE_ALPHA_PERSONA, 'exchange');
  });
});
