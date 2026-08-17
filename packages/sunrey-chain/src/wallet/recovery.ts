/**
 * Recovery providers and policies.
 *
 * Mnemonic seed phrases do not fit a crypto-agile SunRey architecture as
 * the permanent recovery model. Hierarchical classical schemes are an
 * optional adapter, not the protocol. Recovery guardians never receive
 * everyday spending authority unless a policy explicitly says so.
 *
 * Consensus delay uses blockchain height, not local wall-clock time.
 */

import { pbkdf2Sync } from 'node:crypto';

import type {
  BlockchainAccount,
  PendingRecovery,
  RecoveryCredentialDescriptor,
  RecoveryKind,
  RecoveryPolicy,
  WalletRejection,
} from './types.ts';

export type RecoveryProviderKind =
  | 'ENCRYPTED_RECOVERY_SECRET'
  | 'CLASSICAL_MNEMONIC_ADAPTER'
  | 'HARDWARE_BACKUP_PORT';

export type RecoveryProvider = {
  readonly kind: RecoveryProviderKind;
  readonly derivePublicDescriptor: (credential: RecoveryCredentialDescriptor, secret: string) => string;
};

export const encryptedRecoverySecretProvider: RecoveryProvider = {
  kind: 'ENCRYPTED_RECOVERY_SECRET',
  derivePublicDescriptor(credential, secret) {
    return `${credential.credentialId}:${secret.length}`;
  },
};

/**
 * Classical mnemonic adapter. Uses BIP39's established PBKDF2-HMAC-SHA512
 * seed derivation. This is not the SunRey recovery architecture and must
 * not be required for hybrid or PQ accounts.
 */
export const classicalMnemonicAdapter: RecoveryProvider = {
  kind: 'CLASSICAL_MNEMONIC_ADAPTER',
  derivePublicDescriptor(credential, mnemonic) {
    const seed = pbkdf2Sync(mnemonic.normalize('NFKD'), `mnemonic${credential.credentialId}`, 2048, 64, 'sha512');
    return seed.subarray(0, 32).toString('hex');
  },
};

export function createRecoveryPolicy(input: {
  readonly policyId: string;
  readonly kind: RecoveryKind;
  readonly threshold: number;
  readonly delayHeights: number;
  readonly ownerMayCancel: boolean;
  readonly credentials: readonly RecoveryCredentialDescriptor[];
}): RecoveryPolicy {
  if (input.threshold < 1 || input.threshold > input.credentials.length) {
    throw new TypeError('recovery threshold must be an integer in 1..=N');
  }
  if (input.delayHeights < 0) {
    throw new TypeError('recovery delay must be an unsigned height delta');
  }
  for (const credential of input.credentials) {
    if (credential.grantsEverydaySpend !== false) {
      throw new TypeError('recovery credentials must not grant everyday spend by default');
    }
  }
  return Object.freeze({
    schemaVersion: 1,
    policyId: input.policyId,
    kind: input.kind,
    threshold: input.threshold,
    delayHeights: input.delayHeights,
    ownerMayCancel: input.ownerMayCancel,
    credentials: Object.freeze([...input.credentials]),
  });
}

export function requestRecovery(input: {
  readonly account: BlockchainAccount;
  readonly policy: RecoveryPolicy;
  readonly currentHeight: number;
  readonly nextPrimaryKeyId: string;
  readonly authorizingCredentialIds: readonly string[];
}): { readonly ok: true; readonly pending: PendingRecovery } | WalletRejection {
  const unique = new Set(input.authorizingCredentialIds);
  if (unique.size !== input.authorizingCredentialIds.length) {
    return { ok: false, code: 'DUPLICATE_SIGNER', detail: 'duplicate recovery guardian' };
  }
  const allowed = new Set(input.policy.credentials.map((credential) => credential.credentialId));
  for (const id of unique) {
    if (!allowed.has(id)) {
      return { ok: false, code: 'UNAUTHORIZED_SIGNER', detail: `recovery credential ${id} is not in the policy` };
    }
  }
  if (unique.size < input.policy.threshold) {
    return {
      ok: false,
      code: 'INSUFFICIENT_M_OF_N',
      detail: `recovery requires ${input.policy.threshold} credentials`,
    };
  }
  return {
    ok: true,
    pending: Object.freeze({
      requestedHeight: input.currentHeight,
      activationHeight: input.currentHeight + input.policy.delayHeights,
      nextPrimaryKeyId: input.nextPrimaryKeyId,
      authorizingCredentialIds: Object.freeze([...unique]),
    }),
  };
}

export function recoveryIsActive(pending: PendingRecovery, currentHeight: number): boolean {
  return currentHeight >= pending.activationHeight;
}

export function cancelRecovery(
  account: BlockchainAccount,
  policy: RecoveryPolicy,
): { readonly ok: true } | WalletRejection {
  if (!policy.ownerMayCancel) {
    return { ok: false, code: 'SECURITY_HOLD', detail: 'owner cancel is not permitted by the recovery policy' };
  }
  if (account.status !== 'RECOVERY_PENDING') {
    return { ok: false, code: 'ACCOUNT_NOT_ACTIVE', detail: 'no pending recovery to cancel' };
  }
  return { ok: true };
}
