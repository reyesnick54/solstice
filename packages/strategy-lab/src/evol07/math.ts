/**
 * Deterministic numeric helpers for EVOL07 (bounded [0,1] projections).
 */

export function clamp01(x: number): number {
  if (Number.isNaN(x)) {
    return 0;
  }
  if (x <= 0) {
    return 0;
  }
  if (x >= 1) {
    return 1;
  }
  return x;
}

/** Map [-1, 1] to [0, 1] for fingerprint components. */
export function signedTo01(x: number): number {
  return clamp01((x + 1) / 2);
}

export function l1Distance(a: readonly number[], b: readonly number[]): number {
  const n = Math.min(a.length, b.length);
  let s = 0;
  for (let i = 0; i < n; i += 1) {
    s += Math.abs((a[i] ?? 0) - (b[i] ?? 0));
  }
  return s / n;
}

export function multisetJaccardDistance(xs: readonly string[], ys: readonly string[]): number {
  const ax = multisetFromStrings(xs);
  const ay = multisetFromStrings(ys);
  const keys = new Set<string>([...ax.keys(), ...ay.keys()]);
  let inter = 0;
  let uni = 0;
  for (const k of keys) {
    const cx = ax.get(k) ?? 0;
    const cy = ay.get(k) ?? 0;
    inter += Math.min(cx, cy);
    uni += Math.max(cx, cy);
  }
  if (uni === 0) {
    return 0;
  }
  return 1 - inter / uni;
}

function multisetFromStrings(values: readonly string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const v of values) {
    m.set(v, (m.get(v) ?? 0) + 1);
  }
  return m;
}
