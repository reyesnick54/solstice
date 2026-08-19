import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { evaluateDeclaredChunks } from './constitution.ts';
import { evaluateCapability, loadManifest } from './manifest.ts';

const REPO_ROOT = join(import.meta.dirname, '../../..');

describe('CHUNK-101 SunRey AI runtime constitution', () => {
  it('implements the inference plane without a second financial agent', () => {
    const declarationPath = join(REPO_ROOT, 'docs/architecture/chunks/chunk-101-ai-runtime.json');
    assert.equal(existsSync(declarationPath), true);
    const declaration = JSON.parse(readFileSync(declarationPath, 'utf8')) as {
      readonly chunk: string;
      readonly requires: readonly string[];
    };
    assert.equal(declaration.chunk, 'CHUNK-101');
    assert.ok(declaration.requires.includes('sunrey-ai-runtime'));
    assert.ok(declaration.requires.includes('sunrey-user-agent-mandates'));
    assert.ok(declaration.requires.includes('model-registry'));

    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'sunrey-ai-runtime').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-ai-runtime').protected, true);
    assert.equal(evaluateCapability(manifest, 'sunrey-ai-runtime').owner, 'packages/ai-runtime');
    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find((evaluation) => evaluation.chunk === 'CHUNK-101');
    assert.ok(declared, 'CHUNK-101 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    assert.equal(existsSync(join(REPO_ROOT, 'docs/ai/chunk-101-ai-runtime.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-101-ai-runtime.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/ai-runtime/src/index.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/ai-engine')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/model-runtime')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/grok-runtime')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/s3m')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/llm')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/inference-v2')), false);
  });
});
