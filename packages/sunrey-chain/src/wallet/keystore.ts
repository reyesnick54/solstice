/**
 * Local encrypted development keystore.
 *
 * Uses established scrypt (node:crypto) and canonical AES-256-GCM
 * envelope encryption. Only the LOCAL_ENCRYPTED_DEVELOPMENT provider
 * holds usable key material. Private keys are never logged.
 */

import { scryptSync, timingSafeEqual } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import {
  openEnvelope,
  sealEnvelope,
  type EncryptedEnvelope,
} from '../../../security/src/index.ts';
import { wipeBuffer } from './keys.ts';
import type { SignerProviderClass } from './types.ts';

export const KEYSTORE_FORMAT = 'sunrey.wallet.keystore.v1' as const;
export const KEYSTORE_SCHEMA_VERSION = 1 as const;
const SCRYPT_N = 16_384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 32;

export type StoredKeyRecord = {
  readonly keyId: string;
  readonly purpose: 'WALLET_SIGNING';
  readonly suiteId: string;
  readonly publicKeyHex: string;
  readonly seedHex: string;
};

export type KeystoreFile = {
  readonly schemaVersion: typeof KEYSTORE_SCHEMA_VERSION;
  readonly format: typeof KEYSTORE_FORMAT;
  readonly providerClass: 'LOCAL_ENCRYPTED_DEVELOPMENT';
  readonly kdf: 'scrypt';
  readonly kdfParams: {
    readonly N: number;
    readonly r: number;
    readonly p: number;
    readonly saltHex: string;
    readonly keylen: number;
  };
  readonly purpose: 'DATA_ENCRYPTION';
  readonly envelope: EncryptedEnvelope;
};

export class DevelopmentKeystore {
  #unlocked = false;
  #keys = new Map<string, StoredKeyRecord>();
  #master: Buffer | null = null;
  readonly path: string | null;

  constructor(path: string | null = null) {
    this.path = path;
  }

  get unlocked(): boolean {
    return this.#unlocked;
  }

  get providerClass(): SignerProviderClass {
    return 'LOCAL_ENCRYPTED_DEVELOPMENT';
  }

  unlock(passphrase: string, existing?: KeystoreFile): void {
    const salt = existing
      ? Buffer.from(existing.kdfParams.saltHex, 'hex')
      : Buffer.from('sunrey-dev-keystore-salt-v1');
    const master = scryptSync(passphrase, salt, SCRYPT_KEYLEN, {
      N: SCRYPT_N,
      r: SCRYPT_R,
      p: SCRYPT_P,
    });
    if (existing) {
      const opened = openEnvelope(master, existing.envelope);
      if (!opened.ok) {
        wipeBuffer(master);
        throw new Error('keystore passphrase failed');
      }
      const records = JSON.parse(opened.value.toString('utf8')) as StoredKeyRecord[];
      wipeBuffer(opened.value);
      this.#keys = new Map(records.map((record) => [record.keyId, record]));
    }
    if (this.#master) {
      wipeBuffer(this.#master);
    }
    this.#master = master;
    this.#unlocked = true;
  }

  lock(): void {
    this.#keys.clear();
    if (this.#master) {
      wipeBuffer(this.#master);
      this.#master = null;
    }
    this.#unlocked = false;
  }

  put(record: StoredKeyRecord): void {
    if (!this.#unlocked) {
      throw new Error('keystore is locked');
    }
    this.#keys.set(record.keyId, record);
  }

  get(keyId: string): StoredKeyRecord | null {
    if (!this.#unlocked) {
      return null;
    }
    return this.#keys.get(keyId) ?? null;
  }

  listPublic(): ReadonlyArray<{ readonly keyId: string; readonly publicKeyHex: string; readonly suiteId: string }> {
    return [...this.#keys.values()].map((record) =>
      Object.freeze({
        keyId: record.keyId,
        publicKeyHex: record.publicKeyHex,
        suiteId: record.suiteId,
      }),
    );
  }

  persist(): KeystoreFile {
    if (!this.#unlocked || !this.#master) {
      throw new Error('keystore is locked');
    }
    const plaintext = Buffer.from(JSON.stringify([...this.#keys.values()]), 'utf8');
    const sealed = sealEnvelope({
      keyId: 'wallet-dev-keystore',
      keyVersion: 1,
      purpose: 'DATA_ENCRYPTION',
      masterKey: this.#master,
      plaintext,
    });
    wipeBuffer(plaintext);
    if (!sealed.ok) {
      throw new Error(sealed.error.message);
    }
    const file: KeystoreFile = {
      schemaVersion: KEYSTORE_SCHEMA_VERSION,
      format: KEYSTORE_FORMAT,
      providerClass: 'LOCAL_ENCRYPTED_DEVELOPMENT',
      kdf: 'scrypt',
      kdfParams: {
        N: SCRYPT_N,
        r: SCRYPT_R,
        p: SCRYPT_P,
        saltHex: Buffer.from('sunrey-dev-keystore-salt-v1').toString('hex'),
        keylen: SCRYPT_KEYLEN,
      },
      purpose: 'DATA_ENCRYPTION',
      envelope: sealed.value,
    };
    if (this.path) {
      mkdirSync(dirname(this.path), { recursive: true });
      writeFileSync(this.path, JSON.stringify(file, null, 2), { mode: 0o600 });
      try {
        chmodSync(this.path, 0o600);
      } catch {
        // platform may not support chmod
      }
    }
    return file;
  }

  static loadFile(path: string): KeystoreFile {
    if (!existsSync(path)) {
      throw new Error('keystore file not found');
    }
    return JSON.parse(readFileSync(path, 'utf8')) as KeystoreFile;
  }

  assertNoPlaintext(serialized: string): void {
    for (const record of this.#keys.values()) {
      const seed = Buffer.from(record.seedHex, 'hex');
      const leaked = serialized.includes(record.seedHex);
      wipeBuffer(seed);
      if (leaked) {
        throw new Error('private key material must not appear in serialized output');
      }
    }
  }
}

export function passphrasesEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  const ok = a.length === b.length && timingSafeEqual(a, b);
  wipeBuffer(a);
  wipeBuffer(b);
  return ok;
}
