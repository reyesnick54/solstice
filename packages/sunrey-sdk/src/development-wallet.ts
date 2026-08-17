/**
 * Local development wallet. Keys stay in the injected signer / keystore.
 * Public RPC receives only public descriptors and signed envelopes.
 */

import { WalletEngine, type BlockchainAccount } from '../../sunrey-chain/src/wallet/index.ts';
import { isWalletRejection } from '../../sunrey-chain/src/wallet/types.ts';
import { CLASSICAL_SUITE_ID, PUBLIC_NETWORK_ID } from './ids.ts';
import type { AccountPolicyKind } from './types.ts';

export type CreatedDevelopmentWallet = {
  readonly walletId: string;
  readonly account: BlockchainAccount;
  readonly engine: WalletEngine;
  readonly keyId: string;
  readonly suiteId: string;
};

export function createDevelopmentWallet(input: {
  readonly walletId: string;
  readonly passphrase?: string;
  readonly policyKind?: AccountPolicyKind;
  readonly threshold?: number;
  readonly signerLabels?: readonly string[];
  readonly suiteId?: string;
  readonly walletType?: 'HUMAN' | 'ENTERPRISE' | 'MACHINE' | 'INSTITUTIONAL';
}): CreatedDevelopmentWallet {
  const engine = new WalletEngine({ networkId: PUBLIC_NETWORK_ID });
  engine.unlock(input.passphrase ?? 'development-passphrase');
  const created = engine.createWallet({
    walletId: input.walletId,
    ownerActorId: `actor.${input.walletId}`,
    walletType: input.walletType ?? 'HUMAN',
    ...(input.policyKind !== undefined ? { policyKind: input.policyKind } : {}),
    ...(input.threshold !== undefined ? { threshold: input.threshold } : {}),
    ...(input.signerLabels !== undefined ? { signerLabels: input.signerLabels } : {}),
    ...(input.suiteId !== undefined ? { approvedCryptoSuites: [input.suiteId] } : {}),
  });
  if (isWalletRejection(created)) {
    throw new Error(created.detail);
  }
  const account = engine.getAccount(`bca.${input.walletId}`);
  if (!account) {
    throw new Error('development wallet account missing');
  }
  return {
    walletId: input.walletId,
    account,
    engine,
    keyId: account.keys[0]?.keyId ?? `${input.walletId}.key.1`,
    suiteId: account.keys[0]?.suiteId ?? input.suiteId ?? CLASSICAL_SUITE_ID,
  };
}

export function publicRegistration(wallet: CreatedDevelopmentWallet): {
  readonly account_id: string;
  readonly address: string;
  readonly public_key_hex: string;
  readonly suite_id: string;
  readonly authorization_policy: AccountPolicyKind;
} {
  return {
    account_id: wallet.account.accountId,
    address: wallet.account.address.text,
    public_key_hex: wallet.account.keys[0]?.publicKeyHex ?? '',
    suite_id: wallet.suiteId,
    authorization_policy: wallet.account.authorizationPolicy.kind,
  };
}
