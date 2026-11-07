/**
 * PRODUCT → BRAND → SUBSIDIARY → PUBLIC COMPANY entity chain with temporal resolution.
 */

import type { UtcInstant } from '@solstice/domain';

import { isEffectiveAt, isKnowableAt } from '../../feature-fabric/entity-resolution/temporal.ts';

export const ALT06_PRODUCT_GRAPH_NODE_KINDS = [
  'PRODUCT',
  'BRAND',
  'SUBSIDIARY',
  'PUBLIC_COMPANY',
] as const;

export type Alt06ProductGraphNodeKind = (typeof ALT06_PRODUCT_GRAPH_NODE_KINDS)[number];

export const ALT06_PRODUCT_GRAPH_EDGES = [
  'PRODUCT_OF_BRAND',
  'BRAND_OF_SUBSIDIARY',
  'SUBSIDIARY_OF',
] as const;

export type Alt06ProductGraphEdgeKind = (typeof ALT06_PRODUCT_GRAPH_EDGES)[number];

export type Alt06ProductGraphNode = {
  readonly nodeId: string;
  readonly kind: Alt06ProductGraphNodeKind;
  readonly displayName: string;
  readonly canonicalEntityId: string | null;
  readonly grantsExecutionAuthority: false;
};

export type Alt06ProductGraphEdge = {
  readonly edgeId: string;
  readonly relationshipType: Alt06ProductGraphEdgeKind;
  readonly fromNodeId: string;
  readonly toNodeId: string;
  readonly effectiveFrom: UtcInstant;
  readonly effectiveTo: UtcInstant | null;
  readonly knowableAt: UtcInstant;
  readonly grantsExecutionAuthority: false;
};

export type ResolvedProductCorporateChain = {
  readonly productNodeId: string;
  readonly brandNodeId: string | null;
  readonly subsidiaryNodeId: string | null;
  readonly publicCompanyNodeId: string | null;
  readonly canonicalEntityId: string | null;
  readonly grantsExecutionAuthority: false;
};

export type Alt06ProductEntityGraph = {
  readonly upsertNode: (node: Alt06ProductGraphNode) => void;
  readonly appendEdge: (edge: Alt06ProductGraphEdge) => void;
  readonly resolveCorporateChain: (input: {
    readonly productNodeId: string;
    readonly asOf: UtcInstant;
    readonly knowableAtCutoff: UtcInstant;
  }) => ResolvedProductCorporateChain | null;
};

function activeEdge(
  edge: Alt06ProductGraphEdge,
  asOf: UtcInstant,
  knowableAtCutoff: UtcInstant,
): boolean {
  return (
    isEffectiveAt(edge.effectiveFrom, edge.effectiveTo, asOf) &&
    isKnowableAt(edge.knowableAt, knowableAtCutoff)
  );
}

export function createAlt06ProductEntityGraph(): Alt06ProductEntityGraph {
  const nodes = new Map<string, Alt06ProductGraphNode>();
  const edges: Alt06ProductGraphEdge[] = [];

  const follow = (
    fromId: string,
    relationship: Alt06ProductGraphEdgeKind,
    asOf: UtcInstant,
    cutoff: UtcInstant,
  ): string | null => {
    const hit = edges.find(
      (edge) =>
        edge.fromNodeId === fromId &&
        edge.relationshipType === relationship &&
        activeEdge(edge, asOf, cutoff),
    );
    return hit?.toNodeId ?? null;
  };

  return Object.freeze({
    upsertNode(node) {
      nodes.set(node.nodeId, Object.freeze({ ...node }));
    },
    appendEdge(edge) {
      edges.push(Object.freeze({ ...edge }));
    },
    resolveCorporateChain(input) {
      const product = nodes.get(input.productNodeId);
      if (!product || product.kind !== 'PRODUCT') {
        return null;
      }
      const brandId = follow(input.productNodeId, 'PRODUCT_OF_BRAND', input.asOf, input.knowableAtCutoff);
      const subsidiaryId = brandId
        ? follow(brandId, 'BRAND_OF_SUBSIDIARY', input.asOf, input.knowableAtCutoff)
        : null;
      const issuerId = subsidiaryId
        ? follow(subsidiaryId, 'SUBSIDIARY_OF', input.asOf, input.knowableAtCutoff)
        : null;
      const issuer = issuerId ? nodes.get(issuerId) : null;
      return Object.freeze({
        productNodeId: input.productNodeId,
        brandNodeId: brandId,
        subsidiaryNodeId: subsidiaryId,
        publicCompanyNodeId: issuerId,
        canonicalEntityId: issuer?.canonicalEntityId ?? null,
        grantsExecutionAuthority: false,
      });
    },
  });
}
