import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { encodeEnvelope, encodeUnsignedEnvelope, transactionIdOf } from '../../../src/protocol/index.ts';
import { signedTransferEnvelope } from '../../../src/protocol/fixtures.ts';

const envelope = signedTransferEnvelope();
const signed = Buffer.from(encodeEnvelope(envelope)).toString('hex');
const unsigned = Buffer.from(encodeUnsignedEnvelope(envelope)).toString('hex');
const transactionId = transactionIdOf(envelope);

const vectors = {
  schemaVersion: 1,
  codecId: 'sunrey.protobuf.canonical.v1',
  hashAlgorithm: 'SHA-256',
  tickerStatus: 'NOT_ASSIGNED',
  moonreyIssuance: 'unavailable',
  ledgerSupplyChanged: false,
  notes: 'JSON fixtures only. Consensus hashes use protobuf bytes, never this projection.',
  cases: [
    {
      name: 'valid-sunrey-coin-transfer-shape',
      expected: 'ACCEPT',
      signedBytesHex: signed,
      unsignedBytesHex: unsigned,
      transactionIdHex: transactionId,
    },
    { name: 'identical-bytes', expected: 'IDENTICAL_CANONICAL_BYTES' },
    { name: 'identical-transaction-id', expected: 'IDENTICAL_TX_ID' },
    { name: 'semantic-byte-change', expected: 'DIFFERENT_TX_ID' },
    { name: 'wrong-network', expected: 'WRONG_NETWORK' },
    { name: 'wrong-chain', expected: 'WRONG_CHAIN' },
    { name: 'replay', expected: 'REPLAY' },
    { name: 'expired', expected: 'EXPIRED' },
    { name: 'unsupported-version', expected: 'INVALID_VERSION' },
    { name: 'unknown-fields', expected: 'MALFORMED' },
    { name: 'unauthorized-purpose', expected: 'PURPOSE_NOT_AUTHORIZED' },
    { name: 'ai-capability-mismatch', expected: 'CAPABILITY_INVALID' },
    { name: 'productive-capacity-round-trip', expected: 'ACCEPT' },
    { name: 'raw-sensitive-payload', expected: 'INVALID_OBJECT_TYPE' },
    { name: 'moonrey-issuance-unavailable', expected: 'TRANSACTION_NOT_ACTIVATED' },
    { name: 'overflow-bounds', expected: 'INVALID_QUANTITY' },
    { name: 'malformed-signature', expected: 'INVALID_SIGNATURE' },
    { name: 'debug-json-not-hashed', expected: 'JSON_NOT_CONSENSUS' },
  ],
};

const out = join(import.meta.dirname, 'vectors.json');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(vectors, null, 2)}\n`);
console.log(`wrote ${out}`);
console.log(`tx ${transactionId}`);
