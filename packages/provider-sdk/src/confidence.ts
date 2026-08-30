/**
 * Generic confidence representation. No fake precision.
 * Designed for later multi-source consensus (Prompt 26).
 */

import type { AuthorityClass, ConfidenceBasis, ObservationConfidence } from './types.ts';
import type { FreshnessStatus } from './types.ts';
import type { ValidationStatus } from './types.ts';

export type ConfidenceInput = {
  readonly authorityClass: AuthorityClass;
  readonly freshnessStatus: FreshnessStatus;
  readonly validationStatus: ValidationStatus;
  readonly corroborationCount?: number;
  readonly providerTrustScore?: number | null;
};

const AUTHORITY_WEIGHT: Readonly<Record<AuthorityClass, number>> = Object.freeze({
  authoritative_official: 0.95,
  regulated_provider: 0.85,
  reference_data: 0.75,
  research_data: 0.55,
  community_data: 0.35,
  derived_data: 0.45,
});

export function buildConfidence(input: ConfidenceInput): ObservationConfidence {
  const basis: ConfidenceBasis[] = [];
  if (input.validationStatus === 'valid') {
    basis.push('schema_valid');
  }
  if (input.freshnessStatus === 'fresh') {
    basis.push('fresh');
  }
  if (input.authorityClass === 'authoritative_official') {
    basis.push('authoritative_source');
  } else if (input.authorityClass === 'regulated_provider') {
    basis.push('regulated_provider');
  } else if (input.authorityClass === 'reference_data') {
    basis.push('reference_data');
  } else if (input.authorityClass === 'derived_data') {
    basis.push('derived_only');
  }
  if ((input.corroborationCount ?? 0) > 1) {
    basis.push('corroborated');
  }
  if (input.providerTrustScore !== undefined && input.providerTrustScore !== null) {
    basis.push('provider_trust');
  }

  if (
    input.validationStatus !== 'valid' ||
    input.freshnessStatus === 'unknown' ||
    input.freshnessStatus === 'expired'
  ) {
    return Object.freeze({ score: null, basis });
  }

  let score = AUTHORITY_WEIGHT[input.authorityClass];
  if (input.freshnessStatus === 'stale' || input.freshnessStatus === 'aging') {
    score *= 0.7;
  }
  if (input.providerTrustScore !== undefined && input.providerTrustScore !== null) {
    score = (score + clamp01(input.providerTrustScore)) / 2;
  }
  if ((input.corroborationCount ?? 0) > 1) {
    score = Math.min(1, score + 0.05 * ((input.corroborationCount ?? 0) - 1));
  }
  return Object.freeze({ score: clamp01(score), basis: Object.freeze(basis) });
}

export function validateConfidenceScore(score: number | null): boolean {
  if (score === null) {
    return true;
  }
  return Number.isFinite(score) && score >= 0 && score <= 1;
}

export function assertValidConfidence(confidence: ObservationConfidence): void {
  if (!validateConfidenceScore(confidence.score)) {
    throw new TypeError(`confidence.score must be null or 0.0–1.0, received ${String(confidence.score)}`);
  }
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}
