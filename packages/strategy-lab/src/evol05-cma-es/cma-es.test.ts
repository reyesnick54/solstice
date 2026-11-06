import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  createInitialCmaEsSearchState,
  decodeUnconstrainedToParameters,
  runCmaEsGeneration,
} from './cma-es.ts';
import { evaluateEvol05CmaEsQualification } from './qualification.ts';
import type { CmaEsParameterBounds } from './types.ts';

describe('HELIOS EVOL05 — CMA-ES continuous parameter search', () => {
  it('decodes mid-point of bounds at z=0 (sigmoid center)', () => {
    const bounds: readonly CmaEsParameterBounds[] = Object.freeze([
      Object.freeze({ parameterId: 'lookbackBars', min: 5, max: 120, integral: true }),
      Object.freeze({ parameterId: 'liquidityThresholdBps', min: 1, max: 500 }),
    ]);
    const p = decodeUnconstrainedToParameters([0, 0], bounds);
    assert.equal(p.lookbackBars, 63);
    assert.ok(Math.abs(p.liquidityThresholdBps! - 250.5) < 1e-9);
  });

  it('records invalid candidates without fitness while valid members are evaluated', () => {
    const bounds: readonly CmaEsParameterBounds[] = Object.freeze([
      Object.freeze({ parameterId: 'x', min: 1, max: 10, integral: true }),
    ]);
    const state = createInitialCmaEsSearchState({
      bounds,
      initialParameters: Object.freeze({ x: 5 }),
      seed: 7,
      lambda: 6,
      sigma0: 0.5,
    });
    const gen = runCmaEsGeneration({
      searchState: state,
      bounds,
      generation: 0,
      seed: 123_456,
      evaluateFitness: (params) => -Math.abs(params.x! - 7),
      policyGate: (params) =>
        params.x === 7 ? { ok: false, reason: 'policy excludes training extreme' } : { ok: true },
    });
    const invalid = gen.population.candidates.filter((c) => !c.validity.ok);
    const valid = gen.population.candidates.filter((c) => c.validity.ok);
    assert.ok(invalid.length > 0);
    assert.ok(valid.every((c) => c.fitness !== null));
    assert.ok(invalid.every((c) => c.fitness === null));
  });

  it('qualifies EVOL05 CMA-ES research harness', () => {
    const r = evaluateEvol05CmaEsQualification();
    assert.equal(r.qualified, true, JSON.stringify(r.checks));
    assert.equal(r.marker, 'HELIOS_EVOL05_CMA_ES_QUALIFIED');
  });
});
