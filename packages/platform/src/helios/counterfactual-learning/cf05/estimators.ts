import type { HeliosOpeLogRow, OffPolicyEvaluationOptions } from './types.ts';

export function importanceRatio(row: HeliosOpeLogRow): number {
  return row.targetPropensity / row.behaviorPropensity;
}

export function effectiveSampleSizeFromWeights(weights: readonly number[]): number {
  const s = weights.reduce((a, b) => a + b, 0);
  const s2 = weights.reduce((a, b) => a + b * b, 0);
  if (s2 <= 0) return 0;
  return (s * s) / s2;
}

export function effectiveSampleSizeFromImportanceRatios(
  rows: readonly HeliosOpeLogRow[],
  cap?: number,
): number {
  const weights =
    cap !== undefined ? rows.map((r) => Math.min(importanceRatio(r), cap)) : rows.map(importanceRatio);
  return effectiveSampleSizeFromWeights(weights);
}

function calibrationFactor(row: HeliosOpeLogRow): number {
  const ann = row.annotation;
  if (!ann || ann.calibration.length === 0) return 1;
  let sum = 0;
  for (const b of ann.calibration) {
    sum += Math.abs(b.expected - b.observed);
  }
  const raw = 1 - sum / (2 * ann.calibration.length);
  return Math.max(0, Math.min(1, raw));
}

function annotationAlpha(row: HeliosOpeLogRow): number {
  const ann = row.annotation;
  if (!ann) return 0;
  const c = Math.max(0, Math.min(1, ann.confidence));
  return c * calibrationFactor(row);
}

/** Direct method expectation plug-in; optional annotation-guided blend when policy permits. */
export function directMethodPoint(
  rows: readonly HeliosOpeLogRow[],
  policy: OffPolicyEvaluationOptions['annotationDirectPolicy'],
): number {
  if (rows.length === 0) return Number.NaN;
  let sum = 0;
  for (const row of rows) {
    const muTarget = row.outcomeModel.meanUnderTargetPolicy;
    const muObs = row.outcomeModel.meanUnderObservedAction;
    const ann = row.annotation;
    if (policy === 'permit' && ann) {
      const w = annotationAlpha(row);
      sum += (1 - w) * muTarget + w * muObs;
    } else {
      sum += muTarget;
    }
  }
  return sum / rows.length;
}

export function ipsPoint(rows: readonly HeliosOpeLogRow[]): number {
  if (rows.length === 0) return Number.NaN;
  let sum = 0;
  for (const row of rows) {
    sum += importanceRatio(row) * row.outcome;
  }
  return sum / rows.length;
}

export function snipsPoint(rows: readonly HeliosOpeLogRow[]): { value: number; ess: number } {
  if (rows.length === 0) return { value: Number.NaN, ess: 0 };
  const weights = rows.map(importanceRatio);
  const wSum = weights.reduce((a, b) => a + b, 0);
  if (wSum <= 0) return { value: Number.NaN, ess: 0 };
  let num = 0;
  for (let i = 0; i < rows.length; i += 1) {
    const w = weights[i]!;
    num += w * rows[i]!.outcome;
  }
  return {
    value: num / wSum,
    ess: effectiveSampleSizeFromWeights(weights),
  };
}

export function doublyRobustPoint(rows: readonly HeliosOpeLogRow[]): number {
  if (rows.length === 0) return Number.NaN;
  let sum = 0;
  for (const row of rows) {
    const w = importanceRatio(row);
    const residual = row.outcome - row.outcomeModel.meanUnderObservedAction;
    sum += row.outcomeModel.meanUnderTargetPolicy + w * residual;
  }
  return sum / rows.length;
}

export function switchDoublyRobustPoint(rows: readonly HeliosOpeLogRow[], tau: number): number {
  if (rows.length === 0) return Number.NaN;
  let sum = 0;
  for (const row of rows) {
    const w = Math.min(importanceRatio(row), tau);
    const residual = row.outcome - row.outcomeModel.meanUnderObservedAction;
    sum += row.outcomeModel.meanUnderTargetPolicy + w * residual;
  }
  return sum / rows.length;
}

export function usedAnnotationInDirect(row: HeliosOpeLogRow, policy: OffPolicyEvaluationOptions['annotationDirectPolicy']): boolean {
  return policy === 'permit' && Boolean(row.annotation) && annotationAlpha(row) > 0;
}
