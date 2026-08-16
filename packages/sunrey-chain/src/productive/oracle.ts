import type { OracleFactStatus, ProductiveCategory } from './types.ts';

export type OracleFact = {
  readonly factId: string;
  readonly feedId: string;
  readonly objectId: string;
  readonly category: ProductiveCategory;
  readonly quantity: bigint;
  readonly unit: string;
  readonly sourceId: string;
  readonly quality: bigint;
  readonly observedAtUnixSeconds: bigint;
  readonly validFromUnixSeconds: bigint;
  readonly validUntilUnixSeconds: bigint;
  readonly conflictKey: string;
  readonly status: OracleFactStatus;
  readonly attestationHeight: number;
};

export function factIsStale(fact: OracleFact, blockTimeUnixSeconds: bigint): boolean {
  return blockTimeUnixSeconds >= fact.validUntilUnixSeconds || fact.status === 'STALE';
}

export function factIsConflicted(fact: OracleFact): boolean {
  return fact.status === 'CONFLICTED';
}

export function distinctOracleSources(facts: readonly OracleFact[]): readonly string[] {
  return [...new Set(facts.map((fact) => fact.sourceId))].sort();
}

export function detectConflicts(facts: readonly OracleFact[]): readonly string[] {
  const groups = new Map<string, OracleFact[]>();
  for (const fact of facts) {
    const existing = groups.get(fact.conflictKey) ?? [];
    existing.push(fact);
    groups.set(fact.conflictKey, existing);
  }
  const conflicted: string[] = [];
  for (const group of groups.values()) {
    if (group.length < 2) {
      continue;
    }
    const first = group[0];
    if (group.some((fact) => fact.quantity !== first.quantity || fact.unit !== first.unit)) {
      for (const fact of group) {
        conflicted.push(fact.factId);
      }
    }
  }
  return conflicted.sort();
}
