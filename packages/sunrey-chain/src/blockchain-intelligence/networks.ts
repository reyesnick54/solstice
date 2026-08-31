/**
 * External network registry and per-chain capability matrix.
 */

import type { ChainCapability, ExternalNetwork, ExternalNetworkObservationSupport } from './types.ts';

function caps(
  read: Partial<Record<ChainCapability, boolean>> = {},
): Readonly<Record<ChainCapability, boolean>> {
  const base: Record<ChainCapability, boolean> = {
    READ_BLOCKS: false,
    READ_TRANSACTIONS: false,
    READ_BALANCES: false,
    READ_CONTRACTS: false,
    READ_TOKEN_METADATA: false,
    READ_EVENTS: false,
    FEE_ESTIMATE: false,
    MARKET_REFERENCE: false,
    CUSTODY: false,
    DEPOSIT: false,
    WITHDRAWAL: false,
    EXECUTION: false,
  };
  for (const [key, value] of Object.entries(read)) {
    base[key as ChainCapability] = value ?? false;
  }
  return Object.freeze(base);
}

function observation(
  overrides: Partial<ExternalNetworkObservationSupport> = {},
): ExternalNetworkObservationSupport {
  return Object.freeze({
    observable: overrides.observable ?? true,
    referenceMarketData: overrides.referenceMarketData ?? false,
    custody: overrides.custody ?? false,
    execution: overrides.execution ?? false,
  });
}

export const EXTERNAL_NETWORKS: readonly ExternalNetwork[] = Object.freeze([
  Object.freeze({
    networkId: 'ethereum-mainnet',
    name: 'Ethereum Mainnet',
    chainFamily: 'evm',
    nativeAsset: 'ETH',
    networkType: 'mainnet',
    expectedChainId: '0x1',
    readSupport: true,
    explorerSupport: true,
    rpcSupport: true,
    status: 'active',
    providers: Object.freeze([
      'cloudflare-eth-rpc',
      'infura-ethereum',
      'alchemy-ethereum',
      'etherscan',
      'blockscout',
      'ethplorer',
      'chainlink-feeds',
      'the-graph',
      'covalent',
    ]),
    capabilities: caps({
      READ_BLOCKS: true,
      READ_TRANSACTIONS: true,
      READ_BALANCES: true,
      READ_CONTRACTS: true,
      READ_TOKEN_METADATA: true,
      READ_EVENTS: true,
      FEE_ESTIMATE: true,
      MARKET_REFERENCE: true,
    }),
    observationSupport: observation({ referenceMarketData: true }),
  }),
  Object.freeze({
    networkId: 'bitcoin-mainnet',
    name: 'Bitcoin Mainnet',
    chainFamily: 'bitcoin',
    nativeAsset: 'BTC',
    networkType: 'mainnet',
    expectedChainId: null,
    readSupport: true,
    explorerSupport: true,
    rpcSupport: false,
    status: 'active',
    providers: Object.freeze(['mempool-space']),
    capabilities: caps({
      READ_BLOCKS: true,
      READ_TRANSACTIONS: true,
      READ_BALANCES: true,
      FEE_ESTIMATE: true,
      MARKET_REFERENCE: true,
    }),
    observationSupport: observation({ referenceMarketData: true }),
  }),
  Object.freeze({
    networkId: 'solana-mainnet',
    name: 'Solana Mainnet',
    chainFamily: 'solana',
    nativeAsset: 'SOL',
    networkType: 'mainnet',
    expectedChainId: null,
    readSupport: true,
    explorerSupport: false,
    rpcSupport: true,
    status: 'active',
    providers: Object.freeze(['solana-public-rpc']),
    capabilities: caps({
      READ_BLOCKS: true,
      READ_TRANSACTIONS: true,
      READ_BALANCES: true,
      READ_CONTRACTS: true,
      FEE_ESTIMATE: true,
    }),
    observationSupport: observation(),
  }),
  Object.freeze({
    networkId: 'sunrey-native',
    name: 'SunRey Blockchain',
    chainFamily: 'other',
    nativeAsset: 'SUNREY',
    networkType: 'mainnet',
    expectedChainId: 'sunrey-mainnet',
    readSupport: true,
    explorerSupport: true,
    rpcSupport: true,
    status: 'active',
    providers: Object.freeze(['sunrey-native']),
    capabilities: caps({
      READ_BLOCKS: true,
      READ_TRANSACTIONS: true,
      READ_BALANCES: true,
      CUSTODY: true,
      DEPOSIT: true,
      WITHDRAWAL: true,
      EXECUTION: true,
    }),
    observationSupport: observation({
      observable: true,
      referenceMarketData: true,
      custody: true,
      execution: true,
    }),
  }),
]);

export function networkById(networkId: string): ExternalNetwork | undefined {
  return EXTERNAL_NETWORKS.find((n) => n.networkId === networkId);
}

export function networksForProvider(providerId: string): readonly ExternalNetwork[] {
  return Object.freeze(EXTERNAL_NETWORKS.filter((n) => n.providers.includes(providerId)));
}

export function capabilityMatrix(): Readonly<Record<string, Readonly<Record<ChainCapability, boolean>>>> {
  const matrix: Record<string, Readonly<Record<ChainCapability, boolean>>> = {};
  for (const network of EXTERNAL_NETWORKS) {
    matrix[network.networkId] = network.capabilities;
  }
  return Object.freeze(matrix);
}
