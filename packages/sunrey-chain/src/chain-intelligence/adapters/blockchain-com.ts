/**
 * Blockchain.com Explorer API fixture-backed adapter — secondary Bitcoin source.
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

const PROVIDER_ID = 'blockchain-com';
const SUPPORTED: readonly ExternalBlockchainId[] = Object.freeze(['bitcoin-mainnet']);

export class BlockchainComAdapter implements BlockchainIntelligenceProvider {
  readonly providerId = PROVIDER_ID;
  readonly capabilities = Object.freeze([
    'blockchain_intelligence',
    'bitcoin_network',
    'block_explorer',
    'network_statistics',
    'onchain_reference',
  ] as const);
  readonly priority = 'secondary' as const;
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
      status: this.#scenario === 'unavailable' ? 'unavailable' : 'healthy',
      circuitState: this.#scenario === 'unavailable' ? 'OPEN' : 'CLOSED',
      rateLimited: this.#scenario === 'rate_limited',
      lastSuccessAt: this.#scenario === 'unavailable' ? null : nowUtc,
      message: null,
    });
  }

  supportsChain(chainId: ExternalBlockchainId): boolean {
    return (this.supportedChains as readonly string[]).includes(chainId);
  }

  async getNetworkStatus(chainId: ExternalBlockchainId, nowUtc: UtcInstant) {
    const block = await this.getLatestBlock(chainId, nowUtc);
    if (!block.ok) return block;
    return ok(buildNetworkStatus(chainId, this.providerId, block.value, null, nowUtc), this.providerId);
  }

  async getLatestBlock(chainId: ExternalBlockchainId, nowUtc: UtcInstant) {
    if (this.#scenario === 'unavailable') {
      return fail('PROVIDER_UNAVAILABLE', 'provider unavailable', this.providerId);
    }
    if (!this.supportsChain(chainId)) {
      return fail('UNSUPPORTED_CHAIN', `chain ${chainId} not supported`, this.providerId);
    }
    const raw = loadChainFixture('mempool-space-block.json') as Record<string, unknown>;
    if (this.#scenario === 'disagreeing') {
      raw.id = '0000000000000000000disagreeblockhashdisagreeblockhashdisagree00';
    }
    return ok(normalizeMempoolSpaceBlock(raw, chainId, this.providerId, nowUtc), this.providerId);
  }

  async getBlock(chainId: ExternalBlockchainId, _identifier: string | number, nowUtc: UtcInstant) {
    return this.getLatestBlock(chainId, nowUtc);
  }

  async getTransaction(chainId: ExternalBlockchainId, txHash: string, nowUtc: UtcInstant) {
    if (this.#scenario === 'unavailable') {
      return fail('PROVIDER_UNAVAILABLE', 'provider unavailable', this.providerId);
    }
    const raw = loadChainFixture('blockchain-com-tx.json') as Record<string, unknown>;
    raw.hash = txHash;
    return ok(normalizeBitcoinTransaction(raw, chainId, this.providerId, nowUtc), this.providerId);
  }

  async getFeeEstimate(chainId: ExternalBlockchainId, nowUtc: UtcInstant) {
    const raw = loadChainFixture('mempool-space-mempool.json') as Record<string, unknown>;
    const { normalizeMempoolFees } = await import('./base.ts');
    return ok(normalizeMempoolFees(raw, chainId, this.providerId, nowUtc), this.providerId);
  }

  async getMempoolStatus(chainId: ExternalBlockchainId, nowUtc: UtcInstant) {
    const raw = loadChainFixture('mempool-space-mempool.json') as Record<string, unknown>;
    return ok(normalizeMempoolObservation(raw, chainId, this.providerId, nowUtc, 'reference_data'), this.providerId);
  }

  async getNetworkMetrics(chainId: ExternalBlockchainId, nowUtc: UtcInstant) {
    return ok(
      buildNetworkMetrics(chainId, this.providerId, {
        hashrate: '648.2',
        difficulty: '88913528925798.77',
        block_interval: 610,
      }, nowUtc),
      this.providerId,
    );
  }
}

export function createBlockchainComAdapter(): BlockchainComAdapter {
  return new BlockchainComAdapter();
}
