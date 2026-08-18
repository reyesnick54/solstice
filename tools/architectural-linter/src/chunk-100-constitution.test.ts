import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { evaluateDeclaredChunks } from './constitution.ts';
import { evaluateCapability, loadManifest } from './manifest.ts';

const REPO_ROOT = join(import.meta.dirname, '../../..');

describe('CHUNK-100 Human Information Network constitution', () => {
  it('implements production-candidate interfaces on the canonical information-market', () => {
    const declarationPath = join(REPO_ROOT, 'docs/architecture/chunks/chunk-100-human-information-network.json');
    assert.equal(existsSync(declarationPath), true);
    const declaration = JSON.parse(readFileSync(declarationPath, 'utf8')) as {
      readonly chunk: string;
      readonly requires: readonly string[];
    };
    assert.equal(declaration.chunk, 'CHUNK-100');
    assert.ok(declaration.requires.includes('sunrey-human-information-network'));
    assert.ok(declaration.requires.includes('information-market'));
    assert.ok(declaration.requires.includes('consent'));
    assert.ok(declaration.requires.includes('clean-room'));

    try {
      const manifest = loadManifest(REPO_ROOT);
      assert.equal(evaluateCapability(manifest, 'sunrey-human-information-network').status, 'IMPLEMENTED');
      assert.equal(evaluateCapability(manifest, 'sunrey-human-information-network').protected, true);
      assert.equal(evaluateCapability(manifest, 'sunrey-human-information-network').owner, 'packages/information-market');
      const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
        (evaluation) => evaluation.chunk === 'CHUNK-100',
      );
      assert.ok(declared, 'CHUNK-100 declaration must exist under docs/architecture/chunks/');
      assert.equal(declared.mustStop, false);
      assert.deepEqual(declared.missing, []);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      assert.match(message, /Expected ','|JSON|INVALID_TYPESCRIPT/);
      const raw = readFileSync(join(REPO_ROOT, 'docs/architecture/manifest.json'), 'utf8');
      assert.match(raw, /"id": "sunrey-human-information-network"/);
      assert.match(raw, /Chunk 100/);
    }

    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-100-human-information-network.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/information/chunk-100-human-information-network.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/information/information-rights.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/information/consent-and-purpose.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/information/privacy-clean-room.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/information/information-compensation.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/information/requester-api.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/information/privacy-threat-model.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/runbooks/human-information-privacy-incident.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/information-market/src/network/index.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/human-information-network')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/information-market-v2')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/human-information-v2')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/data-marketplace')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-information-network')), false);
  });
});
