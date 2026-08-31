/**
 * Mempool.space fixture-backed adapter — primary Bitcoin network intelligence.
 */

import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { BlockchainIntelligenceProvider, BlockchainIntelligenceProviderHealth } from '../provider.ts';
import type { ExternalBlockchainId } from '../types.ts';
import {
  buildNetworkMetrics,
  buildNetworkStatus,
  fail,
  loadChainFixture,
  normalizeBitcoinTransaction,
  normalizeMempoolObservation,
  normalizeMempoolSpaceBlock,
  ok,
  type AdapterScenario,
} from './base.ts';

const PROVIDER_ID = 'mempool-space';
const SUPPORTED: readonly ExternalBlockchainId[] = Object.freeze(['bitcoin-mainnet', 'bitcoin-testnet']);

export class MempoolSpaceAdapter implements BlockchainIntelligenceProvider {
  readonly providerId = PROVIDER_ID;
  readonly capabilities = Object.freeze([
    'blockchain_intelligence',
    'bitcoin_network',
    'mempool',
    'block_explorer',
    'network_statistics',
    'onchain_reference',
  ] as const);
  readonly priority = 'primary' as const;
  readonly supportedChains = SUPPORTED;
  readonly productionAuthorized = false as const;
  readonly liveProviderConnected = false as const;

  #scenario: AdapterScenario = 'normal';

  setScenario(scenario: AdapterScenario): void {
    this.#scenario = scenario;
  }

  health(nowUtc: UtcInstant): BlockchainIntelligenceProviderHealth {
    return Object.freeze({
      providerId: this.providerId,
      status: this.#scenario === 'unavailable' || this.#scenario === 'timeout' ? 'unavailable' : 'healthy',
      circuitState: this.#scenario === 'unavailable' ? 'OPEN' : 'CLOSED',
      rateLimited: this.#scenario === 'rate_limited',
      lastSuccessAt: this.#scenario === 'unavailable' ? null : nowUtc,
      message: this.#scenario === 'rate_limited' ? 'HTTP 429' : null,
    });
  }

  supportsChain(chainId: ExternalBlockchainId): boolean {
    return (this.supportedChains as readonly string[]).includes(chainId);
  }

  async getNetworkStatus(chainId: ExternalBlockchainId, nowUtc: UtcInstant) {
    const block = await this.getLatestBlock(chainId, nowUtc);
    if (!block.ok) return block;
    const mempool = await this.getMempoolStatus(chainId, nowUtc);
    return ok(
      buildNetworkStatus(chainId, this.providerId, block.value, mempool.ok ? mempool.value : null, nowUtc),
      this.providerId,
    );
  }

  async getLatestBlock(chainId: ExternalBlockchainId, nowUtc: UtcInstant) {
    if (this.#scenario === 'timeout') {
      return fail('PROVIDER_TIMEOUT', 'request timed out', this.providerId);
    }
    if (this.#scenario === 'rate_limited') {
      return fail('RATE_LIMITED', 'HTTP 429 Too Many Requests', this.providerId);
    }
    if (this.#scenario === 'unavailable') {
      return fail('PROVIDER_UNAVAILABLE', 'provider unavailable', this.providerId);
    }
    if (!this.supportsChain(chainId)) {
      return fail('UNSUPPORTED_CHAIN', `chain ${chainId} not supported`, this.providerId);
    }
    const raw = { ...(loadChainFixture('mempool-space-block.json') as Record<string, unknown>) };
    if (this.#scenario === 'disagreeing') {
      raw.height = Number(raw.height) + 1;
    }
    return ok(normalizeMempoolSpaceBlock(raw, chainId, this.providerId, nowUtc), this.providerId);
  }

  async getBlock(chainId: ExternalBlockchainId, identifier: string | number, nowUtc: UtcInstant) {
    return this.getLatestBlock(chainId, nowUtc);
  }

  async getTransaction(chainId: ExternalBlockchainId, txHash: string, nowUtc: UtcInstant) {
    const raw = { ...(loadChainFixture('blockchain-com-tx.json') as Record<string, unknown>), hash: txHash };
    return ok(normalizeBitcoinTransaction(raw, chainId, this.providerId, nowUtc), this.providerId);
  }

  async getFeeEstimate(chainId: ExternalBlockchainId, nowUtc: UtcInstant) {
    const raw = loadChainFixture('mempool-space-mempool.json') as Record<string, unknown>;
    const { normalizeMempoolFees } = await import('./base.ts');
    return ok(normalizeMempoolFees(raw, chainId, this.providerId, nowUtc), this.providerId);
  }

  async getMempoolStatus(chainId: ExternalBlockchainId, nowUtc: UtcInstant) {
    const raw = loadChainFixture('mempool-space-mempool.json') as Record<string, unknown>;
    return ok(normalizeMempoolObservation(raw, chainId, this.providerId, nowUtc, 'community_data'), this.providerId);
  }

  async getNetworkMetrics(chainId: ExternalBlockchainId, nowUtc: UtcInstant) {
    const raw = loadChainFixture('mempool-space-block.json') as Record<string, unknown>;
    return ok(
      buildNetworkMetrics(chainId, this.providerId, {
        hashrate: '650.5',
        difficulty: raw.difficulty,
        block_interval: 600,
        tps: 5.2,
        active_addresses: 950000,
        circulating_supply: '19850000',
      }, nowUtc),
      this.providerId,
    );
  }
}

export function createMempoolSpaceAdapter(): MempoolSpaceAdapter {
  return new MempoolSpaceAdapter();
}
