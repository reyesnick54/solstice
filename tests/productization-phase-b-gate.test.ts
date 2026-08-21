import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const ROOT = join(import.meta.dirname, '..');

describe('Phase B productization gate', () => {
  it('keeps required handoff documents and production flags off', () => {
    for (const rel of [
      'api/sunrey-consumer-platform-v1.openapi.yaml',
      'docs/productization/SUNREY_API_ERROR_CATALOG.md',
      'docs/productization/SUNREY_FRONTEND_AUTH_GUIDE.md',
      'docs/productization/SUNREY_LOVABLE_INTEGRATION_GUIDE.md',
      'docs/productization/PHASE_B_CLOSURE_REPORT.md',
    ]) {
      assert.equal(existsSync(join(ROOT, rel)), true, rel);
    }
    const closure = readFileSync(join(ROOT, 'docs/productization/PHASE_B_CLOSURE_REPORT.md'), 'utf8');
    assert.match(closure, /PHASE B does not mean SunRey is production ready/);
    assert.match(closure, /CORE_CODE_COMPLETE_CANDIDATE=true/);
    assert.match(closure, /PRODUCTION_READY=false/);
    assert.match(closure, /PRODUCTION_ACTIVE=false/);
    assert.match(closure, /LIVE_CONNECTIVITY_ENABLED=false/);
    assert.match(closure, /READY_FOR_PHASE_C=/);
  });
});
