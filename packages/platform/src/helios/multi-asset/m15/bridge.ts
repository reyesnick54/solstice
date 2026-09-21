/**
 * HELIOS M15 bridge for Opportunity Research and Agentic Capital Mesh evidence bundles.
 *
 * Provider-neutral research view. Does not grant execution authority.
 */

import type { UtcInstant } from '@solstice/domain';
import { anchorNodeIdForInstrument, queryCrossAssetOpportunityGraph } from './query.ts';
import type { InMemoryCrossAssetGraphStore } from './store.ts';
import type { CrossAssetGraphResearchView } from './types.ts';

export function bridgeCrossAssetGraphToOpportunityResearch(input: {
  readonly store: InMemoryCrossAssetGraphStore;
  readonly instrumentId: string;
  readonly asOf: UtcInstant;
  readonly customerId?: string | null;
}): CrossAssetGraphResearchView {
  const anchorNodeId = anchorNodeIdForInstrument(input.instrumentId);
  const customerScope = input.customerId !== undefined ? { customerId: input.customerId } : {};
  const related = queryCrossAssetOpportunityGraph(input.store, {
    queryKind: 'related_instruments',
    anchorNodeId,
    asOf: input.asOf,
    ...customerScope,
    includeHypotheses: true,
    includeDegraded: false,
  });
  const hedges = queryCrossAssetOpportunityGraph(input.store, {
    queryKind: 'possible_hedges',
    anchorNodeId,
    asOf: input.asOf,
    ...customerScope,
    includeHypotheses: true,
    includeDegraded: false,
  });
  const macro = queryCrossAssetOpportunityGraph(input.store, {
    queryKind: 'macro_context',
    anchorNodeId,
    asOf: input.asOf,
    ...customerScope,
    includeHypotheses: false,
    includeDegraded: true,
  });

  const relatedInstrumentIds = related.hits
    .filter((hit) => hit.relatedNode.nodeClass === 'instrument')
    .map((hit) => hit.relatedNode.externalRef)
    .filter((row): row is string => row !== null);

  const hedgeCandidateIds = hedges.hits
    .filter((hit) => hit.relatedNode.nodeClass === 'instrument')
    .map((hit) => hit.relatedNode.externalRef)
    .filter((row): row is string => row !== null);

  const evidenceRefs = [...related.hits, ...hedges.hits, ...macro.hits].flatMap((hit) =>
    hit.lineage.map((row) =>
      Object.freeze({
        evidenceId: row.evidenceId,
        sourceKind: row.kind === 'STATISTICAL_SERIES' || row.kind === 'MARKET_OBSERVATION' ? ('MARKET_OBSERVATION' as const) : ('ASSERTION' as const),
        sourceRef: row.sourceRef,
        observedAt: row.observedAt,
        freshnessOk: hit.edge.validityState !== 'DEGRADED' && hit.edge.validityState !== 'EXPIRED',
        entitlementOk: true,
        provenanceRef: row.provenanceRef,
      }),
    ),
  );

  return Object.freeze({
    schema: 'sunrey.helios.multi-asset.cross-asset-graph.research-view.v1',
    anchorInstrumentId: input.instrumentId,
    relatedInstrumentIds: Object.freeze([...new Set(relatedInstrumentIds)]),
    hedgeCandidateIds: Object.freeze([...new Set(hedgeCandidateIds)]),
    macroContextNodeIds: Object.freeze(macro.hits.map((hit) => hit.relatedNode.nodeId)),
    evidenceRefs: Object.freeze(evidenceRefs),
    generatedAt: input.asOf,
    researchOnly: true,
    grantsExecutionAuthority: false,
  });
}
