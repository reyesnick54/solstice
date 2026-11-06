import type { StrategyNode } from '../../os05/types.ts';
import { addNode as addNodeInternal, cloneNodes, removeNodeById, rewireCompatibleRefs } from './graph.ts';

type FlowEdgeSpec = {
  readonly flowId: string;
  readonly fromNodeId: string;
  readonly toNodeId: string;
  readonly port?: string;
};

/**
 * Safe structural graph operations (bounded): each returns a new node list; callers must
 * run {@link validateStrategyGenome} after edits.
 */
export const genomeGraphOps = {
  cloneNodes,
  addNode: (nodes: readonly StrategyNode[], node: StrategyNode, flow?: FlowEdgeSpec) =>
    addNodeInternal(nodes, node, flow),
  removeNodeById,
  replaceNode: (nodes: readonly StrategyNode[], nodeId: string, replacement: StrategyNode): StrategyNode[] => {
    const without = removeNodeById(nodes, nodeId);
    return [...without, replacement];
  },
  rewireCompatibleRefs,
} as const;
