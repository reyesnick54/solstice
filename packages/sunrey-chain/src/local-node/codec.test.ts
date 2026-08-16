import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  encodeSystemPayload,
  encodeUnsignedTransaction,
  LOCAL_DEV_CHAIN_ID,
  LOCAL_DEV_NETWORK_ID,
  SRCB_CODEC_ID,
  transactionId,
} from './codec.ts';

const vectors = JSON.parse(
  readFileSync(join(import.meta.dirname, '..', '..', 'fixtures', 'protocol', 'vectors.json'), 'utf8'),
) as {
  unsignedSystem: {
    unsigned_hex: string;
    tx_id: string;
    op: string;
    object_key: string;
    object_value_hex: string;
    idempotency_key: string;
  };
};

describe('local node reference codec', () => {
  it('matches Rust unsigned encoding and transaction id', () => {
    const payload = encodeSystemPayload({
      op: vectors.unsignedSystem.op,
      objectKey: vectors.unsignedSystem.object_key,
      objectValue: Buffer.from(vectors.unsignedSystem.object_value_hex, 'hex'),
    });
    const unsigned = encodeUnsignedTransaction({
      networkId: LOCAL_DEV_NETWORK_ID,
      chainId: LOCAL_DEV_CHAIN_ID,
      codecId: SRCB_CODEC_ID,
      schemaVersion: 1,
      family: 'SYSTEM',
      nonce: 0n,
      idempotencyKey: vectors.unsignedSystem.idempotency_key,
      payload,
    });
    assert.equal(unsigned.toString('hex'), vectors.unsignedSystem.unsigned_hex);
    assert.equal(transactionId(unsigned), vectors.unsignedSystem.tx_id);
  });
});
