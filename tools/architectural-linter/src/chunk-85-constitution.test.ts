import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { evaluateDeclaredChunks } from './constitution.ts';
import { evaluateCapability, loadManifest } from './manifest.ts';

const REPO_ROOT = join(import.meta.dirname, '../../..');

describe('CHUNK-85 production genesis ceremony constitution', () => {
  it('implements the SunRey production genesis ceremony package', () => {
    const declarationPath = join(REPO_ROOT, 'docs/architecture/chunks/chunk-85-production-genesis-ceremony.json');
    assert.equal(existsSync(declarationPath), true);
    const declaration = JSON.parse(readFileSync(declarationPath, 'utf8')) as {
      readonly chunk: string;
      readonly requires: readonly string[];
    };
    assert.equal(declaration.chunk, 'CHUNK-85');
    assert.ok(declaration.requires.includes('sunrey-production-genesis-ceremony'));

    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'sunrey-production-genesis-ceremony').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-production-genesis-ceremony').protected, true);
    assert.equal(evaluateCapability(manifest, 'sunrey-production-genesis-ceremony').owner, 'packages/sunrey-chain');
    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
      (evaluation) => evaluation.chunk === 'CHUNK-85',
    );
    assert.ok(declared, 'CHUNK-85 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-85-production-genesis-ceremony.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/mainnet/chunk-85-production-genesis-ceremony.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/mainnet/production-validator-dossier.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/mainnet/production-genesis-manifest.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/mainnet/genesis-authorization-package.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/mainnet/launch-authorization-dossier.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/runbooks/production-genesis-ceremony.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/runbooks/validator-production-onboarding.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain/src/production-ceremony/index.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-ceremony')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/production-genesis')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/genesis-ceremony')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/launch-authorization')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/production-ceremony')), false);
  });
});
