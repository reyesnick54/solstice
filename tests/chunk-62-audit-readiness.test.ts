import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { runSunreyAudit } from '../packages/sunrey-chain/src/audit/index.ts';

const ROOT = join(import.meta.dirname, '..');

describe('Chunk 62 exit criteria', () => {
  it('generates and verifies a reviewer-safe audit bundle without claiming an external audit', () => {
    const generated = runSunreyAudit(ROOT, ['generate']);
    assert.equal(generated.ok, true);
    const verified = runSunreyAudit(ROOT, ['verify', 'dist/sunrey-audit']);
    assert.equal(verified.ok, true);
    const readiness = runSunreyAudit(ROOT, ['readiness']);
    assert.equal(readiness.ok, true);
    assert.equal(existsSync(join(ROOT, 'dist/sunrey-audit/manifest.json')), true);
    assert.equal(existsSync(join(ROOT, 'dist/sunrey-audit/signature.json')), true);
    assert.equal((generated.payload as { claims_external_audit_completed: boolean }).claims_external_audit_completed, false);
  });
});
