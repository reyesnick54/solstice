import { createHash } from 'node:crypto';

export const SRCB_CODEC_ID = 'srcb.v1';
export const LOCAL_DEV_NETWORK_ID = 'net_sunrey_local_dev';
export const LOCAL_DEV_CHAIN_ID = 'chn_sunrey_local_dev';
export const DOMAIN_TX_ID = 'sunrey.txid.v1';

export function encodeU32(value: number): Buffer {
  const buf = Buffer.alloc(4);
  buf.writeUInt32BE(value);
  return buf;
}

export function encodeU64(value: bigint): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(value);
  return buf;
}

export function encodeBytes(value: Buffer): Buffer {
  return Buffer.concat([encodeU32(value.length), value]);
}

export function encodeString(value: string): Buffer {
  return encodeBytes(Buffer.from(value, 'utf8'));
}

export function domainHash(domain: string, payload: Buffer): Buffer {
  return createHash('sha256').update(Buffer.concat([encodeString(domain), payload])).digest();
}

export function encodeSystemPayload(input: {
  readonly op: string;
  readonly objectKey: string;
  readonly objectValue: Buffer;
}): Buffer {
  return Buffer.concat([encodeString(input.op), encodeString(input.objectKey), encodeBytes(input.objectValue)]);
}

export function encodeUnsignedTransaction(input: {
  readonly networkId: string;
  readonly chainId: string;
  readonly codecId: string;
  readonly schemaVersion: number;
  readonly family: string;
  readonly nonce: bigint;
  readonly idempotencyKey: string;
  readonly payload: Buffer;
}): Buffer {
  return Buffer.concat([
    encodeString('EnvelopeV1'),
    encodeString(input.networkId),
    encodeString(input.chainId),
    encodeString(input.codecId),
    encodeU32(input.schemaVersion),
    encodeString(input.family),
    encodeU64(input.nonce),
    encodeString(input.idempotencyKey),
    encodeBytes(input.payload),
  ]);
}

export function transactionId(unsigned: Buffer): string {
  return domainHash(DOMAIN_TX_ID, unsigned).toString('hex');
}
