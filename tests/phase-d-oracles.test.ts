import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  createOracleProviderA,
  createOracleProviderB,
  observationCannotMint,
  runOracleContractSuite,
} from '../packages/sunrey-chain/src/oracle/production/productization.ts';

describe('Phase D oracles', () => {
  it('passes the oracle contract suite and never mints from an observation', () => {
    const report = runOracleContractSuite();
    assert.equal(report.outcome, 'CONTRACT_TEST_PASS');
    const provider = createOracleProviderA();
    const energy = provider.observe('energy', '2026-08-21T16:00:00.000Z');
    assert.equal(energy.ok, true);
    if (!energy.ok) throw new Error('energy');
    assert.equal(observationCannotMint(energy.value), true);
    assert.equal(energy.value.provenance.verification, 'VERIFIED');
  });

  it('rejects expired, invalid, and conflicting sandbox observations', () => {
    const provider = createOracleProviderB();
    provider.setScenario('expired');
    assert.equal(provider.observe('compute', '2026-08-21T16:00:00.000Z').ok, false);
    provider.setScenario('invalid_signature');
    assert.equal(provider.observe('manufacturing', '2026-08-21T16:00:00.000Z').ok, false);
    provider.setScenario('conflicting');
    const conflicting = provider.observe('logistics', '2026-08-21T16:00:00.000Z');
    assert.equal(conflicting.ok, true);
    if (!conflicting.ok) throw new Error('conflict');
    assert.equal(conflicting.value.quality, 'CONFLICTING');
    assert.equal(conflicting.value.mintsMoonRey, false);
  });
});
