import { sha256Hex } from '../../../../../security/src/hash.ts';
import { identityRef, sortRefs } from './identity.ts';
import {
  type BatchLineageEdge,
  type BatchLineageNode,
  type EventRelationType,
  type IdentityRef,
  type LineageNodeKind,
  type LinkageConfidenceClass,
} from './types.ts';

export type ProductiveBatchLineage = {
  readonly lineageId: string;
  readonly rootRef: IdentityRef;
  readonly nodes: readonly BatchLineageNode[];
  readonly edges: readonly BatchLineageEdge[];
  readonly authoritative: boolean;
};

/**
 * Reference-safe manufacturing / goods lineage.
 *
 * Example: raw batch A + energy B → manufacturing C → output D → logistics E.
 * C is the transformation. D is goods identity. E is a transportation service.
 * D is not automatically another independent production event.
 */
export function buildBatchLineage(input: {
  readonly rawMaterialBatchRef: IdentityRef;
  readonly energyEventRef: IdentityRef;
  readonly manufacturingEventId: string;
  readonly outputBatchRef: IdentityRef;
  readonly logisticsEventId?: string;
  readonly storageEventId?: string;
  readonly authoritative: boolean;
}): ProductiveBatchLineage {
  const nodes: BatchLineageNode[] = [
    node('raw', 'RAW_MATERIAL_BATCH', input.rawMaterialBatchRef, null),
    node('energy', 'ENERGY_INPUT', input.energyEventRef, input.energyEventRef),
    node('mfg', 'MANUFACTURING_TRANSFORMATION', identityRef('event', input.manufacturingEventId), input.manufacturingEventId),
    node('out', 'OUTPUT_BATCH', input.outputBatchRef, input.manufacturingEventId),
    node('goods', 'GOODS_IDENTITY', input.outputBatchRef, null),
  ];
  const edges: BatchLineageEdge[] = [
    edge('raw', 'mfg', 'INPUT_TO', input.authoritative ? 'AUTHORITATIVE_LINK' : 'STRONG_EVIDENCE'),
    edge('energy', 'mfg', 'ENABLES', input.authoritative ? 'AUTHORITATIVE_LINK' : 'STRONG_EVIDENCE'),
    edge('mfg', 'out', 'PRODUCES', input.authoritative ? 'AUTHORITATIVE_LINK' : 'VERIFIED_LINK'),
    edge('out', 'goods', 'OUTPUT_OF', input.authoritative ? 'AUTHORITATIVE_LINK' : 'VERIFIED_LINK'),
  ];
  if (input.logisticsEventId) {
    nodes.push(node('log', 'LOGISTICS_MOVEMENT', identityRef('event', input.logisticsEventId), input.logisticsEventId));
    edges.push(edge('goods', 'log', 'TRANSPORTS', input.authoritative ? 'VERIFIED_LINK' : 'STRONG_EVIDENCE'));
    edges.push(edge('log', 'goods', 'DELIVERS', input.authoritative ? 'VERIFIED_LINK' : 'STRONG_EVIDENCE'));
  }
  if (input.storageEventId) {
    nodes.push(node('store', 'STORAGE_HOLDING', identityRef('event', input.storageEventId), input.storageEventId));
    edges.push(edge('store', 'goods', 'STORES', input.authoritative ? 'VERIFIED_LINK' : 'STRONG_EVIDENCE'));
  }
  const sortedNodes = [...nodes].sort((left, right) => left.nodeId.localeCompare(right.nodeId));
  const sortedEdges = [...edges].sort((left, right) =>
    `${left.relation}:${left.fromId}:${left.toId}`.localeCompare(`${right.relation}:${right.fromId}:${right.toId}`),
  );
  const lineageId = sha256Hex(
    ['lineage', ...sortedNodes.map((item) => item.nodeId), ...sortedEdges.map((item) => `${item.fromId}->${item.toId}`)].join('|'),
  );
  return Object.freeze({
    lineageId,
    rootRef: input.rawMaterialBatchRef,
    nodes: Object.freeze(sortedNodes),
    edges: Object.freeze(sortedEdges),
    authoritative: input.authoritative,
  });
}

export function outputBatchIsIndependentProduction(lineage: ProductiveBatchLineage): false {
  void lineage;
  return false;
}

export function goodsIdentityOf(lineage: ProductiveBatchLineage): BatchLineageNode | undefined {
  return lineage.nodes.find((item) => item.kind === 'GOODS_IDENTITY');
}

export function manufacturingEventOf(lineage: ProductiveBatchLineage): BatchLineageNode | undefined {
  return lineage.nodes.find((item) => item.kind === 'MANUFACTURING_TRANSFORMATION');
}

export function logisticsIsDistinctService(lineage: ProductiveBatchLineage): boolean {
  return lineage.nodes.some((item) => item.kind === 'LOGISTICS_MOVEMENT');
}

export function storageIsDistinctService(lineage: ProductiveBatchLineage): boolean {
  return lineage.nodes.some((item) => item.kind === 'STORAGE_HOLDING');
}

export function authoritativeLineageCreatesStrongLink(lineage: ProductiveBatchLineage): boolean {
  return lineage.authoritative && lineage.edges.some((item) => item.confidence === 'AUTHORITATIVE_LINK');
}

export function lineageRootRef(parts: readonly IdentityRef[]): IdentityRef {
  return sha256Hex(`lineage-root:${sortRefs(parts).join(',')}`);
}

function node(
  nodeId: string,
  kind: LineageNodeKind,
  assetRef: IdentityRef,
  eventRef: string | null,
): BatchLineageNode {
  return Object.freeze({ nodeId, kind, assetRef, eventRef });
}

function edge(
  fromId: string,
  toId: string,
  relation: EventRelationType,
  confidence: LinkageConfidenceClass,
): BatchLineageEdge {
  return Object.freeze({ fromId, toId, relation, confidence });
}
