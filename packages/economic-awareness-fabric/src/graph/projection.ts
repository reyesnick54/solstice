export type GraphNodeKind = 'entity' | 'observation' | 'event' | 'claim' | 'fact';

export type EconomicGraphNode = {
  readonly nodeId: string;
  readonly kind: GraphNodeKind;
  readonly ref: string;
  readonly economicDomain: string;
  readonly committedAtUtc: string;
};

export type EconomicGraphEdge = {
  readonly edgeId: string;
  readonly fromNodeId: string;
  readonly toNodeId: string;
  readonly relation: string;
};

export type EconomicGraphProjection = {
  addNode(node: EconomicGraphNode): void;
  addEdge(edge: EconomicGraphEdge): void;
  neighbors(nodeId: string): readonly EconomicGraphNode[];
  snapshot(): { readonly nodes: readonly EconomicGraphNode[]; readonly edges: readonly EconomicGraphEdge[] };
};

export function createEconomicGraphProjection(): EconomicGraphProjection {
  const nodes = new Map<string, EconomicGraphNode>();
  const edges: EconomicGraphEdge[] = [];
  const adjacency = new Map<string, Set<string>>();

  return {
    addNode(node) {
      nodes.set(node.nodeId, Object.freeze({ ...node }));
    },
    addEdge(edge) {
      edges.push(Object.freeze({ ...edge }));
      let fromSet = adjacency.get(edge.fromNodeId);
      if (!fromSet) {
        fromSet = new Set();
        adjacency.set(edge.fromNodeId, fromSet);
      }
      fromSet.add(edge.toNodeId);
    },
    neighbors(nodeId) {
      const ids = adjacency.get(nodeId);
      if (!ids) return Object.freeze([]);
      return Object.freeze([...ids].map((id) => nodes.get(id)!).filter(Boolean));
    },
    snapshot() {
      return Object.freeze({ nodes: Object.freeze([...nodes.values()]), edges: Object.freeze([...edges]) });
    },
  };
}
