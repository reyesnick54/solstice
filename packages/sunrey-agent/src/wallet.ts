import type { BlockchainAccount, WalletSignature } from '../../sunrey-chain/src/wallet/types.ts';
import type { MandateRefusal, WalletAuthorizationView } from './types.ts';

/**
 * Canonical wallet authorization adapter (Chunk 46 delegated keys /
 * Chunk 96 wallet policy). This module does not become a second wallet
 * authority. Callers still invoke `authorizeAccountAction` from
 * packages/sunrey-chain/src/wallet/authorization.ts for signature
 * verification. AI identity alone cannot satisfy that path.
 */
export function walletAuthorizationView(input: {
  readonly walletId: string;
  readonly accountId: string;
  readonly networkId: string;
  readonly delegatedKeyId: string | null;
}): WalletAuthorizationView {
  return Object.freeze({
    walletId: input.walletId,
    accountId: input.accountId,
    networkId: input.networkId,
    policyHash: `wallet-policy:${input.walletId}:${input.accountId}`,
    delegatedKeyId: input.delegatedKeyId,
    masterKeyHeldByAgent: false,
  });
}

export function authorizeWithWallet(input: {
  readonly account: BlockchainAccount;
  readonly bodyHash: string;
  readonly signatures: readonly WalletSignature[];
  readonly currentHeight: number;
  readonly signerIsAiIdentity: boolean;
  readonly usesMasterKey: boolean;
  readonly delegatedKeyId: string | null;
  readonly authorizeAccountAction?: (args: {
    readonly account: BlockchainAccount;
    readonly bodyHash: string;
    readonly signatures: readonly WalletSignature[];
    readonly currentHeight: number;
  }) => { readonly ok: true } | { readonly ok: false; readonly detail: string };
}): { readonly ok: true } | MandateRefusal {
  if (input.signerIsAiIdentity) {
    return { ok: false, code: 'AI_CANNOT_SIGN', detail: 'AI identity alone cannot authorize a transaction' };
  }
  if (input.usesMasterKey) {
    return { ok: false, code: 'MASTER_KEY_FORBIDDEN', detail: 'the agent never receives unrestricted master authority' };
  }
  if (input.delegatedKeyId) {
    const delegated = input.account.delegatedLimits.find((limit) => limit.keyId === input.delegatedKeyId);
    if (!delegated) {
      return { ok: false, code: 'WALLET_AUTHORIZATION_REFUSED', detail: 'delegated key is not registered on the wallet policy' };
    }
  }
  if (input.authorizeAccountAction) {
    const result = input.authorizeAccountAction({
      account: input.account,
      bodyHash: input.bodyHash,
      signatures: input.signatures,
      currentHeight: input.currentHeight,
    });
    if (!result.ok) {
      return { ok: false, code: 'WALLET_AUTHORIZATION_REFUSED', detail: result.detail };
    }
  }
  return { ok: true };
}
