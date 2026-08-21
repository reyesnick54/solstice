/**
 * Password credentials use node:crypto scrypt (memory-hard KDF already
 * used by the wallet keystore). Unique salt per credential. Plaintext is
 * never stored or logged.
 */

import { scrypt, timingSafeEqual } from 'node:crypto';

import { secureRandomBytes } from '../../security/src/random.ts';

function scryptAsync(
  password: string,
  salt: Buffer,
  keylen: number,
  options: { readonly N: number; readonly r: number; readonly p: number },
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, options, (error, derived) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(derived);
    });
  });
}

export const PASSWORD_KDF = 'scrypt' as const;
export const PASSWORD_MIN_LENGTH = 12;
export const SCRYPT_N = 16_384;
export const SCRYPT_R = 8;
export const SCRYPT_P = 1;
export const SCRYPT_DKLEN = 32;
export const SCRYPT_SALT_BYTES = 16;

export type PasswordDigest = {
  readonly kdf: typeof PASSWORD_KDF;
  readonly saltHex: string;
  readonly digestHex: string;
  readonly N: number;
  readonly r: number;
  readonly p: number;
  readonly dkLen: number;
};

const DUMMY_SALT = Buffer.alloc(SCRYPT_SALT_BYTES, 7);
let dummyDigest: Buffer | null = null;

async function derive(password: string, salt: Buffer, params: Omit<PasswordDigest, 'kdf' | 'saltHex' | 'digestHex'>): Promise<Buffer> {
  return (await scryptAsync(password, salt, params.dkLen, {
    N: params.N,
    r: params.r,
    p: params.p,
  })) as Buffer;
}

async function dummy(): Promise<Buffer> {
  if (dummyDigest) {
    return dummyDigest;
  }
  dummyDigest = await derive('sunrey-dummy-password-not-a-user-secret', DUMMY_SALT, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    dkLen: SCRYPT_DKLEN,
  });
  return dummyDigest;
}

export function assertPasswordPolicy(password: string): string | null {
  if (typeof password !== 'string' || password.length < PASSWORD_MIN_LENGTH) {
    return `password must be at least ${PASSWORD_MIN_LENGTH} characters`;
  }
  if (password.length > 256) {
    return 'password exceeds maximum length';
  }
  return null;
}

export async function hashPassword(password: string): Promise<PasswordDigest> {
  const policy = assertPasswordPolicy(password);
  if (policy) {
    throw new Error(policy);
  }
  const salt = secureRandomBytes(SCRYPT_SALT_BYTES);
  const digest = await derive(password, salt, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    dkLen: SCRYPT_DKLEN,
  });
  return Object.freeze({
    kdf: PASSWORD_KDF,
    saltHex: salt.toString('hex'),
    digestHex: digest.toString('hex'),
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    dkLen: SCRYPT_DKLEN,
  });
}

export async function verifyPassword(password: string, record: PasswordDigest | null): Promise<boolean> {
  if (record === null) {
    const computed = await derive(password.length > 0 ? password : 'x', DUMMY_SALT, {
      N: SCRYPT_N,
      r: SCRYPT_R,
      p: SCRYPT_P,
      dkLen: SCRYPT_DKLEN,
    });
    const expected = await dummy();
    timingSafeEqual(computed.subarray(0, Math.min(computed.length, expected.length)), expected.subarray(0, Math.min(computed.length, expected.length)));
    return false;
  }
  if (record.kdf !== PASSWORD_KDF) {
    return false;
  }
  const salt = Buffer.from(record.saltHex, 'hex');
  const expected = Buffer.from(record.digestHex, 'hex');
  const computed = await derive(password, salt, record);
  if (computed.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(computed, expected);
}
