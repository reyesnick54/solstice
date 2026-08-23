/**
 * Oracle verification statuses for productive-economy observations.
 *
 * Single-source verified is not consensus. Multi-source corroboration
 * uses the existing oracle consensus architecture. One configured
 * provider is never automatically trusted.
 */

import { detectOutlier } from './outliers.ts';
import type { VerificationStatus } from './types.ts';

export const VERIFICATION_IS_NOT_MINT = true as const;

export type VerificationInput = {
  readonly signatureValid: boolean;
  readonly provenancePresent: boolean;
  readonly freshnessState: 'FRESH' | 'AGING' | 'STALE' | 'EXPIRED';
  readonly independentSourceCount: number;
  readonly values: readonly bigint[];
  readonly subjectValue: bigint;
};

export type VerificationDecision = {
  readonly status: VerificationStatus;
  readonly consensusClaimed: false;
  readonly singleSourceIsConsensus: false;
  readonly providerTrustedBecauseConfigured: false;
};

export function verifyObservation(input: VerificationInput): VerificationDecision {
  if (!input.signatureValid || !input.provenancePresent) {
    return decision('INVALID');
  }
  if (input.freshnessState === 'STALE' || input.freshnessState === 'EXPIRED') {
    return decision('STALE');
  }
  const outlier = detectOutlier({ value: input.subjectValue, peers: input.values.filter((row) => row !== input.subjectValue) });
  if (outlier.outlier) {
    return decision('OUTLIER');
  }
  if (input.independentSourceCount >= 2) {
    const spread = maxSpread(input.values);
    const median = medianOf(input.values);
    if (median > 0n && spread > (median * 2_500n) / 10_000n) {
      return decision('DISPUTED');
    }
    return decision('MULTI_SOURCE_CORROBORATED');
  }
  return decision('SINGLE_SOURCE_VERIFIED');
}

export function verificationEligibleForValuation(status: VerificationStatus): boolean {
  return status === 'SINGLE_SOURCE_VERIFIED' || status === 'MULTI_SOURCE_CORROBORATED';
}

export function refuseFakeConsensus(status: VerificationStatus): boolean {
  return status !== 'MULTI_SOURCE_CORROBORATED';
}

function decision(status: VerificationStatus): VerificationDecision {
  return Object.freeze({
    status,
    consensusClaimed: false,
    singleSourceIsConsensus: false,
    providerTrustedBecauseConfigured: false,
  });
}

function maxSpread(values: readonly bigint[]): bigint {
  if (values.length === 0) return 0n;
  let min = values[0]!;
  let max = values[0]!;
  for (const value of values) {
    if (value < min) min = value;
    if (value > max) max = value;
  }
  return max - min;
}

function medianOf(values: readonly bigint[]): bigint {
  if (values.length === 0) return 0n;
  const sorted = [...values].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
  return sorted[Math.floor(sorted.length / 2)] ?? 0n;
}
