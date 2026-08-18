import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { describe, it } from 'node:test';

describe('Chunk 84 exit criteria', () => {
  it('keeps Mainnet RC documentation and owner on sunrey-chain', () => {
    assert.equal(existsSync('docs/releases/chunk-84-mainnet-rc.md'), true);
    assert.equal(existsSync('docs/releases/mainnet-freeze-policy.md'), true);
    assert.equal(existsSync('docs/releases/mainnet-qualification.md'), true);
    assert.equal(existsSync('docs/releases/mainnet-known-limitations.md'), true);
    assert.equal(existsSync('docs/releases/mainnet-reproducibility.md'), true);
    assert.equal(existsSync('docs/runbooks/mainnet-rc-qualification.md'), true);
    assert.equal(existsSync('docs/architecture/chunk-84-mainnet-rc.md'), true);
    assert.equal(existsSync('docs/architecture/chunks/chunk-84-mainnet-rc.json'), true);
    assert.equal(existsSync('packages/sunrey-chain/src/release-candidate/mainnet/index.ts'), true);
    assert.equal(existsSync('packages/sunrey-mainnet-rc'), false);
    assert.equal(existsSync('packages/mainnet-rc'), false);
    assert.equal(existsSync('packages/mainnet-qualification'), false);
    assert.equal(existsSync('packages/sunrey-mainnet-release'), false);
    assert.equal(existsSync('packages/mainnet-release-candidate'), false);
  });
});
