import type { StrategyGenomeId } from '../os05/ids.ts';
import type { EvolutionOperator, EvolutionTrial } from './types.ts';

type Adjacency = ReadonlyMap<StrategyGenomeId, ReadonlySet<StrategyGenomeId>>;

function addEdge(map: Map<StrategyGenomeId, Set<StrategyGenomeId>>, from: StrategyGenomeId, to: StrategyGenomeId) {
  if (!map.has(from)) {
    map.set(from, new Set());
  }
  map.get(from)!.add(to);
}

export function buildChildIndex(trials: readonly EvolutionTrial[]): Adjacency {
  const forward = new Map<StrategyGenomeId, Set<StrategyGenomeId>>();
  for (const trial of trials) {
    for (const parent of trial.parents) {
      addEdge(forward, parent, trial.genomeId);
    }
  }
  return new Map(
    [...forward.entries()].map(([k, v]) => [k, v as ReadonlySet<StrategyGenomeId>]),
  );
}

export function buildParentIndex(trials: readonly EvolutionTrial[]): Adjacency {
  const back = new Map<StrategyGenomeId, Set<StrategyGenomeId>>();
  for (const trial of trials) {
    if (!back.has(trial.genomeId)) {
      back.set(trial.genomeId, new Set());
    }
    for (const p of trial.parents) {
      back.get(trial.genomeId)!.add(p);
    }
  }
  return new Map(
    [...back.entries()].map(([k, v]) => [k, v as ReadonlySet<StrategyGenomeId>]),
  );
}

export function ancestorsFromTrials(
  genomeId: StrategyGenomeId,
  parentIndex: Adjacency,
): readonly StrategyGenomeId[] {
  const seen = new Set<StrategyGenomeId>();
  const stack = [...(parentIndex.get(genomeId) ?? new Set<StrategyGenomeId>())];
  while (stack.length > 0) {
    const next = stack.pop()!;
    if (seen.has(next)) {
      continue;
    }
    seen.add(next);
    for (const p of parentIndex.get(next) ?? []) {
      stack.push(p);
    }
  }
  return Object.freeze([...seen]);
}

export function descendantsFromTrials(
  genomeId: StrategyGenomeId,
  childIndex: Adjacency,
): readonly StrategyGenomeId[] {
  const seen = new Set<StrategyGenomeId>();
  const stack = [...(childIndex.get(genomeId) ?? new Set<StrategyGenomeId>())];
  while (stack.length > 0) {
    const next = stack.pop()!;
    if (seen.has(next)) {
      continue;
    }
    seen.add(next);
    for (const c of childIndex.get(next) ?? []) {
      stack.push(c);
    }
  }
  return Object.freeze([...seen]);
}

/** Root genomes in the recorded graph (no parents in the ledger). */
export function rootAncestors(genomeId: StrategyGenomeId, parentIndex: Adjacency): readonly StrategyGenomeId[] {
  const anc = new Set<StrategyGenomeId>(ancestorsFromTrials(genomeId, parentIndex));
  anc.add(genomeId);
  const roots: StrategyGenomeId[] = [];
  for (const id of anc) {
    const ps = parentIndex.get(id);
    if (!ps || ps.size === 0) {
      roots.push(id);
    }
  }
  return Object.freeze(roots.sort());
}

export function lineageDepth(genomeId: StrategyGenomeId, parentIndex: Adjacency): number {
  const memo = new Map<StrategyGenomeId, number>();

  function depthOf(id: StrategyGenomeId): number {
    const cached = memo.get(id);
    if (cached !== undefined) {
      return cached;
    }
    const parents = [...(parentIndex.get(id) ?? new Set())];
    if (parents.length === 0) {
      memo.set(id, 0);
      return 0;
    }
    let maxParent = 0;
    for (const p of parents) {
      maxParent = Math.max(maxParent, depthOf(p));
    }
    const d = maxParent + 1;
    memo.set(id, d);
    return d;
  }

  return depthOf(genomeId);
}

export function commonAncestor(
  a: StrategyGenomeId,
  b: StrategyGenomeId,
  parentIndex: Adjacency,
): StrategyGenomeId | null {
  const ancA = new Set<StrategyGenomeId>(ancestorsFromTrials(a, parentIndex));
  ancA.add(a);
  const queue: StrategyGenomeId[] = [b];
  const visited = new Set<StrategyGenomeId>();
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) {
      continue;
    }
    visited.add(current);
    if (ancA.has(current)) {
      return current;
    }
    for (const p of parentIndex.get(current) ?? []) {
      queue.push(p);
    }
  }
  return null;
}

/**
 * Operator labels along the primary parent chain from the earliest recorded ancestor to `genomeId`.
 */
export function operatorHistory(
  genomeId: StrategyGenomeId,
  trialsByGenome: ReadonlyMap<StrategyGenomeId, EvolutionTrial>,
): readonly EvolutionOperator[] {
  const chain: EvolutionOperator[] = [];
  let current: StrategyGenomeId | null = genomeId;
  const guard = new Set<StrategyGenomeId>();
  while (current !== null) {
    if (guard.has(current)) {
      break;
    }
    guard.add(current);
    const trial = trialsByGenome.get(current);
    if (!trial) {
      break;
    }
    chain.unshift(trial.operator);
    current =
      trial.parents.length > 0 ? (trial.parents[0] ?? null) : null;
  }
  return Object.freeze(chain);
}
