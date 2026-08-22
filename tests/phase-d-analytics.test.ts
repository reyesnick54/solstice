import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  analyticsCannotDecideWithdrawal,
  createBlockchainAnalyticsA,
  findingToCompliance,
  runBlockchainAnalyticsContractSuite,
} from '../packages/kernel/src/compliance/provider-candidate/blockchain-analytics.ts';

describe('Phase D blockchain analytics', () => {
  it('normalizes risk into compliance findings without deciding withdrawals', () => {
    const report = runBlockchainAnalyticsContractSuite();
    assert.equal(report.outcome, 'CONTRACT_TEST_PASS');
    const provider = createBlockchainAnalyticsA();
    const finding = provider.screenAddress('addr_mix', asUtcInstant('2026-08-21T16:00:00.000Z'));
    assert.equal(finding.outcome, 'REVIEW');
    assert.equal(analyticsCannotDecideWithdrawal(finding), true);
    const compliance = findingToCompliance(finding);
    assert.equal(compliance.outcome, 'REVIEW');
    assert.equal(compliance.available, true);
  });

  it('fails closed when the analytics provider is unavailable', () => {
    const provider = createBlockchainAnalyticsA();
    provider.setUnavailable(true);
    const finding = provider.screenTransaction('tx_1', asUtcInstant('2026-08-21T16:00:00.000Z'));
    assert.equal(finding.outcome, 'UNAVAILABLE');
    assert.equal(finding.authorizesWithdrawal, false);
  });
});
