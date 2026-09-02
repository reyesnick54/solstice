/**
 * Oracle disagreement and conflict handling.
 *
 * Never blindly average conflicting productive data.
 */

import type {
  OracleConflictReport,
  OracleDisagreementLevel,
  ToleranceAssessment,
} from './types.ts';

export function medianBigInt(values: readonly bigint[]): bigint {
  if (values.length === 0) return 0n;
  const sorted = [...values].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
  return sorted[Math.floor(sorted.length / 2)] ?? 0n;
}

export function spreadBps(values: readonly bigint[]): number {
  if (values.length < 2) return 0;
  const min = values.reduce((acc, value) => (value < acc ? value : acc));
  const max = values.reduce((acc, value) => (value > acc ? value : acc));
  if (min === 0n) {
    return max === 0n ? 0 : 10_000;
  }
  return Number(((max - min) * 10_000n) / min);
}

export function assessTolerance(
  values: readonly bigint[],
  toleranceBps: number,
): ToleranceAssessment {
  const medianValue = medianBigInt(values);
  const spread = spreadBps(values);
  return Object.freeze({
    toleranceBps,
    spreadBps: spread,
    withinTolerance: spread <= toleranceBps,
    medianValue,
    values: Object.freeze([...values]),
  });
}

export function detectOutlierProviders(input: {
  readonly values: readonly { readonly providerId: string; readonly value: bigint }[];
  readonly toleranceBps: number;
}): readonly string[] {
  if (input.values.length < 3) {
    return Object.freeze([]);
  }
  const allValues = input.values.map((row) => row.value);
  const median = medianBigInt(allValues);
  if (median === 0n) {
    return Object.freeze([]);
  }
  const outliers: string[] = [];
  for (const row of input.values) {
    const deviation = row.value > median ? row.value - median : median - row.value;
    const deviationBps = Number((deviation * 10_000n) / median);
    if (deviationBps > input.toleranceBps * 2) {
      outliers.push(row.providerId);
    }
  }
  return Object.freeze(outliers);
}

export function classifyDisagreement(input: {
  readonly values: readonly bigint[];
  readonly toleranceBps: number;
  readonly outlierProviderIds: readonly string[];
  readonly admittedCount: number;
  readonly minimumRequired: number;
}): OracleConflictReport {
  if (input.admittedCount < input.minimumRequired) {
    return conflict('INSUFFICIENT_EVIDENCE', input.outlierProviderIds, 0, 'not enough admitted observations');
  }
  if (input.values.length === 0) {
    return conflict('INSUFFICIENT_EVIDENCE', [], 0, 'no numeric values');
  }
  if (input.values.length === 1) {
    return conflict('AGREEMENT', [], 0, 'single admitted observation');
  }

  const spread = spreadBps(input.values);
  if (input.outlierProviderIds.length > 0) {
    return conflict('OUTLIER', input.outlierProviderIds, spread, 'outlier provider detected');
  }
  if (spread > input.toleranceBps * 3) {
    return conflict('MATERIAL_CONFLICT', [], spread, 'spread exceeds material conflict threshold');
  }
  if (spread > input.toleranceBps) {
    return conflict('MINOR_VARIANCE', [], spread, 'variance within review band but above tolerance');
  }
  return conflict('AGREEMENT', [], spread, 'values within tolerance');
}

function conflict(
  level: OracleDisagreementLevel,
  outlierProviderIds: readonly string[],
  spreadBps: number,
  detail: string,
): OracleConflictReport {
  return Object.freeze({
    disagreementLevel: level,
    outlierProviderIds: Object.freeze([...outlierProviderIds]),
    spreadBps,
    detail,
  });
}

export function disagreementBlocksVerification(level: OracleDisagreementLevel): boolean {
  return level === 'MATERIAL_CONFLICT' || level === 'INSUFFICIENT_EVIDENCE' || level === 'OUTLIER';
}

export function disagreementRequiresManualReview(
  level: OracleDisagreementLevel,
  triggers: readonly OracleDisagreementLevel[],
): boolean {
  return (triggers as readonly string[]).includes(level);
}
