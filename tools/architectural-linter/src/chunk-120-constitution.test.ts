import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { evaluateDeclaredChunks } from './constitution.ts';
import { evaluateCapability, loadManifest } from './manifest.ts';

const REPO_ROOT = join(import.meta.dirname, '../../..');

describe('CHUNK-120 productive economic event identity constitution', () => {
  it('owns one attribution graph inside packages/sunrey-chain policy-governance', () => {
    const declarationPath = join(REPO_ROOT, 'docs/architecture/chunks/chunk-120.json');
    assert.equal(existsSync(declarationPath), true);
    const declaration = JSON.parse(readFileSync(declarationPath, 'utf8')) as {
      readonly chunk: string;
      readonly requires: readonly string[];
    };
    assert.equal(declaration.chunk, 'CHUNK-120');
    assert.ok(declaration.requires.includes('moonrey-economic-event-attribution'));
    assert.ok(declaration.requires.includes('moonrey-policy-governance'));
    assert.ok(declaration.requires.includes('sunrey-productive-capacity'));
    assert.ok(declaration.requires.includes('sunrey-economic-asset-registry'));

    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'moonrey-economic-event-attribution').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'moonrey-economic-event-attribution').owner, 'packages/sunrey-chain');
    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find((evaluation) => evaluation.chunk === 'CHUNK-120');
    assert.ok(declared, 'CHUNK-120 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    assert.equal(existsSync(join(REPO_ROOT, 'docs/economics/chunk-120-productive-economic-event-identity.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-120-productive-economic-event-identity.md')), true);
    assert.equal(
      existsSync(join(REPO_ROOT, 'packages/sunrey-chain/src/productive/policy-governance/attribution/index.ts')),
      true,
    );
    assert.equal(existsSync(join(REPO_ROOT, 'packages/moonrey-attribution')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/economic-event-graph')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/deduplication-engine')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/productive-attribution-v2')), false);
  });
});
