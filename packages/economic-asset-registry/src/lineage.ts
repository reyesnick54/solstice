import { err, ok, type Result } from '../../domain/src/result.ts';
import type { AssetId } from './ids.ts';
import type { LineageEdgeKind } from './taxonomy.ts';
import type { LineageEdge, RegistryFailure } from './types.ts';

const ACYCLIC_KINDS = new Set<LineageEdgeKind>([
  'DERIVED_FROM',
  'VERIFIED_BY',
  'ATTESTED_BY',
  'AGGREGATED_FROM',
  'NORMALIZED_FROM',
  'TRANSFORMED_FROM',
  'SETTLED_FROM',
  'SUPERSEDES',
  'CORRECTS',
]);

function failure(code: RegistryFailure['code'], message: string): RegistryFailure {
  return Object.freeze({ code, message });
}

export function normalizeLineage(edges: readonly LineageEdge[]): readonly LineageEdge[] {
  const seen = new Set<string>();
  const out: LineageEdge[] = [];
  for (const edge of edges) {
    const key = `${edge.kind}:${edge.fromAssetId}:${edge.toAssetId}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(Object.freeze({ ...edge }));
  }
  return Object.freeze(out.sort((left, right) => `${left.kind}${left.fromAssetId}${left.toAssetId}`.localeCompare(`${right.kind}${right.fromAssetId}${right.toAssetId}`)));
}

export function wouldCreateCycle(existing: readonly LineageEdge[], next: readonly LineageEdge[]): boolean {
  const adjacency = new Map<AssetId, AssetId[]>();
  for (const edge of [...existing, ...next]) {
    if (!ACYCLIC_KINDS.has(edge.kind)) {
      continue;
    }
    const list = adjacency.get(edge.fromAssetId) ?? [];
    list.push(edge.toAssetId);
    adjacency.set(edge.fromAssetId, list);
  }
  const visiting = new Set<AssetId>();
  const visited = new Set<AssetId>();

  const walk = (node: AssetId): boolean => {
    if (visiting.has(node)) {
      return true;
    }
    if (visited.has(node)) {
      return false;
    }
    visiting.add(node);
    for (const child of adjacency.get(node) ?? []) {
      if (walk(child)) {
        return true;
      }
    }
    visiting.delete(node);
    visited.add(node);
    return false;
  };

  for (const node of adjacency.keys()) {
    if (walk(node)) {
      return true;
    }
  }
  return false;
}

export function assertAcyclicLineage(
  existing: readonly LineageEdge[],
  next: readonly LineageEdge[],
): Result<readonly LineageEdge[], RegistryFailure> {
  for (const edge of next) {
    if (edge.fromAssetId === edge.toAssetId && ACYCLIC_KINDS.has(edge.kind)) {
      return err(failure('LINEAGE_CYCLE', `${edge.kind} cannot reference the same asset as parent and child`));
    }
  }
  if (wouldCreateCycle(existing, next)) {
    return err(failure('LINEAGE_CYCLE', 'lineage edges must be deterministic and cycle-safe where cycles are invalid'));
  }
  return ok(normalizeLineage([...existing, ...next]));
}

export function parentsOf(edges: readonly LineageEdge[], assetId: AssetId): readonly AssetId[] {
  return Object.freeze(
    [...new Set(edges.filter((edge) => edge.fromAssetId === assetId).map((edge) => edge.toAssetId))].sort(),
  );
}

export function childrenOf(edges: readonly LineageEdge[], assetId: AssetId): readonly AssetId[] {
  return Object.freeze(
    [...new Set(edges.filter((edge) => edge.toAssetId === assetId).map((edge) => edge.fromAssetId))].sort(),
  );
}
