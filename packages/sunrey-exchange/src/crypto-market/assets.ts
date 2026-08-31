/**
 * Canonical crypto asset identity registry.
 *
 * Symbols alone are not globally unique. Identity includes network,
 * contract address, and provider-native IDs where applicable.
 *
 * SunRey Coin and MoonRey Coin are native SunRey blockchain assets and
 * are NOT mapped to external chain identities.
 */

import { createHash } from 'node:crypto';

import { MOONREY_COIN_NATIVE_ASSET_ID, SUNREY_COIN_NATIVE_ASSET_ID } from '../ids.ts';
import type { CryptoAssetIdentity, CryptoAssetType } from './types.ts';

export const CRYPTO_ASSET_REGISTRY_ID = 'sunrey.crypto-asset-registry.v1' as const;

export const NATIVE_SUNREY_ASSET_IDS = Object.freeze([SUNREY_COIN_NATIVE_ASSET_ID, MOONREY_COIN_NATIVE_ASSET_ID]);

export type RegisteredCryptoAsset = CryptoAssetIdentity & {
  readonly quoteCurrencies: readonly string[];
};

function canonicalExternalId(parts: readonly string[]): string {
  return `cext_${createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 24)}`;
}

function cryptoAssetId(
  symbol: string,
  network: string,
  contractAddress: string | null,
  quoteCurrency: string,
): string {
  const contract = contractAddress ?? 'native';
  return `CRYPTO:${symbol.toUpperCase()}:${network}:${contract}:${quoteCurrency.toUpperCase()}`;
}

function registerAsset(input: {
  readonly name: string;
  readonly symbol: string;
  readonly assetType: CryptoAssetType;
  readonly network: string;
  readonly contractAddress: string | null;
  readonly quoteCurrencies: readonly string[];
  readonly providerIds: Readonly<Record<string, string>>;
}): readonly RegisteredCryptoAsset[] {
  return input.quoteCurrencies.map((quoteCurrency) => {
    const assetId = cryptoAssetId(input.symbol, input.network, input.contractAddress, quoteCurrency);
    return Object.freeze({
      assetId,
      canonicalExternalId: canonicalExternalId([input.symbol, input.network, input.contractAddress ?? 'native', quoteCurrency]),
      name: input.name,
      symbol: input.symbol.toUpperCase(),
      assetType: input.assetType,
      network: input.network,
      contractAddress: input.contractAddress,
      providerIds: Object.freeze({ ...input.providerIds }),
      quoteCurrencies: Object.freeze([...input.quoteCurrencies]),
    });
  });
}

const BTC_PROVIDER_IDS = Object.freeze({
  coingecko: 'bitcoin',
  coincap: 'bitcoin',
  coinpaprika: 'btc-bitcoin',
  coinlore: '90',
  cryptocompare: 'BTC',
});

const ETH_PROVIDER_IDS = Object.freeze({
  coingecko: 'ethereum',
  coincap: 'ethereum',
  coinpaprika: 'eth-ethereum',
  coinlore: '80',
  cryptocompare: 'ETH',
});

const SOL_PROVIDER_IDS = Object.freeze({
  coingecko: 'solana',
  coincap: 'solana',
  coinpaprika: 'sol-solana',
  coinlore: '48543',
  cryptocompare: 'SOL',
});

const USDT_ERC20_PROVIDER_IDS = Object.freeze({
  coingecko: 'tether',
  coincap: 'tether',
  coinpaprika: 'usdt-tether',
  coinlore: '518',
  cryptocompare: 'USDT',
});

const USDC_ERC20_PROVIDER_IDS = Object.freeze({
  coingecko: 'usd-coin',
  coincap: 'usd-coin',
  coinpaprika: 'usdc-usd-coin',
  coinlore: '485',
  cryptocompare: 'USDC',
});

export const REGISTERED_CRYPTO_ASSETS: readonly RegisteredCryptoAsset[] = Object.freeze([
  ...registerAsset({
    name: 'Bitcoin',
    symbol: 'BTC',
    assetType: 'native',
    network: 'bitcoin',
    contractAddress: null,
    quoteCurrencies: ['USD', 'USDT'],
    providerIds: BTC_PROVIDER_IDS,
  }),
  ...registerAsset({
    name: 'Ethereum',
    symbol: 'ETH',
    assetType: 'native',
    network: 'ethereum',
    contractAddress: null,
    quoteCurrencies: ['USD', 'USDT'],
    providerIds: ETH_PROVIDER_IDS,
  }),
  ...registerAsset({
    name: 'Solana',
    symbol: 'SOL',
    assetType: 'native',
    network: 'solana',
    contractAddress: null,
    quoteCurrencies: ['USD'],
    providerIds: SOL_PROVIDER_IDS,
  }),
  ...registerAsset({
    name: 'Tether',
    symbol: 'USDT',
    assetType: 'stablecoin',
    network: 'ethereum',
    contractAddress: '0xdac17f958d2ee523a2206206994597c13d831ec7',
    quoteCurrencies: ['USD'],
    providerIds: USDT_ERC20_PROVIDER_IDS,
  }),
  ...registerAsset({
    name: 'USD Coin',
    symbol: 'USDC',
    assetType: 'stablecoin',
    network: 'ethereum',
    contractAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    quoteCurrencies: ['USD'],
    providerIds: USDC_ERC20_PROVIDER_IDS,
  }),
]);

const ASSET_BY_ID = new Map(REGISTERED_CRYPTO_ASSETS.map((asset) => [asset.assetId, asset]));
const ASSET_BY_SYMBOL_NETWORK = new Map(
  REGISTERED_CRYPTO_ASSETS.map((asset) => [`${asset.symbol}@${asset.network}`, asset]),
);

export function isNativeSunReyAsset(assetId: string): boolean {
  return (NATIVE_SUNREY_ASSET_IDS as readonly string[]).includes(assetId);
}

export function resolveCryptoAsset(assetId: string): RegisteredCryptoAsset | undefined {
  if (isNativeSunReyAsset(assetId)) {
    return undefined;
  }
  return ASSET_BY_ID.get(assetId);
}

export function resolveCryptoAssetBySymbolNetwork(symbol: string, network: string): RegisteredCryptoAsset | undefined {
  return ASSET_BY_SYMBOL_NETWORK.get(`${symbol.toUpperCase()}@${network}`);
}

export function providerNativeId(asset: RegisteredCryptoAsset, providerId: string): string | undefined {
  return asset.providerIds[providerId];
}

export function searchRegisteredCryptoAssets(query: string, limit = 20): readonly RegisteredCryptoAsset[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return Object.freeze(REGISTERED_CRYPTO_ASSETS.slice(0, limit));
  }
  const matches = REGISTERED_CRYPTO_ASSETS.filter(
    (asset) =>
      asset.symbol.toLowerCase().includes(normalized) ||
      asset.name.toLowerCase().includes(normalized) ||
      asset.network.toLowerCase().includes(normalized),
  );
  const unique = new Map<string, RegisteredCryptoAsset>();
  for (const asset of matches) {
    const key = `${asset.symbol}@${asset.network}`;
    if (!unique.has(key)) {
      unique.set(key, asset);
    }
  }
  return Object.freeze([...unique.values()].slice(0, limit));
}

export function disambiguateSymbolCollision(symbol: string): readonly RegisteredCryptoAsset[] {
  return Object.freeze(REGISTERED_CRYPTO_ASSETS.filter((asset) => asset.symbol === symbol.toUpperCase()));
}
