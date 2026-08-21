import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildProviderReadinessReport,
  runCertificationHarness,
  runProviderPreflight,
} from '../scripts/phase-d-provider-harness.ts';

describe('Phase D certification harness', () => {
  it('runs provider:test / provider:certify without completing external certification', () => {
    const tested = runCertificationHarness('provider:test');
    const certified = runCertificationHarness('provider:certify');
    assert.equal(tested.contractTests, 'CONTRACT_TEST_PASS');
    assert.equal(certified.sandboxIntegration, 'SANDBOX_INTEGRATION_PASS');
    assert.equal(certified.externalCertification, 'EXTERNAL_CERTIFICATION_REQUIRED');
    assert.equal(certified.productionAuthorized, false);
    assert.ok(!JSON.stringify(certified).toLowerCase().includes('sk_live'));
    assert.ok(!JSON.stringify(certified).includes('apiKey'));
  });

  it('emits a machine-readable readiness report without secrets', () => {
    const report = buildProviderReadinessReport();
    assert.equal(report.productionAuthorized, false);
    assert.equal(report.secretValuePresent, false);
    const types = report.providers.map((row) => row.type);
    for (const required of [
      'BANKING',
      'PAYMENTS',
      'FX',
      'CARDS',
      'KYC_KYB',
      'AML_SANCTIONS_FRAUD',
      'TRAVEL_RULE',
      'CUSTODY',
      'BLOCKCHAIN_ANALYTICS',
      'MARKET_DATA',
      'ORACLE',
    ]) {
      assert.ok(types.includes(required), required);
    }
    for (const row of report.providers) {
      assert.equal(row.externalCertification, 'EXTERNAL_CERTIFICATION_REQUIRED');
      assert.equal(row.productionAuthorized, false);
      assert.ok(row.classification.includes('REAL_PROVIDER_NOT_SELECTED'));
      assert.equal(row.classification.includes('PRODUCTION_AUTHORIZED'), false);
    }
  });

  it('keeps default preflight empty while simulation flags stay off', () => {
    assert.deepEqual(runProviderPreflight(), []);
  });
});
