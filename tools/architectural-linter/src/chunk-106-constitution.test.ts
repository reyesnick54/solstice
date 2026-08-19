import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { evaluateDeclaredChunks } from './constitution.ts';
import { evaluateCapability, loadManifest } from './manifest.ts';

const REPO_ROOT = join(import.meta.dirname, '../../..');

describe('CHUNK-106 human contribution registry constitution', () => {
  it('extends the singular contribution capability instead of forking a registry', () => {
    const declarationPath = join(REPO_ROOT, 'docs/architecture/chunks/chunk-106.json');
    assert.equal(existsSync(declarationPath), true);
    const declaration = JSON.parse(readFileSync(declarationPath, 'utf8')) as {
      readonly chunk: string;
      readonly requires: readonly string[];
    };
    assert.equal(declaration.chunk, 'CHUNK-106');
    assert.ok(declaration.requires.includes('sunrey-human-economic-contributions'));

    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'sunrey-human-economic-contributions').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-human-economic-contributions').owner, 'packages/human-economic-contribution');
    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find((evaluation) => evaluation.chunk === 'CHUNK-106');
    assert.ok(declared, 'CHUNK-106 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    assert.equal(existsSync(join(REPO_ROOT, 'docs/economics/chunk-106-human-contribution-registry.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-106-human-contribution-registry.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/human-economic-contribution/src/registry.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/human-economic-contribution/src/port.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/human-contribution-registry')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/contribution-registry')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/human-economic-contribution-registry')), false);
  });
});
