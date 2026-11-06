import type { StrategyGenome, StrategyNode } from '../../os05/types.ts';

export function cloneNodes(nodes: readonly StrategyNode[]): StrategyNode[] {
  return structuredClone(nodes) as StrategyNode[];
}

export function flowEdges(nodes: readonly StrategyNode[]): Extract<StrategyNode, { kind: 'FLOW' }>[] {
  return nodes.filter((n): n is Extract<StrategyNode, { kind: 'FLOW' }> => n.kind === 'FLOW');
}

export function removeFlowsReferencing(
  nodes: readonly StrategyNode[],
  nodeId: string,
): StrategyNode[] {
  return nodes.filter((n) => {
    if (n.kind !== 'FLOW') {
      return true;
    }
    return n.fromNodeId !== nodeId && n.toNodeId !== nodeId;
  });
}

export function removeNodeById(nodes: readonly StrategyNode[], nodeId: string): StrategyNode[] {
  return removeFlowsReferencing(
    nodes.filter((n) => n.nodeId !== nodeId),
    nodeId,
  );
}

/** Add a node (caller must preserve unique ids) and optionally connect with a FLOW. */
export function addNode(
  nodes: readonly StrategyNode[],
  node: StrategyNode,
  flow?: { readonly flowId: string; readonly fromNodeId: string; readonly toNodeId: string; readonly port?: string },
): StrategyNode[] {
  const next = [...nodes, node];
  if (!flow) {
    return next;
  }
  const edge: Extract<StrategyNode, { kind: 'FLOW' }> = {
    nodeId: flow.flowId,
    kind: 'FLOW',
    fromNodeId: flow.fromNodeId,
    toNodeId: flow.toNodeId,
    port: flow.port,
  };
  return [...next, edge];
}

/** Replace references to `oldId` with `newId` on non-FLOW nodes (safe rewiring). */
export function rewireCompatibleRefs(nodes: readonly StrategyNode[], oldId: string, newId: string): StrategyNode[] {
  const mapField = (v: string) => (v === oldId ? newId : v);
  return nodes.map((n) => {
    if (n.kind === 'FLOW') {
      return {
        ...n,
        fromNodeId: mapField(n.fromNodeId),
        toNodeId: mapField(n.toNodeId),
      };
    }
    if (n.kind === 'CONDITION' || n.kind === 'SIGNAL') {
      return { ...n, inputRef: mapField(n.inputRef) };
    }
    if (n.kind === 'SIZING') {
      return {
        ...n,
        signalInputRef: mapField(n.signalInputRef),
        volFeatureRef: mapField(n.volFeatureRef),
      };
    }
    if (n.kind === 'RISK') {
      return { ...n, sizingInputRef: mapField(n.sizingInputRef) };
    }
    if (n.kind === 'EXIT') {
      return { ...n, signalInputRef: mapField(n.signalInputRef) };
    }
    return n;
  });
}
