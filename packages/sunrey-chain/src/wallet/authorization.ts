/**
 * Account authorization policies and M-of-N verification.
 *
 * Integer thresholds only. Duplicate signers are rejected. Signatures
 * from keys not authorized by the account policy are rejected.
 */

import type { BlockchainAccount, WalletRejection, WalletSignature } from './types.ts';
import { isApprovedWalletSuite, suiteRank, verifyProtocolDigest, verifyWalletBytes } from './keys.ts';

export function authorizeAccountAction(input: {
  readonly account: BlockchainAccount;
  readonly bodyHash: string;
  readonly signBytesHex?: string;
  readonly signatures: readonly WalletSignature[];
  readonly allowRecoveryKeys?: boolean;
  readonly currentHeight: number;
}): { readonly ok: true } | WalletRejection {
  const { account, signatures } = input;
  if (account.status === 'REVOKED') {
    return { ok: false, code: 'ACCOUNT_NOT_ACTIVE', detail: 'account is revoked' };
  }
  if (account.status === 'SECURITY_RESTRICTED') {
    return { ok: false, code: 'SECURITY_HOLD', detail: 'account is under an owner security hold' };
  }
  if (account.status === 'RECOVERY_PENDING' && !input.allowRecoveryKeys) {
    return { ok: false, code: 'RECOVERY_DELAY_ACTIVE', detail: 'ordinary spend is blocked while recovery is pending' };
  }

  const seen = new Set<string>();
  const validKeyIds: string[] = [];
  const policy = account.authorizationPolicy;
  const authorized = new Set(policy.authorizedKeyIds);
  if (input.allowRecoveryKeys) {
    for (const keyId of policy.recoveryKeyIds) {
      authorized.add(keyId);
    }
  }

  for (const signature of signatures) {
    if (seen.has(signature.keyId)) {
      return { ok: false, code: 'DUPLICATE_SIGNER', detail: `duplicate signer ${signature.keyId}` };
    }
    seen.add(signature.keyId);
    const record = account.keys.find((key) => key.keyId === signature.keyId);
    if (record && (record.status === 'REVOKED' || record.status === 'HISTORICAL')) {
      return { ok: false, code: 'OLD_ROTATED_KEY', detail: `key ${signature.keyId} is not active for new transactions` };
    }
    if (!authorized.has(signature.keyId)) {
      return { ok: false, code: 'UNAUTHORIZED_SIGNER', detail: `key ${signature.keyId} is not authorized by the account policy` };
    }
    if (!record) {
      return { ok: false, code: 'UNAUTHORIZED_SIGNER', detail: `key ${signature.keyId} is not registered on the account` };
    }
    if (record.status !== 'ACTIVE' && record.status !== 'ROTATION_REGISTERED') {
      return { ok: false, code: 'OLD_ROTATED_KEY', detail: `key ${signature.keyId} is not active` };
    }
    if (!isApprovedWalletSuite(signature.suiteId) || !account.approvedCryptoSuites.includes(signature.suiteId)) {
      return { ok: false, code: 'CRYPTO_SUITE_DOWNGRADE', detail: `suite ${signature.suiteId} is not approved for this account` };
    }
    const activeSuites = account.keys
      .filter((key) => key.status === 'ACTIVE' || key.status === 'ROTATION_REGISTERED')
      .map((key) => suiteRank(key.suiteId));
    const highest = activeSuites.reduce((max, rank) => (rank > max ? rank : max), 0);
    if (suiteRank(signature.suiteId) < highest && policy.kind !== 'M_OF_N') {
      return { ok: false, code: 'CRYPTO_SUITE_DOWNGRADE', detail: 'cannot sign new transactions with a downgraded CryptoSuite' };
    }
    const signedPayload = input.signBytesHex ?? input.bodyHash;
    if (
      !verifyProtocolDigest(
        signature.publicKeyHex,
        signedPayload,
        signature.signatureHex,
        signature.suiteId,
      ) &&
      !verifyWalletBytes(
        signature.publicKeyHex,
        Buffer.from(input.bodyHash, 'hex'),
        signature.signatureHex,
        signature.suiteId,
      )
    ) {
      return { ok: false, code: 'UNAUTHORIZED_SIGNER', detail: `signature for ${signature.keyId} failed verification` };
    }
    if (signature.publicKeyHex !== record.publicKeyHex) {
      return { ok: false, code: 'UNAUTHORIZED_SIGNER', detail: 'signature public key does not match the registered key' };
    }
    validKeyIds.push(signature.keyId);
  }

  const threshold = policy.threshold;
  if (validKeyIds.length < threshold) {
    return {
      ok: false,
      code: 'INSUFFICIENT_M_OF_N',
      detail: `policy ${policy.kind} requires ${threshold} signatures, received ${validKeyIds.length}`,
    };
  }
  return { ok: true };
}

export function historicalSignatureStillVerifies(
  publicKeyHex: string,
  bodyHash: string,
  signatureHex: string,
  signBytesHex?: string,
): boolean {
  if (signBytesHex && verifyProtocolDigest(publicKeyHex, signBytesHex, signatureHex)) {
    return true;
  }
  return verifyWalletBytes(publicKeyHex, Buffer.from(bodyHash, 'hex'), signatureHex);
}
