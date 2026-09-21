/**
 * HELIOS Multi-Asset M17 → M15 Cross-Asset Opportunity Graph evidence bridge.
 */

import type { UtcInstant } from '@solstice/domain';
import type { CrossAssetOpportunityGraphStorePort } from '../opportunity-graph/index.ts';
import type { CorrelationArtifact, CorrelationChangeEvent } from './types.ts';

export function publishCorrelationArtifactToOpportunityGraph(input: {
  readonly graph: CrossAssetOpportunityGraphStorePort;
  readonly artifact: CorrelationArtifact;
  readonly instrumentAAssetClass: string;
  readonly instrumentASymbol: string;
  readonly instrumentBAssetClass: string;
  readonly instrumentBSymbol: string;
}): void {
  const { artifact } = input;
  const capturedAt = artifact.calculationTimestamp;

  input.graph.upsertNode(
    Object.freeze({
      nodeId: `node_${artifact.instrumentA}`,
      instrumentId: artifact.instrumentA,
      assetClass: input.instrumentAAssetClass,
      symbol: input.instrumentASymbol,
      admitted: true,
      updatedAt: capturedAt,
    }),
  );
  input.graph.upsertNode(
    Object.freeze({
      nodeId: `node_${artifact.instrumentB}`,
      instrumentId: artifact.instrumentB,
      assetClass: input.instrumentBAssetClass,
      symbol: input.instrumentBSymbol,
      admitted: true,
      updatedAt: capturedAt,
    }),
  );

  input.graph.upsertEdgeEvidence({
    kind: 'CORRELATION',
    instrumentA: artifact.instrumentA,
    instrumentB: artifact.instrumentB,
    updatedAt: capturedAt,
    evidence: Object.freeze({
      evidenceId: artifact.artifactId,
      kind: 'CORRELATION_ARTIFACT',
      artifactRef: artifact.artifactId,
      summary: `${artifact.windowHorizon} ${artifact.methodology} r=${artifact.correlationBps ?? 'null'}bps`,
      correlationBps: artifact.correlationBps,
      relationshipState: artifact.relationshipState,
      capturedAt,
      validUntil: artifact.validUntil,
    }),
  });
}

export function publishCorrelationChangeToOpportunityGraph(input: {
  readonly graph: CrossAssetOpportunityGraphStorePort;
  readonly change: CorrelationChangeEvent;
  readonly validUntil: UtcInstant;
}): void {
  input.graph.upsertEdgeEvidence({
    kind: 'CORRELATION',
    instrumentA: input.change.instrumentA,
    instrumentB: input.change.instrumentB,
    updatedAt: input.change.detectedAt,
    evidence: Object.freeze({
      evidenceId: input.change.changeId,
      kind: 'CORRELATION_CHANGE',
      artifactRef: input.change.changeId,
      summary: `${input.change.kind} delta=${input.change.deltaBps ?? 'null'}bps`,
      correlationBps: input.change.currentCorrelationBps,
      relationshipState: input.change.kind,
      capturedAt: input.change.detectedAt,
      validUntil: input.validUntil,
    }),
  });
}
