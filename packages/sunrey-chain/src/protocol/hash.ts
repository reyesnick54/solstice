import { sha256Hex } from '../../../security/src/hash.ts';
import {
  HASH_DOMAINS,
  PROTOCOL_SCHEMA_VERSION,
  type HashDomain,
} from './constants.ts';
import { encodeEconomicObject, encodeUnsignedEnvelope } from './codec.ts';
import type { EnvelopeV1 } from './envelope.ts';
import type { EconomicObject } from './economic-object.ts';

function lengthPrefixed(value: Uint8Array): Buffer {
  if (value.length > 255) {
    throw new TypeError('domain-separation prefix exceeds 255 bytes');
  }
  return Buffer.concat([Buffer.from([value.length]), Buffer.from(value)]);
}

export function domainSeparatedHash(
  domain: HashDomain,
  networkId: string,
  chainId: string,
  schemaVersion: number,
  payload: Uint8Array,
): string {
  if (!(HASH_DOMAINS as readonly string[]).includes(domain)) {
    throw new TypeError('unknown hash domain');
  }
  if (!Buffer.isBuffer(payload) && !(payload instanceof Uint8Array)) {
    throw new TypeError('consensus hash payload must be canonical bytes');
  }
  const version = Buffer.alloc(4);
  version.writeUInt32BE(schemaVersion);
  const input = Buffer.concat([
    lengthPrefixed(Buffer.from(domain, 'utf8')),
    lengthPrefixed(Buffer.from(networkId, 'utf8')),
    lengthPrefixed(Buffer.from(chainId, 'utf8')),
    version,
    Buffer.from(payload),
  ]);
  return sha256Hex(input);
}

export function transactionIdFromCanonicalBytes(
  networkId: string,
  chainId: string,
  canonicalBytes: Uint8Array,
): string {
  return domainSeparatedHash('SUNREY_TX_V1', networkId, chainId, PROTOCOL_SCHEMA_VERSION, canonicalBytes);
}

export function transactionIdOf(envelope: EnvelopeV1): string {
  const canonical = encodeUnsignedEnvelope(envelope);
  return transactionIdFromCanonicalBytes(envelope.networkId, envelope.chainId, canonical);
}

export function objectIdHash(
  networkId: string,
  chainId: string,
  object: EconomicObject,
): string {
  return domainSeparatedHash(
    'SUNREY_OBJECT_V1',
    networkId,
    chainId,
    PROTOCOL_SCHEMA_VERSION,
    encodeEconomicObject(object),
  );
}

export function hashForDomain(
  domain: HashDomain,
  networkId: string,
  chainId: string,
  payload: Uint8Array,
): string {
  return domainSeparatedHash(domain, networkId, chainId, PROTOCOL_SCHEMA_VERSION, payload);
}

export function rejectJsonConsensusHash(value: unknown): never {
  throw new TypeError(
    `consensus hashes require canonical protobuf bytes; debug JSON is not a hash input (${typeof value})`,
  );
}
