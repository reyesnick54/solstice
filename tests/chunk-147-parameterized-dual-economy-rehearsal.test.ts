import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { ENVIRONMENT, LIVE_MONEY_ENABLED } from '../packages/config/src/flags.ts';
import {
  fixtureBlocked,
  runParameterizedDualEconomyRehearsal,
} from '../packages/sunrey-chain/src/economic-rehearsal/parameterized-candidate/index.ts';

describe('Chunk 147 exit criteria', () => {
  it('extends the existing economic rehearsal owner and forbids a competing package', () => {
    assert.equal(existsSync('docs/economics/chunk-147-parameterized-dual-economy-rehearsal.md'), true);
    assert.equal(existsSync('docs/architecture/chunks/chunk-147.json'), true);
    assert.equal(
      existsSync('packages/sunrey-chain/src/economic-rehearsal/parameterized-candidate/index.ts'),
      true,
    );
    assert.equal(existsSync('packages/sunrey-economic-rehearsal'), false);
    assert.equal(existsSync('packages/parameterized-rehearsal'), false);
    assert.equal(existsSync('packages/dual-economy-rehearsal'), false);
    const constitution = readFileSync('docs/architecture/constitution.md', 'utf8');
    assert.match(constitution, /parameterized-candidate/);
    assert.match(constitution, /sunrey-economic-mainnet-rehearsal/);
  });

  it('completes the rehearsal while remaining production-blocked', () => {
    const report = runParameterizedDualEconomyRehearsal();
    assert.equal(report.parameterClass, 'REHEARSAL_ONLY');
    assert.equal(report.sunreyPathComplete, true);
    assert.equal(report.moonreyV2PathComplete, true);
    assert.equal(report.suppliesReconciled, true);
    assert.equal(report.exchangeReconciled, true);
    assert.equal(report.productionAuthorized, false);
    assert.equal(report.fixtureParameters, true);
    assert.equal(report.liveFlagsChanged, false);
    assert.equal(report.productionActive, false);
    assert.equal(fixtureBlocked(report.firewallAfter), true);
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_MONEY_ENABLED, false);
  });
});
