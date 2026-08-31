/**
 * Wave 3 — external chain and blockchain intelligence canonical types.
 * Read-only observation plane. Not SunRey native chain authority.
 */

export const CHAIN_FAMILIES = ['evm', 'bitcoin', 'solana', 'other'] as const;
export type ChainFamily = (typeof CHAIN_FAMILIES)[number];

export const NETWORK_TYPES = ['mainnet', 'testnet', 'devnet', 'other'] as const;
export type NetworkType = (typeof NETWORK_TYPES)[number];

export const EXTERNAL_NETWORK_STATUSES = ['active', 'degraded', 'inactive', 'preview'] as const;
export type ExternalNetworkStatus = (typeof EXTERNAL_NETWORK_STATUSES)[number];

export const CHAIN_CAPABILITIES = [
  'READ_BLOCKS',
  'READ_TRANSACTIONS',
  'READ_BALANCES',
  'READ_CONTRACTS',
  'READ_TOKEN_METADATA',
  'READ_EVENTS',
  'FEE_ESTIMATE',
  'MARKET_REFERENCE',
  'CUSTODY',
  'DEPOSIT',
  'WITHDRAWAL',
  'EXECUTION',
] as const;
export type ChainCapability = (typeof CHAIN_CAPABILITIES)[number];

export const READ_ONLY_CAPABILITIES: readonly ChainCapability[] = Object.freeze([
  'READ_BLOCKS',
  'READ_TRANSACTIONS',
  'READ_BALANCES',
  'READ_CONTRACTS',
  'READ_TOKEN_METADATA',
  'READ_EVENTS',
  'FEE_ESTIMATE',
  'MARKET_REFERENCE',
]);

export const EXECUTION_CAPABILITIES: readonly ChainCapability[] = Object.freeze([
  'CUSTODY',
  'DEPOSIT',
  'WITHDRAWAL',
  'EXECUTION',
]);

/** Prohibited RPC operations — never exposed through Wave 3. */
export const PROHIBITED_RPC_OPERATIONS = Object.freeze([
  'sendRawTransaction',
  'sendTransaction',
  'signTransaction',
  'signMessage',
  'deployContract',
  'personal_sign',
  'eth_sendTransaction',
  'eth_sign',
  'eth_signTransaction',
]);

export type ExternalTokenIdentity = {
  readonly chainId: string;
  readonly contractAddress: string;
  readonly symbol: string;
  readonly name: string;
  readonly decimals: number;
  readonly providerNativeId: string | null;
};

export type ExternalNetworkObservationSupport = {
  readonly observable: boolean;
  readonly referenceMarketData: boolean;
  readonly custody: boolean;
  readonly execution: boolean;
};

export type ExternalNetwork = {
  readonly networkId: string;
  readonly name: string;
  readonly chainFamily: ChainFamily;
  readonly nativeAsset: string;
  readonly networkType: NetworkType;
  readonly expectedChainId: string | null;
  readonly readSupport: boolean;
  readonly explorerSupport: boolean;
  readonly rpcSupport: boolean;
  readonly status: ExternalNetworkStatus;
  readonly providers: readonly string[];
  readonly capabilities: Readonly<Record<ChainCapability, boolean>>;
  readonly observationSupport: ExternalNetworkObservationSupport;
};

export type ExternalBlockSummary = {
  readonly networkId: string;
  readonly blockNumber: number;
  readonly blockHash: string;
  readonly parentHash: string;
  readonly timestampUtc: string;
  readonly transactionCount: number;
};

export type ExternalTransactionSummary = {
  readonly networkId: string;
  readonly hash: string;
  readonly blockNumber: number | null;
  readonly from: string | null;
  readonly to: string | null;
  readonly valueMinor: string | null;
  readonly status: 'success' | 'failed' | 'pending' | 'unknown';
};

export type ExternalBalanceObservation = {
  readonly networkId: string;
  readonly address: string;
  readonly asset: string;
  readonly balanceMinor: string;
};

export type ExternalFeeEstimate = {
  readonly networkId: string;
  readonly gasPriceMinor: string | null;
  readonly baseFeeMinor: string | null;
  readonly priorityFeeMinor: string | null;
  readonly estimatedConfirmationBlocks: number | null;
  readonly unit: string;
};

export type ExternalNetworkStatusObservation = {
  readonly networkId: string;
  readonly healthy: boolean;
  readonly latestBlockNumber: number | null;
  readonly chainId: string | null;
  readonly peerCount: number | null;
  readonly synced: boolean;
  readonly message: string | null;
};

export type OracleReferenceObservation = {
  readonly feedId: string;
  readonly networkId: string;
  readonly feedAddress: string;
  readonly assetPair: string;
  readonly valueMinor: string;
  readonly decimals: number;
  readonly updatedAtUtc: string;
  readonly roundId: string | null;
  readonly providerId: string;
};

export type CryptoMarketQuote = {
  readonly assetId: string;
  readonly symbol: string;
  readonly name: string;
  readonly priceUsdMinor: string;
  readonly marketCapUsdMinor: string | null;
  readonly volume24hUsdMinor: string | null;
  readonly updatedAtUtc: string;
  readonly providerId: string;
};

export type ProviderObservationEnvelope<T> = {
  readonly providerId: string;
  readonly capability: string;
  readonly collectedAtUtc: string;
  readonly sourceTimestampUtc: string | null;
  readonly stale: boolean;
  readonly simulation: true;
  readonly data: T;
};

export type ProviderHealthSnapshot = {
  readonly providerId: string;
  readonly healthy: boolean;
  readonly degraded: boolean;
  readonly message: string;
  readonly checkedAtUtc: string;
};

export function chainScopedTokenKey(chainId: string, contractAddress: string): string {
  return `${chainId}:${contractAddress.toLowerCase()}`;
}

export function assertReadOnlyRpcOperation(operation: string): void {
  const normalized = operation.trim().toLowerCase();
  if (PROHIBITED_RPC_OPERATIONS.some((op) => normalized === op.toLowerCase())) {
    throw new Error(`prohibited_rpc_operation:${operation}`);
  }
}

export function isExecutionCapability(capability: ChainCapability): boolean {
  return (EXECUTION_CAPABILITIES as readonly string[]).includes(capability);
}
