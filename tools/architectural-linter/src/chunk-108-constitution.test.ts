import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { evaluateDeclaredChunks } from './constitution.ts';
import { evaluateCapability, loadManifest } from './manifest.ts';

const REPO_ROOT = join(import.meta.dirname, '../../..');

describe('CHUNK-108 human contribution monetary bridge constitution', () => {
  it('bridges contributions to existing MonetaryIssuanceAuthority without a second mint', () => {
    const declarationPath = join(
      REPO_ROOT,
      'docs/architecture/chunks/chunk-108-human-contribution-monetary-bridge.json',
    );
    assert.equal(existsSync(declarationPath), true);
    const declaration = JSON.parse(readFileSync(declarationPath, 'utf8')) as {
      readonly chunk: string;
      readonly requires: readonly string[];
    };
    assert.equal(declaration.chunk, 'CHUNK-108');
    assert.ok(declaration.requires.includes('sunrey-human-contribution-monetary-bridge'));
    assert.ok(declaration.requires.includes('sunrey-monetary-constitution'));

    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'sunrey-human-contribution-monetary-bridge').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-human-contribution-monetary-bridge').owner, 'packages/sunrey-chain');
    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find((evaluation) => evaluation.chunk === 'CHUNK-108');
    assert.ok(declared, 'CHUNK-108 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    assert.equal(existsSync(join(REPO_ROOT, 'docs/economics/chunk-108-human-contribution-monetary-bridge.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-108-human-contribution-monetary-bridge.md')), true);
    assert.equal(
      existsSync(join(REPO_ROOT, 'packages/sunrey-chain/src/economics/human-contribution-bridge/gate.ts')),
      true,
    );
    assert.equal(existsSync(join(REPO_ROOT, 'packages/human-contribution-mint')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/human-valuation-engine')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/peve-mint')), false);
  });
});
