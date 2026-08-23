import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import {
  PHASE_G_CLASSIFICATION,
  PHASE_G_PRODUCTION_FLAGS,
} from '../packages/sunrey-exchange/src/productization/taxonomy.ts';
import {
  evaluateExchangeProductionGate,
  evaluateMainnetReadinessGate,
} from '../packages/sunrey-exchange/src/productization/gates.ts';

describe('Phase G productization gates', () => {
  it('keeps production flags off', () => {
    assert.equal(PHASE_G_PRODUCTION_FLAGS.CORE_CODE_COMPLETE_CANDIDATE, true);
    assert.equal(PHASE_G_PRODUCTION_FLAGS.PRODUCTION_READY, false);
    assert.equal(PHASE_G_PRODUCTION_FLAGS.PRODUCTION_ACTIVE, false);
    assert.equal(PHASE_G_PRODUCTION_FLAGS.LIVE_CONNECTIVITY_ENABLED, false);
    assert.equal(PHASE_G_PRODUCTION_FLAGS.LIVE_EXCHANGE_ENABLED, false);
    assert.equal(PHASE_G_PRODUCTION_FLAGS.MAINNET_ACTIVE, false);
    assert.equal(PHASE_G_PRODUCTION_FLAGS.LIVE_NATIVE_ASSET_ISSUANCE_ENABLED, false);
  });

  it('fails mainnet and exchange gates until external inputs exist', () => {
    const mainnet = evaluateMainnetReadinessGate();
    const exchange = evaluateExchangeProductionGate();
    assert.equal(mainnet.passed, false);
    assert.equal(exchange.passed, false);
    assert.ok(mainnet.missingRequirementIds.length > 0);
    assert.ok(exchange.missingRequirementIds.length > 0);
    assert.equal(mainnet.activationSeparatedFromBuild, true);
    assert.equal(exchange.activationSeparatedFromBuild, true);
  });

  it('keeps closure artefacts honest', () => {
    const closure = readFileSync('docs/productization/PHASE_G_CLOSURE_REPORT.md', 'utf8');
    assert.match(closure, /PHASE G CLOSURE/);
    assert.match(closure, /PRODUCTION_ACTIVE=false/);
    assert.match(closure, /READY_FOR_PHASE_H=true/);
    const external = readFileSync(
      'docs/productization/SUNREY_EXCHANGE_CHAIN_EXTERNAL_REQUIREMENTS.md',
      'utf8',
    );
    assert.match(external, /SOFTWARE COMPLETE INTERNALLY/);
    assert.match(external, /EXTERNAL INPUT REQUIRED/);
    const mainnetGate = JSON.parse(
      readFileSync('docs/productization/sunrey-mainnet-readiness-gate.json', 'utf8'),
    ) as { passed: boolean };
    const exchangeGate = JSON.parse(
      readFileSync('docs/productization/sunrey-exchange-production-gate.json', 'utf8'),
    ) as { passed: boolean };
    assert.equal(mainnetGate.passed, false);
    assert.equal(exchangeGate.passed, false);
  });

  it('classifies readiness honestly', () => {
    assert.ok(PHASE_G_CLASSIFICATION.EXCHANGE_CORE.includes('PRODUCTIZED_INTERNAL'));
    assert.ok(PHASE_G_CLASSIFICATION.SUNREY_CHAIN.includes('TESTNET_DEPLOYABLE'));
    assert.ok(PHASE_G_CLASSIFICATION.CUSTODY_INTEGRATION.includes('PROVIDER_REQUIRED'));
    assert.ok(!(PHASE_G_CLASSIFICATION.EXCHANGE_CORE as readonly string[]).includes('PRODUCTION_READY_PENDING_EXTERNAL_GATES'));
  });
});
