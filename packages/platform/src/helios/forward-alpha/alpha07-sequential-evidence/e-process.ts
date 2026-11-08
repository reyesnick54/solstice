/**
 * ALPHA07 — e-process / e-value interface for sequential mean evidence.
 */

import { HELIOS_ALPHA07_SEQUENTIAL_EVIDENCE_SCHEMA } from './taxonomy.ts';
import type { ReturnDependenceAssumption } from './taxonomy.ts';
import type { EProcessState, PredeclaredReturnBounds } from './types.ts';

const E_FLOOR = 1e-300;

function safeLogE(e: number): number {
  return Math.log(Math.max(e, E_FLOOR));
}

/**
 * Betting-martingale e-value update for testing mean > nullMean with bounded observations.
 * Uses a fixed lambda scaled to the pre-declared range (valid anytime under the bound).
 */
export function eProcessMeanExcess(input: {
  readonly observations: readonly number[];
  readonly nullMean: number;
  readonly bounds: PredeclaredReturnBounds;
  readonly assumption: ReturnDependenceAssumption;
}): EProcessState {
  const n = input.observations.length;
  if (input.assumption === 'ASSUMPTIONS_FAILED') {
    return Object.freeze({
      schema: HELIOS_ALPHA07_SEQUENTIAL_EVIDENCE_SCHEMA,
      nullMean: input.nullMean,
      observationCount: n,
      eValue: 1,
      evidenceStrength: 0,
      logEValue: 0,
      anytimeValid: false,
      assumption: input.assumption,
      blockedReason: 'assumptions_failed',
    });
  }

  const span = input.bounds.upperBound - input.bounds.lowerBound;
  const lambda = span > 0 ? 0.5 / span : 0;

  let logE = 0;
  for (const x of input.observations) {
    const excess = x - input.nullMean;
    const factor = 1 + lambda * excess;
    if (factor <= 0) {
      return Object.freeze({
        schema: HELIOS_ALPHA07_SEQUENTIAL_EVIDENCE_SCHEMA,
        nullMean: input.nullMean,
        observationCount: n,
        eValue: 0,
        evidenceStrength: Infinity,
        logEValue: -Infinity,
        anytimeValid: false,
        assumption: input.assumption,
        blockedReason: 'e_process_factor_nonpositive',
      });
    }
    logE += Math.log(factor);
  }

  const eValue = Math.exp(logE);
  const evidenceStrength = safeLogE(eValue);

  return Object.freeze({
    schema: HELIOS_ALPHA07_SEQUENTIAL_EVIDENCE_SCHEMA,
    nullMean: input.nullMean,
    observationCount: n,
    eValue,
    evidenceStrength,
    logEValue: logE,
    anytimeValid: true,
    assumption: input.assumption,
    blockedReason: null,
  });
}
