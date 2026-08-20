import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { evaluateDeclaredChunks } from './constitution.ts';
import { evaluateCapability, loadManifest } from './manifest.ts';

const REPO_ROOT = join(import.meta.dirname, '../../..');

describe('CHUNK-139 HIN chain-anchor foundation constitution', () => {
  it('owns a narrow HIN adapter over the existing SunRey Chain', () => {
    const declarationPath = join(REPO_ROOT, 'docs/architecture/chunks/chunk-139.json');
    assert.equal(existsSync(declarationPath), true);
    const declaration = JSON.parse(readFileSync(declarationPath, 'utf8')) as {
      readonly chunk: string;
      readonly requires: readonly string[];
    };
    assert.equal(declaration.chunk, 'CHUNK-139');
    assert.ok(declaration.requires.includes('sunrey-human-information-network'));
    assert.ok(declaration.requires.includes('sunrey-hin-contribution-integration'));
    assert.ok(declaration.requires.includes('information-market'));
    assert.ok(declaration.requires.includes('sunrey-chain'));
    assert.ok(declaration.requires.includes('sunrey-economic-asset-registry'));
    assert.equal(declaration.requires.includes('sunrey-hin-chain-anchoring'), false);

    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'sunrey-hin-chain-anchoring').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-hin-chain-anchoring').owner, 'packages/information-market');
    assert.equal(evaluateCapability(manifest, 'sunrey-chain').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-human-information-network').owner, 'packages/information-market');
    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find((evaluation) => evaluation.chunk === 'CHUNK-139');
    assert.ok(declared, 'CHUNK-139 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    assert.equal(existsSync(join(REPO_ROOT, 'docs/economics/chunk-139-hin-chain-anchor-foundation.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-139-hin-chain-anchor-foundation.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/information-market/src/network/chain-anchor/adapter.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/hin-chain')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/information-blockchain')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/privacy-chain')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/consent-chain')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/human-data-ledger')), false);
  });
});
