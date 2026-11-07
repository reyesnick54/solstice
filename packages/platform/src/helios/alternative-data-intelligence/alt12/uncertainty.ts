/**
 * HELIOS ALT12 — calibrated uncertainty widening under missing / low-quality data.
 */

import type { FusionRouteDecision, FusionUncertainty, ModelFusionOutput, ModalityState } from './types.ts';
import type { AltFusionModelKind } from '../taxonomy.ts';

export function fuseModelOutputs(
  outputs: readonly ModelFusionOutput[],
  route: FusionRouteDecision,
): { readonly fusedSignal: number; readonly modelDispersion: number } {
  let num = 0;
  let den = 0;
  const points: number[] = [];
  for (const output of outputs) {
    const w = route.modelRouteWeights[output.modelKind as AltFusionModelKind] ?? 0.05;
    num += w * output.pointEstimate;
    den += w;
    points.push(output.pointEstimate);
  }
  const fusedSignal = den > 0 ? num / den : 0;
  const mean = points.length > 0 ? points.reduce((a, b) => a + b, 0) / points.length : 0;
  const modelDispersion =
    points.length > 1
      ? Math.sqrt(points.reduce((acc, p) => acc + (p - mean) ** 2, 0) / points.length)
      : 0.05;
  return { fusedSignal, modelDispersion };
}

export function calibrateFusionUncertainty(input: {
  readonly modalities: readonly ModalityState[];
  readonly modelOutputs: readonly ModelFusionOutput[];
  readonly route: FusionRouteDecision;
  readonly fusedSignal: number;
}): FusionUncertainty {
  const present = input.modalities.filter((m) => m.availability === 'PRESENT');
  const missing = input.modalities.length - present.length;
  const blocked = input.modalities.filter((m) => m.availability === 'BLOCKED').length;

  const aleatoric =
    input.modelOutputs.reduce((acc, row) => acc + row.uncertainty, 0) / Math.max(1, input.modelOutputs.length);

  const epistemic = fuseModelOutputs(input.modelOutputs, input.route).modelDispersion;

  const lowTrust = present.filter((m) => m.reliability.effectiveTrust < 0.4).length;
  const missingnessInflation = 0.06 * missing + 0.12 * blocked;
  const reliabilityInflation = 0.05 * lowTrust;

  const total = Math.max(0.05, aleatoric + epistemic + missingnessInflation + reliabilityInflation);

  return Object.freeze({
    aleatoric,
    epistemic,
    missingnessInflation,
    reliabilityInflation,
    total,
    intervalLower: input.fusedSignal - 1.96 * total,
    intervalUpper: input.fusedSignal + 1.96 * total,
    calibrated: true,
  });
}
