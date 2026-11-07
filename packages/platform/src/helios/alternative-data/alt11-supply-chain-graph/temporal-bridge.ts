/**
 * Bridges supply-chain firm nodes into the AAF03 temporal entity graph.
 */

import type { TemporalEntityGraphStore } from '../../feature-fabric/entity-resolution/graph-store.ts';
import { temporalEntityNodeIdFor } from '../../feature-fabric/entity-resolution/ids.ts';
import type { TemporalEntityKind } from '../../feature-fabric/entity-resolution/types.ts';
import type { SupplyChainNodeKind } from './taxonomy.ts';
import type { SupplyChainNode } from './types.ts';

function temporalKindForSupplyChainKind(kind: SupplyChainNodeKind): TemporalEntityKind | null {
  switch (kind) {
    case 'COMPANY':
      return 'LEGAL_ENTITY';
    case 'SUBSIDIARY':
      return 'SUBSIDIARY';
    case 'SUPPLIER':
    case 'CUSTOMER':
      return 'LEGAL_ENTITY';
    case 'FACILITY':
      return 'PHYSICAL_LOCATION';
    case 'COUNTRY':
      return 'PHYSICAL_LOCATION';
    default:
      return null;
  }
}

export type AnchorSupplyChainNodeInput = {
  readonly nodeId?: string;
  readonly kind: SupplyChainNodeKind;
  readonly displayName: string;
  readonly jurisdiction: string | null;
  readonly payload: Readonly<Record<string, string>>;
};

export function anchorSupplyChainNodeOnTemporalGraph(
  entityGraph: TemporalEntityGraphStore,
  input: AnchorSupplyChainNodeInput,
): SupplyChainNode {
  const nodeId = input.nodeId ?? temporalEntityNodeIdFor(`alt11:sc:${input.kind}:${input.displayName}`);
  const temporalKind = temporalKindForSupplyChainKind(input.kind);
  let temporalAnchorNodeId: string | null = null;
  if (temporalKind !== null) {
    const temporalNode = entityGraph.upsertNode({
      nodeId: temporalEntityNodeIdFor(`alt11:teg:${input.kind}:${input.displayName}`),
      kind: temporalKind,
      displayName: input.displayName,
      jurisdiction: input.jurisdiction,
      economicKnowledgeEntityId: null,
      payload: Object.freeze({ ...input.payload, supplyChainNodeId: nodeId }),
    });
    temporalAnchorNodeId = temporalNode.nodeId;
  }
  return Object.freeze({
    nodeId,
    kind: input.kind,
    displayName: input.displayName,
    temporalAnchorNodeId,
    payload: Object.freeze({ ...input.payload }),
    grantsExecutionAuthority: false,
  });
}
