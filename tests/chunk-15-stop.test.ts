import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { evaluateDeclaredChunks } from '../tools/architectural-linter/src/constitution.ts';
import { evaluateCapability, loadManifest } from '../tools/architectural-linter/src/manifest.ts';

const REPO_ROOT = join(import.meta.dirname, '..');

describe('CHUNK-15 Personal Economy Agent isolation after treasury', () => {
  it('keeps the reserved agent owner and does not create competing agent packages', () => {
    assert.equal(existsSync(join(REPO_ROOT, 'packages/agent')), true);
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
    assert.equal(evaluateCapability(manifest, 'personal-economy-agent').status, 'IMPLEMENTED');
    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
      (evaluation) => evaluation.chunk === 'CHUNK-15',
    );
    assert.ok(declared);
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);
  });
});
