/**
 * RFC 6238 TOTP using node:crypto HMAC-SHA1. This is the IETF algorithm,
 * not a homemade MAC. Secrets are stored as encrypted envelopes, never logged.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

import { secureRandomBytes } from '../../security/src/random.ts';

export const TOTP_PERIOD_SECONDS = 30;
export const TOTP_DIGITS = 6;
export const TOTP_ALGORITHM = 'SHA1' as const;
export const TOTP_WINDOW = 1;

export function generateTotpSecret(): { readonly secretBytes: Buffer; readonly secretBase32: string } {
  const secretBytes = secureRandomBytes(20);
  return { secretBytes, secretBase32: toBase32(secretBytes) };
}

export function totpAt(secret: Buffer, unixSeconds: number): string {
  const timestep = Math.floor(unixSeconds / TOTP_PERIOD_SECONDS);
  return hotp(secret, timestep);
}

export function verifyTotp(secret: Buffer, code: string, unixSeconds: number, window = TOTP_WINDOW): boolean {
  const normalized = code.replace(/\s+/g, '');
  if (!/^\d{6}$/.test(normalized)) {
    return false;
  }
  const presented = Buffer.from(normalized, 'utf8');
  let matched = false;
  for (let offset = -window; offset <= window; offset += 1) {
    const candidate = Buffer.from(totpAt(secret, unixSeconds + offset * TOTP_PERIOD_SECONDS), 'utf8');
    if (candidate.length === presented.length && timingSafeEqual(candidate, presented)) {
      matched = true;
    }
  }
  return matched;
}

export function otpauthUri(input: { readonly issuer: string; readonly accountLabel: string; readonly secretBase32: string }): string {
  const label = encodeURIComponent(`${input.issuer}:${input.accountLabel}`);
  const params = new URLSearchParams({
    secret: input.secretBase32,
    issuer: input.issuer,
    algorithm: TOTP_ALGORITHM,
    digits: String(TOTP_DIGITS),
    period: String(TOTP_PERIOD_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

function hotp(secret: Buffer, counter: number): string {
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(counter / 0x1_0000_0000), 0);
  buf.writeUInt32BE(counter >>> 0, 4);
  const hmac = createHmac('sha1', secret).update(buf).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const binary =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff);
  return String(binary % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, '0');
}

function toBase32(bytes: Buffer): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += alphabet[(value << (5 - bits)) & 31];
  }
  return output;
}

export function fromBase32(encoded: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const normalized = encoded.toUpperCase().replace(/=+$/g, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of normalized) {
    const idx = alphabet.indexOf(char);
    if (idx < 0) {
      throw new Error('invalid base32');
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
