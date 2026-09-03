// @ts-nocheck
/**
 * Agent evidence bridge for external chain intelligence observations.
 */

import {
  bundleObservationEvidence,
  EXTERNAL_OBSERVATION_EVIDENCE_KIND,
  toAgentEvidenceRef,
  type AgentEvidenceBundle,
  type ExternalObservationEvidenceRef,
} from '../../../provider-sdk/src/agent-evidence.ts';
import { buildExternalObservation } from '../../../provider-sdk/src/observation.ts';
import type { ExternalObservation } from '../../../provider-sdk/src/types.ts';
import type { ExternalChainIntelligenceService } from './service.ts';
import type { ChainObservation, ExternalBlockchainId, MempoolObservation, NetworkMetrics } from './types.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';

export { EXTERNAL_OBSERVATION_EVIDENCE_KIND, toAgentEvidenceRef };
export type { ExternalObservationEvidenceRef, AgentEvidenceBundle };

export type ChainIntelligenceAgentEvidence = {
  readonly schema: 'sunrey.agent.chain-intelligence-evidence.v1';
  readonly generatedAt: UtcInstant;
  readonly readOnly: true;
  readonly grantsExecutionAuthority: false;
  readonly grantsSigningAuthority: false;
  readonly items: readonly {
    readonly chainId: ExternalBlockchainId;
    readonly observationType: string;
    readonly summary: string;
    readonly providerId: string;
    readonly label: 'RESEARCH_EVIDENCE_NOT_EXECUTION';
  }[];
};

export function chainObservationToExternalObservation(
  observation: ChainObservation,
): ExternalObservation<{ readonly summary: string; readonly chainId: string }> {
  const built = buildExternalObservation({
    providerId: observation.providerId,
    providerCategory: 'blockchain',
    capability: 'blockchain_intelligence',
    data: Object.freeze({
      summary: `${observation.observationType} on ${observation.network}`,
      chainId: observation.chainId,
    }),
    source: {
      provider: observation.providerId,
      dataset: observation.observationType,
    },
    time: { retrievedAt: observation.retrievedAt, sourceTimestamp: observation.timestamp },
    authorityClass: observation.authorityClass,
    provenance: {
      rawPayload: JSON.stringify(observation.data),
      providerSchemaVersion: '1',
    },
  });
  if (!built.ok) {
    throw new Error(built.message);
  }
  return built.value;
}

export async function buildChainIntelligenceAgentEvidence(
  service: ExternalChainIntelligenceService,
  chainId: ExternalBlockchainId,
  nowUtc: UtcInstant,
): Promise<ChainIntelligenceAgentEvidence> {
  const items: ChainIntelligenceAgentEvidence['items'][number][] = [];
  const mempool = await service.getMempoolStatus(chainId, nowUtc);
  if (mempool.ok) {
    items.push(
      Object.freeze({
        chainId,
        observationType: 'MEMPOOL',
        summary: `Mempool congestion: ${mempool.value.congestionLevel}; ${mempool.value.pendingTransactionCount} pending txs`,
        providerId: mempool.value.providerId,
        label: 'RESEARCH_EVIDENCE_NOT_EXECUTION',
      }),
    );
  }
  const fees = await service.getFeeEstimate(chainId, nowUtc);
  if (fees.ok) {
    const priority = fees.value.tiers.find((t) => t.label === 'priority');
    items.push(
      Object.freeze({
        chainId,
        observationType: 'FEE',
        summary: `Priority fee: ${priority?.rate ?? 0n} ${priority?.unit ?? 'sat/vB'}`,
        providerId: fees.value.providerId,
        label: 'RESEARCH_EVIDENCE_NOT_EXECUTION',
      }),
    );
  }
  return Object.freeze({
    schema: 'sunrey.agent.chain-intelligence-evidence.v1',
    generatedAt: nowUtc,
    readOnly: true,
    grantsExecutionAuthority: false,
    grantsSigningAuthority: false,
    items: Object.freeze(items),
  });
}

export function mempoolToAgentEvidence(mempool: MempoolObservation): ExternalObservationEvidenceRef {
  return toAgentEvidenceRef(
    chainObservationToExternalObservation({
      schema: 'sunrey.chain-intelligence.v1',
      authority: 'OBSERVATION_ONLY',
      chainId: mempool.chainId,
      network: mempool.chainId,
      observationType: 'MEMPOOL',
      blockHeight: null,
      blockHash: null,
      transactionHash: null,
      timestamp: mempool.timestamp,
      providerId: mempool.providerId,
      retrievedAt: mempool.retrievedAt,
      freshness: mempool.freshness,
      authorityClass: 'reference_data',
      provenance: mempool.provenance,
      data: { kind: 'MEMPOOL', mempool },
      reorgAware: true,
      finalityNote: 'Probabilistic finality',
    }),
  );
}

export function networkMetricsToAgentEvidence(metrics: NetworkMetrics): ExternalObservationEvidenceRef {
  const observation: ChainObservation = Object.freeze({
    schema: 'sunrey.chain-intelligence.v1',
    authority: 'OBSERVATION_ONLY',
    chainId: metrics.chainId,
    network: metrics.chainId,
    observationType: 'HASHRATE',
    blockHeight: null,
    blockHash: null,
    transactionHash: null,
    timestamp: metrics.timestamp,
    providerId: metrics.providerId,
    retrievedAt: metrics.timestamp,
    freshness: metrics.freshness,
    authorityClass: 'reference_data',
    provenance: Object.freeze({
      providerId: metrics.providerId,
      authorityClass: 'reference_data',
      sourceUrl: null,
      rawPayloadHash: null,
      observationId: `metrics_${metrics.providerId}`,
      capability: 'network_statistics',
    }),
    data: { kind: 'NETWORK_METRICS', metrics },
    reorgAware: true,
    finalityNote: 'External network statistics',
  });
  return toAgentEvidenceRef(chainObservationToExternalObservation(observation));
}
