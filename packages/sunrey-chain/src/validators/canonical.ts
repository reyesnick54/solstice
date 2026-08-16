import { createHash } from 'node:crypto';

import { DOMAIN_VALSET } from './types.ts';

export function encodeU32(value: number): Buffer {
  const buf = Buffer.alloc(4);
  buf.writeUInt32BE(value);
  return buf;
}

export function encodeU64(value: bigint): Buffer {
  if (value < 0n || value > 0xffff_ffff_ffff_ffffn) {
    throw new TypeError('u64 overflow');
  }
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(value);
  return buf;
}

export function encodeBool(value: boolean): Buffer {
  return Buffer.from([value ? 1 : 0]);
}

export function encodeBytes(value: Uint8Array | Buffer): Buffer {
  return Buffer.concat([encodeU32(value.length), Buffer.from(value)]);
}

export function encodeString(value: string): Buffer {
  return encodeBytes(Buffer.from(value, 'utf8'));
}

export function domainPayload(domain: string, payload: Uint8Array): Buffer {
  return Buffer.concat([encodeString(domain), Buffer.from(payload)]);
}

export function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(Buffer.from(bytes)).digest('hex');
}

export function sha256Bytes(bytes: Uint8Array): Buffer {
  return createHash('sha256').update(Buffer.from(bytes)).digest();
}

export function domainHashHex(domain: string, payload: Uint8Array): string {
  return sha256Hex(domainPayload(domain, payload));
}

export function valsetDomainHash(payload: Uint8Array): string {
  return domainHashHex(DOMAIN_VALSET, payload);
}
