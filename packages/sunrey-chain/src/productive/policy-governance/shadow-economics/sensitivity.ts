/**
 * Bounded sensitivity analysis for simulation policies.
 *
 * Flags policies where a small approved-range factor change produces
 * an excessive output change. Not a market forecast.
 */

import { VALUE_FACTOR_SCALE } from '../value-function/types.ts';
import { representativeScenario } from './scenarios.ts';
import type { SensitivityFactorName, SensitivityObservation } from './types.ts';
import { evaluateGovernedV2 } from './v2.ts';

const EXTREME_OUTPUT_MULTIPLE = 8n;

export function analyzeSensitivity(): readonly SensitivityObservation[] {
  const base = representativeScenario('solar-energy');
  const baseEval = evaluateGovernedV2(base);
  if (!baseEval.valued || baseEval.quantity === null) {
    throw new TypeError('representative solar-energy scenario must value under the simulation policy');
  }
  return Object.freeze([
    observe('quality', baseEval.quantity, evaluateGovernedV2({
      ...base,
      evidence: { ...base.evidence, quality: 990_000n },
    }).quantity, 10_000n),
    observe('freshness', baseEval.quantity, evaluateGovernedV2({
      ...base,
      evidence: { ...base.evidence, freshnessAgeEpochs: 1n },
    }).quantity, 125_000n),
    observe('attribution', baseEval.quantity, evaluateGovernedV2({
      ...base,
      attributionShare: { numerator: 396_000n, denominator: 1_000_000n },
    }).quantity, 10_000n),
    observe('utilization', baseEval.quantity, evaluateGovernedV2({
      ...base,
      evidence: { ...base.evidence, utilizationActual: (base.evidence.utilizationActual ?? 0n) * 99n / 100n },
    }).quantity, 10_000n),
    observe('scarcity', baseEval.quantity, evaluateGovernedV2({
      ...base,
      evidence: { ...base.evidence, scarcity: 1_010_000n, scarcityEvidenced: true },
    }).quantity, 10_000n),
    observe('geography', baseEval.quantity, evaluateGovernedV2({
      ...base,
      evidence: { ...base.evidence, geography: 1_010_000n, geographyEvidenced: true },
    }).quantity, 10_000n),
    observe('concentration', baseEval.quantity, evaluateGovernedV2({
      ...base,
      evidence: { ...base.evidence, concentration: 990_000n },
    }).quantity, 10_000n),
  ]);
}

function observe(
  factor: SensitivityFactorName,
  baseOutput: bigint,
  perturbed: bigint | null,
  factorDeltaBps: bigint,
): SensitivityObservation {
  const perturbedOutput = perturbed ?? 0n;
  const outputDeltaBps =
    baseOutput === 0n ? null : ((perturbedOutput - baseOutput) * 10_000n * (perturbedOutput >= baseOutput ? 1n : -1n)) / baseOutput;
  const absDelta = outputDeltaBps === null ? 0n : outputDeltaBps < 0n ? -outputDeltaBps : outputDeltaBps;
  const extremeSensitivity = absDelta > factorDeltaBps * EXTREME_OUTPUT_MULTIPLE;
  return Object.freeze({
    factor,
    baseOutput,
    perturbedOutput,
    factorDeltaBps,
    outputDeltaBps,
    extremeSensitivity,
  });
}

export function excessiveSensitivityDetected(rows: readonly SensitivityObservation[] = analyzeSensitivity()): boolean {
  return rows.some((row) => row.extremeSensitivity);
}

export const SENSITIVITY_NEUTRAL = VALUE_FACTOR_SCALE;
