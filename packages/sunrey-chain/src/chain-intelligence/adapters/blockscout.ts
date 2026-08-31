/**
 * Blockscout fixture-backed adapter — Ethereum block explorer intelligence.
 */

import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { BlockchainIntelligenceProvider, BlockchainIntelligenceProviderHealth } from '../provider.ts';
import type { ExternalBlockchainId, NormalizedBitcoinBlock } from '../types.ts';
import { asUtcInstant } from '../../../../domain/src/time.ts';
import {
  buildNetworkStatus,
  confirmationStatusFor,
  fail,
  loadChainFixture,
  normalizeBitcoinTransaction,
  ok,
  type AdapterScenario,
} from './base.ts';

const PROVIDER_ID = 'blockscout';
const SUPPORTED: readonly ExternalBlockchainId[] = Object.freeze(['ethereum-mainnet']);

export class BlockscoutAdapter implements BlockchainIntelligenceProvider {
  readonly providerId = PROVIDER_ID;
  readonly capabilities = Object.freeze([
    'blockchain_intelligence',
    'block_explorer',
    'chain_intelligence',
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
      status: this.#scenario === 'unavailable' ? 'unavailable' : 'healthy',
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
    return ok(buildNetworkStatus(chainId, this.providerId, block.value, null, nowUtc), this.providerId);
  }

  async getLatestBlock(chainId: ExternalBlockchainId, nowUtc: UtcInstant) {
    if (!this.supportsChain(chainId)) {
      return fail('UNSUPPORTED_CHAIN', `chain ${chainId} not supported`, this.providerId);
    }
    const raw = loadChainFixture('blockscout-block.json') as Record<string, unknown>;
    const block: NormalizedBitcoinBlock = Object.freeze({
      height: Number(raw.height),
      hash: String(raw.hash),
      previousHash: '',
      timestamp: asUtcInstant(String(raw.timestamp)),
      transactionCount: Number(raw.transactions_count ?? 0),
      sizeBytes: Number(raw.size ?? 0),
      weight: Number(raw.size ?? 0),
      difficulty: String(raw.difficulty ?? '0'),
      feeTotalSat: null,
      confirmationStatus: confirmationStatusFor(32, chainId),
      observedAt: nowUtc,
    });
    return ok(block, this.providerId);
  }

  async getBlock(chainId: ExternalBlockchainId, _identifier: string | number, nowUtc: UtcInstant) {
    return this.getLatestBlock(chainId, nowUtc);
  }

  async getTransaction(chainId: ExternalBlockchainId, txHash: string, nowUtc: UtcInstant) {
    const raw = {
      hash: txHash,
      block_height: 21000000,
      confirmations: 32,
      size: 21000,
      fee: 21000000000000,
      time: Math.floor(Date.parse(nowUtc) / 1000),
      inputs: [],
      outputs: [],
    };
    return ok(normalizeBitcoinTransaction(raw, chainId, this.providerId, nowUtc), this.providerId);
  }

  async getFeeEstimate(chainId: ExternalBlockchainId, nowUtc: UtcInstant) {
    return ok(
      Object.freeze({
        chainId,
        tiers: Object.freeze([
          Object.freeze({ label: 'minimum' as const, rate: 10n, unit: 'gwei' as const }),
          Object.freeze({ label: 'economy' as const, rate: 15n, unit: 'gwei' as const }),
          Object.freeze({ label: 'normal' as const, rate: 25n, unit: 'gwei' as const }),
          Object.freeze({ label: 'priority' as const, rate: 40n, unit: 'gwei' as const }),
        ]),
        timestamp: nowUtc,
        providerId: this.providerId,
        freshness: Object.freeze({ status: 'fresh' as const, ageMs: 0n, assessedAt: nowUtc }),
      }),
      this.providerId,
    );
  }

  async getMempoolStatus(chainId: ExternalBlockchainId, nowUtc: UtcInstant) {
    return fail('UNSUPPORTED', 'mempool not exposed for ethereum via blockscout fixture', this.providerId);
  }

  async getNetworkMetrics(chainId: ExternalBlockchainId, nowUtc: UtcInstant) {
    return fail('UNSUPPORTED', 'network metrics not in blockscout fixture scope', this.providerId);
  }
}

export function createBlockscoutAdapter(): BlockscoutAdapter {
  return new BlockscoutAdapter();
}
