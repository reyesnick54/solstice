/**
 * Productized protocol-native asset registry.
 *
 * Canonical owner remains packages/sunrey-chain. This is the product
 * metadata surface over Chunk 41 (Rust native-assets) and Chunk 71
 * (monetary constitution). It does not invent tickers, max supply, or
 * a second mint.
 */

import { nativeAssetConstitution, policyFor } from '../economics/constitution.ts';
import {
  TICKER_STATUS_NOT_ASSIGNED,
  type MonetaryPolicyState,
  type NativeMonetaryAssetId,
} from '../economics/types.ts';
import { NATIVE_ASSET_TICKER_STATUS } from '../protocol/assets.ts';

export const PROTOCOL_NATIVE_ASSET_CLASS = 'PROTOCOL_NATIVE_ASSET' as const;
export const ASSET_LEDGER_KIND = 'SUNREY_CHAIN_NATIVE' as const;

export const NATIVE_ASSET_STATUSES = [
  'DEVELOPMENT_ACTIVE',
  'TESTNET_ACTIVE',
  'MAINNET_BLOCKED',
  'DISABLED',
] as const;
export type NativeAssetProductStatus = (typeof NATIVE_ASSET_STATUSES)[number];

export const SUPPLY_MODELS = [
  'GOVERNED_DUAL_NATIVE',
  'UNRESOLVED_MAINNET',
] as const;
export type NativeSupplyModel = (typeof SUPPLY_MODELS)[number];

export type CanonicalNativeAssetRecord = {
  readonly assetId: NativeMonetaryAssetId;
  readonly canonicalName: 'SunRey Coin' | 'MoonRey Coin';
  readonly ticker: typeof TICKER_STATUS_NOT_ASSIGNED;
  readonly tickerStatus: typeof TICKER_STATUS_NOT_ASSIGNED;
  readonly decimals: 6;
  readonly precision: 6;
  readonly status: NativeAssetProductStatus;
  readonly supplyModel: NativeSupplyModel;
  readonly assetClass: typeof PROTOCOL_NATIVE_ASSET_CLASS;
  readonly ledgerKind: typeof ASSET_LEDGER_KIND;
  readonly evmToken: false;
  readonly erc20: false;
  readonly thirdPartyContract: false;
  readonly genesisPolicyReference: string;
  readonly issuancePolicyReference: string;
  readonly burnPolicyReference: string;
  readonly governanceReference: string;
  readonly purpose: 'HUMAN_ECONOMIC_LAYER' | 'AUTONOMOUS_PRODUCTIVE_ECONOMY';
  readonly associatedLayer: 'HIN_HUMAN_ECONOMIC' | 'PRODUCTIVE_ECONOMY';
};

function statusOf(state: MonetaryPolicyState): NativeAssetProductStatus {
  if (state === 'TESTNET_ACTIVE') {
    return 'TESTNET_ACTIVE';
  }
  if (state === 'PRODUCTION_CANDIDATE') {
    return 'MAINNET_BLOCKED';
  }
  if (state === 'SUPERSEDED') {
    return 'DISABLED';
  }
  return 'DEVELOPMENT_ACTIVE';
}

export function canonicalNativeAsset(
  assetId: NativeMonetaryAssetId,
  state: MonetaryPolicyState = 'DEVELOPMENT_ACTIVE',
): CanonicalNativeAssetRecord {
  const constitution = nativeAssetConstitution(state);
  const policy = policyFor(constitution, assetId);
  const sunrey = assetId === 'SUNREY_COIN';
  return Object.freeze({
    assetId,
    canonicalName: policy.displayName,
    ticker: TICKER_STATUS_NOT_ASSIGNED,
    tickerStatus: TICKER_STATUS_NOT_ASSIGNED,
    decimals: 6,
    precision: 6,
    status: statusOf(state),
    supplyModel: state === 'PRODUCTION_CANDIDATE' ? 'UNRESOLVED_MAINNET' : 'GOVERNED_DUAL_NATIVE',
    assetClass: PROTOCOL_NATIVE_ASSET_CLASS,
    ledgerKind: ASSET_LEDGER_KIND,
    evmToken: false,
    erc20: false,
    thirdPartyContract: false,
    genesisPolicyReference: policy.genesisPolicy.policyVersion,
    issuancePolicyReference: policy.issuancePolicy.policyVersion,
    burnPolicyReference: policy.burnPolicy.policyVersion,
    governanceReference: policy.policyVersion.governanceReference,
    purpose: policy.assetPurpose,
    associatedLayer: sunrey ? 'HIN_HUMAN_ECONOMIC' : 'PRODUCTIVE_ECONOMY',
  });
}

export function nativeAssetRegistry(
  state: MonetaryPolicyState = 'DEVELOPMENT_ACTIVE',
): readonly CanonicalNativeAssetRecord[] {
  return Object.freeze([canonicalNativeAsset('SUNREY_COIN', state), canonicalNativeAsset('MOONREY_COIN', state)]);
}

export function requireNativeAssetRecord(
  assetId: string,
  state: MonetaryPolicyState = 'DEVELOPMENT_ACTIVE',
): CanonicalNativeAssetRecord {
  if (assetId !== 'SUNREY_COIN' && assetId !== 'MOONREY_COIN') {
    throw new TypeError(`invented asset rejected: ${assetId}`);
  }
  return canonicalNativeAsset(assetId, state);
}

export function publicTickerRemainsUnassigned(): true {
  if (NATIVE_ASSET_TICKER_STATUS !== 'NOT_ASSIGNED') {
    throw new TypeError('public ticker must remain NOT_ASSIGNED');
  }
  return true;
}
