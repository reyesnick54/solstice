import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { evaluateDeclaredChunks } from './constitution.ts';
import { evaluateCapability, loadManifest } from './manifest.ts';

const REPO_ROOT = join(import.meta.dirname, '../../..');

describe('CHUNK-165 launch authorization ceremony constitution', () => {
  it('extends the existing production genesis ceremony without a second owner', () => {
    const declarationPath = join(REPO_ROOT, 'docs/architecture/chunks/chunk-165.json');
    assert.equal(existsSync(declarationPath), true);
    const declaration = JSON.parse(readFileSync(declarationPath, 'utf8')) as {
      readonly chunk: string;
      readonly requires: readonly string[];
    };
    assert.equal(declaration.chunk, 'CHUNK-165');
    assert.ok(declaration.requires.includes('sunrey-production-genesis-ceremony'));
    assert.ok(declaration.requires.includes('sunrey-production-economic-authorization'));

    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'sunrey-production-genesis-ceremony').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-production-genesis-ceremony').protected, true);
    assert.equal(evaluateCapability(manifest, 'sunrey-production-genesis-ceremony').owner, 'packages/sunrey-chain');
    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
      (evaluation) => evaluation.chunk === 'CHUNK-165',
    );
    assert.ok(declared, 'CHUNK-165 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    assert.equal(
      existsSync(join(REPO_ROOT, 'docs/operations/chunk-165-launch-authorization-ceremony.md')),
      true,
    );
    assert.equal(
      existsSync(join(REPO_ROOT, 'packages/sunrey-chain/src/production-ceremony/launch-candidate/types.ts')),
      true,
    );
    assert.equal(existsSync(join(REPO_ROOT, 'packages/ceremony-v2')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/launch-signing')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/genesis-authority')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/mainnet-ceremony')), false);
  });
});
