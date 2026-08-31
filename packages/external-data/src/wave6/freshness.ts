/**
 * Wave 6 — job listing freshness assessment.
 */

import type { UtcInstant } from '../../../domain/src/time.ts';
import type { JobFreshnessStatus } from './types.ts';

const ACTIVE_MS = 7 * 24 * 60 * 60 * 1000;
const AGING_MS = 14 * 24 * 60 * 60 * 1000;
const STALE_MS = 30 * 24 * 60 * 60 * 1000;

export function assessJobFreshness(input: {
  readonly postedAt: UtcInstant | null;
  readonly expiresAt: UtcInstant | null;
  readonly retrievedAt: UtcInstant;
  readonly nowUtc: UtcInstant;
}): JobFreshnessStatus {
  const nowMs = Date.parse(input.nowUtc);
  if (input.expiresAt && Date.parse(input.expiresAt) < nowMs) {
    return 'EXPIRED';
  }
  const referenceMs = input.postedAt ? Date.parse(input.postedAt) : Date.parse(input.retrievedAt);
  const ageMs = nowMs - referenceMs;
  if (ageMs > STALE_MS) return 'STALE';
  if (ageMs > AGING_MS) return 'AGING';
  if (ageMs > ACTIVE_MS) return 'AGING';
  return 'ACTIVE';
}

export function isRecommendableFreshness(status: JobFreshnessStatus): boolean {
  return status === 'ACTIVE' || status === 'AGING';
}
