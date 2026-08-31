/**
 * External blockchain identity — distinct from SunRey native chain.
 */

import { EXTERNAL_BLOCKCHAIN_IDS, SUNREY_NATIVE_CHAIN_ID, type ExternalBlockchainId } from './types.ts';

const EXTERNAL_SET = new Set<string>(EXTERNAL_BLOCKCHAIN_IDS);

export function isExternalBlockchainId(value: string): value is ExternalBlockchainId {
  return EXTERNAL_SET.has(value);
}

export function assertExternalBlockchainId(value: string): ExternalBlockchainId {
  if (!isExternalBlockchainId(value)) {
    throw new Error(`unknown external blockchain id: ${value}`);
  }
  return value;
}

export function isSunReyNativeChainId(value: string): boolean {
  return value === SUNREY_NATIVE_CHAIN_ID;
}

export function rejectSunReyNativeChain(chainId: string): void {
  if (isSunReyNativeChainId(chainId) || chainId.startsWith('chn_sunrey')) {
    throw new Error('SunRey native chain must not be queried as an external observed chain');
  }
}

export function networkLabel(chainId: ExternalBlockchainId): string {
  switch (chainId) {
    case 'bitcoin-mainnet':
      return 'Bitcoin Mainnet';
    case 'bitcoin-testnet':
      return 'Bitcoin Testnet';
    case 'ethereum-mainnet':
      return 'Ethereum Mainnet';
    case 'solana-mainnet':
      return 'Solana Mainnet';
    default:
      return chainId;
  }
}

export function finalityNoteFor(chainId: ExternalBlockchainId): string {
  switch (chainId) {
    case 'bitcoin-mainnet':
    case 'bitcoin-testnet':
      return 'Probabilistic finality; recent blocks may reorganize. Do not treat unconfirmed observations as permanent.';
    case 'ethereum-mainnet':
      return 'Probabilistic finality under proof-of-stake; recent slots may reorg.';
    case 'solana-mainnet':
      return 'Probabilistic finality; recent blocks may reorganize.';
    default:
      return 'External chain finality is provider-reported and may change.';
  }
}

export function minConfirmationsForLikelyFinal(chainId: ExternalBlockchainId): number {
  switch (chainId) {
    case 'bitcoin-mainnet':
      return 6;
    case 'bitcoin-testnet':
      return 3;
    case 'ethereum-mainnet':
      return 32;
    case 'solana-mainnet':
      return 32;
    default:
      return 12;
  }
}
