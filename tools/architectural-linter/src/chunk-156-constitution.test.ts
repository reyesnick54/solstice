import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { evaluateDeclaredChunks } from './constitution.ts';
import { evaluateCapability, loadManifest } from './manifest.ts';

const REPO_ROOT = join(import.meta.dirname, '../../..');

describe('CHUNK-156 unified control room constitution', () => {
  it('owns the control room inside packages/sunrey-chain/src/ops', () => {
    const declarationPath = join(REPO_ROOT, 'docs/architecture/chunks/chunk-156.json');
    assert.equal(existsSync(declarationPath), true);
    const declaration = JSON.parse(readFileSync(declarationPath, 'utf8')) as {
      readonly chunk: string;
      readonly requires: readonly string[];
    };
    assert.equal(declaration.chunk, 'CHUNK-156');
    assert.ok(declaration.requires.includes('sunrey-ops-resilience'));
    assert.ok(declaration.requires.includes('sunrey-production-provider-credential-plane'));
    assert.ok(declaration.requires.includes('evidence'));

    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'sunrey-ops-resilience').owner, 'packages/sunrey-chain');
    assert.equal(evaluateCapability(manifest, 'sunrey-unified-control-room').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-unified-control-room').owner, 'packages/sunrey-chain');

    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find((evaluation) => evaluation.chunk === 'CHUNK-156');
    assert.ok(declared, 'CHUNK-156 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    assert.equal(existsSync(join(REPO_ROOT, 'docs/operations/chunk-156-sunrey-control-room.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain/src/ops/control-room/index.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/observability')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/control-room')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sre')), false);
  });
});
