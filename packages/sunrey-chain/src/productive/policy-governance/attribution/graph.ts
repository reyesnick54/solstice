import { sha256Hex } from '../../../../../security/src/hash.ts';
import { containsRawIndustrialData } from './identity.ts';
import {
  ATTRIBUTION_GRAPH_DOMAIN,
  ATTRIBUTION_SCHEMA_VERSION,
  EVENT_IDENTITY_PRODUCTION_ACTIVE,
  type AttributionGraphEdge,
  type AttributionGraphNode,
  type AttributionNodeKind,
  type EventRelation,
  type IdentityRef,
  type ProductiveAttributionGraph,
  type ProductiveEconomicEvent,
} from './types.ts';

export type AttributionGraphSources = {
  readonly events: readonly ProductiveEconomicEvent[];
  readonly objectRefs?: readonly IdentityRef[];
  readonly claimRefs?: readonly IdentityRef[];
  readonly contributionRefs?: readonly IdentityRef[];
  readonly economicAssetRefs?: readonly IdentityRef[];
  readonly relations?: readonly EventRelation[];
};

/**
 * Rebuildable projection / index. Deleting this graph does not change
 * authoritative event identity. It is not a ledger or monetary authority.
 */
export function rebuildProductiveAttributionGraph(sources: AttributionGraphSources): ProductiveAttributionGraph {
  if (containsRawIndustrialData(sources)) {
    throw new Error('RAW_INDUSTRIAL_DATA_FORBIDDEN');
  }
  const nodes = new Map<string, AttributionGraphNode>();
  const edges: AttributionGraphEdge[] = [];

  const addNode = (id: string, kind: AttributionNodeKind, label: string): void => {
    if (!nodes.has(id)) {
      nodes.set(id, Object.freeze({ id, kind, label }));
    }
  };
  const addEdge = (edge: AttributionGraphEdge): void => {
    edges.push(Object.freeze({ ...edge }));
  };

  for (const event of sources.events) {
    addNode(`event:${event.eventId}`, 'ECONOMIC_EVENT', event.eventClass);
    for (const objectRef of event.sourceObjectRefs) {
      addNode(`object:${objectRef}`, 'PRODUCTIVE_OBJECT', 'PRODUCTIVE_OBJECT');
      addEdge({
        from: `object:${objectRef}`,
        to: `event:${event.eventId}`,
        relation: 'DERIVED_VIEW_OF',
        confidence: 'VERIFIED_LINK',
      });
    }
    for (const claimRef of event.claimRefs) {
      addNode(`claim:${claimRef}`, 'CLAIM', 'CLAIM');
      addEdge({
        from: `claim:${claimRef}`,
        to: `event:${event.eventId}`,
        relation: 'DERIVED_VIEW_OF',
        confidence: 'VERIFIED_LINK',
      });
    }
    for (const contributionRef of event.contributionRefs) {
      addNode(`contribution:${contributionRef}`, 'VERIFIED_CONTRIBUTION', 'VERIFIED_CONTRIBUTION');
      addEdge({
        from: `contribution:${contributionRef}`,
        to: `event:${event.eventId}`,
        relation: 'DERIVED_VIEW_OF',
        confidence: 'VERIFIED_LINK',
      });
    }
    for (const assetRef of [...event.inputAssetRefs, ...event.outputAssetRefs]) {
      addNode(`asset:${assetRef}`, 'ECONOMIC_ASSET', 'ECONOMIC_ASSET');
    }
    for (const parent of event.parentEventRefs) {
      addNode(`event:${parent}`, 'ECONOMIC_EVENT', 'PARENT');
      addEdge({
        from: `event:${parent}`,
        to: `event:${event.eventId}`,
        relation: event.status === 'SUPERSEDED' ? 'SUPERSEDES' : 'DEPENDENT_ON',
        confidence: 'VERIFIED_LINK',
      });
    }
  }

  for (const ref of sources.objectRefs ?? []) {
    addNode(`object:${ref}`, 'PRODUCTIVE_OBJECT', 'PRODUCTIVE_OBJECT');
  }
  for (const ref of sources.claimRefs ?? []) {
    addNode(`claim:${ref}`, 'CLAIM', 'CLAIM');
  }
  for (const ref of sources.contributionRefs ?? []) {
    addNode(`contribution:${ref}`, 'VERIFIED_CONTRIBUTION', 'VERIFIED_CONTRIBUTION');
  }
  for (const ref of sources.economicAssetRefs ?? []) {
    addNode(`asset:${ref}`, 'ECONOMIC_ASSET', 'ECONOMIC_ASSET');
  }
  for (const relation of sources.relations ?? []) {
    addEdge({
      from: relation.fromId,
      to: relation.toId,
      relation: relation.relation,
      confidence: relation.confidence,
    });
  }

  const sortedNodes = [...nodes.values()].sort((left, right) => left.id.localeCompare(right.id));
  const sortedEdges = [...edges].sort((left, right) =>
    `${left.relation}:${left.from}:${left.to}:${left.confidence}`.localeCompare(
      `${right.relation}:${right.from}:${right.to}:${right.confidence}`,
    ),
  );
  const projectionHash = sha256Hex(
    [
      ATTRIBUTION_GRAPH_DOMAIN,
      'graph',
      ...sortedNodes.map((node) => `${node.kind}:${node.id}:${node.label}`),
      ...sortedEdges.map((edge) => `${edge.relation}:${edge.from}:${edge.to}:${edge.confidence}`),
    ].join('|'),
  );
  return Object.freeze({
    schemaVersion: ATTRIBUTION_SCHEMA_VERSION,
    nodes: Object.freeze(sortedNodes),
    edges: Object.freeze(sortedEdges),
    projectionHash,
    isLedger: false,
    isMonetaryAuthority: false,
    canMint: false,
    containsRawIndustrialData: false,
    productionActive: EVENT_IDENTITY_PRODUCTION_ACTIVE,
  });
}

export function attributionGraphCannotMint(graph: ProductiveAttributionGraph): false {
  void graph;
  return false;
}

export function attributionGraphIsProjection(graph: ProductiveAttributionGraph): true {
  return graph.isLedger === false && graph.isMonetaryAuthority === false && graph.canMint === false;
}
