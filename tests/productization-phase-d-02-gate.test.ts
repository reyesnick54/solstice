import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const ROOT = join(import.meta.dirname, '..');

describe('Phase D Prompt 2 financial provider adapter gate', () => {
  it('keeps production closed and records the adapter framework', () => {
    for (const rel of [
      'docs/productization/PHASE_D_02_FINANCIAL_PROVIDER_ADAPTERS.md',
      'docs/productization/SUNREY_FINANCIAL_PROVIDER_ONBOARDING_CHECKLIST.md',
      'packages/payments/src/production-adapters/index.ts',
      'packages/cards/src/production-adapters/index.ts',
    ]) {
      assert.equal(existsSync(join(ROOT, rel)), true, rel);
    }
    const doc = readFileSync(join(ROOT, 'docs/productization/PHASE_D_02_FINANCIAL_PROVIDER_ADAPTERS.md'), 'utf8');
    assert.match(doc, /PRODUCTION_READY=false/);
    assert.match(doc, /PRODUCTION_ACTIVE=false/);
    assert.match(doc, /LIVE_CONNECTIVITY_ENABLED=false/);
    assert.match(doc, /REAL_BANKING_CONNECTED=false/);
    assert.match(doc, /REAL_FX_PROVIDER_CONNECTED=false/);
    assert.match(doc, /REAL_CARD_PROCESSOR_CONNECTED=false/);
    assert.match(doc, /PROVIDER ADAPTER/);
    const flags = readFileSync(join(ROOT, 'packages/config/src/flags.ts'), 'utf8');
    assert.equal(flags.includes("ENVIRONMENT = 'simulation'"), true);
    assert.equal(/LIVE_PAYMENTS_ENABLED = true/.test(flags), false);
    assert.equal(/LIVE_BANKING_RAILS = true/.test(flags), false);
  });
});
