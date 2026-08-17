/**
 * Versioned SunRey Blockchain address format.
 *
 * Canonical binary is 42 bytes. Canonical text is HRP + '1' + base32.
 * The address binds network class, algorithm, and a SHA-256 payload of
 * the public-key or account descriptor. Cross-network reuse is rejected.
 *
 * Do not hard-code a single cryptographic algorithm forever.
 */

import { createHash } from 'node:crypto';

import {
  ADDRESS_ALGORITHM_IDS,
  ADDRESS_ALGORITHMS,
  ADDRESS_CLASS_IDS,
  ADDRESS_CLASSES,
  ADDRESS_FORMAT_VERSION,
  ADDRESS_MAX_BINARY_BYTES,
  ADDRESS_MAX_TEXT_LENGTH,
  DEVELOPMENT_NETWORK_IDS,
  NETWORK_CLASS_IDS,
  NETWORK_CLASSES,
  RESERVED_PRODUCTION_NETWORK_ID,
  TESTNET_NETWORK_IDS,
  type AccountDescriptor,
  type AddressAlgorithm,
  type AddressClass,
  type BlockchainAddress,
  type NetworkClass,
  type PublicKeyDescriptor,
} from './types.ts';

const MAGIC = Buffer.from('SR');
const PAYLOAD_DOMAIN = 'SUNREY-ADDR-PAYLOAD-V1';
const CHECKSUM_DOMAIN = 'SUNREY-ADDR-V1';
const BASE32 = 'abcdefghijklmnopqrstuvwxyz234567';

const HRP_BY_CLASS: { readonly [K in NetworkClass]: string } = {
  DEVELOPMENT: 'srdev',
  RESERVED_TEST: 'srtst',
  RESERVED_PRODUCTION: 'srprd',
};

export function networkClassOf(networkId: string): NetworkClass | null {
  if ((DEVELOPMENT_NETWORK_IDS as readonly string[]).includes(networkId)) {
    return 'DEVELOPMENT';
  }
  if ((TESTNET_NETWORK_IDS as readonly string[]).includes(networkId) || networkId.startsWith('net_sunrey_testnet_')) {
    return 'RESERVED_TEST';
  }
  if (
    networkId === RESERVED_PRODUCTION_NETWORK_ID ||
    networkId.startsWith('net_sunrey_production_candidate_')
  ) {
    return 'RESERVED_PRODUCTION';
  }
  return null;
}

export function addressClassFromId(id: number): AddressClass | null {
  const found = (Object.entries(ADDRESS_CLASS_IDS) as Array<[AddressClass, number]>).find(
    ([, value]) => value === id,
  );
  return found ? found[0] : null;
}

export function addressAlgorithmFromId(id: number): AddressAlgorithm | null {
  const found = (Object.entries(ADDRESS_ALGORITHM_IDS) as Array<[AddressAlgorithm, number]>).find(
    ([, value]) => value === id,
  );
  return found ? found[0] : null;
}

export function networkClassFromId(id: number): NetworkClass | null {
  const found = (Object.entries(NETWORK_CLASS_IDS) as Array<[NetworkClass, number]>).find(
    ([, value]) => value === id,
  );
  return found ? found[0] : null;
}

function sha256(...parts: readonly (string | Uint8Array)[]): Buffer {
  const hash = createHash('sha256');
  for (const part of parts) {
    hash.update(part);
  }
  return hash.digest();
}

export function descriptorPayload(
  networkId: string,
  addressClass: AddressClass,
  algorithm: AddressAlgorithm,
  descriptorBytes: Uint8Array,
): Buffer {
  return sha256(
    PAYLOAD_DOMAIN,
    networkId,
    addressClass,
    algorithm,
    descriptorBytes,
  );
}

export function publicKeyDescriptorBytes(descriptor: PublicKeyDescriptor): Buffer {
  return Buffer.from(
    `${descriptor.schemaVersion}|${descriptor.keyId}|${descriptor.suiteId}|${descriptor.algorithm}|${descriptor.publicKeyHex}|${descriptor.purpose}`,
    'utf8',
  );
}

export function accountDescriptorBytes(descriptor: AccountDescriptor): Buffer {
  return Buffer.from(
    `${descriptor.schemaVersion}|${descriptor.accountId}|${descriptor.addressClass}|${descriptor.authorizedKeyIds.join(',')}|${descriptor.policyKind}|${descriptor.threshold}`,
    'utf8',
  );
}

function encodeBase32(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    out += BASE32[(value << (5 - bits)) & 31];
  }
  return out;
}

function decodeBase32(text: string): Buffer | null {
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of text) {
    const idx = BASE32.indexOf(char);
    if (idx < 0) {
      return null;
    }
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function checksumOf(prefix: Uint8Array): Buffer {
  return sha256(CHECKSUM_DOMAIN, prefix).subarray(0, 4);
}

export function encodeAddress(input: {
  readonly networkId: string;
  readonly addressClass: AddressClass;
  readonly algorithm: AddressAlgorithm;
  readonly descriptorBytes: Uint8Array;
}): BlockchainAddress {
  const networkClass = networkClassOf(input.networkId);
  if (!networkClass) {
    throw new TypeError(`unknown network id ${input.networkId}`);
  }
  if (!(ADDRESS_CLASSES as readonly string[]).includes(input.addressClass)) {
    throw new TypeError('unknown address class');
  }
  if (!(ADDRESS_ALGORITHMS as readonly string[]).includes(input.algorithm)) {
    throw new TypeError('unknown address algorithm');
  }
  const payload = descriptorPayload(
    input.networkId,
    input.addressClass,
    input.algorithm,
    input.descriptorBytes,
  );
  const prefix = Buffer.alloc(38);
  MAGIC.copy(prefix, 0);
  prefix[2] = ADDRESS_FORMAT_VERSION;
  prefix[3] = NETWORK_CLASS_IDS[networkClass];
  prefix[4] = ADDRESS_CLASS_IDS[input.addressClass];
  prefix[5] = ADDRESS_ALGORITHM_IDS[input.algorithm];
  payload.copy(prefix, 6);
  const checksum = checksumOf(prefix);
  const binary = Buffer.concat([prefix, checksum]);
  if (binary.length !== ADDRESS_MAX_BINARY_BYTES) {
    throw new TypeError('canonical address binary must be 42 bytes');
  }
  const body = encodeBase32(
    Buffer.concat([
      Buffer.from([ADDRESS_FORMAT_VERSION, prefix[4], prefix[5]]),
      payload,
      checksum,
    ]),
  );
  const text = `${HRP_BY_CLASS[networkClass]}1${body}`;
  if (text.length > ADDRESS_MAX_TEXT_LENGTH) {
    throw new TypeError(`address text exceeds ${ADDRESS_MAX_TEXT_LENGTH} characters`);
  }
  return Object.freeze({
    schemaVersion: ADDRESS_FORMAT_VERSION,
    text,
    binaryHex: binary.toString('hex'),
    networkId: input.networkId,
    networkClass,
    addressClass: input.addressClass,
    algorithm: input.algorithm,
    payloadHex: payload.toString('hex'),
  });
}

export function encodeFromPublicKey(
  networkId: string,
  addressClass: AddressClass,
  descriptor: PublicKeyDescriptor,
): BlockchainAddress {
  return encodeAddress({
    networkId,
    addressClass,
    algorithm: descriptor.algorithm,
    descriptorBytes: publicKeyDescriptorBytes(descriptor),
  });
}

export function encodeFromAccountDescriptor(
  networkId: string,
  algorithm: AddressAlgorithm,
  descriptor: AccountDescriptor,
): BlockchainAddress {
  return encodeAddress({
    networkId,
    addressClass: descriptor.addressClass,
    algorithm,
    descriptorBytes: accountDescriptorBytes(descriptor),
  });
}

export type AddressParseError =
  | 'WRONG_NETWORK_ADDRESS'
  | 'CHECKSUM_FAILURE'
  | 'MALFORMED_ADDRESS'
  | 'UNKNOWN_VERSION'
  | 'UNKNOWN_CLASS'
  | 'UNKNOWN_ALGORITHM';

export type AddressParseResult =
  | { readonly ok: true; readonly address: BlockchainAddress }
  | { readonly ok: false; readonly code: AddressParseError; readonly detail: string };

export function parseAddress(
  text: string,
  expectedNetworkId?: string,
): AddressParseResult {
  const sep = text.indexOf('1');
  if (sep < 4 || text.length > ADDRESS_MAX_TEXT_LENGTH) {
    return { ok: false, code: 'MALFORMED_ADDRESS', detail: 'address text is malformed' };
  }
  const hrp = text.slice(0, sep);
  const body = text.slice(sep + 1);
  const networkClass = (Object.entries(HRP_BY_CLASS) as Array<[NetworkClass, string]>).find(
    ([, value]) => value === hrp,
  )?.[0];
  if (!networkClass || !(NETWORK_CLASSES as readonly string[]).includes(networkClass)) {
    return { ok: false, code: 'WRONG_NETWORK_ADDRESS', detail: 'human-readable prefix is not a SunRey network' };
  }
  const decoded = decodeBase32(body);
  if (!decoded || decoded.length < 3 + 32 + 4) {
    return { ok: false, code: 'MALFORMED_ADDRESS', detail: 'base32 payload is incomplete' };
  }
  const version = decoded[0];
  const classId = decoded[1];
  const algId = decoded[2];
  const payload = decoded.subarray(3, 35);
  const checksum = decoded.subarray(35, 39);
  if (version === undefined || classId === undefined || algId === undefined) {
    return { ok: false, code: 'MALFORMED_ADDRESS', detail: 'base32 payload is incomplete' };
  }
  if (version !== ADDRESS_FORMAT_VERSION) {
    return { ok: false, code: 'UNKNOWN_VERSION', detail: `unsupported address version ${version}` };
  }
  const addressClass = addressClassFromId(classId);
  const algorithm = addressAlgorithmFromId(algId);
  if (!addressClass) {
    return { ok: false, code: 'UNKNOWN_CLASS', detail: 'reserved address class requires a governed upgrade' };
  }
  if (!algorithm) {
    return { ok: false, code: 'UNKNOWN_ALGORITHM', detail: 'unknown address algorithm' };
  }
  const prefix = Buffer.alloc(38);
  MAGIC.copy(prefix, 0);
  prefix[2] = version;
  prefix[3] = NETWORK_CLASS_IDS[networkClass];
  prefix[4] = classId;
  prefix[5] = algId;
  payload.copy(prefix, 6);
  if (!checksum.equals(checksumOf(prefix))) {
    return { ok: false, code: 'CHECKSUM_FAILURE', detail: 'address checksum failed' };
  }
  if (expectedNetworkId) {
    const expectedClass = networkClassOf(expectedNetworkId);
    if (expectedClass !== networkClass) {
      return { ok: false, code: 'WRONG_NETWORK_ADDRESS', detail: 'address network class does not match expected network' };
    }
  }
  const binary = Buffer.concat([prefix, checksum]);
  const inferredNetworkId =
    expectedNetworkId ??
    (networkClass === 'DEVELOPMENT'
      ? DEVELOPMENT_NETWORK_IDS[0]
      : networkClass === 'RESERVED_TEST'
        ? TESTNET_NETWORK_IDS[1]
        : RESERVED_PRODUCTION_NETWORK_ID);
  return {
    ok: true,
    address: Object.freeze({
      schemaVersion: ADDRESS_FORMAT_VERSION,
      text,
      binaryHex: binary.toString('hex'),
      networkId: inferredNetworkId,
      networkClass,
      addressClass,
      algorithm,
      payloadHex: payload.toString('hex'),
    }),
  };
}

export function addressesEqual(left: BlockchainAddress, right: BlockchainAddress): boolean {
  return left.binaryHex === right.binaryHex;
}
