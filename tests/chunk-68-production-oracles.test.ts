import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { runProductionOracleE2E, runSunreyOracle } from '../packages/sunrey-chain/src/oracle/production/index.ts';

const ROOT = join(import.meta.dirname, '..');

describe('Chunk 68 exit criteria', () => {
  it('runs the seven-validator production-oracle E2E', () => {
    const report = runProductionOracleE2E();
    assert.equal(report.validatorCount, 7);
    assert.equal(report.validatorsAgree, true);
    assert.equal(report.conflicted, true);
    assert.equal(report.automaticIssuance, false);
    assert.equal(report.consensusCalledExternalApi, false);
  });

  it('exposes the sunrey-oracle CLI', () => {
    const readiness = runSunreyOracle(['readiness']);
    assert.equal(readiness.ok, true);
    const health = runSunreyOracle(['source', 'health']);
    assert.equal(health.ok, true);
  });

  it('publishes the required documentation', () => {
    for (const relative of [
      'docs/oracle/chunk-68-production-oracles.md',
      'docs/oracle/provider-onboarding.md',
      'docs/oracle/source-provenance.md',
      'docs/oracle/source-independence.md',
      'docs/oracle/production-eligibility.md',
      'docs/runbooks/oracle-provider-incident.md',
      'docs/runbooks/oracle-schema-change.md',
      'docs/architecture/chunk-68-production-oracles.md',
      'docs/architecture/chunks/chunk-68-production-oracles.json',
    ]) {
      assert.equal(existsSync(join(ROOT, relative)), true, relative);
    }
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-oracle')), false);
    assert.equal(existsSync(join(ROOT, 'packages/production-oracles')), false);
  });
});
