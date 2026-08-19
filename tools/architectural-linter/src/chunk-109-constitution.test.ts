import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { evaluateDeclaredChunks } from './constitution.ts';
import { evaluateCapability, loadManifest } from './manifest.ts';

const REPO_ROOT = join(import.meta.dirname, '../../..');

describe('CHUNK-109 human contribution verification constitution', () => {
  it('extends the existing contribution owner instead of forking a verifier', () => {
    const declarationPath = join(REPO_ROOT, 'docs/architecture/chunks/chunk-109.json');
    assert.equal(existsSync(declarationPath), true);
    const declaration = JSON.parse(readFileSync(declarationPath, 'utf8')) as {
      readonly chunk: string;
      readonly requires: readonly string[];
    };
    assert.equal(declaration.chunk, 'CHUNK-109');
    assert.ok(declaration.requires.includes('sunrey-human-economic-contributions'));
    assert.ok(declaration.requires.includes('sunrey-human-contribution-verification'));

    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'sunrey-human-contribution-verification').status, 'IMPLEMENTED');
    assert.equal(
      evaluateCapability(manifest, 'sunrey-human-contribution-verification').owner,
      'packages/human-economic-contribution',
    );
    assert.equal(evaluateCapability(manifest, 'sunrey-human-economic-contributions').owner, 'packages/human-economic-contribution');
    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find((evaluation) => evaluation.chunk === 'CHUNK-109');
    assert.ok(declared, 'CHUNK-109 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    assert.equal(existsSync(join(REPO_ROOT, 'docs/economics/chunk-109-human-contribution-verification.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-109-human-contribution-verification.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/human-economic-contribution/src/verification/engine.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/human-contribution-verification')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/contribution-verification')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/human-worth')), false);
  });
});
