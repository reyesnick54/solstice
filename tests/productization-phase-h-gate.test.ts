import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  ENVIRONMENT,
  LIVE_DATA_MARKET_ENABLED,
  LIVE_DATA_MONETIZATION_ENABLED,
  LIVE_HIN_BASED_ISSUANCE_ENABLED,
  LIVE_INFORMATION_RIGHTS_MARKETPLACE,
  LIVE_MOONREY_PRODUCTIVE_ISSUANCE_ENABLED,
} from '../packages/config/src/flags.ts';
import {
  evaluateInformationRightsMarketplaceGate,
  evaluateProductionDataGates,
} from '../services/api/src/consumer/phase-h/gates.ts';

const ROOT = join(import.meta.dirname, '..');

describe('Phase H Prompt 6 qualification gate', () => {
  it('keeps the closure record and production flags off', () => {
    for (const rel of [
      'docs/productization/PHASE_H_06_QUALIFICATION.md',
      'docs/productization/PHASE_H_CLOSURE_REPORT.md',
      'docs/productization/SUNREY_HIN_DATA_EXTERNAL_REQUIREMENTS.md',
      'docs/productization/PHASE_H_PERFORMANCE_BASELINE.md',
      'docs/productization/phase-h-production-data-gates.json',
      'docs/productization/phase-h-marketplace-gate.json',
      'services/api/src/consumer/phase-h/surface.ts',
      'packages/personal-data-vault/src/service.ts',
      'packages/consent/src/service.ts',
      'packages/information-market/src/network/engine.ts',
      'packages/human-economic-contribution/src/registry.ts',
    ]) {
      assert.equal(existsSync(join(ROOT, rel)), true, rel);
    }
    const doc = readFileSync(join(ROOT, 'docs/productization/PHASE_H_CLOSURE_REPORT.md'), 'utf8');
    assert.match(doc, /CORE_CODE_COMPLETE_CANDIDATE=true/);
    assert.match(doc, /PRODUCTION_READY=false/);
    assert.match(doc, /PRODUCTION_ACTIVE=false/);
    assert.match(doc, /LIVE_CONNECTIVITY_ENABLED=false/);
    assert.match(doc, /READY_FOR_PHASE_I=true/);
    assert.match(doc, /Do not begin Phase I/);
    assert.equal(existsSync(join(ROOT, 'packages/hin')), false);
    assert.equal(existsSync(join(ROOT, 'packages/pdv-v2')), false);
    assert.equal(existsSync(join(ROOT, 'packages/consent-v2')), false);
    assert.equal(existsSync(join(ROOT, 'packages/licensing')), false);
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_INFORMATION_RIGHTS_MARKETPLACE, false);
    assert.equal(LIVE_DATA_MONETIZATION_ENABLED, false);
    assert.equal(LIVE_HIN_BASED_ISSUANCE_ENABLED, false);
    assert.equal(LIVE_MOONREY_PRODUCTIVE_ISSUANCE_ENABLED, false);
    assert.equal(LIVE_DATA_MARKET_ENABLED, false);
    const production = evaluateProductionDataGates();
    assert.equal(production.allSatisfied, false);
    assert.equal(production.liveActivityAuthorized, false);
    const marketplace = evaluateInformationRightsMarketplaceGate();
    assert.equal(marketplace.allSatisfied, false);
    assert.equal(marketplace.marketplaceEconomicsAuthorized, false);
    assert.equal(marketplace.technicalReadinessDoesNotActivate, true);
  });
});
