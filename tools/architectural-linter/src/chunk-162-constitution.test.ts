import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { evaluateDeclaredChunks } from './constitution.ts';
import { evaluateCapability, loadManifest } from './manifest.ts';

const REPO_ROOT = join(import.meta.dirname, '../../..');

describe('CHUNK-162 production provider binding', () => {
  it('extends provider acceptance and runtime without a second owner package', () => {
    const declarationPath = join(REPO_ROOT, 'docs/architecture/chunks/chunk-162.json');
    assert.equal(existsSync(declarationPath), true);
    const declaration = JSON.parse(readFileSync(declarationPath, 'utf8')) as {
      readonly chunk: string;
      readonly requires: readonly string[];
    };
    assert.equal(declaration.chunk, 'CHUNK-162');
    assert.ok(declaration.requires.includes('sunrey-production-provider-acceptance'));
    assert.ok(declaration.requires.includes('sunrey-provider-runtime'));
    assert.ok(declaration.requires.includes('sunrey-production-provider-binding'));

    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'sunrey-production-provider-binding').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-production-provider-binding').owner, 'packages/sunrey-chain');
    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find((evaluation) => evaluation.chunk === 'CHUNK-162');
    assert.ok(declared, 'CHUNK-162 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    assert.equal(existsSync(join(REPO_ROOT, 'docs/operations/chunk-162-production-provider-binding.md')), true);
    assert.equal(
      existsSync(join(REPO_ROOT, 'packages/sunrey-chain/src/providers/production-binding/types.ts')),
      true,
    );
    assert.equal(existsSync(join(REPO_ROOT, 'packages/integrations-v2')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/vendor-connectivity')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/provider-manager')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/live-providers')), false);
  });
});
