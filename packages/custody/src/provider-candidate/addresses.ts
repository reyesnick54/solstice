import { isNativeCustodyAssetId, type NativeCustodyAssetId } from '../native-assets.ts';
import { candidateErr, candidateOk, type CustodyCandidateResult, type CustodyCandidateWallet } from './types.ts';

const wallets = new Map<string, CustodyCandidateWallet>();

export function createCandidateWallet(input: Omit<CustodyCandidateWallet, 'createdAt'> & { readonly createdAt?: string }): CustodyCandidateResult<CustodyCandidateWallet> {
  if (!isNativeCustodyAssetId(input.assetId)) {
    return candidateErr('INVALID_ASSET', 'wallet asset must be a native custody asset');
  }
  const wallet: CustodyCandidateWallet = Object.freeze({
    ...input,
    createdAt: input.createdAt ?? '2026-08-20T00:00:00.000Z',
  });
  wallets.set(wallet.walletId, wallet);
  return candidateOk(wallet);
}

export function rebindCandidateWalletAsset(_walletId: string, _assetId: NativeCustodyAssetId): CustodyCandidateResult<never> {
  return candidateErr('ASSET_IMMUTABLE', 'a wallet asset cannot mutate after creation');
}

export function getCandidateWallet(walletId: string): CustodyCandidateWallet | undefined {
  return wallets.get(walletId);
}

export function resetCandidateWallets(): void {
  wallets.clear();
}
