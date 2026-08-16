import type { ProductiveCategory } from './types.ts';

export type ProductiveMetrics = {
  productive_objects: number;
  productive_claims: number;
  verified_contributions: number;
  rejected_contributions: number;
  duplicate_contributions: number;
  moonrey_issuance: number;
  moonrey_issuance_by_category: Readonly<Record<string, string>>;
  epoch_issuance: string;
  category_limit_utilization: Readonly<Record<string, string>>;
  oracle_concentration: Readonly<Record<string, number>>;
  productive_graph_lag: number;
};

export function emptyMetrics(): ProductiveMetrics {
  return {
    productive_objects: 0,
    productive_claims: 0,
    verified_contributions: 0,
    rejected_contributions: 0,
    duplicate_contributions: 0,
    moonrey_issuance: 0,
    moonrey_issuance_by_category: {},
    epoch_issuance: '0',
    category_limit_utilization: {},
    oracle_concentration: {},
    productive_graph_lag: 0,
  };
}

export function categoryUtilization(
  used: bigint,
  cap: bigint,
): string {
  if (cap === 0n) {
    return '0';
  }
  return ((used * 1_000_000n) / cap).toString();
}

export function incrementCategory(
  current: Readonly<Record<string, string>>,
  category: ProductiveCategory,
  quantity: bigint,
): Record<string, string> {
  const next = { ...current };
  next[category] = ((BigInt(next[category] ?? '0') + quantity)).toString();
  return next;
}
