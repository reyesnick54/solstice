import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { ENVIRONMENT } from '../packages/config/src/flags.ts';
import { TICKER_STATUS } from '../packages/sunrey-coin/src/taxonomy.ts';
import {
  moonreyIssuanceActivated,
  NATIVE_ASSET_TICKER_STATUS,
  PROTOCOL_CODEC_ID,
} from '../packages/sunrey-chain/src/protocol/index.ts';
import { evaluateDeclaredChunks } from '../tools/architectural-linter/src/constitution.ts';
import { evaluateCapability, loadManifest } from '../tools/architectural-linter/src/manifest.ts';
import { lintSunReyProtocol } from '../tools/architectural-linter/src/sunrey-protocol-guards.ts';

const ROOT = join(import.meta.dirname, '..');

describe('Chunk 32R SunRey transaction protocol', () => {
  it('implements one canonical protocol without a competing ledger or ticker', () => {
    assert.deepEqual(lintSunReyProtocol(ROOT), []);
    const manifest = loadManifest(ROOT);
    assert.equal(evaluateCapability(manifest, 'blockchain-protocol').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'blockchain-protocol').owner, 'packages/sunrey-chain');
    assert.equal(evaluateCapability(manifest, 'moonrey-coin').status, 'PLANNED');
    const declared = evaluateDeclaredChunks(ROOT, manifest).find((row) => row.chunk === 'CHUNK-32');
    assert.ok(declared);
    assert.equal(declared.mustStop, false);
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-chain/src/protocol/codec.ts')), true);
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-chain/protocol/v1/sunrey_tx_v1.proto')), true);
    assert.equal(existsSync(join(ROOT, 'docs/architecture/chunk-32-resume.md')), true);
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-protocol')), false);
    assert.equal(existsSync(join(ROOT, 'packages/moonrey-coin')), false);
    assert.equal(PROTOCOL_CODEC_ID, 'sunrey.protobuf.canonical.v1');
    assert.equal(NATIVE_ASSET_TICKER_STATUS, 'NOT_ASSIGNED');
    assert.equal(TICKER_STATUS, 'NOT_ASSIGNED');
    assert.equal(moonreyIssuanceActivated(), false);
    assert.equal(ENVIRONMENT, 'simulation');
    const proto = JSON.parse(
      readFileSync(join(ROOT, 'docs/architecture/sunrey-blockchain-protocol.json'), 'utf8'),
    ) as { productionBlockchainImplemented: boolean; mainnetEnabled: boolean };
    assert.equal(proto.productionBlockchainImplemented, false);
    assert.equal(proto.mainnetEnabled, false);
  });
});
