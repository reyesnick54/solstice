import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { evaluateDeclaredChunks } from './constitution.ts';
import { evaluateCapability, loadManifest } from './manifest.ts';

const REPO_ROOT = join(import.meta.dirname, '../../..');

describe('CHUNK-110 human contribution valuation constitution', () => {
  it('implements the valuation constitution without a second valuation engine or mint', () => {
    const declarationPath = join(
      REPO_ROOT,
      'docs/architecture/chunks/chunk-110.json',
    );
    assert.equal(existsSync(declarationPath), true);
    const declaration = JSON.parse(readFileSync(declarationPath, 'utf8')) as {
      readonly chunk: string;
      readonly requires: readonly string[];
    };
    assert.equal(declaration.chunk, 'CHUNK-110');
    assert.ok(declaration.requires.includes('sunrey-human-contribution-valuation'));
    assert.ok(declaration.requires.includes('sunrey-human-economic-contributions'));
    assert.ok(declaration.requires.includes('personal-economic-value-engine'));

    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'sunrey-human-contribution-valuation').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-human-contribution-valuation').protected, true);
    assert.equal(
      evaluateCapability(manifest, 'sunrey-human-contribution-valuation').owner,
      'packages/human-economic-contribution',
    );
    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find((evaluation) => evaluation.chunk === 'CHUNK-110');
    assert.ok(declared, 'CHUNK-110 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    assert.equal(existsSync(join(REPO_ROOT, 'docs/economics/chunk-110-human-contribution-valuation-constitution.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-110-human-contribution-valuation-constitution.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/human-economic-contribution/src/valuation/constitution.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/human-economic-contribution/src/valuation/registry.ts')), true);
    const valuationComponent = manifest.components.find((component) => component.id === 'sunrey-human-contribution-valuation');
    assert.equal(valuationComponent?.canonicalPath, 'packages/human-economic-contribution/src/valuation/registry.ts');
    assert.equal(existsSync(join(REPO_ROOT, 'packages/human-valuation-engine')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/contribution-valuation')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/human-valuation')), false);
  });
});
