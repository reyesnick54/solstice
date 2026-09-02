import { createHash } from 'node:crypto';

import {
  EVIDENCE_ROOT_LEAF_DOMAIN,
  EVIDENCE_ROOT_MERKLE_DOMAIN,
  ZERO_ROOT_HEX,
} from './constants.ts';

function encodeString(value: string): Buffer {
  const bytes = Buffer.from(value, 'utf8');
  return Buffer.concat([Buffer.from([bytes.length]), bytes]);
}

function encodeBytes(value: Buffer): Buffer {
  return Buffer.concat([Buffer.from([value.length]), value]);
}

export function domainHash(domain: string, payload: Buffer): Buffer {
  return createHash('sha256').update(Buffer.concat([encodeString(domain), payload])).digest();
}

export function hexToBytes(hex: string): Buffer {
  if (!/^[0-9a-f]{64}$/i.test(hex)) {
    throw new TypeError('expected 32-byte hex digest');
  }
  return Buffer.from(hex, 'hex');
}

export function bytesToHex(bytes: Buffer): string {
  return bytes.toString('hex');
}

export function leafHash(leafKey: string, leafValueHex: string): string {
  const payload = Buffer.concat([encodeString(leafKey), encodeBytes(hexToBytes(leafValueHex))]);
  return bytesToHex(domainHash(EVIDENCE_ROOT_LEAF_DOMAIN, payload));
}

export function merkleRootFromLeafHashes(leafHashes: readonly string[]): string {
  if (leafHashes.length === 0) {
    return bytesToHex(domainHash(EVIDENCE_ROOT_MERKLE_DOMAIN, Buffer.from('empty', 'utf8')));
  }
  let level = leafHashes.map((hash) => hexToBytes(hash));
  while (level.length > 1) {
    const next: Buffer[] = [];
    for (let index = 0; index < level.length; index += 2) {
      if (index + 1 >= level.length) {
        next.push(level[index]!);
        continue;
      }
      const payload = Buffer.concat([encodeBytes(level[index]!), encodeBytes(level[index + 1]!)]);
      next.push(domainHash(EVIDENCE_ROOT_MERKLE_DOMAIN, payload));
    }
    level = next;
  }
  return bytesToHex(level[0]!);
}

export function merkleRootFromEntries(
  entries: ReadonlyArray<{ readonly key: string; readonly valueHex: string }>,
): string {
  if (entries.length === 0) {
    return emptyMerkleRoot();
  }
  return merkleRootFromLeafHashes(entries.map((entry) => leafHash(entry.key, entry.valueHex)));
}

export type MerkleMembershipProof = {
  readonly leafKey: string;
  readonly leafValueHex: string;
  readonly leafIndex: number;
  readonly siblings: readonly string[];
  readonly leafCount: number;
};

function collectSiblings(leafHashes: readonly string[], targetIndex: number): string[] {
  let level = leafHashes.map((hash) => hexToBytes(hash));
  let index = targetIndex;
  const siblings: string[] = [];
  while (level.length > 1) {
    if (index % 2 === 1) {
      siblings.push(bytesToHex(level[index - 1]!));
    } else if (index + 1 < level.length) {
      siblings.push(bytesToHex(level[index + 1]!));
    }
    const next: Buffer[] = [];
    for (let pair = 0; pair < level.length; pair += 2) {
      if (pair + 1 >= level.length) {
        next.push(level[pair]!);
        continue;
      }
      const payload = Buffer.concat([encodeBytes(level[pair]!), encodeBytes(level[pair + 1]!)]);
      next.push(domainHash(EVIDENCE_ROOT_MERKLE_DOMAIN, payload));
    }
    index = Math.floor(index / 2);
    level = next;
  }
  return siblings;
}

export function buildMembershipProof(
  entries: ReadonlyArray<{ readonly key: string; readonly valueHex: string }>,
  key: string,
): MerkleMembershipProof {
  const index = entries.findIndex((entry) => entry.key === key);
  if (index < 0) {
    throw new Error(`membership proof key not found: ${key}`);
  }
  const leafHashes = entries.map((entry) => leafHash(entry.key, entry.valueHex));
  return Object.freeze({
    leafKey: key,
    leafValueHex: entries[index]!.valueHex,
    leafIndex: index,
    siblings: Object.freeze(collectSiblings(leafHashes, index)),
    leafCount: entries.length,
  });
}

export function verifyMembershipProof(rootHex: string, proof: MerkleMembershipProof): boolean {
  if (proof.leafCount === 0) {
    return false;
  }
  let hash = hexToBytes(leafHash(proof.leafKey, proof.leafValueHex));
  let index = proof.leafIndex;
  let width = proof.leafCount;
  let siblingIndex = 0;
  while (width > 1) {
    const sibling =
      siblingIndex < proof.siblings.length ? hexToBytes(proof.siblings[siblingIndex]!) : null;
    if (index % 2 === 0) {
      if (index + 1 >= width) {
        // odd promotion — sibling not consumed
      } else if (sibling) {
        siblingIndex += 1;
        hash = domainHash(EVIDENCE_ROOT_MERKLE_DOMAIN, Buffer.concat([encodeBytes(hash), encodeBytes(sibling)]));
      }
    } else if (sibling) {
      siblingIndex += 1;
      hash = domainHash(EVIDENCE_ROOT_MERKLE_DOMAIN, Buffer.concat([encodeBytes(sibling), encodeBytes(hash)]));
    } else {
      return false;
    }
    index = Math.floor(index / 2);
    width = Math.ceil(width / 2);
  }
  return bytesToHex(hash) === rootHex;
}

export function emptyMerkleRoot(): string {
  return merkleRootFromLeafHashes([]);
}

export function isZeroRootHex(value: string): boolean {
  return value.toLowerCase() === ZERO_ROOT_HEX;
}
