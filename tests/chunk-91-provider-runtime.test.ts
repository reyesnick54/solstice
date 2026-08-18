import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  createProviderRuntime,
  runNegativeControls,
  runProviderRuntimeCommand,
} from '../packages/sunrey-chain/src/provider-runtime/index.ts';

const ROOT = join(import.meta.dirname, '..');

describe('Chunk 91 provider runtime exit criteria', () => {
  it('keeps technical connectivity distinct from production approval', () => {
    const runtime = createProviderRuntime();
    assert.equal(runtime.ok, true);
    if (!runtime.ok) {
      return;
    }
    const negatives = runNegativeControls(runtime.value);
    assert.equal(negatives.sandboxCannotMarkLegal, true);
    assert.equal(negatives.aiProviderApprovalRejected, true);
    const cli = runProviderRuntimeCommand(['runtime-test']);
    assert.equal(cli.ok, true);
    assert.equal((cli.payload as { legallyApproved: boolean }).legallyApproved, false);
  });

  it('publishes the required runtime documents', () => {
    for (const rel of [
      'docs/providers/chunk-91-provider-runtime.md',
      'docs/providers/provider-runtime-modes.md',
      'docs/providers/provider-credentials.md',
      'docs/providers/provider-webhook-security.md',
      'docs/providers/provider-failure-handling.md',
      'docs/runbooks/provider-runtime-incident.md',
      'docs/architecture/chunks/chunk-91-provider-runtime.json',
      'packages/sunrey-chain/src/provider-runtime/index.ts',
    ]) {
      assert.equal(existsSync(join(ROOT, rel)), true, rel);
    }
  });
});
