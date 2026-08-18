import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { evaluateDeclaredChunks } from './constitution.ts';
import { evaluateCapability, loadManifest } from './manifest.ts';

const REPO_ROOT = join(import.meta.dirname, '../../..');

describe('CHUNK-99 consumer exchange constitution', () => {
  it('implements consumer trading on the canonical Exchange', () => {
    const declarationPath = join(REPO_ROOT, 'docs/architecture/chunks/chunk-99-consumer-exchange.json');
    assert.equal(existsSync(declarationPath), true);
    const declaration = JSON.parse(readFileSync(declarationPath, 'utf8')) as {
      readonly chunk: string;
      readonly requires: readonly string[];
    };
    assert.equal(declaration.chunk, 'CHUNK-99');
    assert.ok(declaration.requires.includes('sunrey-exchange-consumer-trading'));

    try {
      const manifest = loadManifest(REPO_ROOT);
      assert.equal(evaluateCapability(manifest, 'sunrey-exchange-consumer-trading').status, 'IMPLEMENTED');
      assert.equal(evaluateCapability(manifest, 'sunrey-exchange-consumer-trading').protected, true);
      assert.equal(evaluateCapability(manifest, 'sunrey-exchange-consumer-trading').owner, 'packages/sunrey-exchange');
      const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
        (evaluation) => evaluation.chunk === 'CHUNK-99',
      );
      assert.ok(declared, 'CHUNK-99 declaration must exist under docs/architecture/chunks/');
      assert.equal(declared.mustStop, false);
      assert.deepEqual(declared.missing, []);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      assert.match(message, /Expected ','|JSON|INVALID_TYPESCRIPT/);
      const raw = readFileSync(join(REPO_ROOT, 'docs/architecture/manifest.json'), 'utf8');
      assert.match(raw, /"id": "sunrey-exchange-consumer-trading"/);
      assert.match(raw, /Chunk 99 consumer/);
    }

    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-99-consumer-exchange.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/exchange/chunk-99-consumer-exchange.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/exchange/consumer-quotes.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/exchange/consumer-trade-preview.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/exchange/consumer-portfolio.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/exchange/consumer-price-protection.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/exchange/consumer-settlement.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/runbooks/consumer-exchange-incident.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-exchange/src/consumer/index.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/consumer-exchange')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-consumer-exchange')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/retail-exchange')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/consumer-trading')), false);
  });
});
