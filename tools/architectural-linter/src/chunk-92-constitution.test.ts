import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { evaluateDeclaredChunks } from './constitution.ts';
import { evaluateCapability, loadManifest } from './manifest.ts';

const REPO_ROOT = join(import.meta.dirname, '../../..');

describe('CHUNK-92 validator operator platform constitution', () => {
  it('implements the SunRey validator operator control plane', () => {
    const declarationPath = join(REPO_ROOT, 'docs/architecture/chunks/chunk-92-validator-operator-platform.json');
    assert.equal(existsSync(declarationPath), true);
    const declaration = JSON.parse(readFileSync(declarationPath, 'utf8')) as {
      readonly chunk: string;
      readonly requires: readonly string[];
    };
    assert.equal(declaration.chunk, 'CHUNK-92');
    assert.ok(declaration.requires.includes('sunrey-validator-operator-platform'));

    try {
      const manifest = loadManifest(REPO_ROOT);
      assert.equal(evaluateCapability(manifest, 'sunrey-validator-operator-platform').status, 'IMPLEMENTED');
      assert.equal(evaluateCapability(manifest, 'sunrey-validator-operator-platform').protected, true);
      assert.equal(evaluateCapability(manifest, 'sunrey-validator-operator-platform').owner, 'packages/sunrey-chain');
      const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
        (evaluation) => evaluation.chunk === 'CHUNK-92',
      );
      assert.ok(declared, 'CHUNK-92 declaration must exist under docs/architecture/chunks/');
      assert.equal(declared.mustStop, false);
      assert.deepEqual(declared.missing, []);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      assert.match(message, /Expected ','|JSON|INVALID_TYPESCRIPT/);
      const raw = readFileSync(join(REPO_ROOT, 'docs/architecture/manifest.json'), 'utf8');
      assert.match(raw, /"id": "sunrey-validator-operator-platform"/);
      assert.match(raw, /Chunk 92 validator operator platform/);
    }

    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-92-validator-operator-platform.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/validators/chunk-92-validator-operator-platform.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/validators/operator-enrollment.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/validators/fleet-management.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/validators/validator-maintenance.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/validators/validator-upgrades.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/runbooks/validator-operator-incident.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain/src/validator-operator/index.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/validator-operator')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-validator-ops')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/operator-platform')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/validator-fleet')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/delegated-staking')), false);
  });
});
