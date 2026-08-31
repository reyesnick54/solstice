/**
 * Data quality validation for energy and resource observations.
 */

import type { ObservationFreshness } from './types.ts';

export type DataQualityIssue = {
  readonly code: string;
  readonly severity: 'WARNING' | 'ERROR';
  readonly detail: string;
};

export type DataQualityReport = {
  readonly valid: boolean;
  readonly issues: readonly DataQualityIssue[];
};

export function assessFreshness(
  sourceTimestamp: string,
  retrievedAt: string,
  maxAgeSeconds: number,
): ObservationFreshness {
  const ageSeconds = Math.max(0, (Date.parse(retrievedAt) - Date.parse(sourceTimestamp)) / 1000);
  let state: ObservationFreshness['state'];
  if (ageSeconds <= maxAgeSeconds * 0.5) {
    state = 'FRESH';
  } else if (ageSeconds <= maxAgeSeconds) {
    state = 'AGING';
  } else if (ageSeconds <= maxAgeSeconds * 2) {
    state = 'STALE';
  } else {
    state = 'EXPIRED';
  }
  return Object.freeze({ state, ageSeconds, maxAgeSeconds });
}

export function validateObservation(input: {
  readonly value: number;
  readonly unit: string;
  readonly sourceTimestamp: string;
  readonly retrievedAt: string;
  readonly isPercentage?: boolean;
  readonly allowNegative?: boolean;
}): DataQualityReport {
  const issues: DataQualityIssue[] = [];

  if (!input.unit || input.unit.trim().length === 0) {
    issues.push({ code: 'MISSING_UNIT', severity: 'ERROR', detail: 'Unit is required' });
  }

  if (!Number.isFinite(input.value)) {
    issues.push({ code: 'NON_FINITE_VALUE', severity: 'ERROR', detail: 'Value must be finite' });
  }

  if (!input.allowNegative && input.value < 0) {
    issues.push({ code: 'NEGATIVE_VALUE', severity: 'ERROR', detail: 'Negative value not permitted for this metric' });
  }

  if (input.isPercentage && (input.value < 0 || input.value > 100)) {
    issues.push({ code: 'IMPOSSIBLE_PERCENTAGE', severity: 'ERROR', detail: 'Percentage out of 0-100 range' });
  }

  if (Number.isNaN(Date.parse(input.sourceTimestamp))) {
    issues.push({ code: 'MALFORMED_TIMESTAMP', severity: 'ERROR', detail: 'Source timestamp is invalid' });
  }

  const ageMs = Date.parse(input.retrievedAt) - Date.parse(input.sourceTimestamp);
  if (ageMs < 0) {
    issues.push({ code: 'FUTURE_SOURCE_TIMESTAMP', severity: 'WARNING', detail: 'Source timestamp is in the future' });
  }

  const hasError = issues.some((i) => i.severity === 'ERROR');
  return Object.freeze({ valid: !hasError, issues: Object.freeze(issues) });
}

export function dataQualityEvent(issue: DataQualityIssue, providerId: string, observationId: string) {
  return Object.freeze({
    schema: 'sunrey.data-quality.event.v1' as const,
    providerId,
    observationId,
    code: issue.code,
    severity: issue.severity,
    detail: issue.detail,
    autoNotify: false,
  });
}
