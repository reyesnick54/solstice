// @ts-nocheck
/**
 * World surface — Bitcoin network health display via canonical APIs.
 */

import type { UtcInstant } from '../../../domain/src/time.ts';
import type { ExternalChainIntelligenceService } from '../../../sunrey-chain/src/chain-intelligence/service.ts';
import type { ExternalBlockchainId } from '../../../sunrey-chain/src/chain-intelligence/types.ts';

export type WorldBlockchainHealthSnapshot = {
  readonly schema: 'sunrey.world.blockchain-health.v1';
  readonly generatedAt: UtcInstant;
  readonly chains: readonly {
    readonly chainId: ExternalBlockchainId;
    readonly healthy: boolean;
    readonly latestBlockHeight: number | null;
    readonly hashrate: string | null;
    readonly mempoolCongestion: string;
    readonly priorityFeeRate: string | null;
    readonly priorityFeeUnit: string | null;
    readonly providerId: string;
  }[];
};

export async function buildWorldBlockchainHealth(
  service: ExternalChainIntelligenceService,
  chainIds: readonly ExternalBlockchainId[],
  nowUtc: UtcInstant,
): Promise<WorldBlockchainHealthSnapshot> {
  const chains: WorldBlockchainHealthSnapshot['chains'][number][] = [];
  for (const chainId of chainIds) {
    const status = await service.getNetworkStatus(chainId, nowUtc);
    const metrics = await service.getNetworkMetrics(chainId, nowUtc);
    const fees = await service.getFeeEstimate(chainId, nowUtc);
    const priority = fees.ok ? fees.value.tiers.find((t) => t.label === 'priority') : null;
    chains.push(
      Object.freeze({
        chainId,
        healthy: status.ok ? status.value.healthy : false,
        latestBlockHeight: status.ok ? status.value.latestBlockHeight : null,
        hashrate: metrics.ok ? metrics.value.hashrate : null,
        mempoolCongestion: status.ok ? status.value.mempoolCongestion : 'unknown',
        priorityFeeRate: priority ? priority.rate.toString() : null,
        priorityFeeUnit: priority?.unit ?? null,
        providerId: status.ok ? status.value.providerId : 'none',
      }),
    );
  }
  return Object.freeze({
    schema: 'sunrey.world.blockchain-health.v1',
    generatedAt: nowUtc,
    chains: Object.freeze(chains),
  });
}
