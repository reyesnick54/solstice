import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { evaluateDeclaredChunks } from './constitution.ts';
import { evaluateCapability, loadManifest } from './manifest.ts';

const REPO_ROOT = join(import.meta.dirname, '../../..');

describe('CHUNK-148 production economic constitution candidate', () => {
  it('extends the existing economic RC owner without a second capability', () => {
    const declarationPath = join(REPO_ROOT, 'docs/architecture/chunks/chunk-148.json');
    assert.equal(existsSync(declarationPath), true);
    const declaration = JSON.parse(readFileSync(declarationPath, 'utf8')) as {
      readonly chunk: string;
      readonly requires: readonly string[];
    };
    assert.equal(declaration.chunk, 'CHUNK-148');
    assert.ok(declaration.requires.includes('sunrey-economic-rc'));
    assert.ok(declaration.requires.includes('sunrey-production-economic-activation-firewall'));
    assert.equal(declaration.requires.includes('sunrey-production-economic-constitution'), false);

    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'sunrey-economic-rc').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-economic-rc').owner, 'packages/sunrey-chain');
    assert.equal(evaluateCapability(manifest, 'sunrey-production-economic-activation-firewall').status, 'IMPLEMENTED');
    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find((evaluation) => evaluation.chunk === 'CHUNK-148');
    assert.ok(declared, 'CHUNK-148 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    assert.equal(
      existsSync(join(REPO_ROOT, 'docs/economics/chunk-148-production-economic-constitution-candidate.md')),
      true,
    );
    assert.equal(
      existsSync(
        join(REPO_ROOT, 'packages/sunrey-chain/src/release-candidate/economic/production-constitution/types.ts'),
      ),
      true,
    );
    assert.equal(existsSync(join(REPO_ROOT, 'packages/economic-constitution')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/economic-rc-v2')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/tokenomics-release')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/dual-economy-release')), false);
  });
});
