/**
 * Fixture payloads for Wave 3 blockchain intelligence adapters.
 * Simulation only — no live network calls.
 */

export const FIXTURE_ETHEREUM_CHAIN_ID = '0x1';
export const FIXTURE_SOLANA_SLOT = 250_000_000;

export const FIXTURE_BLOCKS = Object.freeze({
  'ethereum-mainnet': Object.freeze({
    blockNumber: 18_500_000,
    blockHash: '0xabc123def4567890abcdef1234567890abcdef1234567890abcdef1234567890',
    parentHash: '0xdef4567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12',
    timestampUtc: '2026-08-30T12:00:00.000Z',
    transactionCount: 142,
  }),
  'bitcoin-mainnet': Object.freeze({
    blockNumber: 850_000,
    blockHash: '0000000000000000000123456789abcdef0123456789abcdef0123456789abcdef',
    parentHash: '0000000000000000000987654321fedcba0987654321fedcba0987654321fedcba',
    timestampUtc: '2026-08-30T11:55:00.000Z',
    transactionCount: 2841,
  }),
  'solana-mainnet': Object.freeze({
    blockNumber: FIXTURE_SOLANA_SLOT,
    blockHash: '5KJp7K8vQmN2xR9wL3pT6yH4jF8sD1cV7bN0mQ2rX5zA',
    parentHash: '4Jk6H7uPlM1wQ8vK2oS5xG3iE7rC0bM9lP1qW4yZ6aB',
    timestampUtc: '2026-08-30T12:00:01.000Z',
    transactionCount: 3120,
  }),
});

export const FIXTURE_TRANSACTIONS = Object.freeze({
  eth_tx: Object.freeze({
    hash: '0xdeadbeef1234567890deadbeef1234567890deadbeef1234567890deadbeef12',
    blockNumber: 18_500_000,
    from: '0x1111111111111111111111111111111111111111',
    to: '0x2222222222222222222222222222222222222222',
    valueMinor: '1000000000000000000',
    status: 'success' as const,
  }),
});

export const FIXTURE_TOKEN_USDC = Object.freeze({
  chainId: FIXTURE_ETHEREUM_CHAIN_ID,
  contractAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  symbol: 'USDC',
  name: 'USD Coin',
  decimals: 6,
  providerNativeId: 'usd-coin',
});

export const FIXTURE_CHAINLINK_ETH_USD = Object.freeze({
  feedId: 'eth-usd-mainnet',
  networkId: 'ethereum-mainnet',
  feedAddress: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419',
  assetPair: 'ETH/USD',
  valueMinor: '320000000000',
  decimals: 8,
  updatedAtUtc: '2026-08-30T12:00:00.000Z',
  roundId: '184422',
});

export const FIXTURE_CRYPTO_QUOTES = Object.freeze([
  Object.freeze({
    assetId: 'bitcoin',
    symbol: 'BTC',
    name: 'Bitcoin',
    priceUsdMinor: '65000000000',
    marketCapUsdMinor: '1280000000000000',
    volume24hUsdMinor: '28000000000000',
    updatedAtUtc: '2026-08-30T12:00:00.000Z',
    providerId: 'coingecko',
  }),
  Object.freeze({
    assetId: 'ethereum',
    symbol: 'ETH',
    name: 'Ethereum',
    priceUsdMinor: '3200000000',
    marketCapUsdMinor: '385000000000000',
    volume24hUsdMinor: '15000000000000',
    updatedAtUtc: '2026-08-30T12:00:00.000Z',
    providerId: 'coingecko',
  }),
]);

export const FIXTURE_BITCOIN_FEES = Object.freeze({
  networkId: 'bitcoin-mainnet',
  gasPriceMinor: '15000',
  baseFeeMinor: '12000',
  priorityFeeMinor: '3000',
  estimatedConfirmationBlocks: 2,
  unit: 'sat/vB',
});

export const MALFORMED_RPC_PAYLOADS = Object.freeze({
  oversized: Object.freeze({ result: '0x' + 'ff'.repeat(200_000) }),
  invalidJsonRpcId: Object.freeze({ jsonrpc: '2.0', id: 'not-a-number', result: '0x1' }),
  malformedHex: Object.freeze({ jsonrpc: '2.0', id: 1, result: '0xNOTHEX' }),
  nested: Object.freeze({ jsonrpc: '2.0', id: 1, result: { a: { b: { c: { d: { e: 'deep' } } } } } }),
  hostileString: Object.freeze({ jsonrpc: '2.0', id: 1, result: '<script>alert(1)</script>' }),
  wrongChainId: Object.freeze({ jsonrpc: '2.0', id: 1, result: '0x89' }),
});
