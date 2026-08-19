import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { evaluateDeclaredChunks } from './constitution.ts';
import { evaluateCapability, loadManifest } from './manifest.ts';

const REPO_ROOT = join(import.meta.dirname, '../../..');

describe('CHUNK-102 S3M primary provider constitution', () => {
  it('implements S3M as an adapter on the canonical AI runtime', () => {
    const declarationPath = join(REPO_ROOT, 'docs/architecture/chunks/chunk-102-s3m-provider.json');
    assert.equal(existsSync(declarationPath), true);
    const declaration = JSON.parse(readFileSync(declarationPath, 'utf8')) as {
      readonly chunk: string;
      readonly requires: readonly string[];
    };
    assert.equal(declaration.chunk, 'CHUNK-102');
    assert.ok(declaration.requires.includes('sunrey-s3m-provider'));
    assert.ok(declaration.requires.includes('sunrey-ai-runtime'));
    assert.ok(declaration.requires.includes('sunrey-user-agent-mandates'));

    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'sunrey-s3m-provider').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-s3m-provider').owner, 'packages/ai-runtime');
    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find((evaluation) => evaluation.chunk === 'CHUNK-102');
    assert.ok(declared, 'CHUNK-102 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    assert.equal(existsSync(join(REPO_ROOT, 'docs/ai/chunk-102-s3m-provider.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-102-s3m-provider.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/ai-runtime/src/providers/s3m/adapter.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/s3m')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/ai-engine')), false);
  });
});
