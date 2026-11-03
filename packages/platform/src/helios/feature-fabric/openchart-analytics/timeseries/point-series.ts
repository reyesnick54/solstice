/**
 * Scalar point series without Arrow (OpenChart `fromPoints` semantics subset).
 */

export type PointValue = number | string | boolean | null;

export type PointRow = { readonly timeMs: number } & Readonly<Record<string, PointValue>>;

export type PointSeriesLabels = Readonly<Record<string, string>>;

export type BuiltPointRow = { readonly timeMs: number } & Readonly<Record<string, PointValue>>;

export type PointSeries = {
  readonly labels: PointSeriesLabels;
  readonly rows: readonly BuiltPointRow[];
};

function inferColumnKind(values: readonly PointValue[]): 'number' | 'string' | 'boolean' | null {
  let kind: 'number' | 'string' | 'boolean' | null = null;
  for (const value of values) {
    if (value === null) continue;
    const next =
      typeof value === 'number'
        ? 'number'
        : typeof value === 'string'
          ? 'string'
          : typeof value === 'boolean'
            ? 'boolean'
            : null;
    if (next === null) return null;
    if (kind === null) {
      kind = next;
      continue;
    }
    if (kind !== next) return null;
  }
  return kind;
}

export function buildPointSeries(
  labels: PointSeriesLabels,
  points: readonly PointRow[],
): PointSeries {
  if (points.some((point) => !Number.isSafeInteger(point.timeMs))) {
    throw new Error('PointSeries time must be safe integer epoch milliseconds');
  }
  const columnNames = new Set<string>();
  for (const point of points) {
    for (const key of Object.keys(point)) {
      if (key !== 'timeMs') columnNames.add(key);
    }
  }
  for (const name of columnNames) {
    const values = points.map((point) => point[name] ?? null);
    const kind = inferColumnKind(values);
    if (kind === null) {
      throw new Error(`column "${name}" mixes types or has only null values`);
    }
  }

  const rows = points.map((point) => {
    const row: Record<string, PointValue> = { timeMs: point.timeMs };
    for (const name of columnNames) {
      if (!Object.hasOwn(point, name)) {
        const kind = inferColumnKind(points.map((p) => p[name] ?? null));
        row[name] = kind === 'number' ? Number.NaN : null;
      } else {
        row[name] = point[name] ?? null;
      }
    }
    return Object.freeze(row) as BuiltPointRow;
  });

  return Object.freeze({
    labels: Object.freeze({ ...labels }),
    rows: Object.freeze(rows),
  });
}
