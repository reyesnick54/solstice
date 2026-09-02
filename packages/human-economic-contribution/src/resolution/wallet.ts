import { humanEconomicIdentityIdFor, walletBindingRefFor } from './ids.ts';
import type { HumanEconomicIdentityId, WalletBindingRef } from './types.ts';

export type WalletAliasResolver = {
  readonly resolveWallet: (walletCommitment: string) => HumanEconomicIdentityId | null;
};

export type EconomicIdentityRegistry = {
  readonly bindWallet: (walletCommitment: string, humanEconomicIdentityId: HumanEconomicIdentityId) => WalletBindingRef;
  readonly resolveIdentity: (walletCommitment: string) => HumanEconomicIdentityId | null;
  readonly walletsForIdentity: (humanEconomicIdentityId: HumanEconomicIdentityId) => readonly WalletBindingRef[];
};

export function createEconomicIdentityRegistry(aliasResolver?: WalletAliasResolver): EconomicIdentityRegistry {
  const walletToIdentity = new Map<string, HumanEconomicIdentityId>();
  const identityWallets = new Map<string, WalletBindingRef[]>();

  return Object.freeze({
    bindWallet(walletCommitment: string, humanEconomicIdentityId: HumanEconomicIdentityId): WalletBindingRef {
      const existing = walletToIdentity.get(walletCommitment);
      if (existing && existing !== humanEconomicIdentityId) {
        throw new Error(`wallet ${walletCommitment} is already bound to a different economic identity`);
      }
      walletToIdentity.set(walletCommitment, humanEconomicIdentityId);
      const binding = walletBindingRefFor({ walletCommitment, humanEconomicIdentityId });
      const wallets = identityWallets.get(humanEconomicIdentityId) ?? [];
      if (!wallets.includes(binding)) {
        identityWallets.set(humanEconomicIdentityId, Object.freeze([...wallets, binding]));
      }
      return binding;
    },
    resolveIdentity(walletCommitment: string): HumanEconomicIdentityId | null {
      const aliased = aliasResolver?.resolveWallet(walletCommitment);
      if (aliased) {
        return aliased;
      }
      return walletToIdentity.get(walletCommitment) ?? null;
    },
    walletsForIdentity(humanEconomicIdentityId: HumanEconomicIdentityId): readonly WalletBindingRef[] {
      return identityWallets.get(humanEconomicIdentityId) ?? Object.freeze([]);
    },
  });
}

/**
 * Same participant submitting from wallet A, B, or C must not create multiple
 * monetizable contribution events. Uniqueness belongs at economic-identity level.
 */
export function resolveEconomicIdentity(input: {
  readonly walletCommitment: string;
  readonly actorCommitment: string;
  readonly jurisdiction?: string;
  readonly registry: EconomicIdentityRegistry;
}): { readonly humanEconomicIdentityId: HumanEconomicIdentityId; readonly walletBindingRef: WalletBindingRef } {
  const existing = input.registry.resolveIdentity(input.walletCommitment);
  const humanEconomicIdentityId = existing ?? humanEconomicIdentityIdFor({ actorCommitment: input.actorCommitment, jurisdiction: input.jurisdiction });
  const walletBindingRef = input.registry.bindWallet(input.walletCommitment, humanEconomicIdentityId);
  return Object.freeze({ humanEconomicIdentityId, walletBindingRef });
}
