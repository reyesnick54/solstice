/**
 * WalletSignerProvider abstraction.
 *
 * Only LOCAL_ENCRYPTED_DEVELOPMENT holds usable local key material.
 * Hardware, remote, HSM, institutional, and PQ providers are ports
 * for later integrations. Do not claim hardware-vendor certification.
 */

import type { HardwareSignRequest, HardwareSignResponse, SignerProviderClass, WalletSignature } from './types.ts';
import { signProtocolDigest, signWalletBytes } from './keys.ts';
import type { DevelopmentKeystore } from './keystore.ts';

export type WalletSignerProvider = {
  readonly providerClass: SignerProviderClass;
  readonly canHoldLocalKeyMaterial: boolean;
  readonly sign: (keyId: string, signBytes: Uint8Array) => WalletSignature;
  readonly signProtocol: (keyId: string, digestHex: string) => WalletSignature;
};

export class LocalEncryptedDevelopmentSigner implements WalletSignerProvider {
  readonly providerClass = 'LOCAL_ENCRYPTED_DEVELOPMENT' as const;
  readonly canHoldLocalKeyMaterial = true;
  readonly keystore: DevelopmentKeystore;

  constructor(keystore: DevelopmentKeystore) {
    this.keystore = keystore;
  }

  sign(keyId: string, signBytes: Uint8Array): WalletSignature {
    if (!this.keystore.unlocked) {
      throw new Error('keystore is locked');
    }
    const record = this.keystore.get(keyId);
    if (!record) {
      throw new Error(`development key ${keyId} is not in the unlocked keystore`);
    }
    const seed = Buffer.from(record.seedHex, 'hex');
    const signatureHex = signWalletBytes(seed, signBytes, record.suiteId);
    seed.fill(0);
    return Object.freeze({
      keyId: record.keyId,
      suiteId: record.suiteId,
      publicKeyHex: record.publicKeyHex,
      signatureHex,
    });
  }

  signProtocol(keyId: string, digestHex: string): WalletSignature {
    if (!this.keystore.unlocked) {
      throw new Error('keystore is locked');
    }
    const record = this.keystore.get(keyId);
    if (!record) {
      throw new Error(`development key ${keyId} is not in the unlocked keystore`);
    }
    const seed = Buffer.from(record.seedHex, 'hex');
    const signatureHex = signProtocolDigest(seed, digestHex, record.suiteId);
    seed.fill(0);
    return Object.freeze({
      keyId: record.keyId,
      suiteId: record.suiteId,
      publicKeyHex: record.publicKeyHex,
      signatureHex,
    });
  }
}

export class UnimplementedSigner implements WalletSignerProvider {
  readonly canHoldLocalKeyMaterial = false;
  readonly providerClass: Exclude<SignerProviderClass, 'LOCAL_ENCRYPTED_DEVELOPMENT'>;

  constructor(providerClass: Exclude<SignerProviderClass, 'LOCAL_ENCRYPTED_DEVELOPMENT'>) {
    this.providerClass = providerClass;
  }

  sign(_keyId: string, _signBytes: Uint8Array): WalletSignature {
    throw new Error(`${this.providerClass} is a protocol port; it does not hold local key material`);
  }

  signProtocol(_keyId: string, _digestHex: string): WalletSignature {
    throw new Error(`${this.providerClass} is a protocol port; it does not hold local key material`);
  }
}

export function hardwareSignerPort(): {
  readonly providerClass: 'HARDWARE_SIGNER';
  readonly request: (input: HardwareSignRequest) => HardwareSignRequest;
  readonly accept: (response: HardwareSignResponse) => HardwareSignResponse;
} {
  return {
    providerClass: 'HARDWARE_SIGNER',
    request(input) {
      return Object.freeze({ ...input, transactionSummary: Object.freeze({ ...input.transactionSummary }) });
    },
    accept(response) {
      return Object.freeze({ ...response });
    },
  };
}

export const remoteSignerPort = new UnimplementedSigner('REMOTE_SIGNER');
export const hsmSignerPort = new UnimplementedSigner('HSM_SIGNER');
export const institutionalSignerPort = new UnimplementedSigner('INSTITUTIONAL_SIGNER');
export const pqSignerPort = new UnimplementedSigner('PQ_SIGNER');
