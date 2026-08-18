import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { describe, it } from 'node:test';

describe('Chunk 78 exit criteria', () => {
  it('keeps economic RC documentation and owner on sunrey-chain', () => {
    assert.equal(existsSync('docs/releases/chunk-78-economic-rc.md'), true);
    assert.equal(existsSync('docs/releases/economic-policy-freeze.md'), true);
    assert.equal(existsSync('docs/releases/economic-qualification.md'), true);
    assert.equal(existsSync('docs/releases/economic-compatibility.md'), true);
    assert.equal(existsSync('docs/releases/economic-known-limitations.md'), true);
    assert.equal(existsSync('docs/architecture/chunk-78-economic-rc.md'), true);
    assert.equal(existsSync('docs/architecture/chunks/chunk-78-economic-rc.json'), true);
    assert.equal(existsSync('packages/sunrey-chain/src/release-candidate/economic/index.ts'), true);
    assert.equal(existsSync('packages/sunrey-economic-rc'), false);
    assert.equal(existsSync('packages/economic-rc'), false);
    assert.equal(existsSync('packages/economic-qualification'), false);
    assert.equal(existsSync('packages/sunrey-economic-release'), false);
    assert.equal(existsSync('packages/economic-policy-freeze'), false);
  });
});
