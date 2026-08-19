import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { evaluateDeclaredChunks } from './constitution.ts';
import { evaluateCapability, loadManifest } from './manifest.ts';

const REPO_ROOT = join(import.meta.dirname, '../../..');

describe('CHUNK-111 human contribution valuation engine constitution', () => {
  it('extends the Chunk 110 valuation capability at the canonical owner', () => {
    const declarationPath = join(REPO_ROOT, 'docs/architecture/chunks/chunk-111.json');
    assert.equal(existsSync(declarationPath), true);
    const declaration = JSON.parse(readFileSync(declarationPath, 'utf8')) as {
      readonly chunk: string;
      readonly requires: readonly string[];
    };
    assert.equal(declaration.chunk, 'CHUNK-111');
    assert.ok(declaration.requires.includes('sunrey-human-contribution-valuation'));
    assert.ok(declaration.requires.includes('sunrey-human-economic-contributions'));

    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'sunrey-human-contribution-valuation').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-human-contribution-valuation').owner, 'packages/human-economic-contribution');
    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find((evaluation) => evaluation.chunk === 'CHUNK-111');
    assert.ok(declared, 'CHUNK-111 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    assert.equal(existsSync(join(REPO_ROOT, 'docs/economics/chunk-111-human-contribution-valuation-engine.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-111-human-contribution-valuation-engine.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/human-economic-contribution/src/valuation/engine.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/human-valuation-engine')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/contribution-valuation')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/human-contribution-valuation')), false);
  });
});
