import { err, ok, type Result } from '../../../domain/src/result.ts';
import type { LineageEdge, LineageRecord } from './types.ts';

const ACYCLIC_KINDS = new Set<LineageEdge['kind']>([
  'OBSERVED_FROM',
  'ATTESTED_BY',
  'TRANSFORMED_FROM',
  'AGGREGATED_FROM',
  'NORMALIZED_FROM',
  'DERIVED_FROM',
  'PRODUCED',
]);

export type LineageFailure = {
  readonly code: 'CIRCULAR_LINEAGE' | 'DUPLICATE_EDGE';
  readonly message: string;
};

function edgeKey(edge: LineageEdge): string {
  return `${edge.kind}:${edge.parentRef}:${edge.childRef}`;
}

export function normalizeLineageEdges(edges: readonly LineageEdge[]): readonly LineageEdge[] {
  const seen = new Set<string>();
  const out: LineageEdge[] = [];
  for (const edge of edges) {
    const key = edgeKey(edge);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(Object.freeze({ ...edge }));
  }
  return Object.freeze(
    out.sort((left, right) => edgeKey(left).localeCompare(edgeKey(right))),
  );
}

export function wouldCreateLineageCycle(existing: readonly LineageEdge[], next: readonly LineageEdge[]): boolean {
  const adjacency = new Map<string, string[]>();
  for (const edge of [...existing, ...next]) {
    if (!ACYCLIC_KINDS.has(edge.kind)) {
      continue;
    }
    const list = adjacency.get(edge.parentRef) ?? [];
    list.push(edge.childRef);
    adjacency.set(edge.parentRef, list);
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();

  const walk = (node: string): boolean => {
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

export function buildLineageRecord(input: {
  readonly edges: readonly LineageEdge[];
  readonly methodologyVersion: string;
  readonly producedRefs?: readonly string[];
}): Result<LineageRecord, LineageFailure> {
  const edges = normalizeLineageEdges(input.edges);
  if (wouldCreateLineageCycle([], edges)) {
    return err({ code: 'CIRCULAR_LINEAGE', message: 'Lineage graph would contain a cycle' });
  }
  return ok(
    Object.freeze({
      edges,
      methodologyVersion: input.methodologyVersion,
      producedRefs: Object.freeze([...(input.producedRefs ?? [])].sort()),
    }),
  );
}

export function appendLineageEdge(
  record: LineageRecord,
  edge: LineageEdge,
): Result<LineageRecord, LineageFailure> {
  const edges = normalizeLineageEdges([...record.edges, edge]);
  if (wouldCreateLineageCycle([], edges)) {
    return err({ code: 'CIRCULAR_LINEAGE', message: 'Lineage graph would contain a cycle' });
  }
  return ok(
    Object.freeze({
      ...record,
      edges,
    }),
  );
}
