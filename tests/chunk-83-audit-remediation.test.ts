import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { runSunreyAudit } from '../packages/sunrey-chain/src/audit/index.ts';
import { TEST_FIXTURE_NOT_EXTERNAL_AUDIT } from '../packages/sunrey-chain/src/audit/remediation/types.ts';
import { fixtureReview, reviewSatisfiesRealExternalReadiness } from '../packages/sunrey-chain/src/audit/remediation/index.ts';

const ROOT = join(import.meta.dirname, '..');

describe('Chunk 83 exit criteria', () => {
  it('provides remediation CLI without claiming an independent audit', () => {
    const imported = runSunreyAudit(ROOT, ['review', 'import', 'packages/sunrey-chain/audit/test-fixture-review.json']);
    assert.equal(imported.ok, true);
    assert.equal((imported.payload as { fixtureOnly: boolean }).fixtureOnly, true);
    const status = runSunreyAudit(ROOT, ['status']);
    assert.equal(status.ok, true);
    assert.equal((status.payload as { claimsExternalAuditCompleted: boolean }).claimsExternalAuditCompleted, false);
    const risk = runSunreyAudit(ROOT, ['risk-acceptance']);
    assert.equal(risk.ok, false);
    const bundle = runSunreyAudit(ROOT, ['bundle']);
    assert.equal(bundle.ok, true);
    assert.equal(existsSync(join(ROOT, 'docs/audit/chunk-83-audit-remediation.md')), true);
    assert.equal(existsSync(join(ROOT, 'docs/audit/remediation-evidence.md')), true);
    assert.equal(existsSync(join(ROOT, 'docs/audit/external-retest.md')), true);
    assert.equal(existsSync(join(ROOT, 'docs/audit/security-risk-acceptance.md')), true);
    assert.equal(existsSync(join(ROOT, 'docs/runbooks/security-finding-remediation.md')), true);
    assert.equal(existsSync(join(ROOT, 'packages/audit-remediation')), false);
    assert.equal(existsSync(join(ROOT, 'packages/security-audit-v2')), false);
  });

  it('keeps fictional fixtures labeled and ineligible for real readiness', () => {
    const review = fixtureReview();
    assert.equal(review.fixtureLabel, TEST_FIXTURE_NOT_EXTERNAL_AUDIT);
    assert.equal(reviewSatisfiesRealExternalReadiness(review), false);
    assert.equal(review.claimsExternalAuditCompleted, false);
  });
});
