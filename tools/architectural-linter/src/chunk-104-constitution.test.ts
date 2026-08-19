import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { evaluateDeclaredChunks } from './constitution.ts';
import { evaluateCapability, loadManifest } from './manifest.ts';

const REPO_ROOT = join(import.meta.dirname, '../../..');

describe('CHUNK-104 SunRey human contribution ontology constitution', () => {
  it('implements the ontology without a second valuation or mint authority', () => {
    const declarationPath = join(
      REPO_ROOT,
      'docs/architecture/chunks/chunk-104-human-contribution-ontology.json',
    );
    assert.equal(existsSync(declarationPath), true);
    const declaration = JSON.parse(readFileSync(declarationPath, 'utf8')) as {
      readonly chunk: string;
      readonly requires: readonly string[];
    };
    assert.equal(declaration.chunk, 'CHUNK-104');
    assert.ok(declaration.requires.includes('sunrey-human-economic-contributions'));
    assert.ok(declaration.requires.includes('personal-economic-value-engine'));
    assert.ok(declaration.requires.includes('sunrey-human-information-network'));

    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'sunrey-human-economic-contributions').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-human-economic-contributions').protected, true);
    assert.equal(
      evaluateCapability(manifest, 'sunrey-human-economic-contributions').owner,
      'packages/human-economic-contribution',
    );
    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find((evaluation) => evaluation.chunk === 'CHUNK-104');
    assert.ok(declared, 'CHUNK-104 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    assert.equal(existsSync(join(REPO_ROOT, 'docs/economics/chunk-104-human-contribution-ontology.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-104-human-contribution-ontology.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/human-economic-contribution/src/index.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/human-contribution')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/human-economic-contribution-v2')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/contribution-ontology')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/human-worth')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/contribution-valuation')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/human-contribution-score')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-contribution')), false);
  });
});
