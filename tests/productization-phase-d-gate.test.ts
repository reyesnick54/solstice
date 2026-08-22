import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const ROOT = join(import.meta.dirname, '..');

describe('Phase D productization gate', () => {
  it('keeps the closure report and production flags off', () => {
    for (const rel of [
      'docs/productization/PHASE_D_CLOSURE_REPORT.md',
      'docs/productization/SUNREY_EXTERNAL_PROVIDER_INTEGRATION_PACKAGE.md',
      'docs/productization/SUNREY_LOVABLE_BFF_MAPPING.md',
      'packages/custody/src/provider-candidate/contract.ts',
      'packages/sunrey-exchange/src/market-data/index.ts',
      'packages/sunrey-chain/src/oracle/production/productization.ts',
      'packages/kernel/src/compliance/provider-candidate/blockchain-analytics.ts',
      'scripts/provider-test.ts',
      'scripts/provider-certify.ts',
    ]) {
      assert.equal(existsSync(join(ROOT, rel)), true, rel);
    }
    const closure = readFileSync(join(ROOT, 'docs/productization/PHASE_D_CLOSURE_REPORT.md'), 'utf8');
    assert.match(closure, /PHASE D does not mean SunRey is production ready/);
    assert.match(closure, /CORE_CODE_COMPLETE_CANDIDATE=true/);
    assert.match(closure, /PRODUCTION_READY=false/);
    assert.match(closure, /PRODUCTION_ACTIVE=false/);
    assert.match(closure, /LIVE_CONNECTIVITY_ENABLED=false/);
    assert.match(closure, /PROVIDER_RUNTIME_PRODUCTIZED=true/);
    assert.match(closure, /BANK_ADAPTER_READY=true/);
    assert.match(closure, /PAYMENT_ADAPTER_READY=true/);
    assert.match(closure, /FX_ADAPTER_READY=true/);
    assert.match(closure, /CARD_ADAPTER_READY=true/);
    assert.match(closure, /COMPLIANCE_ADAPTERS_READY=true/);
    assert.match(closure, /CUSTODY_ADAPTER_READY=true/);
    assert.match(closure, /MARKET_DATA_ADAPTER_READY=true/);
    assert.match(closure, /ORACLE_ADAPTER_READY=true/);
    assert.match(closure, /REAL_BANK_CONNECTED=false/);
    assert.match(closure, /REAL_PAYMENT_PROVIDER_CONNECTED=false/);
    assert.match(closure, /REAL_FX_PROVIDER_CONNECTED=false/);
    assert.match(closure, /REAL_CARD_PROVIDER_CONNECTED=false/);
    assert.match(closure, /REAL_KYC_PROVIDER_CONNECTED=false/);
    assert.match(closure, /REAL_CUSTODY_PROVIDER_CONNECTED=false/);
    assert.match(closure, /READY_FOR_PHASE_E=true/);
    const flags = readFileSync(join(ROOT, 'packages/config/src/flags.ts'), 'utf8');
    assert.equal(flags.includes("ENVIRONMENT = 'simulation'"), true);
    assert.equal(/LIVE_MONEY_ENABLED = true/.test(flags), false);
    const pkg = readFileSync(join(ROOT, 'package.json'), 'utf8');
    assert.match(pkg, /"provider:test"/);
    assert.match(pkg, /"provider:certify"/);
  });
});
