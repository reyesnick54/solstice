/**
 * BTCGlobe fixture-backed adapter — fallback Bitcoin network statistics.
 */

import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { BlockchainIntelligenceProvider, BlockchainIntelligenceProviderHealth } from '../provider.ts';
import type { ExternalBlockchainId } from '../types.ts';
import {
  buildNetworkMetrics,
  fail,
  loadChainFixture,
  normalizeMempoolObservation,
  normalizeMempoolSpaceBlock,
  ok,
  type AdapterScenario,
} from './base.ts';

const PROVIDER_ID = 'btcglobe';
const SUPPORTED: readonly ExternalBlockchainId[] = Object.freeze(['bitcoin-mainnet']);

export class BtcGlobeAdapter implements BlockchainIntelligenceProvider {
  readonly providerId = PROVIDER_ID;
  readonly capabilities = Object.freeze([
    'blockchain_intelligence',
    'bitcoin_network',
    'network_statistics',
    'mempool',
  ] as const);
  readonly priority = 'fallback' as const;
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
      status: 'healthy',
      circuitState: 'CLOSED',
      rateLimited: false,
      lastSuccessAt: nowUtc,
      message: null,
    });
  }

  supportsChain(chainId: ExternalBlockchainId): boolean {
    return (this.supportedChains as readonly string[]).includes(chainId);
  }

  async getNetworkStatus(chainId: ExternalBlockchainId, nowUtc: UtcInstant) {
    const block = await this.getLatestBlock(chainId, nowUtc);
    if (!block.ok) return block;
    const { buildNetworkStatus } = await import('./base.ts');
    return ok(buildNetworkStatus(chainId, this.providerId, block.value, null, nowUtc), this.providerId);
  }

  async getLatestBlock(chainId: ExternalBlockchainId, nowUtc: UtcInstant) {
    const raw = loadChainFixture('mempool-space-block.json') as Record<string, unknown>;
    return ok(normalizeMempoolSpaceBlock(raw, chainId, this.providerId, nowUtc), this.providerId);
  }

  async getBlock(chainId: ExternalBlockchainId, _id: string | number, nowUtc: UtcInstant) {
    return this.getLatestBlock(chainId, nowUtc);
  }

  async getTransaction() {
    return fail('UNSUPPORTED', 'transaction lookup not in btcglobe fixture scope', this.providerId);
  }

  async getFeeEstimate(chainId: ExternalBlockchainId, nowUtc: UtcInstant) {
    const raw = loadChainFixture('mempool-space-mempool.json') as Record<string, unknown>;
    const { normalizeMempoolFees } = await import('./base.ts');
    return ok(normalizeMempoolFees(raw, chainId, this.providerId, nowUtc), this.providerId);
  }

  async getMempoolStatus(chainId: ExternalBlockchainId, nowUtc: UtcInstant) {
    const raw = loadChainFixture('mempool-space-mempool.json') as Record<string, unknown>;
    return ok(normalizeMempoolObservation(raw, chainId, this.providerId, nowUtc, 'derived_data'), this.providerId);
  }

  async getNetworkMetrics(chainId: ExternalBlockchainId, nowUtc: UtcInstant) {
    return ok(
      buildNetworkMetrics(chainId, this.providerId, {
        hashrate: '649.0',
        difficulty: '88913528925798.77',
        block_interval: 605,
        tps: 4.8,
      }, nowUtc),
      this.providerId,
    );
  }
}

export function createBtcGlobeAdapter(): BtcGlobeAdapter {
  return new BtcGlobeAdapter();
}
