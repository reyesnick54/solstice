import { createHash } from 'node:crypto';

/** Deterministic 32-bit seed from arbitrary string (e.g. parent ids + operator version). */
export function seedToUint32(seed: string): number {
  const h = createHash('sha256').update(seed, 'utf8').digest();
  return h.readUInt32BE(0);
}

/** Mulberry32 — deterministic PRNG for evolution (same seed → same sequence). */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickInt(rng: () => number, min: number, max: number): number {
  const lo = Math.ceil(min);
  const hi = Math.floor(max);
  if (hi < lo) {
    return lo;
  }
  return lo + Math.floor(rng() * (hi - lo + 1));
}

export function pickItem<T>(rng: () => number, items: readonly T[]): T {
  if (items.length === 0) {
    throw new RangeError('pickItem: empty array');
  }
  return items[pickInt(rng, 0, items.length - 1)]!;
}
