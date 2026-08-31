/**
 * BlockchainIntelligenceProvider — domain port for external chain observation.
 */

import type { UtcInstant } from '../../../domain/src/time.ts';
import type {
  AddressLookupResult,
  ChainIntelligenceResult,
  ExternalBlockchainId,
  MempoolObservation,
  NetworkMetrics,
  NetworkStatus,
  NormalizedBitcoinBlock,
  NormalizedFeeEstimate,
  NormalizedTransaction,
} from './types.ts';

export type BlockchainIntelligenceCapability =
  | 'bitcoin_network'
  | 'mempool'
  | 'block_explorer'
  | 'chain_intelligence'
  | 'network_statistics'
  | 'onchain_reference'
  | 'blockchain_intelligence';

export type BlockchainIntelligenceProviderHealth = {
  readonly providerId: string;
  readonly status: 'healthy' | 'degraded' | 'unavailable';
  readonly circuitState: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  readonly rateLimited: boolean;
  readonly lastSuccessAt: UtcInstant | null;
  readonly message: string | null;
};

export type BlockchainIntelligenceProvider = {
  readonly providerId: string;
  readonly capabilities: readonly BlockchainIntelligenceCapability[];
  readonly priority: 'primary' | 'secondary' | 'fallback';
  readonly supportedChains: readonly ExternalBlockchainId[];
  readonly productionAuthorized: false;
  readonly liveProviderConnected: false;
  health(nowUtc: UtcInstant): BlockchainIntelligenceProviderHealth;
  supportsChain(chainId: ExternalBlockchainId): boolean;
  getNetworkStatus(chainId: ExternalBlockchainId, nowUtc: UtcInstant): Promise<ChainIntelligenceResult<NetworkStatus>>;
  getLatestBlock(chainId: ExternalBlockchainId, nowUtc: UtcInstant): Promise<ChainIntelligenceResult<NormalizedBitcoinBlock>>;
  getBlock(
    chainId: ExternalBlockchainId,
    identifier: string | number,
    nowUtc: UtcInstant,
  ): Promise<ChainIntelligenceResult<NormalizedBitcoinBlock>>;
  getTransaction(
    chainId: ExternalBlockchainId,
    txHash: string,
    nowUtc: UtcInstant,
  ): Promise<ChainIntelligenceResult<NormalizedTransaction>>;
  getFeeEstimate(chainId: ExternalBlockchainId, nowUtc: UtcInstant): Promise<ChainIntelligenceResult<NormalizedFeeEstimate>>;
  getMempoolStatus(chainId: ExternalBlockchainId, nowUtc: UtcInstant): Promise<ChainIntelligenceResult<MempoolObservation>>;
  getNetworkMetrics(chainId: ExternalBlockchainId, nowUtc: UtcInstant): Promise<ChainIntelligenceResult<NetworkMetrics>>;
  lookupAddress?(
    chainId: ExternalBlockchainId,
    address: string,
    nowUtc: UtcInstant,
  ): Promise<ChainIntelligenceResult<AddressLookupResult>>;
};
