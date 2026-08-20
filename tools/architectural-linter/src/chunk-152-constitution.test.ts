import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { evaluateDeclaredChunks } from './constitution.ts';
import { evaluateCapability, loadManifest } from './manifest.ts';

const REPO_ROOT = join(import.meta.dirname, '../../..');

describe('CHUNK-152 regulated provider candidates', () => {
  it('adds sunrey-regulated-provider-candidates without replacing canonical owners', () => {
    const declarationPath = join(REPO_ROOT, 'docs/architecture/chunks/chunk-152.json');
    assert.equal(existsSync(declarationPath), true);
    const declaration = JSON.parse(readFileSync(declarationPath, 'utf8')) as {
      readonly chunk: string;
      readonly requires: readonly string[];
    };
    assert.equal(declaration.chunk, 'CHUNK-152');
    assert.ok(declaration.requires.includes('identity'));
    assert.ok(declaration.requires.includes('compliance-screening'));
    assert.ok(declaration.requires.includes('custody'));
    assert.ok(declaration.requires.includes('market-surveillance'));

    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'identity').owner, 'packages/identity');
    assert.equal(evaluateCapability(manifest, 'compliance-screening').owner, 'packages/kernel');
    assert.equal(evaluateCapability(manifest, 'custody').owner, 'packages/custody');
    assert.equal(evaluateCapability(manifest, 'market-surveillance').owner, 'packages/market-surveillance');
    assert.equal(evaluateCapability(manifest, 'sunrey-regulated-provider-candidates').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-regulated-provider-candidates').owner, 'packages/kernel');

    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find((evaluation) => evaluation.chunk === 'CHUNK-152');
    assert.ok(declared, 'CHUNK-152 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    assert.equal(existsSync(join(REPO_ROOT, 'docs/compliance/chunk-152-regulated-provider-candidates.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/kyc')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/aml')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sanctions')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/compliance-v2')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/regtech')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/travel-rule-v2')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/surveillance-v2')), false);
  });
});
