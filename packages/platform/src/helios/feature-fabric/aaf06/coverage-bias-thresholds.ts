import type { CoverageBiasSeverity } from './coverage-bias-types.ts';

export const COVERAGE_BIAS_MIN_ELIGIBLE_UNIVERSE = 30;
export const COVERAGE_BIAS_MIN_FEATURE_COVERED = 10;

export const SMD_WARNING_THRESHOLD = 0.25;
export const SMD_SEVERE_THRESHOLD = 0.5;

export const TVD_WARNING_THRESHOLD = 0.1;
export const TVD_SEVERE_THRESHOLD = 0.2;

export const COVERAGE_GAP_WARNING_THRESHOLD = 0.15;
export const COVERAGE_GAP_SEVERE_THRESHOLD = 0.35;

export const MISSINGNESS_CORR_WARNING_THRESHOLD = 0.3;
export const MISSINGNESS_CORR_SEVERE_THRESHOLD = 0.5;

export const BUCKET_COVERAGE_DELTA_WARNING = 0.12;
export const BUCKET_COVERAGE_DELTA_SEVERE = 0.22;

export function severityFromMagnitude(
  magnitude: number,
  warningThreshold: number,
  severeThreshold: number,
): CoverageBiasSeverity {
  const abs = Math.abs(magnitude);
  if (abs >= severeThreshold) {
    return 'SEVERE';
  }
  if (abs >= warningThreshold) {
    return 'WARNING';
  }
  return 'PASS';
}

export function combineSeverities(levels: readonly CoverageBiasSeverity[]): CoverageBiasSeverity {
  if (levels.includes('INSUFFICIENT_DATA')) {
    return 'INSUFFICIENT_DATA';
  }
  if (levels.includes('SEVERE')) {
    return 'SEVERE';
  }
  if (levels.includes('WARNING')) {
    return 'WARNING';
  }
  return 'PASS';
}
