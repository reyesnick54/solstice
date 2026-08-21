import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { evaluateDeclaredChunks } from './constitution.ts';
import { lintEngineeringClosure, parseCapabilityTable } from './engineering-closure-guards.ts';
import { capabilitySupersessionResolved, evaluateCapability, loadManifest } from './manifest.ts';

const REPO_ROOT = join(import.meta.dirname, '../../..');

describe('CHUNK-168 engineering closure constitution', () => {
  it('extends existing owners without a new architecture authority', () => {
    const declarationPath = join(REPO_ROOT, 'docs/architecture/chunks/chunk-168.json');
    assert.equal(existsSync(declarationPath), true);
    const declaration = JSON.parse(readFileSync(declarationPath, 'utf8')) as {
      readonly chunk: string;
      readonly requires: readonly string[];
    };
    assert.equal(declaration.chunk, 'CHUNK-168');
    assert.ok(declaration.requires.includes('sunrey-production-handoff'));
    assert.ok(declaration.requires.includes('architecture-linting'));

    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'sunrey-production-handoff').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'architecture-linting').status, 'IMPLEMENTED');
    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find((evaluation) => evaluation.chunk === 'CHUNK-168');
    assert.ok(declared);
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain/src/production-handoff/engineering-closure/types.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-core')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/platform-v2')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/final-architecture')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/super-app')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/everything')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/production-v2')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/moonrey-coin')), false);
  });

  it('resolves moonrey-coin as a superseded placeholder', () => {
    const manifest = loadManifest(REPO_ROOT);
    const moonrey = manifest.capabilities.find((row) => row.id === 'moonrey-coin');
    assert.ok(moonrey);
    assert.deepEqual(moonrey.supersededBy, ['sunrey-native-assets', 'moonrey-issuance-engine']);
    assert.equal(capabilitySupersessionResolved(manifest, 'moonrey-coin'), true);
    assert.equal(evaluateCapability(manifest, 'sunrey-native-assets').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'moonrey-issuance-engine').status, 'IMPLEMENTED');
  });

  it('keeps one current dependency-table row per capability', () => {
    const manifest = loadManifest(REPO_ROOT);
    const table = parseCapabilityTable(readFileSync(join(REPO_ROOT, 'docs/architecture/chunk-dependencies.md'), 'utf8'));
    assert.equal(new Set(table).size, table.length);
    assert.deepEqual([...table].sort(), [...manifest.capabilities.map((row) => row.id)].sort());
    assert.equal(lintEngineeringClosure(REPO_ROOT).length, 0);
  });
});
