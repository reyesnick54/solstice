import {
  heliosExternalIdentifier,
  type EconomicKnowledgeCanonicalEntityId,
  type HeliosExternalIdentifier,
} from './ekg-bridge.ts';
import { canonicalHeliosInstrumentId } from './ids.ts';
import type { TemporalEntityGraphStore } from './graph-store.ts';
import { mappingActive } from './temporal.ts';
import type {
  EntityResolutionState,
  ResolveProviderSymbolInput,
  ResolvedEntityBinding,
  TemporalEntityKind,
  TemporalEntityNode,
} from './types.ts';

const INSTRUMENT_KINDS = new Set<TemporalEntityKind>([
  'SECURITY',
  'CRYPTO_VENUE_INSTRUMENT',
  'ECONOMIC_SERIES',
]);

function instrumentIdForNode(node: TemporalEntityNode): string | null {
  if (!INSTRUMENT_KINDS.has(node.kind)) {
    return null;
  }
  const m01 = node.payload.m01InstrumentId ?? node.payload.instrumentId;
  if (m01 && m01.length > 0) {
    return m01;
  }
  const symbol = node.payload.symbol ?? node.displayName;
  const jurisdiction = node.jurisdiction ?? node.payload.jurisdiction ?? 'GLOBAL';
  const venue = node.payload.venueId ?? node.payload.providerId ?? 'UNKNOWN';
  const variant = node.payload.variant ?? null;
  return canonicalHeliosInstrumentId({
    kind: node.kind as 'SECURITY' | 'CRYPTO_VENUE_INSTRUMENT' | 'ECONOMIC_SERIES',
    jurisdiction,
    symbol,
    venueOrProvider: venue,
    variant,
  });
}

function entityIdForNode(node: TemporalEntityNode): EconomicKnowledgeCanonicalEntityId | null {
  return node.economicKnowledgeEntityId;
}

function binding(
  resolutionState: EntityResolutionState,
  nodes: readonly TemporalEntityNode[],
  message: string | null,
): ResolvedEntityBinding {
  const instrumentNodes = nodes.filter((n) => INSTRUMENT_KINDS.has(n.kind));
  const entityNodes = nodes.filter((n) => n.economicKnowledgeEntityId !== null);
  const canonicalEntityId = entityNodes[0]?.economicKnowledgeEntityId ?? null;
  const canonicalInstrumentId =
    instrumentNodes.length === 1 ? instrumentIdForNode(instrumentNodes[0]!) : instrumentNodes[0] ? instrumentIdForNode(instrumentNodes[0]) : null;

  const externalIdentifiers: HeliosExternalIdentifier[] = [];
  for (const node of nodes) {
    if (node.payload.cik) {
      externalIdentifiers.push(heliosExternalIdentifier('cik', node.payload.cik, 'AUTHORITATIVE'));
    }
    if (node.payload.lei) {
      externalIdentifiers.push(heliosExternalIdentifier('lei', node.payload.lei, 'AUTHORITATIVE'));
    }
    if (node.payload.isin) {
      externalIdentifiers.push(heliosExternalIdentifier('isin', node.payload.isin, 'AUTHORITATIVE'));
    }
  }

  return Object.freeze({
    resolutionState,
    canonicalEntityId,
    canonicalInstrumentId,
    resolvedNodeIds: Object.freeze(nodes.map((n) => n.nodeId)),
    candidateNodeIds: Object.freeze(nodes.map((n) => n.nodeId)),
    externalIdentifiers: Object.freeze(externalIdentifiers),
    message,
    grantsExecutionAuthority: false,
  });
}

export function resolveProviderSymbol(
  store: TemporalEntityGraphStore,
  input: ResolveProviderSymbolInput,
): ResolvedEntityBinding {
  const hits = store.listProviderMappings().filter(
    (row) =>
      row.providerId === input.providerId &&
      row.providerSymbol === input.providerSymbol &&
      mappingActive(row, input.asOf, input.knowableAtCutoff),
  );

  if (hits.length === 0) {
    const expired = store.listProviderMappings().filter(
      (row) =>
        row.providerId === input.providerId &&
        row.providerSymbol === input.providerSymbol &&
        Date.parse(input.asOf) >= Date.parse(row.effectiveFrom) &&
        row.effectiveTo !== null &&
        Date.parse(input.asOf) >= Date.parse(row.effectiveTo),
    );
    if (expired.length > 0) {
      return binding('EXPIRED_MAPPING', [], 'provider mapping expired for as-of date');
    }
    return binding('UNRESOLVED', [], 'no active provider mapping');
  }

  const ambiguousHits = hits.filter((row) => row.ambiguityState === 'AMBIGUOUS');
  if (hits.length > 1 || ambiguousHits.length > 0) {
    const nodes = hits
      .map((row) => store.getNode(row.targetNodeId))
      .filter((node): node is TemporalEntityNode => node !== undefined);
    return binding('AMBIGUOUS', nodes, 'multiple or ambiguous provider mappings');
  }

  const target = store.getNode(hits[0]!.targetNodeId);
  if (!target) {
    return binding('UNRESOLVED', [], 'mapping target node missing');
  }

  const related = collectRelatedNodes(store, target.nodeId, input.asOf, input.knowableAtCutoff);
  const entityIds = new Set(
    related
      .filter((n) => n.kind === 'ISSUER' || n.kind === 'LEGAL_ENTITY')
      .map((n) => n.economicKnowledgeEntityId)
      .filter((id): id is EconomicKnowledgeCanonicalEntityId => id !== null),
  );
  if (entityIds.size > 1) {
    return binding('CONFLICTING_EVIDENCE', related, 'conflicting issuer / legal entity evidence');
  }

  return binding('RESOLVED', related, null);
}

export function resolveNodeAt(
  store: TemporalEntityGraphStore,
  nodeId: string,
  asOf: ResolveProviderSymbolInput['asOf'],
  knowableAtCutoff: ResolveProviderSymbolInput['knowableAtCutoff'],
): ResolvedEntityBinding {
  const node = store.getNode(nodeId);
  if (!node) {
    return binding('UNRESOLVED', [], 'node not found');
  }
  const related = collectRelatedNodes(store, nodeId, asOf, knowableAtCutoff);
  return binding('RESOLVED', related, null);
}

function activeEdges(
  store: TemporalEntityGraphStore,
  asOf: ResolveProviderSymbolInput['asOf'],
  knowableAtCutoff: ResolveProviderSymbolInput['knowableAtCutoff'],
) {
  return store.listEdges().filter((edge) => mappingActive(edge, asOf, knowableAtCutoff));
}

function addRelated(
  out: Map<string, TemporalEntityNode>,
  store: TemporalEntityGraphStore,
  nodeId: string,
): void {
  const node = store.getNode(nodeId);
  if (node) {
    out.set(nodeId, node);
  }
}

function collectRelatedNodes(
  store: TemporalEntityGraphStore,
  startNodeId: string,
  asOf: ResolveProviderSymbolInput['asOf'],
  knowableAtCutoff: ResolveProviderSymbolInput['knowableAtCutoff'],
): TemporalEntityNode[] {
  const out = new Map<string, TemporalEntityNode>();
  addRelated(out, store, startNodeId);
  const edges = activeEdges(store, asOf, knowableAtCutoff);
  const start = store.getNode(startNodeId);
  if (!start) {
    return [];
  }

  const expandSecurityChain = (securityId: string): void => {
    for (const edge of edges) {
      if (edge.toNodeId === securityId && edge.relationshipType === 'ISSUES') {
        addRelated(out, store, edge.fromNodeId);
      }
      if (edge.toNodeId === securityId && edge.relationshipType === 'SPONSORS') {
        addRelated(out, store, edge.fromNodeId);
      }
      if (edge.toNodeId === securityId && edge.relationshipType === 'ADR_OF') {
        addRelated(out, store, edge.fromNodeId);
      }
      if (
        (edge.fromNodeId === securityId || edge.toNodeId === securityId) &&
        edge.relationshipType === 'SHARE_CLASS_OF'
      ) {
        addRelated(out, store, edge.fromNodeId);
        addRelated(out, store, edge.toNodeId);
      }
    }
  };

  if (start.kind === 'LISTING') {
    for (const edge of edges) {
      if (edge.toNodeId === startNodeId && edge.relationshipType === 'LISTS') {
        addRelated(out, store, edge.fromNodeId);
        expandSecurityChain(edge.fromNodeId);
      }
      if (edge.fromNodeId === startNodeId && edge.relationshipType === 'TRADES_ON') {
        addRelated(out, store, edge.toNodeId);
      }
      if (
        (edge.fromNodeId === startNodeId || edge.toNodeId === startNodeId) &&
        edge.relationshipType === 'DUAL_LISTED_AS'
      ) {
        addRelated(out, store, edge.fromNodeId);
        addRelated(out, store, edge.toNodeId);
      }
    }
  } else if (start.kind === 'SECURITY') {
    expandSecurityChain(startNodeId);
    for (const edge of edges) {
      if (edge.fromNodeId === startNodeId && edge.relationshipType === 'LISTS') {
        addRelated(out, store, edge.toNodeId);
      }
    }
  } else if (start.kind === 'CRYPTO_VENUE_INSTRUMENT') {
    for (const edge of edges) {
      if (edge.fromNodeId === startNodeId && edge.relationshipType === 'TRADES_ON') {
        addRelated(out, store, edge.toNodeId);
      }
    }
  } else if (start.kind === 'ECONOMIC_SERIES') {
    for (const edge of edges) {
      if (edge.fromNodeId === startNodeId && edge.relationshipType === 'CONTINUOUS_SERIES_FOR') {
        addRelated(out, store, edge.toNodeId);
      }
    }
  }

  for (const node of [...out.values()]) {
    if (node.kind === 'ISSUER' || node.kind === 'LEGAL_ENTITY') {
      for (const edge of edges) {
        if (edge.relationshipType !== 'IDENTIFIED_BY') {
          continue;
        }
        if (edge.fromNodeId === node.nodeId || edge.toNodeId === node.nodeId) {
          addRelated(out, store, edge.fromNodeId);
          addRelated(out, store, edge.toNodeId);
        }
      }
    }
  }

  return [...out.values()];
}

export function assertFeatureFabricEntityRefs(binding: ResolvedEntityBinding): {
  readonly ok: true;
} | {
  readonly ok: false;
  readonly code: string;
  readonly message: string;
} {
  if (binding.resolutionState !== 'RESOLVED') {
    return {
      ok: false,
      code: binding.resolutionState,
      message: binding.message ?? 'entity resolution required before feature materialization',
    };
  }
  if (!binding.canonicalEntityId) {
    return { ok: false, code: 'MISSING_ENTITY_ID', message: 'canonical entity id required for features' };
  }
  return { ok: true };
}
