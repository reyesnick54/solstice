import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { evaluateDeclaredChunks } from './constitution.ts';
import { evaluateCapability, loadManifest } from './manifest.ts';

const REPO_ROOT = join(import.meta.dirname, '../../..');

describe('CHUNK-155 distributed idempotency recovery constitution', () => {
  it('extends events and persistence without a saga-engine owner', () => {
    const declarationPath = join(REPO_ROOT, 'docs/architecture/chunks/chunk-155.json');
    assert.equal(existsSync(declarationPath), true);
    const declaration = JSON.parse(readFileSync(declarationPath, 'utf8')) as {
      readonly chunk: string;
      readonly requires: readonly string[];
    };
    assert.equal(declaration.chunk, 'CHUNK-155');
    assert.ok(declaration.requires.includes('events'));
    assert.ok(declaration.requires.includes('event-fabric'));
    assert.ok(declaration.requires.includes('persistence'));

    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'events').owner, 'packages/events');
    assert.equal(evaluateCapability(manifest, 'sunrey-distributed-idempotency-recovery').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-distributed-idempotency-recovery').owner, 'packages/events');

    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
      (evaluation) => evaluation.chunk === 'CHUNK-155',
    );
    assert.ok(declared, 'CHUNK-155 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    assert.equal(
      existsSync(join(REPO_ROOT, 'docs/architecture/chunk-155-distributed-idempotency-recovery.md')),
      true,
    );
    assert.equal(existsSync(join(REPO_ROOT, 'packages/events/src/operation/index.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/persistence/src/operations/pg-operation-store.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/saga-engine')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/workflow-v2')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/idempotency-service')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/transaction-manager')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/distributed-ledger')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/exactly-once')), false);
  });
});
