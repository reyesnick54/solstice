import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { evaluateDeclaredChunks } from './constitution.ts';
import { evaluateCapability, loadManifest } from './manifest.ts';

const REPO_ROOT = join(import.meta.dirname, '../../..');

describe('CHUNK-146 MoonRey production issuance candidate constitution', () => {
  it('owns production-candidate policy inside existing sunrey-chain owners', () => {
    const declarationPath = join(REPO_ROOT, 'docs/architecture/chunks/chunk-146.json');
    assert.equal(existsSync(declarationPath), true);
    const declaration = JSON.parse(readFileSync(declarationPath, 'utf8')) as {
      readonly chunk: string;
      readonly requires: readonly string[];
    };
    assert.equal(declaration.chunk, 'CHUNK-146');
    assert.ok(declaration.requires.includes('moonrey-production-issuance-policy-candidate'));
    assert.ok(declaration.requires.includes('moonrey-productive-value-function'));
    assert.ok(declaration.requires.includes('moonrey-productive-value-settlement'));
    assert.ok(declaration.requires.includes('sunrey-production-economic-activation-firewall'));
    assert.ok(declaration.requires.includes('sunrey-monetary-constitution'));

    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'moonrey-production-issuance-policy-candidate').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'moonrey-production-issuance-policy-candidate').owner, 'packages/sunrey-chain');
    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find((evaluation) => evaluation.chunk === 'CHUNK-146');
    assert.ok(declared, 'CHUNK-146 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    assert.equal(existsSync(join(REPO_ROOT, 'docs/economics/chunk-146-moonrey-production-policy-candidate.md')), true);
    assert.equal(
      existsSync(join(REPO_ROOT, 'packages/sunrey-chain/src/productive/policy-governance/value-function/production-candidate/index.ts')),
      true,
    );
    assert.equal(
      existsSync(join(REPO_ROOT, 'packages/sunrey-chain/src/productive/policy-governance/value-settlement/production-candidate/index.ts')),
      true,
    );
    assert.equal(existsSync(join(REPO_ROOT, 'packages/moonrey-production-tokenomics')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/gpuv-conversion')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/moonrey-issuance-policy')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/production-value-function')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/moonrey-production-policy')), false);
  });
});
