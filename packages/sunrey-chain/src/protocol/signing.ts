/**
 * Explicit transaction signing-domain separation.
 *
 * Signatures commit to network, chain, protocol version, and transaction
 * type so they cannot be replayed across environments or operation kinds.
 */

import {
  encodeSignatureDomainCommit,
  SIGNATURE_DOMAINS,
} from '../../../security/src/signature-domains.ts';
import { sha256Hex } from '../../../security/src/hash.ts';
import { encodeUnsignedEnvelope } from './codec.ts';
import type { EnvelopeV1 } from './envelope.ts';
import { transactionIdOf } from './hash.ts';

function encodeU32(value: number): Buffer {
  const buf = Buffer.alloc(4);
  buf.writeUInt32BE(value);
  return buf;
}

function encodeString(value: string): Buffer {
  const bytes = Buffer.from(value, 'utf8');
  if (bytes.length > 65_535) {
    throw new TypeError('signing binding string exceeds u16 bound');
  }
  const len = Buffer.alloc(2);
  len.writeUInt16BE(bytes.length);
  return Buffer.concat([len, bytes]);
}

/**
 * Deterministic binding payload hashed before the signature domain commit.
 * Includes every axis that must not be interchangeable across replays.
 */
export function transactionSigningBinding(envelope: EnvelopeV1): Buffer {
  const unsigned = encodeUnsignedEnvelope(envelope);
  return Buffer.concat([
    encodeString(envelope.networkId),
    encodeString(envelope.chainId),
    encodeU32(envelope.schemaVersion),
    encodeString(envelope.codecId),
    encodeString(envelope.transactionType),
    encodeU32(unsigned.length),
    Buffer.from(unsigned),
  ]);
}

/** 32-byte digest that Ed25519 signs for protocol transactions. */
export function transactionSigningDigest(envelope: EnvelopeV1): Buffer {
  const binding = transactionSigningBinding(envelope);
  const committed = encodeSignatureDomainCommit(SIGNATURE_DOMAINS.TRANSACTION, binding);
  return Buffer.from(sha256Hex(committed), 'hex');
}

/** Hex digest exposed to wallet hardware and audit surfaces. */
export function transactionSigningDigestHex(envelope: EnvelopeV1): string {
  return transactionSigningDigest(envelope).toString('hex');
}

/** Canonical transaction identifier — content address of unsigned bytes. */
export function canonicalTransactionId(envelope: EnvelopeV1): string {
  return transactionIdOf(envelope);
}
