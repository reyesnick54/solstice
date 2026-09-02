/**
 * Productive asset hierarchy and rollup lineage.
 *
 * Parent + child production must not double-count when rollup is explicit.
 */

import type {
  AssetHierarchyEdge,
  CanonicalProductiveAsset,
  ProductiveAssetId,
  RollupBehavior,
} from './types.ts';

export type RollupAssessment = {
  readonly doubleCountRisk: boolean;
  readonly reportingAssetId: ProductiveAssetId;
  readonly lineageAssetIds: readonly ProductiveAssetId[];
  readonly message: string;
};

export function hierarchyEdge(
  parentAssetId: ProductiveAssetId,
  childAssetId: ProductiveAssetId,
  rollupBehavior: RollupBehavior,
): AssetHierarchyEdge {
  if (parentAssetId === childAssetId) {
    throw new Error('productive asset cannot be its own parent');
  }
  return Object.freeze({
    parentAssetId,
    childAssetId,
    rollupBehavior,
    explicitLineage: true as const,
  });
}

export function assessProductionRollup(input: {
  readonly asset: CanonicalProductiveAsset;
  readonly hierarchy: readonly AssetHierarchyEdge[];
  readonly assetsById: ReadonlyMap<string, CanonicalProductiveAsset>;
}): RollupAssessment {
  const lineageAssetIds: ProductiveAssetId[] = [input.asset.productiveAssetId];
  let reportingAssetId = input.asset.productiveAssetId;
  let doubleCountRisk = false;

  if (input.asset.rollupBehavior === 'ROLLS_UP_TO_PARENT' && input.asset.parentAssetId) {
    reportingAssetId = input.asset.parentAssetId;
    lineageAssetIds.push(input.asset.parentAssetId);
    return Object.freeze({
      doubleCountRisk: true,
      reportingAssetId,
      lineageAssetIds: Object.freeze(lineageAssetIds),
      message: 'child production rolls up to parent; do not count child and parent separately',
    });
  }

  const children = input.hierarchy.filter((edge) => edge.parentAssetId === input.asset.productiveAssetId);
  if (input.asset.rollupBehavior === 'AGGREGATES_CHILDREN' && children.length > 0) {
    for (const childEdge of children) {
      lineageAssetIds.push(childEdge.childAssetId);
      const child = input.assetsById.get(childEdge.childAssetId);
      if (child && child.rollupBehavior === 'ROLLS_UP_TO_PARENT') {
        doubleCountRisk = true;
      }
    }
    return Object.freeze({
      doubleCountRisk,
      reportingAssetId,
      lineageAssetIds: Object.freeze(lineageAssetIds),
      message: doubleCountRisk
        ? 'parent aggregates children with explicit rollup lineage'
        : 'parent aggregates independent child assets',
    });
  }

  return Object.freeze({
    doubleCountRisk: false,
    reportingAssetId,
    lineageAssetIds: Object.freeze(lineageAssetIds),
    message: 'independent asset reporting',
  });
}

export function validateHierarchyAcyclic(edges: readonly AssetHierarchyEdge[]): void {
  const graph = new Map<string, string[]>();
  for (const edge of edges) {
    const list = graph.get(edge.childAssetId) ?? [];
    list.push(edge.parentAssetId);
    graph.set(edge.childAssetId, list);
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (node: string): void => {
    if (visited.has(node)) {
      return;
    }
    if (visiting.has(node)) {
      throw new Error('productive asset hierarchy cycle detected');
    }
    visiting.add(node);
    for (const parent of graph.get(node) ?? []) {
      visit(parent);
    }
    visiting.delete(node);
    visited.add(node);
  };

  for (const edge of edges) {
    visit(edge.childAssetId);
  }
}
