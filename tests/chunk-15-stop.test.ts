import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { evaluateDeclaredChunks } from '../tools/architectural-linter/src/constitution.ts';
import { evaluateCapability, loadManifest } from '../tools/architectural-linter/src/manifest.ts';

const REPO_ROOT = join(import.meta.dirname, '..');

describe('CHUNK-15 Personal Economy Agent remains unstarted', () => {
  it('does not create the reserved agent owner or competing agent packages', () => {
    assert.equal(existsSync(join(REPO_ROOT, 'packages/agent')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'services/agent')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/personal-agent')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/financial-agent')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/economy-ai')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/growth-agent')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/treasury')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'services/treasury')), true);
  });

  it('no longer stops on treasury after Chunk 13R', () => {
    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'treasury').status, 'IMPLEMENTED');
    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
      (evaluation) => evaluation.chunk === 'CHUNK-15',
    );
    assert.ok(declared);
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);
  });
});
