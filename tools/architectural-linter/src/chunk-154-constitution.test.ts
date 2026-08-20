import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { evaluateDeclaredChunks } from './constitution.ts';
import { evaluateCapability, loadManifest } from './manifest.ts';

const REPO_ROOT = join(import.meta.dirname, '../../..');

describe('CHUNK-154 operational persistence recovery constitution', () => {
  it('owns recovery inside packages/persistence', () => {
    const declarationPath = join(REPO_ROOT, 'docs/architecture/chunks/chunk-154.json');
    assert.equal(existsSync(declarationPath), true);
    const declaration = JSON.parse(readFileSync(declarationPath, 'utf8')) as {
      readonly chunk: string;
      readonly requires: readonly string[];
    };
    assert.equal(declaration.chunk, 'CHUNK-154');
    assert.ok(declaration.requires.includes('persistence'));
    assert.ok(declaration.requires.includes('ledger'));
    assert.ok(declaration.requires.includes('sunrey-production-storage'));

    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'persistence').owner, 'packages/persistence');
    assert.equal(evaluateCapability(manifest, 'sunrey-operational-persistence-recovery').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-operational-persistence-recovery').owner, 'packages/persistence');

    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find((evaluation) => evaluation.chunk === 'CHUNK-154');
    assert.ok(declared, 'CHUNK-154 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    assert.equal(
      existsSync(join(REPO_ROOT, 'docs/architecture/chunk-154-operational-persistence-recovery.md')),
      true,
    );
    assert.equal(existsSync(join(REPO_ROOT, 'packages/persistence/src/production/recovery/index.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/database-v2')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/state-store')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/durable-state')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/operational-ledger')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/financial-database')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/persistence-v2')), false);
  });
});
