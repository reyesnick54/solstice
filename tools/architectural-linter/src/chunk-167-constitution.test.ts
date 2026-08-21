import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { evaluateDeclaredChunks } from './constitution.ts';
import { evaluateCapability, loadManifest } from './manifest.ts';

const REPO_ROOT = join(import.meta.dirname, '../../..');

describe('CHUNK-167 launch abort and recovery', () => {
  it('extends governance-ops, post-genesis, and production-handoff without a second emergency authority', () => {
    const declarationPath = join(REPO_ROOT, 'docs/architecture/chunks/chunk-167.json');
    assert.equal(existsSync(declarationPath), true);
    const declaration = JSON.parse(readFileSync(declarationPath, 'utf8')) as {
      readonly chunk: string;
      readonly requires: readonly string[];
    };
    assert.equal(declaration.chunk, 'CHUNK-167');
    assert.ok(declaration.requires.includes('sunrey-governance-operations'));
    assert.ok(declaration.requires.includes('sunrey-post-genesis-stabilization'));
    assert.ok(declaration.requires.includes('sunrey-production-handoff'));
    assert.equal(declaration.requires.includes('sunrey-kill-switch'), false);
    assert.equal(declaration.requires.includes('sunrey-emergency-admin'), false);

    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'sunrey-governance-operations').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-post-genesis-stabilization').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-production-handoff').status, 'IMPLEMENTED');
    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find((evaluation) => evaluation.chunk === 'CHUNK-167');
    assert.ok(declared, 'CHUNK-167 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    assert.equal(existsSync(join(REPO_ROOT, 'docs/operations/chunk-167-launch-abort-recovery.md')), true);
    assert.equal(
      existsSync(join(REPO_ROOT, 'packages/sunrey-chain/src/governance-ops/launch-abort/types.ts')),
      true,
    );
    assert.equal(existsSync(join(REPO_ROOT, 'packages/kill-switch')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/emergency-admin')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/rollback-engine')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/incident-v2')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/recovery-v2')), false);
  });
});
