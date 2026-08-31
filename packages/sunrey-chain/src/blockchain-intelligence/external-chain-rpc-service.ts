/**
 * External chain RPC aggregation with primary/secondary/fallback and chain-ID validation.
 */

import type { SolanaPublicRpcFixture } from './adapters/fixture-adapters.ts';
import { BlockchainIntelligenceCache } from './cache.ts';
import type { ExternalChainRpcProvider, ReadOnlyContractCall } from './external-chain-rpc-provider.ts';
import { BLOCKCHAIN_QUERY_LIMITS } from './limits.ts';
import { networkById } from './networks.ts';
import type {
  ExternalBalanceObservation,
  ExternalBlockSummary,
  ExternalFeeEstimate,
  ExternalNetworkStatusObservation,
  ExternalTokenIdentity,
  ExternalTransactionSummary,
  ProviderHealthSnapshot,
  ProviderObservationEnvelope,
} from './types.ts';

export type RpcProviderTier = {
  readonly tier: 'primary' | 'secondary' | 'fallback';
  readonly provider: ExternalChainRpcProvider;
};

export type ExternalChainRpcServiceOptions = {
  readonly ethereumProviders: readonly RpcProviderTier[];
  readonly solanaProvider: SolanaPublicRpcFixture;
  readonly cache?: BlockchainIntelligenceCache;
};

export class ExternalChainRpcService {
  readonly #ethereumProviders: readonly RpcProviderTier[];
  readonly #solana: SolanaPublicRpcFixture;
  readonly #cache: BlockchainIntelligenceCache;

  constructor(options: ExternalChainRpcServiceOptions) {
    this.#ethereumProviders = options.ethereumProviders;
    this.#solana = options.solanaProvider;
    this.#cache = options.cache ?? new BlockchainIntelligenceCache();
  }

  providerHealth(): readonly ProviderHealthSnapshot[] {
    return Object.freeze([
      ...this.#ethereumProviders.map((p) => p.provider.health()),
      this.#solana.health(),
    ]);
  }

  getNetworkStatus(networkId: string): ProviderObservationEnvelope<ExternalNetworkStatusObservation> {
    return this.#withFallback(`rpc:status:${networkId}`, this.#rpcForNetwork(networkId), (p) => p.getNetworkStatus());
  }

  getFeeEstimate(networkId: string): ProviderObservationEnvelope<ExternalFeeEstimate> {
    return this.#withFallback(`rpc:fees:${networkId}`, this.#rpcForNetwork(networkId), (p) => p.getFeeEstimate());
  }

  getLatestBlock(networkId: string): ProviderObservationEnvelope<ExternalBlockSummary> {
    return this.#withFallback(`rpc:block:${networkId}:latest`, this.#rpcForNetwork(networkId), (p) => p.getLatestBlock());
  }

  getTransaction(networkId: string, hash: string): ProviderObservationEnvelope<ExternalTransactionSummary> {
    return this.#withFallback(`rpc:tx:${networkId}:${hash}`, this.#rpcForNetwork(networkId), (p) => p.getTransaction(hash));
  }

  getBalance(networkId: string, address: string): ProviderObservationEnvelope<ExternalBalanceObservation> {
    return this.#withFallback(`rpc:balance:${networkId}:${address}`, this.#rpcForNetwork(networkId), (p) => p.getBalance(address));
  }

  getTokenMetadata(networkId: string, contractAddress: string): ProviderObservationEnvelope<ExternalTokenIdentity> {
    return this.#withFallback(
      `rpc:token:${networkId}:${contractAddress}`,
      this.#rpcForNetwork(networkId),
      (p) => p.getTokenMetadata(contractAddress),
    );
  }

  callReadOnlyContract(call: ReadOnlyContractCall): ProviderObservationEnvelope<string> {
    return this.#withFallback(
      `rpc:call:${call.networkId}:${call.contractAddress}`,
      this.#rpcForNetwork(call.networkId),
      (p) => p.callReadOnlyContract(call),
    );
  }

  #rpcForNetwork(networkId: string): readonly RpcProviderTier[] {
    const network = networkById(networkId);
    if (!network) throw new Error(`unknown_network:${networkId}`);
    if (networkId === 'solana-mainnet') {
      return Object.freeze([Object.freeze({ tier: 'primary' as const, provider: this.#solana })]);
    }
    if (networkId === 'ethereum-mainnet') return this.#ethereumProviders;
    throw new Error(`rpc_not_supported:${networkId}`);
  }

  #withFallback<T>(
    key: string,
    tiers: readonly RpcProviderTier[],
    op: (provider: ExternalChainRpcProvider) => ProviderObservationEnvelope<T>,
  ): ProviderObservationEnvelope<T> {
    const cached = this.#cache.get<ProviderObservationEnvelope<T>>(key);
    if (cached && !cached.stale) return cached.value;

    return this.#cache.singleFlight(key, () => {
      let lastError: unknown;
      for (const tier of tiers) {
        if (!tier.provider.health().healthy) continue;
        try {
          const result = op(tier.provider);
          this.#cache.set(key, result, BLOCKCHAIN_QUERY_LIMITS.cacheTtlMs, BLOCKCHAIN_QUERY_LIMITS.staleTtlMs);
          return result;
        } catch (error) {
          lastError = error;
        }
      }
      if (cached) return cached.value;
      throw lastError ?? new Error('rpc_all_providers_failed');
    });
  }
}
