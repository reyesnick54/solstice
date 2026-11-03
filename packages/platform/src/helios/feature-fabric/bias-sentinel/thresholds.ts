import type { BiasSeverity } from './types.ts';

export const BIAS_MIN_INTENDED_UNIVERSE = 30;
export const BIAS_MIN_OBSERVED_USABLE = 10;

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

export const SURVIVORSHIP_ABSENCE_WARNING = 0.05;
export const SURVIVORSHIP_ABSENCE_SEVERE = 0.15;

export const DELISTING_OMISSION_WARNING = 0.08;
export const DELISTING_OMISSION_SEVERE = 0.2;

export const PROVIDER_CONCENTRATION_DELTA_WARNING = 0.12;
export const PROVIDER_CONCENTRATION_DELTA_SEVERE = 0.25;

export const TRAIN_HOLDOUT_DELTA_WARNING = 0.1;
export const TRAIN_HOLDOUT_DELTA_SEVERE = 0.2;

export const MISSINGNESS_MODEL_MIN_OBSERVATIONS = 40;

export function severityFromMagnitude(
  magnitude: number,
  warningThreshold: number,
  severeThreshold: number,
): BiasSeverity {
  const abs = Math.abs(magnitude);
  if (abs >= severeThreshold) {
    return 'SEVERE';
  }
  if (abs >= warningThreshold) {
    return 'WARNING';
  }
  return 'PASS';
}

export function combineSeverities(levels: readonly BiasSeverity[]): BiasSeverity {
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
