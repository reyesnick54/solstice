import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { evaluateDeclaredChunks } from './constitution.ts';
import { evaluateCapability, loadManifest } from './manifest.ts';

const REPO_ROOT = join(import.meta.dirname, '../../..');

describe('CHUNK-163 production economic authorization', () => {
  it('extends production-activation and governance-ops without a second mint', () => {
    const declarationPath = join(REPO_ROOT, 'docs/architecture/chunks/chunk-163.json');
    assert.equal(existsSync(declarationPath), true);
    const declaration = JSON.parse(readFileSync(declarationPath, 'utf8')) as {
      readonly chunk: string;
      readonly requires: readonly string[];
    };
    assert.equal(declaration.chunk, 'CHUNK-163');
    assert.ok(declaration.requires.includes('sunrey-production-economic-activation-firewall'));
    assert.ok(declaration.requires.includes('sunrey-production-economic-parameters'));
    assert.ok(declaration.requires.includes('sunrey-governance-operations'));
    assert.ok(declaration.requires.includes('sunrey-production-economic-authorization'));

    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'sunrey-production-economic-authorization').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-production-economic-authorization').owner, 'packages/sunrey-chain');
    assert.equal(evaluateCapability(manifest, 'sunrey-governance-operations').status, 'IMPLEMENTED');
    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find((evaluation) => evaluation.chunk === 'CHUNK-163');
    assert.ok(declared, 'CHUNK-163 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    assert.equal(
      existsSync(join(REPO_ROOT, 'docs/economics/chunk-163-production-economic-authorization.md')),
      true,
    );
    assert.equal(
      existsSync(join(REPO_ROOT, 'packages/sunrey-chain/src/economics/production-activation/authorization/types.ts')),
      true,
    );
    assert.equal(existsSync(join(REPO_ROOT, 'packages/tokenomics')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/economic-governance-v2')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/monetary-policy-v2')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/production-authorization')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/mint-governance')), false);
  });
});
