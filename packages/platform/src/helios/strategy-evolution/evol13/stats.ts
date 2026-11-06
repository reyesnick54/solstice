/**
 * Beta/Gamma sampling for Thompson allocation (research compute only).
 * Internal floating-point use; budget amounts remain integer minor units elsewhere.
 */

/** Marsaglia and Tsang method for Gamma(shape, 1) with shape >= 1. */
function sampleGammaShapeGteOne(shape: number): number {
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  while (true) {
    let x: number;
    let v: number;
    do {
      x = gaussian();
      v = 1 + c * x;
    } while (v <= 0);
    v **= 3;
    const u = Math.random();
    if (u < 1 - 0.0331 * x ** 2 * x) {
      return d * v;
    }
    if (Math.log(u) < 0.5 * x ** 2 + d - d * v + d * Math.log(v)) {
      return d * v;
    }
  }
}

function gaussian(): number {
  // Box-Muller
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

/** Sample ~ Gamma(shape, scale) with shape > 0. */
export function sampleGamma(shape: number, scale: number): number {
  if (shape <= 0 || scale <= 0) {
    throw new Error('gamma shape and scale must be positive');
  }
  if (shape < 1) {
    return sampleGamma(shape + 1, scale) * Math.random() ** (1 / shape);
  }
  return sampleGammaShapeGteOne(shape) * scale;
}

export function sampleBeta(alpha: number, beta: number): number {
  if (alpha <= 0 || beta <= 0) {
    throw new Error('beta parameters must be positive');
  }
  const x = sampleGamma(alpha, 1);
  const y = sampleGamma(beta, 1);
  return x / (x + y);
}

export function betaPosteriorMean(successes: number, trials: number, symmetricAlpha: number): number {
  if (symmetricAlpha <= 0) {
    throw new Error('prior alpha must be positive');
  }
  if (successes < 0 || trials < 0 || successes > trials) {
    throw new Error('invalid beta-binomial counts');
  }
  const a = symmetricAlpha + successes;
  const b = symmetricAlpha + (trials - successes);
  return a / (a + b);
}
