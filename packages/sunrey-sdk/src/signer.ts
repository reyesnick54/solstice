/**
 * Injected local signer. The SDK has no universal private-key singleton.
 *
 * Private user keys never leave the signer. Public RPC receives only
 * already-signed envelopes.
 */

import {
  DevelopmentKeystore,
  LocalEncryptedDevelopmentSigner,
  publicDescriptorFromSeed,
  seedFromLabel,
  type WalletSignature,
} from '../../sunrey-chain/src/wallet/index.ts';
import { CLASSICAL_SUITE_ID, isKnownPublicSuite, rejectSuiteDowngrade } from './ids.ts';

export type LocalSigner = {
  readonly providerClass: string;
  readonly sign: (keyId: string, signBytes: Uint8Array) => WalletSignature;
};

export type DevelopmentWalletHandle = {
  readonly walletId: string;
  readonly accountId: string;
  readonly ownerActorId: string;
  readonly addressText: string;
  readonly publicKeyHex: string;
  readonly suiteId: string;
  readonly keyId: string;
  readonly policyKind: 'SINGLE_SIGNATURE' | 'M_OF_N' | 'INSTITUTIONAL_POLICY' | 'MACHINE_MANDATE';
};

export class InjectedDevelopmentSigner implements LocalSigner {
  readonly providerClass = 'LOCAL_ENCRYPTED_DEVELOPMENT';
  readonly keystore: DevelopmentKeystore;
  readonly inner: LocalEncryptedDevelopmentSigner;

  constructor(keystore?: DevelopmentKeystore) {
    this.keystore = keystore ?? new DevelopmentKeystore();
    this.inner = new LocalEncryptedDevelopmentSigner(this.keystore);
  }

  unlock(passphrase: string): void {
    this.keystore.unlock(passphrase);
  }

  createKey(input: { readonly keyId: string; readonly label: string; readonly suiteId?: string }): {
    readonly publicKeyHex: string;
    readonly suiteId: string;
  } {
    const suiteId = input.suiteId ?? CLASSICAL_SUITE_ID;
    if (!isKnownPublicSuite(suiteId)) {
      throw new Error('unknown CryptoSuite');
    }
    const seed = seedFromLabel(input.label);
    const descriptor = publicDescriptorFromSeed(input.keyId, seed, suiteId);
    this.keystore.put({
      keyId: input.keyId,
      purpose: 'WALLET_SIGNING',
      suiteId,
      publicKeyHex: descriptor.publicKeyHex,
      seedHex: Buffer.from(seed).toString('hex'),
    });
    seed.fill(0);
    return { publicKeyHex: descriptor.publicKeyHex, suiteId };
  }

  sign(keyId: string, signBytes: Uint8Array): WalletSignature {
    return this.inner.sign(keyId, signBytes);
  }

  assertNoDowngrade(currentSuite: string, nextSuite: string): void {
    if (rejectSuiteDowngrade(currentSuite, nextSuite)) {
      throw new Error('CRYPTO_SUITE_DOWNGRADE');
    }
  }
}
