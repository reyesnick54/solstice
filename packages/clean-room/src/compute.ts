import type { QueryAst, ReleasedResult } from './types.ts';

export type EphemeralRow = {
  readonly subjectId: string;
  readonly fields: Readonly<Record<string, string | number | boolean | null>>;
};

function amountOf(row: EphemeralRow, field: string): bigint {
  const raw = row.fields[field];
  if (typeof raw === 'string' || typeof raw === 'number') {
    return BigInt(raw);
  }
  return 0n;
}

function matches(row: EphemeralRow, ast: QueryAst): boolean {
  for (const filter of ast.filters ?? []) {
    if (filter.eq !== undefined && String(row.fields[filter.field] ?? '') !== filter.eq) {
      return false;
    }
  }
  return true;
}

function floorDiv(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) {
    return 0n;
  }
  return numerator / denominator;
}

export function runApprovedComputation(ast: QueryAst, rows: readonly EphemeralRow[]): ReleasedResult {
  const selected = rows.filter((row) => matches(row, ast));
  const field = ast.field ?? 'amountMinor';
  if (ast.operation === 'COUNT') {
    return { shape: 'AGGREGATE', operation: ast.operation, values: { count: selected.length } };
  }
  if (ast.operation === 'SUM') {
    const sum = selected.reduce((acc, row) => acc + amountOf(row, field), 0n);
    return { shape: 'AGGREGATE', operation: ast.operation, values: { sumMinor: sum.toString(), count: selected.length } };
  }
  if (ast.operation === 'AVERAGE') {
    const sum = selected.reduce((acc, row) => acc + amountOf(row, field), 0n);
    const count = BigInt(selected.length);
    return {
      shape: 'AGGREGATE',
      operation: ast.operation,
      values: {
        sumMinor: sum.toString(),
        count: selected.length,
        averageMinor: floorDiv(sum, count).toString(),
      },
    };
  }
  if (ast.operation === 'MIN_MAX_BOUNDED') {
    let min = selected.length === 0 ? 0n : amountOf(selected[0]!, field);
    let max = min;
    for (const row of selected) {
      const value = amountOf(row, field);
      if (value < min) min = value;
      if (value > max) max = value;
    }
    return {
      shape: 'AGGREGATE',
      operation: ast.operation,
      values: { minMinor: min.toString(), maxMinor: max.toString(), count: selected.length },
    };
  }
  if (ast.operation === 'HISTOGRAM' || ast.operation === 'DISTRIBUTION_BUCKETS') {
    const buckets = ast.buckets ?? [];
    const groups = buckets.map((bucket) => {
      const start = BigInt(bucket.startMinor);
      const end = BigInt(bucket.endMinor);
      const count = selected.filter((row) => {
        const value = amountOf(row, field);
        return value >= start && value < end;
      }).length;
      return { startMinor: bucket.startMinor, endMinor: bucket.endMinor, count };
    });
    return {
      shape: 'AGGREGATE',
      operation: ast.operation,
      values: { bucketCount: groups.length, count: selected.length },
      groups,
    };
  }
  if (ast.operation === 'CATEGORY_AGGREGATION') {
    const categoryField = ast.categoryField ?? 'category';
    const grouped = new Map<string, { count: number; sum: bigint }>();
    for (const row of selected) {
      const key = String(row.fields[categoryField] ?? 'unknown');
      const current = grouped.get(key) ?? { count: 0, sum: 0n };
      current.count += 1;
      current.sum += amountOf(row, field);
      grouped.set(key, current);
    }
    const groups = [...grouped.entries()].map(([category, stats]) => ({
      category,
      count: stats.count,
      sumMinor: stats.sum.toString(),
    }));
    return {
      shape: 'AGGREGATE',
      operation: ast.operation,
      values: { groupCount: groups.length, count: selected.length },
      groups,
    };
  }
  const participating = new Set(selected.map((row) => row.subjectId)).size;
  const sum = selected.reduce((acc, row) => acc + amountOf(row, field), 0n);
  return {
    shape: 'AGGREGATE',
    operation: 'COHORT_METRIC',
    values: {
      participatingSubjects: participating,
      observationCount: selected.length,
      sumMinor: sum.toString(),
    },
  };
}
