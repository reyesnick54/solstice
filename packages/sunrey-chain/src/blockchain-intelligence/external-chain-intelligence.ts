/**
 * Bitcoin and external network intelligence (non-RPC chain metadata).
 */

import type { MempoolSpaceFixture } from './adapters/fixture-adapters.ts';
import { BlockchainIntelligenceCache } from './cache.ts';
import { BLOCKCHAIN_QUERY_LIMITS } from './limits.ts';
import type {
  ExternalBlockSummary,
  ExternalFeeEstimate,
  ExternalNetworkStatusObservation,
  ProviderHealthSnapshot,
  ProviderObservationEnvelope,
} from './types.ts';

export type ExternalChainIntelligenceServiceOptions = {
  readonly bitcoinProvider: MempoolSpaceFixture;
  readonly cache?: BlockchainIntelligenceCache;
};

export class ExternalChainIntelligenceService {
  readonly #bitcoin: MempoolSpaceFixture;
  readonly #cache: BlockchainIntelligenceCache;

  constructor(options: ExternalChainIntelligenceServiceOptions) {
    this.#bitcoin = options.bitcoinProvider;
    this.#cache = options.cache ?? new BlockchainIntelligenceCache();
  }

  providerHealth(): readonly ProviderHealthSnapshot[] {
    return Object.freeze([this.#bitcoin.health()]);
  }

  bitcoinNetworkStatus(): ProviderObservationEnvelope<ExternalNetworkStatusObservation> {
    return this.#cached('bitcoin:status', () => this.#bitcoin.getNetworkStatus());
  }

  bitcoinFeeEstimate(): ProviderObservationEnvelope<ExternalFeeEstimate> {
    return this.#cached('bitcoin:fees', () => this.#bitcoin.getFeeEstimate());
  }

  bitcoinLatestBlock(): ProviderObservationEnvelope<ExternalBlockSummary> {
    return this.#cached('bitcoin:block', () => this.#bitcoin.getLatestBlock());
  }

  #cached<T>(
    key: string,
    fetch: () => ProviderObservationEnvelope<T>,
  ): ProviderObservationEnvelope<T> {
    const cached = this.#cache.get<ProviderObservationEnvelope<T>>(key);
    if (cached && !cached.stale) return cached.value;
    if (!this.#bitcoin.health().healthy && cached) return cached.value;

    return this.#cache.singleFlight(key, () => {
      const value = fetch();
      this.#cache.set(key, value, BLOCKCHAIN_QUERY_LIMITS.cacheTtlMs, BLOCKCHAIN_QUERY_LIMITS.staleTtlMs);
      return value;
    });
  }
}
