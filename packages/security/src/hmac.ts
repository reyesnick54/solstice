import { createHmac } from 'node:crypto';

import { HMAC_SHA256 } from './algorithms.ts';
import { safeEqualHex } from './random.ts';
import type { SecretValue } from './redaction.ts';

export type HmacSignature = {
  readonly algorithm: typeof HMAC_SHA256;
  readonly hex: string;
};

export function hmacSha256Hex(key: SecretValue | Buffer | string, payload: string | Buffer): string {
  const material = keyMaterial(key);
  return createHmac('sha256', material).update(payload).digest('hex');
}

export function verifyHmacSha256Hex(
  key: SecretValue | Buffer | string,
  payload: string | Buffer,
  signatureHex: string,
): boolean {
  const expected = hmacSha256Hex(key, payload);
  return safeEqualHex(expected, signatureHex);
}

function keyMaterial(key: SecretValue | Buffer | string): Buffer | string {
  if (typeof key === 'string' || Buffer.isBuffer(key)) {
    return key;
  }
  return key.reveal();
}
