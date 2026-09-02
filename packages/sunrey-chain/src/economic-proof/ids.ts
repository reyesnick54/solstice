/**
 * Deterministic identifiers for Wave 3 economic proof objects.
 */

import { createHash } from 'node:crypto';

import {
  claimCommitment,
  evidenceCommitment,
  observationCommitment,
  verifiedFactCommitment,
} from './serialization.ts';
import type { CanonicalEconomicClaim, EconomicEvidence, EconomicObservation, VerifiedEconomicFact } from './types.ts';

export function observationId(observation: EconomicObservation): string {
  return `obs_${observationCommitment(observation).slice(0, 32)}`;
}

export function evidenceId(evidence: EconomicEvidence): string {
  return `evd_${evidenceCommitment(evidence).slice(0, 32)}`;
}

export function verifiedFactId(fact: VerifiedEconomicFact): string {
  return `vef_${verifiedFactCommitment(fact).slice(0, 32)}`;
}

export function economicClaimId(claim: CanonicalEconomicClaim): string {
  return `cec_${claimCommitment(claim).slice(0, 32)}`;
}

export function duplicateClaimFingerprint(input: {
  readonly economicDomain: string;
  readonly claimType: string;
  readonly canonicalEntityId: string;
  readonly canonicalEventId: string;
  readonly subjectRef: string;
  readonly temporalStartUtc: string;
  readonly temporalEndUtc: string;
}): string {
  const payload = [
    input.economicDomain,
    input.claimType,
    input.canonicalEntityId,
    input.canonicalEventId,
    input.subjectRef,
    input.temporalStartUtc,
    input.temporalEndUtc,
  ].join('|');
  return createHash('sha256').update(`sunrey.claim.fingerprint.v1|${payload}`).digest('hex');
}
