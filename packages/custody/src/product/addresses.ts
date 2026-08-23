/**
 * Deposit-address binding. An address belongs to exactly one network + asset.
 * Wrong-network destinations fail before any signing attempt.
 */

import { isNativeCustodyAssetId, type NativeCustodyAssetId } from '../native-assets.ts';
import type { WalletNetworkId } from './taxonomy.ts';

export type AddressValidationFailure = {
  readonly ok: false;
  readonly code:
    | 'UNSUPPORTED_ASSET'
    | 'UNSUPPORTED_NETWORK'
    | 'ADDRESS_NETWORK_MISMATCH'
    | 'ADDRESS_ASSET_MISMATCH'
    | 'INVALID_ADDRESS_FORMAT'
    | 'EMPTY_ADDRESS';
  readonly message: string;
};

export type AddressBinding = {
  readonly address: string;
  readonly networkId: WalletNetworkId;
  readonly assetId: NativeCustodyAssetId;
};

const NETWORK_PREFIX: Readonly<Record<WalletNetworkId, readonly string[]>> = {
  SUNREY_CHAIN: Object.freeze(['sr1', 'mr1']),
  EXTERNAL_BITCOIN: Object.freeze(['bc1', 'tb1', '1', '3']),
  EXTERNAL_ETHEREUM: Object.freeze(['0x']),
};

const ASSET_NETWORK: Readonly<Record<NativeCustodyAssetId, WalletNetworkId>> = {
  SUNREY_COIN: 'SUNREY_CHAIN',
  MOONREY_COIN: 'SUNREY_CHAIN',
};

export function networkForAsset(assetId: string): WalletNetworkId | null {
  if (!isNativeCustodyAssetId(assetId)) {
    return null;
  }
  return ASSET_NETWORK[assetId];
}

export function expectedAddressPrefix(assetId: NativeCustodyAssetId): 'sr1' | 'mr1' {
  return assetId === 'MOONREY_COIN' ? 'mr1' : 'sr1';
}

export function validateAddressBinding(input: {
  readonly address: string;
  readonly networkId: string;
  readonly assetId: string;
}): AddressBinding | AddressValidationFailure {
  const address = input.address.trim();
  if (address.length === 0) {
    return { ok: false, code: 'EMPTY_ADDRESS', message: 'destination address is required' };
  }
  if (!isNativeCustodyAssetId(input.assetId)) {
    return { ok: false, code: 'UNSUPPORTED_ASSET', message: 'asset is not a supported native custody asset' };
  }
  if (input.networkId !== 'SUNREY_CHAIN' && input.networkId !== 'EXTERNAL_BITCOIN' && input.networkId !== 'EXTERNAL_ETHEREUM') {
    return { ok: false, code: 'UNSUPPORTED_NETWORK', message: 'network is not supported' };
  }
  const requiredNetwork = ASSET_NETWORK[input.assetId];
  if (requiredNetwork !== input.networkId) {
    return {
      ok: false,
      code: 'ADDRESS_ASSET_MISMATCH',
      message: `${input.assetId} cannot move on ${input.networkId}`,
    };
  }
  const prefixes = NETWORK_PREFIX[input.networkId];
  const matchesNetwork = prefixes.some((prefix) => address.toLowerCase().startsWith(prefix.toLowerCase()));
  if (!matchesNetwork) {
    return {
      ok: false,
      code: 'INVALID_ADDRESS_FORMAT',
      message: `address is not valid for ${input.networkId}`,
    };
  }
  if (input.networkId === 'SUNREY_CHAIN') {
    const expected = expectedAddressPrefix(input.assetId);
    if (!address.toLowerCase().startsWith(expected)) {
      return {
        ok: false,
        code: 'ADDRESS_NETWORK_MISMATCH',
        message: `${input.assetId} addresses must start with ${expected}`,
      };
    }
  }
  return { address, networkId: input.networkId, assetId: input.assetId };
}

export function deriveDepositAddress(input: {
  readonly walletId: string;
  readonly assetId: NativeCustodyAssetId;
  readonly networkId: WalletNetworkId;
}): string {
  const prefix = input.networkId === 'SUNREY_CHAIN' ? expectedAddressPrefix(input.assetId) : input.networkId === 'EXTERNAL_ETHEREUM' ? '0x' : 'bc1';
  const body = input.walletId.replace(/[^a-z0-9]/gi, '').slice(-20).toLowerCase() || 'wallet';
  return `${prefix}${body}`;
}
