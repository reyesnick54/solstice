import { createInitialCmaEsSearchState, decodeUnconstrainedToParameters, runCmaEsGeneration } from './cma-es.ts';
import { HELIOS_EVOL05_CMA_ES_QUALIFIED, HOLDOUT_FEEDBACK_LEAKAGE, type CmaEsParameterBounds } from './types.ts';

export type Evol05CmaEsQualificationChecks = Readonly<{
  readonly boundsDecodeCoherent: boolean;
  readonly deterministicRepeat: boolean;
  readonly invalidCandidatesRecorded: boolean;
  readonly holdoutLeakageMarkerPresent: boolean;
}>;

export type Evol05CmaEsQualificationResult = Readonly<{
  readonly marker: typeof HELIOS_EVOL05_CMA_ES_QUALIFIED;
  readonly checks: Evol05CmaEsQualificationChecks;
  readonly qualified: boolean;
}>;

/** Simple sphere in unconstrained space after decode — inner objective only (fixture). */
function sphereFitness(z: readonly number[]): number {
  let s = 0;
  for (let i = 0; i < z.length; i += 1) {
    const t = z[i]!;
    s -= t * t;
  }
  return s;
}

export function evaluateEvol05CmaEsQualification(): Evol05CmaEsQualificationResult {
  const bounds: readonly CmaEsParameterBounds[] = Object.freeze([
    Object.freeze({ parameterId: 'a', min: 0, max: 100, integral: true }),
    Object.freeze({ parameterId: 'b', min: 2, max: 8 }),
  ]);

  /** b=5 is the sigmoid center for [2,8], so z=(0,0) matches this point. */
  const initial = Object.freeze({ a: 50, b: 5 });

  let boundsDecodeCoherent = true;
  const mid = decodeUnconstrainedToParameters([0, 0], bounds);
  if (Math.abs(mid.a! - 50) > 1e-6 || Math.abs(mid.b! - 5) > 0.15) {
    boundsDecodeCoherent = false;
  }

  const state0 = createInitialCmaEsSearchState({
    bounds,
    initialParameters: initial,
    seed: 42_424_242,
    lambda: 8,
    sigma0: 0.85,
  });

  const runOnce = () =>
    runCmaEsGeneration({
      searchState: state0,
      bounds,
      generation: 0,
      seed: 99_001,
      evaluateFitness: (_p, c) => sphereFitness(c.z),
      /** Invalid in lower band — mean b=5 with σ>0 crosses 4.5 in both directions. */
      policyGate: (params) =>
        params.b! < 4.5 ? { ok: false, reason: 'liquidity band policy (fixture)' } : { ok: true },
    });

  const g1 = runOnce();
  const g2 = runOnce();

  let deterministicRepeat = true;
  for (let i = 0; i < g1.nextSearchState.mean.length; i += 1) {
    if (g1.nextSearchState.mean[i] !== g2.nextSearchState.mean[i]) {
      deterministicRepeat = false;
      break;
    }
  }

  const invalidCandidatesRecorded =
    g1.population.candidates.some((c) => c.validity.ok === false && c.evaluated === true) &&
    g1.population.candidates.some((c) => c.validity.ok === true && c.fitness !== null);

  const checks: Evol05CmaEsQualificationChecks = Object.freeze({
    boundsDecodeCoherent,
    deterministicRepeat,
    invalidCandidatesRecorded,
    holdoutLeakageMarkerPresent: HOLDOUT_FEEDBACK_LEAKAGE === 'HOLDOUT_FEEDBACK_LEAKAGE',
  });

  const qualified =
    checks.boundsDecodeCoherent &&
    checks.deterministicRepeat &&
    checks.invalidCandidatesRecorded &&
    checks.holdoutLeakageMarkerPresent;

  return Object.freeze({
    marker: HELIOS_EVOL05_CMA_ES_QUALIFIED,
    checks,
    qualified,
  });
}
