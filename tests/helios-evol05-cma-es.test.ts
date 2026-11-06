/**
 * HELIOS EVOL05 — CMA-ES bounded continuous parameter search (Strategy Genome parameters only).
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  HELIOS_EVOL05_CMA_ES_QUALIFIED,
  evaluateEvol05CmaEsQualification,
} from '../packages/strategy-lab/src/evol05-cma-es/index.ts';

describe('HELIOS EVOL05 — CMA-ES integration', () => {
  it('reports qualification when search harness is coherent', () => {
    const result = evaluateEvol05CmaEsQualification();
    assert.equal(result.qualified, true, JSON.stringify(result.checks));
    assert.equal(result.marker, HELIOS_EVOL05_CMA_ES_QUALIFIED);
  });
});
