import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { ENVIRONMENT, LIVE_EXCHANGE_ENABLED, LIVE_TRADING_ENABLED } from '../packages/config/src/flags.ts';

const ROOT = join(import.meta.dirname, '..');

describe('Phase G Prompt 1 Exchange core gate', () => {
  it('keeps the productization record and production flags off', () => {
    for (const rel of [
      'docs/productization/PHASE_G_01_EXCHANGE_CORE.md',
      'docs/productization/PHASE_G_01_PERFORMANCE_BASELINE.md',
      'packages/sunrey-exchange/src/production-core/index.ts',
      'packages/sunrey-exchange/src/service.ts',
      'packages/sunrey-exchange/src/matching.ts',
      'packages/persistence/src/exchange/durable-core-store.ts',
      'packages/persistence/src/exchange/pg-exchange-core-store.ts',
    ]) {
      assert.equal(existsSync(join(ROOT, rel)), true, rel);
    }
    const doc = readFileSync(join(ROOT, 'docs/productization/PHASE_G_01_EXCHANGE_CORE.md'), 'utf8');
    assert.match(doc, /CORE_CODE_COMPLETE_CANDIDATE=true/);
    assert.match(doc, /PRODUCTION_READY=false/);
    assert.match(doc, /PRODUCTION_ACTIVE=false/);
    assert.match(doc, /LIVE_CONNECTIVITY_ENABLED=false/);
    assert.match(doc, /SAFE_TO_PROCEED_TO_PHASE_G_PROMPT_2=true/);
    assert.match(doc, /Do not begin Prompt 2/);
    assert.equal(existsSync(join(ROOT, 'packages/exchange-v2')), false);
    assert.equal(existsSync(join(ROOT, 'packages/matching-engine')), false);
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_EXCHANGE_ENABLED, false);
    assert.equal(LIVE_TRADING_ENABLED, false);
    const core = readFileSync(join(ROOT, 'packages/sunrey-exchange/src/production-core/posture.ts'), 'utf8');
    assert.match(core, /EXCHANGE_LIVE_TRADING_ENABLED = false/);
  });
});
