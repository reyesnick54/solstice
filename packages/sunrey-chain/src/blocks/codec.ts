/**
 * Canonical length-prefixed codec helpers matching Rust `sunrey-protocol` encoding.
 */

export function encodeU32(value: number): Buffer {
  const out = Buffer.alloc(4);
  out.writeUInt32BE(value >>> 0);
  return out;
}

export function encodeU64(value: bigint): Buffer {
  const out = Buffer.alloc(8);
  out.writeBigUInt64BE(value);
  return out;
}

export function encodeBytes(value: Uint8Array): Buffer {
  return Buffer.concat([encodeU32(value.length), Buffer.from(value)]);
}

export function encodeString(value: string): Buffer {
  return encodeBytes(Buffer.from(value, 'utf8'));
}

export function domainPayload(domain: string, payload: Uint8Array): Buffer {
  return Buffer.concat([encodeString(domain), Buffer.from(payload)]);
}
