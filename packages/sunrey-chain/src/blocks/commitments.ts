// @ts-nocheck
/**
 * Deterministic Merkle commitments for blocks and monetary state.
 *
 * Domains and tree rules match `packages/sunrey-chain/rust/crates/protocol/src/commitments.rs`.
 */

import { createHash } from 'node:crypto';

import { domainPayload, encodeBytes, encodeString, encodeU64 } from './codec.ts';
import type { CanonicalBlockHeader } from './types.ts';

export const HASH_SIZE = 32 as const;

export const DOMAIN_BLOCK_ID = 'sunrey.blockid.v1' as const;
export const DOMAIN_MERKLE = 'sunrey.merkle.v1' as const;
export const DOMAIN_LEAF = 'sunrey.leaf.v1' as const;
export const DOMAIN_STATE_ROOT = 'sunrey.stateroot.v1' as const;
export const DOMAIN_TX_ROOT = 'sunrey.txroot.v1' as const;

export type Hash32 = Uint8Array;

export function hashDomain(domain: string, payload: Uint8Array): Hash32 {
  return createHash('sha256').update(domainPayload(domain, payload)).digest();
}

export function hashToHex(hash: Hash32): string {
  return Buffer.from(hash).toString('hex');
}

export function hashFromHex(text: string): Hash32 {
  if (!/^[0-9a-f]{64}$/i.test(text)) {
    throw new TypeError('hash must be 32-byte hex');
  }
  return Buffer.from(text, 'hex');
}

export function merkleRoot(domain: string, leaves: readonly Hash32[]): Hash32 {
  if (leaves.length === 0) {
    return hashDomain(domain, new Uint8Array());
  }
  let layer = leaves.map((leaf) => Buffer.from(leaf));
  while (layer.length > 1) {
    if (layer.length % 2 === 1) {
      const last = layer[layer.length - 1];
      if (last) {
        layer.push(Buffer.from(last));
      }
    }
    const next: Buffer[] = [];
    for (let index = 0; index < layer.length; index += 2) {
      const left = layer[index];
      const right = layer[index + 1];
      if (!left || !right) {
        throw new Error('invalid merkle layer');
      }
      next.push(hashDomain(DOMAIN_MERKLE, Buffer.concat([left, right])));
    }
    layer = next;
  }
  const root = layer[0];
  if (!root) {
    throw new Error('empty merkle root');
  }
  return root;
}

export function transactionRoot(txIds: readonly Hash32[]): Hash32 {
  return merkleRoot(DOMAIN_TX_ROOT, txIds);
}

export function stateLeaf(key: Uint8Array, value: Uint8Array): Hash32 {
  const payload = Buffer.concat([encodeBytes(key), encodeBytes(value)]);
  return hashDomain(DOMAIN_LEAF, payload);
}

export function stateRoot(entries: ReadonlyMap<string, Uint8Array> | readonly [string, Uint8Array][]): Hash32 {
  const pairs = entries instanceof Map ? [...entries.entries()] : [...entries];
  pairs.sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
  const leaves = pairs.map(([key, value]) => stateLeaf(Buffer.from(key, 'utf8'), value));
  return merkleRoot(DOMAIN_STATE_ROOT, leaves);
}

export function encodeBlockHeader(header: CanonicalBlockHeader): Buffer {
  return Buffer.concat([
    encodeString('BlockHeaderV1'),
    encodeU32FromNumber(header.version),
    encodeString(header.networkId),
    encodeString(header.chainId),
    encodeU64(header.height),
    encodeBytes(header.parentBlockHash),
    encodeBytes(header.transactionRoot),
    encodeBytes(header.previousStateCommitment),
    encodeBytes(header.resultingStateCommitment),
    encodeBytes(header.validatorSetHash),
    encodeBytes(header.consensusParameterHash),
    encodeString(header.protocolVersion),
    encodeBytes(header.moduleRegistryHash),
    encodeBytes(header.codecRegistryHash),
    encodeBytes(header.cryptoPolicyHash),
    encodeU64(header.timestampUnixMs),
    encodeString(header.proposer),
    encodeString(header.cryptoSuiteId),
    encodeU32FromNumber(header.round),
    encodeBytes(header.consensusCertificateHash),
    encodeExtensionCommitments(header.extensionCommitments),
  ]);
}

function encodeU32FromNumber(value: number): Buffer {
  const out = Buffer.alloc(4);
  out.writeUInt32BE(value >>> 0);
  return out;
}

function encodeExtensionCommitments(extensions: Readonly<Record<string, Hash32>>): Buffer {
  const keys = Object.keys(extensions).sort();
  const parts = [encodeU32FromNumber(keys.length)];
  for (const key of keys) {
    const value = extensions[key];
    if (!value) {
      continue;
    }
    parts.push(encodeString(key), encodeBytes(value));
  }
  return Buffer.concat(parts);
}

export function blockId(header: CanonicalBlockHeader): Hash32 {
  return hashDomain(DOMAIN_BLOCK_ID, encodeBlockHeader(header));
}

export function transactionIdFromBytes(canonicalBytes: Uint8Array): Hash32 {
  return hashDomain('sunrey.txid.v1', canonicalBytes);
}
