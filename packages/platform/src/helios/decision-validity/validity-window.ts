import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { ComponentCheckResult } from './types.ts';
import type { EnvelopeValidityStatus } from './taxonomy.ts';

export function shortestMaterialValidUntil(
  checks: readonly ComponentCheckResult[],
): UtcInstant {
  const material = checks.filter((check) => check.critical || check.status === 'VALID');
  if (material.length === 0) {
    return checks[0]?.validUntil ?? (new Date(0).toISOString() as UtcInstant);
  }
  let minMs = Number.POSITIVE_INFINITY;
  for (const check of material) {
    const ms = Date.parse(check.validUntil);
    if (ms < minMs) {
      minMs = ms;
    }
  }
  return new Date(minMs).toISOString() as UtcInstant;
}

export function envelopeExpired(validUntil: UtcInstant, now: UtcInstant): boolean {
  return Date.parse(now) > Date.parse(validUntil);
}

export function aggregateEnvelopeStatus(
  checks: readonly ComponentCheckResult[],
  validUntil: UtcInstant,
  now: UtcInstant,
): EnvelopeValidityStatus {
  if (envelopeExpired(validUntil, now)) {
    return 'EXPIRED';
  }
  const criticalUnknown = checks.some((c) => c.critical && c.status === 'UNKNOWN');
  if (criticalUnknown) {
    return 'UNKNOWN';
  }
  const criticalInvalid = checks.some((c) => c.critical && (c.status === 'INVALID' || c.status === 'EXPIRED'));
  if (criticalInvalid) {
    return 'INVALID';
  }
  const reviewRequired = checks.some((c) => c.status === 'REVIEW_REQUIRED');
  if (reviewRequired) {
    return 'REVIEW_REQUIRED';
  }
  const degraded = checks.some((c) => c.status === 'DEGRADED');
  if (degraded) {
    return 'DEGRADED';
  }
  const anyInvalid = checks.some((c) => c.status === 'INVALID' || c.status === 'EXPIRED');
  if (anyInvalid) {
    return 'INVALID';
  }
  const anyUnknown = checks.some((c) => c.status === 'UNKNOWN');
  if (anyUnknown) {
    return 'UNKNOWN';
  }
  return 'VALID';
}
