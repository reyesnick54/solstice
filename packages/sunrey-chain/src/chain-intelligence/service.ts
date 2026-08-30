/**
 * ExternalChainIntelligenceService — read-only external chain observation plane.
 */

import { asUtcInstant, type UtcInstant } from '../../../domain/src/time.ts';
import {
  blockCacheCapability,
  chainIntelligenceCachePolicy,
  CHAIN_INTELLIGENCE_CACHE_CAPABILITIES,
  transactionCacheCapability,
} from './cache-policies.ts';
import type { ChainIntelligenceEventBus } from './events.ts';
import { defaultChainIntelligenceEventBus } from './events.ts';
import { assertExternalBlockchainId, minConfirmationsForLikelyFinal, rejectSunReyNativeChain } from './identity.ts';
import { validateBitcoinAddress, validateTransactionHash, privacySafeAddressLogRef } from './hash.ts';
import { createChainIntelligenceAdapterFactory } from './registry.ts';
import { chainIntelligenceSeparationProof, assertExternalChainTarget } from './separation.ts';
import type { BlockchainIntelligenceProvider } from './provider.ts';
import type {
  AddressLookupResult,
  ChainIntelligenceResult,
  ChainObservation,
  ExternalBlockchainId,
  MempoolObservation,
  NetworkMetrics,
  NetworkStatus,
  NormalizedBitcoinBlock,
  NormalizedFeeEstimate,
  NormalizedTransaction,
  ProviderDisagreementEvent,
} from './types.ts';
import { CHAIN_INTELLIGENCE_AUTHORITY, CHAIN_INTELLIGENCE_SCHEMA } from './types.ts';
import { finalityNoteFor, networkLabel } from './identity.ts';

export type ExternalChainIntelligenceServiceOptions = {
  readonly nowUtc?: UtcInstant;
  readonly providers?: readonly BlockchainIntelligenceProvider[];
  readonly eventBus?: ChainIntelligenceEventBus;
};

type CacheEntry<T> = { readonly value: T; readonly expiresAtMs: number; readonly providerId: string };

export class ExternalChainIntelligenceService {
  readonly #providers: readonly BlockchainIntelligenceProvider[];
  readonly #memory = new Map<string, CacheEntry<unknown>>();
  readonly #eventBus: ChainIntelligenceEventBus;
  readonly #disagreements: ProviderDisagreementEvent[] = [];
  readonly #addressLogRefs: string[] = [];

  constructor(options: ExternalChainIntelligenceServiceOptions = {}) {
    const factory = createChainIntelligenceAdapterFactory();
    this.#providers = Object.freeze(
      options.providers ?? factory.createAll(),
    );
    this.#eventBus = options.eventBus ?? defaultChainIntelligenceEventBus;
  }

  listProviders(): readonly BlockchainIntelligenceProvider[] {
    return this.#providers;
  }

  separationProof() {
    return chainIntelligenceSeparationProof();
  }

  disagreementEvents(): readonly ProviderDisagreementEvent[] {
    return Object.freeze([...this.#disagreements]);
  }

  addressLookupLogRefs(): readonly string[] {
    return Object.freeze([...this.#addressLogRefs]);
  }

  async getNetworkStatus(chainId: string, nowUtc: UtcInstant): Promise<ChainIntelligenceResult<NetworkStatus>> {
    const chain = this.#resolveChain(chainId);
    if (!chain.ok) return chain;
    return this.#withFallback(
      chain.value,
      (p) => p.getNetworkStatus(chain.value, nowUtc),
      CHAIN_INTELLIGENCE_CACHE_CAPABILITIES.networkMetadata,
      `status:${chain.value}`,
    );
  }

  async getLatestBlock(chainId: string, nowUtc: UtcInstant): Promise<ChainIntelligenceResult<NormalizedBitcoinBlock>> {
    const chain = this.#resolveChain(chainId);
    if (!chain.ok) return chain;
    const result = await this.#withFallback(
      chain.value,
      (p) => p.getLatestBlock(chain.value, nowUtc),
      CHAIN_INTELLIGENCE_CACHE_CAPABILITIES.latestBlock,
      `block:latest:${chain.value}`,
    );
    if (result.ok) {
      await this.#detectBlockDisagreement(chain.value, result.value, nowUtc);
    }
    return result;
  }

  async getBlock(
    chainId: string,
    identifier: string | number,
    nowUtc: UtcInstant,
  ): Promise<ChainIntelligenceResult<NormalizedBitcoinBlock>> {
    const chain = this.#resolveChain(chainId);
    if (!chain.ok) return chain;
    const capability = blockCacheCapability('PROBABILISTIC');
    return this.#withFallback(
      chain.value,
      (p) => p.getBlock(chain.value, identifier, nowUtc),
      capability,
      `block:${chain.value}:${identifier}`,
    );
  }

  async getTransaction(
    chainId: string,
    txHash: string,
    nowUtc: UtcInstant,
  ): Promise<ChainIntelligenceResult<NormalizedTransaction>> {
    const chain = this.#resolveChain(chainId);
    if (!chain.ok) return chain;
    const family = chain.value.startsWith('ethereum') ? 'ethereum' : 'bitcoin';
    const validation = validateTransactionHash(family, txHash);
    if (!validation.ok) {
      return { ok: false, code: validation.code, message: validation.message, providerId: null };
    }
    return this.#withFallback(
      chain.value,
      (p) => p.getTransaction(chain.value, txHash, nowUtc),
      CHAIN_INTELLIGENCE_CACHE_CAPABILITIES.transactionUnconfirmed,
      `tx:${chain.value}:${txHash}`,
    );
  }

  async getFeeEstimate(chainId: string, nowUtc: UtcInstant): Promise<ChainIntelligenceResult<NormalizedFeeEstimate>> {
    const chain = this.#resolveChain(chainId);
    if (!chain.ok) return chain;
    return this.#withFallback(
      chain.value,
      (p) => p.getFeeEstimate(chain.value, nowUtc),
      CHAIN_INTELLIGENCE_CACHE_CAPABILITIES.feeEstimate,
      `fee:${chain.value}`,
    );
  }

  async getMempoolStatus(chainId: string, nowUtc: UtcInstant): Promise<ChainIntelligenceResult<MempoolObservation>> {
    const chain = this.#resolveChain(chainId);
    if (!chain.ok) return chain;
    return this.#withFallback(
      chain.value,
      (p) => p.getMempoolStatus(chain.value, nowUtc),
      CHAIN_INTELLIGENCE_CACHE_CAPABILITIES.mempoolStatus,
      `mempool:${chain.value}`,
    );
  }

  async getNetworkMetrics(chainId: string, nowUtc: UtcInstant): Promise<ChainIntelligenceResult<NetworkMetrics>> {
    const chain = this.#resolveChain(chainId);
    if (!chain.ok) return chain;
    return this.#withFallback(
      chain.value,
      (p) => p.getNetworkMetrics(chain.value, nowUtc),
      CHAIN_INTELLIGENCE_CACHE_CAPABILITIES.networkMetrics,
      `metrics:${chain.value}`,
    );
  }

  async lookupAddress(
    chainId: string,
    address: string,
    nowUtc: UtcInstant,
  ): Promise<ChainIntelligenceResult<AddressLookupResult>> {
    const chain = this.#resolveChain(chainId);
    if (!chain.ok) return chain;
    if (chain.value.startsWith('bitcoin')) {
      const validation = validateBitcoinAddress(address);
      if (!validation.ok) {
        return { ok: false, code: validation.code, message: validation.message, providerId: null };
      }
    }
    const logRef = privacySafeAddressLogRef(address);
    this.#addressLogRefs.push(logRef);
    for (const provider of this.#sortedProviders(chain.value)) {
      if (!provider.lookupAddress) continue;
      const result = await provider.lookupAddress(chain.value, address, nowUtc);
      if (result.ok) {
        return {
          ok: true,
          value: Object.freeze({ ...result.value, privacySafeLogRef: logRef }),
          fromCache: result.fromCache,
          fallbackProviderId: result.fallbackProviderId,
        };
      }
    }
    return {
      ok: true,
      value: Object.freeze({
        chainId: chain.value,
        addressHash: logRef,
        balanceSat: null,
        transactionCount: null,
        timestamp: nowUtc,
        providerId: 'none',
        privacySafeLogRef: logRef,
      }),
      fromCache: false,
      fallbackProviderId: null,
    };
  }

  toChainObservation(
    chainId: ExternalBlockchainId,
    observationType: ChainObservation['observationType'],
    data: ChainObservation['data'],
    providerId: string,
    nowUtc: UtcInstant,
  ): ChainObservation {
    return Object.freeze({
      schema: CHAIN_INTELLIGENCE_SCHEMA,
      authority: CHAIN_INTELLIGENCE_AUTHORITY,
      chainId,
      network: networkLabel(chainId),
      observationType,
      blockHeight: data.kind === 'BLOCK' ? data.block.height : data.kind === 'TRANSACTION' ? data.transaction.blockHeight : null,
      blockHash: data.kind === 'BLOCK' ? data.block.hash : data.kind === 'TRANSACTION' ? data.transaction.blockHash : null,
      transactionHash: data.kind === 'TRANSACTION' ? data.transaction.txHash : null,
      timestamp: nowUtc,
      providerId,
      retrievedAt: nowUtc,
      freshness: Object.freeze({ status: 'fresh', ageMs: 0n, assessedAt: nowUtc }),
      authorityClass: 'reference_data',
      provenance: Object.freeze({
        providerId,
        authorityClass: 'reference_data',
        sourceUrl: null,
        rawPayloadHash: null,
        observationId: `ci_${providerId}_${Date.now()}`,
        capability: observationType.toLowerCase(),
      }),
      data,
      reorgAware: true,
      finalityNote: finalityNoteFor(chainId),
    });
  }

  #resolveChain(chainId: string): ChainIntelligenceResult<ExternalBlockchainId> {
    try {
      rejectSunReyNativeChain(chainId);
      assertExternalChainTarget(chainId);
      return { ok: true, value: assertExternalBlockchainId(chainId), fromCache: false, fallbackProviderId: null };
    } catch (error) {
      return {
        ok: false,
        code: 'INVALID_CHAIN',
        message: error instanceof Error ? error.message : 'invalid chain',
        providerId: null,
      };
    }
  }

  #sortedProviders(chainId: ExternalBlockchainId): readonly BlockchainIntelligenceProvider[] {
    const order = { primary: 0, secondary: 1, fallback: 2 } as const;
    return Object.freeze(
      [...this.#providers]
        .filter((p) => p.supportsChain(chainId))
        .sort((a, b) => order[a.priority] - order[b.priority]),
    );
  }

  async #withFallback<T>(
    chainId: ExternalBlockchainId,
    call: (provider: BlockchainIntelligenceProvider) => Promise<ChainIntelligenceResult<T>>,
    cacheCapability: string,
    cacheKey: string,
  ): Promise<ChainIntelligenceResult<T>> {
    const cached = this.#readCache<T>(cacheKey, cacheCapability);
    if (cached) {
      return { ok: true, value: cached.value, fromCache: true, fallbackProviderId: cached.providerId };
    }
    const sorted = this.#sortedProviders(chainId);
    let lastError: ChainIntelligenceResult<T> | null = null;
    for (const provider of sorted) {
      const result = await call(provider);
      if (result.ok) {
        this.#writeCache(cacheKey, cacheCapability, result.value, provider.providerId);
        return {
          ok: true,
          value: result.value,
          fromCache: result.fromCache,
          fallbackProviderId: provider.priority !== 'primary' ? provider.providerId : result.fallbackProviderId,
        };
      }
      lastError = result;
    }
    return lastError ?? { ok: false, code: 'NO_PROVIDERS', message: 'no chain intelligence providers', providerId: null };
  }

  async #detectBlockDisagreement(
    chainId: ExternalBlockchainId,
    primaryBlock: NormalizedBitcoinBlock,
    nowUtc: UtcInstant,
  ): Promise<void> {
    const bitcoinProviders = this.#sortedProviders(chainId).filter((p) => p.priority !== 'primary');
    if (bitcoinProviders.length === 0) return;
    const secondary = bitcoinProviders[0]!;
    const secondaryResult = await secondary.getLatestBlock(chainId, nowUtc);
    if (!secondaryResult.ok) return;
    if (secondaryResult.value.hash !== primaryBlock.hash && secondaryResult.value.height === primaryBlock.height) {
      const event = this.#eventBus.emitDisagreement({
        chainId,
        observationType: 'BLOCK',
        primaryProviderId: 'mempool-space',
        secondaryProviderId: secondary.providerId,
        field: 'blockHash',
        primaryValue: primaryBlock.hash,
        secondaryValue: secondaryResult.value.hash,
        detectedAt: nowUtc,
        severity: 'material',
      });
      this.#disagreements.push(event);
    }
  }

  #readCache<T>(key: string, capability: string): CacheEntry<T> | null {
    const policy = chainIntelligenceCachePolicy(capability);
    const entry = this.#memory.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    if (Date.now() > entry.expiresAtMs) {
      this.#memory.delete(key);
      return null;
    }
    void policy;
    return entry;
  }

  #writeCache<T>(key: string, capability: string, value: T, providerId: string): void {
    const policy = chainIntelligenceCachePolicy(capability);
    this.#memory.set(
      key,
      Object.freeze({
        value,
        providerId,
        expiresAtMs: Date.now() + policy.freshTtlMs,
      }),
    );
  }
}

export function createExternalChainIntelligenceService(
  options: ExternalChainIntelligenceServiceOptions = {},
): ExternalChainIntelligenceService {
  return new ExternalChainIntelligenceService(options);
}

export function defaultChainIntelligenceNow(): UtcInstant {
  return asUtcInstant('2026-08-21T09:00:00.000Z');
}
