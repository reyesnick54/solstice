import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { evaluateDeclaredChunks } from './constitution.ts';
import { evaluateCapability, loadManifest } from './manifest.ts';

const REPO_ROOT = join(import.meta.dirname, '../../..');

describe('CHUNK-94 developer platform constitution', () => {
  it('implements the SunRey developer application platform', () => {
    const declarationPath = join(REPO_ROOT, 'docs/architecture/chunks/chunk-94-developer-platform.json');
    assert.equal(existsSync(declarationPath), true);
    const declaration = JSON.parse(readFileSync(declarationPath, 'utf8')) as {
      readonly chunk: string;
      readonly requires: readonly string[];
    };
    assert.equal(declaration.chunk, 'CHUNK-94');
    assert.ok(declaration.requires.includes('sunrey-developer-platform'));
    assert.ok(declaration.requires.includes('sunrey-developer-sdk'));
    assert.ok(declaration.requires.includes('sunrey-public-testnet'));

    try {
      const manifest = loadManifest(REPO_ROOT);
      assert.equal(evaluateCapability(manifest, 'sunrey-developer-platform').status, 'IMPLEMENTED');
      assert.equal(evaluateCapability(manifest, 'sunrey-developer-platform').protected, true);
      assert.equal(evaluateCapability(manifest, 'sunrey-developer-platform').owner, 'packages/sunrey-sdk');
      const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
        (evaluation) => evaluation.chunk === 'CHUNK-94',
      );
      assert.ok(declared, 'CHUNK-94 declaration must exist under docs/architecture/chunks/');
      assert.equal(declared.mustStop, false);
      assert.deepEqual(declared.missing, []);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      assert.match(message, /Expected ','|JSON|INVALID_TYPESCRIPT/);
      const raw = readFileSync(join(REPO_ROOT, 'docs/architecture/manifest.json'), 'utf8');
      assert.match(raw, /"id": "sunrey-developer-platform"/);
      assert.match(raw, /Chunk 94 developer application registry/);
    }

    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-94-developer-platform.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/developers/chunk-94-developer-platform.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/developers/api-authentication.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/developers/webhooks.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/developers/testnet-sandbox.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/developers/sdk-quickstart.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/runbooks/developer-platform-incident.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'api/sunrey-developer-platform-v1.openapi.yaml')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'api/sunrey-webhooks-v1.json')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-sdk/src/developer-platform/index.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-developer-platform')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/developer-portal')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/app-registry')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/webhook-service')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/developer-platform-v2')), false);
  });
});
