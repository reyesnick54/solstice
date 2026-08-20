import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { evaluateDeclaredChunks } from './constitution.ts';
import { evaluateCapability, loadManifest } from './manifest.ts';

const REPO_ROOT = join(import.meta.dirname, '../../..');

describe('CHUNK-158 full-platform production candidate', () => {
  it('extends the existing production-handoff owner without a second capability', () => {
    const declarationPath = join(REPO_ROOT, 'docs/architecture/chunks/chunk-158.json');
    assert.equal(existsSync(declarationPath), true);
    const declaration = JSON.parse(readFileSync(declarationPath, 'utf8')) as {
      readonly chunk: string;
      readonly requires: readonly string[];
    };
    assert.equal(declaration.chunk, 'CHUNK-158');
    assert.ok(declaration.requires.includes('sunrey-production-handoff'));
    assert.ok(declaration.requires.includes('sunrey-production-economic-activation-firewall'));
    assert.equal(declaration.requires.includes('sunrey-full-platform-candidate'), false);

    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'sunrey-production-handoff').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-production-handoff').owner, 'packages/sunrey-chain');
    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find((evaluation) => evaluation.chunk === 'CHUNK-158');
    assert.ok(declared, 'CHUNK-158 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    assert.equal(
      existsSync(join(REPO_ROOT, 'docs/operations/chunk-158-full-platform-production-candidate.md')),
      true,
    );
    assert.equal(
      existsSync(join(REPO_ROOT, 'packages/sunrey-chain/src/production-handoff/full-platform-candidate/types.ts')),
      true,
    );
    assert.equal(existsSync(join(REPO_ROOT, 'packages/full-platform')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/mainnet-v2')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/production-ready')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/launch-v2')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/system-rc')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-production')), false);
  });
});
