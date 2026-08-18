import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { evaluateDeclaredChunks } from './constitution.ts';
import { evaluateCapability, loadManifest } from './manifest.ts';

const REPO_ROOT = join(import.meta.dirname, '../../..');

describe('CHUNK-95 exchange market operations constitution', () => {
  it('implements institutional market operations on the canonical Exchange', () => {
    const declarationPath = join(REPO_ROOT, 'docs/architecture/chunks/chunk-95-market-operations.json');
    assert.equal(existsSync(declarationPath), true);
    const declaration = JSON.parse(readFileSync(declarationPath, 'utf8')) as {
      readonly chunk: string;
      readonly requires: readonly string[];
    };
    assert.equal(declaration.chunk, 'CHUNK-95');
    assert.ok(declaration.requires.includes('sunrey-exchange-market-operations'));

    try {
      const manifest = loadManifest(REPO_ROOT);
      assert.equal(evaluateCapability(manifest, 'sunrey-exchange-market-operations').status, 'IMPLEMENTED');
      assert.equal(evaluateCapability(manifest, 'sunrey-exchange-market-operations').protected, true);
      assert.equal(evaluateCapability(manifest, 'sunrey-exchange-market-operations').owner, 'packages/sunrey-exchange');
      const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
        (evaluation) => evaluation.chunk === 'CHUNK-95',
      );
      assert.ok(declared, 'CHUNK-95 declaration must exist under docs/architecture/chunks/');
      assert.equal(declared.mustStop, false);
      assert.deepEqual(declared.missing, []);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      assert.match(message, /Expected ','|JSON|INVALID_TYPESCRIPT/);
      const raw = readFileSync(join(REPO_ROOT, 'docs/architecture/manifest.json'), 'utf8');
      assert.match(raw, /"id": "sunrey-exchange-market-operations"/);
      assert.match(raw, /Chunk 95 institutional market operations/);
    }

    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-95-market-operations.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/exchange/chunk-95-market-operations.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/exchange/institutional-gateway.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/exchange/market-data.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/exchange/market-risk-controls.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/exchange/circuit-breakers.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/exchange/reopening-auctions.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/exchange/market-maker-sessions.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/runbooks/exchange-market-incident.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-exchange/src/ops/index.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/market-operations')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/institutional-gateway')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/exchange-ops')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-exchange-ops')), false);
  });
});
