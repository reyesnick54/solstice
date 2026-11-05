/**
 * Deterministic seeded RNG for correlated forecast paths (Mulberry32).
 */

export type SeededRng = {
  readonly next: () => number;
  readonly nextStandardNormal: () => number;
};

export function createSeededRng(seed: number): SeededRng {
  let state = seed >>> 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const nextStandardNormal = (): number => {
    let u = 0;
    let v = 0;
    while (u === 0) {
      u = next();
    }
    while (v === 0) {
      v = next();
    }
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  return Object.freeze({ next, nextStandardNormal });
}
