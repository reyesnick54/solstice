import type { CrossModelDispersion, CrossModelValueInput } from './types.ts';
import { coefficientOfVariation, mean, median } from './numeric.ts';

export function buildCrossModelDispersion(values: readonly CrossModelValueInput[]): CrossModelDispersion | null {
  if (values.length < 2) return null;
  const ev = values.map((v) => v.enterpriseValue);
  const med = median(ev);
  const min = Math.min(...ev);
  const max = Math.max(...ev);
  const cov = coefficientOfVariation(ev);
  const reverseDcfConsistencyFailures = values
    .filter((v) => v.consistentWithReverseDcf === false)
    .map((v) => v.method);
  return Object.freeze({
    values: Object.freeze([...values]),
    medianEnterpriseValue: med,
    minEnterpriseValue: min,
    maxEnterpriseValue: max,
    coefficientOfVariation: cov,
    disagreementSeverity: disagreementSeverity(cov, max, min, med),
    reverseDcfConsistencyFailures: Object.freeze(reverseDcfConsistencyFailures),
  });
}

function disagreementSeverity(cov: number, max: number, min: number, med: number): 'LOW' | 'MODERATE' | 'HIGH' {
  const rangeRatio = med <= Number.EPSILON ? 1 : (max - min) / Math.abs(med);
  if (cov >= 0.25 || rangeRatio >= 0.4) return 'HIGH';
  if (cov >= 0.12 || rangeRatio >= 0.2) return 'MODERATE';
  return 'LOW';
}

export function dispersionPenalty(dispersion: CrossModelDispersion | null): number {
  if (!dispersion) return 0;
  if (dispersion.disagreementSeverity === 'HIGH') return 0.35;
  if (dispersion.disagreementSeverity === 'MODERATE') return 0.2;
  return 0.08;
}

export function averageCrossModel(values: readonly CrossModelValueInput[]): number {
  return mean(values.map((v) => v.enterpriseValue));
}
