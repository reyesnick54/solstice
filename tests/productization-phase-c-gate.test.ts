import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const ROOT = join(import.meta.dirname, '..');

describe('Phase C productization gate', () => {
  it('keeps the closure report and production flags off', () => {
    for (const rel of [
      'docs/productization/PHASE_C_CLOSURE_REPORT.md',
      'docs/productization/PHASE_C_PERFORMANCE_BASELINE.md',
      'docs/productization/SUNREY_LOVABLE_INTEGRATION_GUIDE.md',
      'docs/productization/SUNREY_LOVABLE_BFF_MAPPING.md',
      'api/sunrey-consumer-platform-v1.openapi.yaml',
    ]) {
      assert.equal(existsSync(join(ROOT, rel)), true, rel);
    }
    const closure = readFileSync(join(ROOT, 'docs/productization/PHASE_C_CLOSURE_REPORT.md'), 'utf8');
    assert.match(closure, /PHASE C does not mean SunRey is production ready/);
    assert.match(closure, /CORE_CODE_COMPLETE_CANDIDATE=true/);
    assert.match(closure, /PRODUCTION_READY=false/);
    assert.match(closure, /PRODUCTION_ACTIVE=false/);
    assert.match(closure, /LIVE_CONNECTIVITY_ENABLED=false/);
    assert.match(closure, /MONEY_BACKEND_PRODUCTIZED=true/);
    assert.match(closure, /REAL_BANKING_CONNECTED=false/);
    assert.match(closure, /REAL_CARD_PROCESSOR_CONNECTED=false/);
    assert.match(closure, /REAL_FX_PROVIDER_CONNECTED=false/);
    assert.match(closure, /READY_FOR_PHASE_D=true/);
    assert.match(closure, /PRODUCTIZED_INTERNAL/);
    assert.match(closure, /SANDBOX_FUNCTIONAL/);
    assert.match(closure, /PROVIDER_ADAPTER_REQUIRED/);
    assert.match(closure, /REGULATORY_APPROVAL_REQUIRED/);
    const flags = readFileSync(join(ROOT, 'packages/config/src/flags.ts'), 'utf8');
    assert.equal(flags.includes("ENVIRONMENT = 'simulation'"), true);
    assert.equal(/LIVE_MONEY_ENABLED = true/.test(flags), false);
  });
});
