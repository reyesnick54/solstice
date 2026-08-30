/**
 * Consumer BFF adapter for external blockchain network intelligence.
 *
 * Vendor-independent. No credentials. No raw provider APIs exposed.
 */

import {
  buildChainIntelligenceAgentEvidence,
  createExternalChainIntelligenceService,
  defaultChainIntelligenceNow,
  type ExternalBlockchainId,
} from '../../../../packages/sunrey-chain/src/chain-intelligence/index.ts';
import { buildWorldBlockchainHealth } from '../../../../packages/sunrey-exchange/src/chain-intelligence/integrations/world.ts';
import { buildExchangeChainContext } from '../../../../packages/sunrey-exchange/src/chain-intelligence/integrations/exchange.ts';

export type BlockchainIntelligenceBff = {
  readonly networkHealth: () => ReturnType<typeof buildWorldBlockchainHealth>;
  readonly bitcoinBlock: () => Promise<{
    readonly schema: 'sunrey.bff.bitcoin-block.v1';
    readonly height: number;
    readonly hash: string;
    readonly transactionCount: number;
    readonly confirmationStatus: string;
    readonly providerId: string;
    readonly reorgAware: true;
  } | { readonly availability: 'UNAVAILABLE' }>;
  readonly mempool: () => Promise<{
    readonly schema: 'sunrey.bff.mempool.v1';
    readonly pendingCount: number;
    readonly congestion: string;
    readonly recommendedPriorityFee: string;
    readonly feeUnit: string;
    readonly providerId: string;
  } | { readonly availability: 'UNAVAILABLE' }>;
  readonly agentEvidence: () => ReturnType<typeof buildChainIntelligenceAgentEvidence>;
  readonly exchangeContext: (txHash?: string) => ReturnType<typeof buildExchangeChainContext>;
  readonly separationProof: () => ReturnType<ReturnType<typeof createExternalChainIntelligenceService>['separationProof']>;
};

const DEFAULT_CHAINS: readonly ExternalBlockchainId[] = Object.freeze(['bitcoin-mainnet', 'ethereum-mainnet']);

export function createBlockchainIntelligenceBff(
  service = createExternalChainIntelligenceService(),
  nowUtc = defaultChainIntelligenceNow(),
): BlockchainIntelligenceBff {
  return Object.freeze({
    networkHealth: () => buildWorldBlockchainHealth(service, DEFAULT_CHAINS, nowUtc),
    bitcoinBlock: async () => {
      const block = await service.getLatestBlock('bitcoin-mainnet', nowUtc);
      if (!block.ok) {
        return Object.freeze({ availability: 'UNAVAILABLE' as const });
      }
      return Object.freeze({
        schema: 'sunrey.bff.bitcoin-block.v1' as const,
        height: block.value.height,
        hash: block.value.hash,
        transactionCount: block.value.transactionCount,
        confirmationStatus: block.value.confirmationStatus,
        providerId: 'redacted',
        reorgAware: true as const,
      });
    },
    mempool: async () => {
      const mempool = await service.getMempoolStatus('bitcoin-mainnet', nowUtc);
      if (!mempool.ok) {
        return Object.freeze({ availability: 'UNAVAILABLE' as const });
      }
      const priority = mempool.value.recommendedFees.find((f) => f.label === 'priority');
      return Object.freeze({
        schema: 'sunrey.bff.mempool.v1' as const,
        pendingCount: mempool.value.pendingTransactionCount,
        congestion: mempool.value.congestionLevel,
        recommendedPriorityFee: priority ? priority.rate.toString() : '0',
        feeUnit: priority?.unit ?? 'sat/vB',
        providerId: 'redacted',
      });
    },
    agentEvidence: () => buildChainIntelligenceAgentEvidence(service, 'bitcoin-mainnet', nowUtc),
    exchangeContext: (txHash?: string) => buildExchangeChainContext(service, 'bitcoin-mainnet', txHash ?? null, nowUtc),
    separationProof: () => service.separationProof(),
  });
}
