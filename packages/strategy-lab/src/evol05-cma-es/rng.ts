/**
 * Deterministic LCG + Box–Muller for CMA-ES sampling (EVOL05).
 */

export type CmaEsRngState = { state: number };

export function createCmaEsRngState(seed: number): CmaEsRngState {
  return { state: seed >>> 0 };
}

export function nextCmaEsUniform(rng: CmaEsRngState): number {
  rng.state = (Math.imul(rng.state, 1_664_525) + 1_013_904_223) >>> 0;
  return rng.state / 0x1_0000_0000;
}

/** Standard normal N(0,1). */
export function nextCmaEsStandardNormal(rng: CmaEsRngState): number {
  let u1 = 0;
  let u2 = 0;
  while (u1 <= Number.EPSILON) {
    u1 = nextCmaEsUniform(rng);
    u2 = nextCmaEsUniform(rng);
  }
  const mag = Math.sqrt(-2 * Math.log(u1));
  return mag * Math.cos(2 * Math.PI * u2);
}
