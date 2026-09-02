import { createHash } from 'node:crypto';

import { sha256Hex } from '../../../security/src/hash.ts';

const DOMAIN_MERKLE = 'sunrey.merkle.v1';
const DOMAIN_LEAF = 'sunrey.merkle.leaf.v1';

function domainHash(domain: string, payload: Buffer): string {
  return sha256Hex(Buffer.concat([Buffer.from(domain, 'utf8'), payload]));
}

function hexToBuffer(hex: string): Buffer {
  if (!/^[a-f0-9]{64}$/.test(hex)) {
    throw new TypeError('Merkle leaf must be a 64-character lowercase hex digest');
  }
  return Buffer.from(hex, 'hex');
}

function bufferToHex(buffer: Buffer): string {
  return buffer.toString('hex');
}

/**
 * Deterministic binary Merkle root over leaf digests. Empty input hashes the
 * domain with an empty payload, matching the Rust protocol commitment helper.
 */
export function merkleRoot(domain: string, leafDigests: readonly string[]): string {
  if (leafDigests.length === 0) {
    return domainHash(domain, Buffer.alloc(0));
  }

  let layer = leafDigests.map((leaf) => hexToBuffer(leaf));
  while (layer.length > 1) {
    if (layer.length % 2 === 1) {
      layer.push(layer[layer.length - 1]!);
    }
    const next: Buffer[] = [];
    for (let index = 0; index < layer.length; index += 2) {
      const payload = Buffer.concat([layer[index]!, layer[index + 1]!]);
      next.push(Buffer.from(domainHash(DOMAIN_MERKLE, payload), 'hex'));
    }
    layer = next;
  }
  return bufferToHex(layer[0]!);
}

export function merkleLeaf(domain: string, key: string, value: string): string {
  const payload = Buffer.concat([
    Buffer.from(key, 'utf8'),
    Buffer.from('\0', 'utf8'),
    Buffer.from(value, 'utf8'),
  ]);
  return domainHash(domain ?? DOMAIN_LEAF, payload);
}

export function sortedMerkleRoot(domain: string, leaves: readonly string[]): string {
  return merkleRoot(domain, [...leaves].sort());
}
