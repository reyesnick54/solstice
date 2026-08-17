import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { runSunreyRelease } from '../packages/sunrey-chain/src/supply-chain/index.ts';

const ROOT = join(import.meta.dirname, '..');

describe('Chunk 59 exit criteria', () => {
  it('traces a testnet release to commit and lockfiles', () => {
    const built = runSunreyRelease(ROOT, ['build']);
    assert.equal(built.ok, true);
    const verified = runSunreyRelease(ROOT, ['verify']);
    assert.equal(verified.ok, true);
    assert.equal(existsSync(join(ROOT, 'dist/testnet-release/sboms.json')), true);
    assert.equal(existsSync(join(ROOT, 'dist/testnet-release/provenance.json')), true);
    assert.equal(existsSync(join(ROOT, 'dist/testnet-release/signature.json')), true);
  });
});
