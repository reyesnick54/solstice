/**
 * Reference fixture — semiconductor peer chain with evidence-backed supplier link.
 */

import { asUtcInstant } from '@solstice/domain';
import { createTemporalEntityGraphStore, type TemporalEntityGraphStore } from '../../feature-fabric/entity-resolution/graph-store.ts';
import { temporalEntityNodeIdFor } from '../../feature-fabric/entity-resolution/ids.ts';
import { createHeliosEarningsEventNetworkFabric, type HeliosEarningsEventNetworkFabric } from './fabric.ts';
import { HELIOS_EARNINGS_EVENT_NETWORK_AUTHORITY, HELIOS_EARNINGS_EVENT_NETWORK_SCHEMA } from './taxonomy.ts';
import type { EarningsEventRecord } from './types.ts';

const T = (iso: string) => asUtcInstant(iso);

export type Earn08FixtureHandles = {
  readonly graph: TemporalEntityGraphStore;
  readonly fabric: HeliosEarningsEventNetworkFabric;
  readonly nvdaNodeId: string;
  readonly amdNodeId: string;
  readonly tsmNodeId: string;
  readonly earlyReporterEventId: string;
  readonly lateReporterEventId: string;
};

function securityNode(store: TemporalEntityGraphStore, key: string, symbol: string, displayName: string): string {
  const node = store.upsertNode({
    nodeId: temporalEntityNodeIdFor(`earn08:security:${key}`),
    kind: 'SECURITY',
    displayName,
    jurisdiction: 'US',
    economicKnowledgeEntityId: null,
    payload: Object.freeze({ symbol, industry: 'semiconductors', subIndustry: 'gpu' }),
  });
  return node.nodeId;
}

function baseEvent(
  partial: Omit<EarningsEventRecord, 'schema' | 'authority' | 'grantsExecutionAuthority'>,
): EarningsEventRecord {
  return Object.freeze({
    schema: HELIOS_EARNINGS_EVENT_NETWORK_SCHEMA,
    authority: HELIOS_EARNINGS_EVENT_NETWORK_AUTHORITY,
    grantsExecutionAuthority: false,
    ...partial,
  });
}

export function seedEarn08ReferenceEventNetwork(): Earn08FixtureHandles {
  const graph = createTemporalEntityGraphStore();
  const nvdaNodeId = securityNode(graph, 'nvda', 'NVDA', 'NVIDIA Corporation');
  const amdNodeId = securityNode(graph, 'amd', 'AMD', 'Advanced Micro Devices');
  const tsmNodeId = securityNode(graph, 'tsm', 'TSM', 'Taiwan Semiconductor Manufacturing');

  const fabric = createHeliosEarningsEventNetworkFabric({ entityGraph: graph });

  const edgeBase = {
    source: 'fixture:earn08:supply_chain_registry',
    effectiveFrom: T('2020-01-01T00:00:00.000Z'),
    effectiveTo: null,
    observedAt: T('2020-01-02T00:00:00.000Z'),
    knowableAt: T('2020-01-03T00:00:00.000Z'),
    jurisdiction: 'US',
  };

  fabric.registerRelationship({
    ...edgeBase,
    relationshipType: 'SAME_SUBINDUSTRY',
    fromSecurityNodeId: nvdaNodeId,
    toSecurityNodeId: amdNodeId,
    evidenceRefs: Object.freeze(['evidence:earn08:gics:semiconductors']),
  });
  fabric.registerRelationship({
    ...edgeBase,
    relationshipType: 'COMPETITOR',
    fromSecurityNodeId: nvdaNodeId,
    toSecurityNodeId: amdNodeId,
    evidenceRefs: Object.freeze(['evidence:earn08:10k:competition_disclosure']),
  });
  fabric.registerRelationship({
    ...edgeBase,
    relationshipType: 'SUPPLIER',
    fromSecurityNodeId: tsmNodeId,
    toSecurityNodeId: nvdaNodeId,
    evidenceRefs: Object.freeze(['evidence:earn08:supply_chain:tsm_nvda']),
  });
  fabric.registerRelationship({
    ...edgeBase,
    relationshipType: 'ETF_COMPONENT',
    fromSecurityNodeId: nvdaNodeId,
    toSecurityNodeId: amdNodeId,
    evidenceRefs: Object.freeze(['evidence:earn08:etf:soxx_holdings']),
  });

  const earlyReporterEventId = 'earn08:event:tsm:2024Q4';
  const lateReporterEventId = 'earn08:event:nvda:2024Q4';

  fabric.ingestEvent(
    baseEvent({
      eventId: earlyReporterEventId,
      securityNodeId: tsmNodeId,
      fiscalPeriod: '2024-Q4',
      industryCode: 'semiconductors',
      subIndustryCode: 'foundry',
      announcementInstant: T('2025-01-15T21:00:00.000Z'),
      knowableAt: T('2025-01-15T21:05:00.000Z'),
      surpriseState: 'BEAT',
      surpriseMagnitudeBps: 120,
      announcementReturnBps: 180,
      guidanceDirection: 'RAISED',
      marginSignal: 'IMPROVING',
      demandSignal: 'IMPROVING',
      analystRevisionSpeedHours: 12,
      optionsImpliedMoveBps: 400,
      transcriptSentimentScoreMilli: 250,
    }),
  );

  fabric.ingestEvent(
    baseEvent({
      eventId: lateReporterEventId,
      securityNodeId: nvdaNodeId,
      fiscalPeriod: '2024-Q4',
      industryCode: 'semiconductors',
      subIndustryCode: 'gpu',
      announcementInstant: T('2025-02-20T21:30:00.000Z'),
      knowableAt: T('2025-02-20T21:35:00.000Z'),
      surpriseState: 'BEAT',
      surpriseMagnitudeBps: 80,
      announcementReturnBps: 95,
      guidanceDirection: 'RAISED',
      marginSignal: 'STABLE',
      demandSignal: 'IMPROVING',
      analystRevisionSpeedHours: 18,
      optionsImpliedMoveBps: 550,
      transcriptSentimentScoreMilli: 180,
    }),
  );

  fabric.ingestEvent(
    baseEvent({
      eventId: 'earn08:event:amd:2024Q4',
      securityNodeId: amdNodeId,
      fiscalPeriod: '2024-Q4',
      industryCode: 'semiconductors',
      subIndustryCode: 'gpu',
      announcementInstant: T('2025-01-28T21:00:00.000Z'),
      knowableAt: T('2025-01-28T21:05:00.000Z'),
      surpriseState: 'MISS',
      surpriseMagnitudeBps: -60,
      announcementReturnBps: -120,
      guidanceDirection: 'LOWERED',
      marginSignal: 'DETERIORATING',
      demandSignal: 'STABLE',
      analystRevisionSpeedHours: 8,
      optionsImpliedMoveBps: 500,
      transcriptSentimentScoreMilli: -100,
    }),
  );

  return Object.freeze({
    graph,
    fabric,
    nvdaNodeId,
    amdNodeId,
    tsmNodeId,
    earlyReporterEventId,
    lateReporterEventId,
  });
}
