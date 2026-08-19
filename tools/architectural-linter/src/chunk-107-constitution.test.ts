import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { evaluateDeclaredChunks } from './constitution.ts';
import { evaluateCapability, loadManifest } from './manifest.ts';

const REPO_ROOT = join(import.meta.dirname, '../../..');

describe('CHUNK-107 HIN contribution integration constitution', () => {
  it('implements a narrow HIN adapter on the information-market owner', () => {
    const declarationPath = join(REPO_ROOT, 'docs/architecture/chunks/chunk-107.json');
    assert.equal(existsSync(declarationPath), true);
    const declaration = JSON.parse(readFileSync(declarationPath, 'utf8')) as {
      readonly chunk: string;
      readonly requires: readonly string[];
    };
    assert.equal(declaration.chunk, 'CHUNK-107');
    assert.ok(declaration.requires.includes('sunrey-hin-contribution-integration'));
    assert.ok(declaration.requires.includes('sunrey-human-information-network'));
    assert.ok(declaration.requires.includes('information-market'));
    assert.ok(declaration.requires.includes('consent'));
    assert.ok(declaration.requires.includes('clean-room'));

    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'sunrey-hin-contribution-integration').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-hin-contribution-integration').owner, 'packages/information-market');
    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find((evaluation) => evaluation.chunk === 'CHUNK-107');
    assert.ok(declared, 'CHUNK-107 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    assert.equal(existsSync(join(REPO_ROOT, 'docs/economics/chunk-107-hin-contribution-integration.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-107-hin-contribution-integration.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/information-market/src/network/contribution/adapter.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/hin-contribution-registry')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/information-contribution-v2')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/human-information-contribution')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/human-information-network')), false);
  });
});
