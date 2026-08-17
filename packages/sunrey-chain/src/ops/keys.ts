import { createHash } from 'node:crypto';

import {
  createEd25519SignatureProvider,
  SUITE_SUNREY_ED25519_V1,
  type KeyPurpose,
} from '../../../security/src/index.ts';
import { CANONICAL_VALIDATOR_SUITE_ID, type PublicKeyRef, type ValidatorKeyRole } from '../validators/index.ts';
import { opsErr, opsOk, type KeyGenerationReceipt, type OpsResult } from './types.ts';

const ROLE_PURPOSE: Readonly<Record<ValidatorKeyRole, KeyPurpose>> = {
  CONSENSUS_VOTING_KEY: 'VALIDATOR_CONSENSUS_SIGNING',
  P2P_NODE_KEY: 'P2P_IDENTITY',
  GOVERNANCE_KEY: 'GOVERNANCE_SIGNING',
  RECOVERY_KEY: 'ATTESTATION_SIGNING',
  REWARD_ADDRESS: 'WALLET_SIGNING',
};

type StoredHandle = {
  readonly keyId: string;
  readonly publicKeyHex: string;
  readonly purpose: KeyPurpose;
  readonly role: ValidatorKeyRole;
  readonly suiteId: string;
  readonly providerId: string;
};

export class OperatorKeystore {
  readonly #handles = new Map<string, StoredHandle>();
  readonly #material = new Map<string, Buffer>();
  readonly provider = createEd25519SignatureProvider();

  generate(role: ValidatorKeyRole, label: string, nowUtc: string): OpsResult<KeyGenerationReceipt> {
    const purpose = ROLE_PURPOSE[role];
    const generated = this.provider.generateKey(purpose, SUITE_SUNREY_ED25519_V1, `ops:${role}:${label}`);
    if (!generated.ok) {
      return opsErr('SIGNER_UNAVAILABLE', generated.error.message);
    }
    const publicKeyHex = generated.value.publicKey.publicKeyHex;
    const keyId = generated.value.publicKey.keyId;
    this.#handles.set(keyId, {
      keyId,
      publicKeyHex,
      purpose,
      role,
      suiteId: CANONICAL_VALIDATOR_SUITE_ID,
      providerId: this.provider.providerId,
    });
    this.#material.set(keyId, generated.value.privateKey.reveal());
    return opsOk({
      keyId,
      publicKeyHex,
      purpose,
      role,
      suiteId: CANONICAL_VALIDATOR_SUITE_ID,
      providerId: this.provider.providerId,
      privateMaterialExported: false,
      createdAtUtc: nowUtc,
    });
  }

  descriptor(keyId: string): OpsResult<PublicKeyRef> {
    const handle = this.#handles.get(keyId);
    if (!handle) {
      return opsErr('SIGNER_UNAVAILABLE', `unknown key handle ${keyId}`);
    }
    return opsOk({
      role: handle.role,
      purpose: handle.purpose,
      publicKeyHex: handle.publicKeyHex,
      keyId: handle.keyId,
      suiteId: handle.suiteId,
    });
  }

  list(): readonly Omit<StoredHandle, never>[] {
    return [...this.#handles.values()].map((handle) => Object.freeze({ ...handle }));
  }

  exportPrivate(keyId: string): OpsResult<never> {
    void keyId;
    return opsErr('PRIVATE_KEY_EXPORT_FORBIDDEN', 'operator API never exports private key bytes');
  }

  hasPrivate(keyId: string): boolean {
    return this.#material.has(keyId);
  }

  auditHash(receipt: KeyGenerationReceipt): string {
    return createHash('sha256')
      .update(
        [
          receipt.keyId,
          receipt.publicKeyHex,
          receipt.purpose,
          receipt.role,
          receipt.suiteId,
          receipt.providerId,
          String(receipt.privateMaterialExported),
        ].join('|'),
      )
      .digest('hex');
  }
}
