/**
 * Seeded, replayable PRNG for property tests and campaigns.
 *
 * Mulberry32 is deterministic given an explicit seed. fast-check is
 * used where available for shrinking; campaigns always record the seed.
 */

export class SeededRng {
  #state: number;
  readonly seed: number;

  constructor(seed: number) {
    this.seed = seed >>> 0;
    this.#state = this.seed || 0x9e3779b9;
  }

  nextU32(): number {
    this.#state = (this.#state + 0x6d2b79f5) >>> 0;
    let t = this.#state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0);
  }

  next(): number {
    return this.nextU32() / 0x1_0000_0000;
  }

  int(min: number, max: number): number {
    if (max < min) {
      throw new TypeError('rng int range inverted');
    }
    return min + (this.nextU32() % (max - min + 1));
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new TypeError('rng pick from empty list');
    }
    return items[this.int(0, items.length - 1)]!;
  }

  bytes(length: number): Uint8Array {
    const out = new Uint8Array(length);
    for (let i = 0; i < length; i += 1) {
      out[i] = this.nextU32() & 0xff;
    }
    return out;
  }

  bool(): boolean {
    return (this.nextU32() & 1) === 1;
  }

  bigint(min: bigint, max: bigint): bigint {
    if (max < min) {
      throw new TypeError('rng bigint range inverted');
    }
    const span = max - min + 1n;
    const raw = BigInt(this.nextU32());
    return min + (raw % span);
  }

  shuffle<T>(items: readonly T[]): T[] {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = this.int(0, i);
      const tmp = out[i]!;
      out[i] = out[j]!;
      out[j] = tmp;
    }
    return out;
  }

  child(label: string): SeededRng {
    let mix = this.seed;
    for (let i = 0; i < label.length; i += 1) {
      mix = Math.imul(mix ^ label.charCodeAt(i), 0x01000193);
    }
    return new SeededRng(mix >>> 0);
  }
}

export function forEachCase(seed: number, count: number, body: (rng: SeededRng, index: number) => void): void {
  const root = new SeededRng(seed);
  for (let index = 0; index < count; index += 1) {
    body(root.child(`case:${index}`), index);
  }
}
