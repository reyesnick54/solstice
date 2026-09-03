/**
 * Schema and domain validation for Wave 3 economic proof objects.
 */

import {
  CANONICAL_ECONOMIC_CLAIM_SCHEMA_VERSION,
  ECONOMIC_DOMAINS,
  ECONOMIC_EVIDENCE_SCHEMA_VERSION,
  ECONOMIC_OBSERVATION_SCHEMA_VERSION,
  SUPPORTED_CLAIM_SCHEMA_VERSIONS,
  SUPPORTED_EVIDENCE_SCHEMA_VERSIONS,
  SUPPORTED_OBSERVATION_SCHEMA_VERSIONS,
  SUPPORTED_VERIFIED_FACT_SCHEMA_VERSIONS,
  VERIFIED_ECONOMIC_FACT_SCHEMA_VERSION,
} from './constants.ts';
import type {
  CanonicalEconomicClaim,
  EconomicEvidence,
  EconomicObservation,
  ProofRejectionCode,
  ProofResult,
  VerifiedEconomicFact,
} from './types.ts';

function fail<T>(code: ProofRejectionCode, message: string): ProofResult<T> {
  return { ok: false, code, message };
}

function ok<T>(value: T): ProofResult<T> {
  return { ok: true, value };
}

function isIsoUtc(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

function validateTemporalRange(startUtc: string, endUtc: string): string | null {
  if (!isIsoUtc(startUtc) || !isIsoUtc(endUtc)) {
    return 'temporal bounds must be ISO-8601 UTC timestamps';
  }
  if (Date.parse(startUtc) > Date.parse(endUtc)) {
    return 'temporal start must not exceed end';
  }
  return null;
}

function validateLabeledQuantity(
  quantity: { readonly value: bigint; readonly unit: string; readonly metric: string },
  allowZero = false,
): string | null {
  if (!quantity.metric.trim()) {
    return 'metric is required';
  }
  if (!quantity.unit.trim()) {
    return 'unit is required';
  }
  if (quantity.value < 0n) {
    return 'negative physical quantity is invalid';
  }
  if (!allowZero && quantity.value === 0n) {
    return 'unlabeled or zero quantity requires explicit policy allowance';
  }
  return null;
}

function assertNoMonetaryAuthority(authority: Record<string, unknown>): string | null {
  for (const [key, value] of Object.entries(authority)) {
    if (value === true && /mint|issue|authorize|price|balance/i.test(key)) {
      return `monetary authority field forbidden: ${key}`;
    }
  }
  return null;
}

export function validateEconomicObservation(observation: EconomicObservation): ProofResult<EconomicObservation> {
  if (!(SUPPORTED_OBSERVATION_SCHEMA_VERSIONS as readonly string[]).includes(observation.schemaVersion)) {
    return fail('UNSUPPORTED_SCHEMA_VERSION', `unsupported observation schema: ${observation.schemaVersion}`);
  }
  if (!observation.observationId.trim()) {
    return fail('MISSING_REQUIRED_ID', 'observationId is required');
  }
  if (!(ECONOMIC_DOMAINS as readonly string[]).includes(observation.economicDomain)) {
    return fail('INVALID_ECONOMIC_DOMAIN', `invalid economic domain: ${observation.economicDomain}`);
  }
  const quantityError = validateLabeledQuantity(observation.quantity, true);
  if (quantityError) {
    return fail(quantityError.includes('negative') ? 'NEGATIVE_PHYSICAL_QUANTITY' : 'UNLABELED_NUMERIC', quantityError);
  }
  if (!observation.provenanceRef.provenanceId.trim()) {
    return fail('MISSING_PROVENANCE', 'provenance reference is required');
  }
  const authorityError = assertNoMonetaryAuthority(observation.authority as unknown as Record<string, unknown>);
  if (authorityError) {
    return fail('MONETARY_AUTHORITY_FORBIDDEN', authorityError);
  }
  if (observation.authority.mintsNativeAsset || observation.authority.issuesExecutionAuthority) {
    return fail('MONETARY_AUTHORITY_FORBIDDEN', 'observation cannot carry monetary authority');
  }
  return ok(observation);
}

export function validateEconomicEvidence(evidence: EconomicEvidence): ProofResult<EconomicEvidence> {
  if (!(SUPPORTED_EVIDENCE_SCHEMA_VERSIONS as readonly string[]).includes(evidence.schemaVersion)) {
    return fail('UNSUPPORTED_SCHEMA_VERSION', `unsupported evidence schema: ${evidence.schemaVersion}`);
  }
  if (!evidence.evidenceId.trim()) {
    return fail('MISSING_REQUIRED_ID', 'evidenceId is required');
  }
  if (!(ECONOMIC_DOMAINS as readonly string[]).includes(evidence.economicDomain)) {
    return fail('INVALID_ECONOMIC_DOMAIN', `invalid economic domain: ${evidence.economicDomain}`);
  }
  if (evidence.materials.length === 0) {
    return fail('MALFORMED_CLAIM', 'evidence requires at least one material digest reference');
  }
  for (const material of evidence.materials) {
    if (!material.materialDigest.trim()) {
      return fail('RAW_PAYLOAD_REQUIRED', 'evidence must use cryptographic digests, not raw payloads');
    }
  }
  if (evidence.authority.mintsNativeAsset || evidence.authority.replacesVaultAuthority) {
    return fail('MONETARY_AUTHORITY_FORBIDDEN', 'evidence cannot carry monetary authority');
  }
  return ok(evidence);
}

export function validateVerifiedEconomicFact(fact: VerifiedEconomicFact): ProofResult<VerifiedEconomicFact> {
  if (!(SUPPORTED_VERIFIED_FACT_SCHEMA_VERSIONS as readonly string[]).includes(fact.schemaVersion)) {
    return fail('UNSUPPORTED_SCHEMA_VERSION', `unsupported verified fact schema: ${fact.schemaVersion}`);
  }
  if (!fact.verifiedFactId.trim()) {
    return fail('MISSING_REQUIRED_ID', 'verifiedFactId is required');
  }
  const temporalError = validateTemporalRange(fact.temporalBounds.startUtc, fact.temporalBounds.endUtc);
  if (temporalError) {
    return fail('INVALID_TEMPORAL_RANGE', temporalError);
  }
  const quantityError = validateLabeledQuantity(fact.quantity);
  if (quantityError) {
    return fail(quantityError.includes('negative') ? 'NEGATIVE_PHYSICAL_QUANTITY' : 'UNLABELED_NUMERIC', quantityError);
  }
  if (fact.supportingEvidenceIds.length === 0) {
    return fail('MALFORMED_CLAIM', 'verified fact requires supporting evidence references');
  }
  if (fact.authority.mintsNativeAsset) {
    return fail('MONETARY_AUTHORITY_FORBIDDEN', 'verified fact cannot mint');
  }
  return ok(fact);
}

export function validateCanonicalEconomicClaim(claim: CanonicalEconomicClaim): ProofResult<CanonicalEconomicClaim> {
  if (!(SUPPORTED_CLAIM_SCHEMA_VERSIONS as readonly string[]).includes(claim.schemaVersion)) {
    return fail('UNSUPPORTED_SCHEMA_VERSION', `unsupported claim schema: ${claim.schemaVersion}`);
  }
  if (!claim.economicClaimId.trim()) {
    return fail('MISSING_REQUIRED_ID', 'economicClaimId is required');
  }
  if (!(ECONOMIC_DOMAINS as readonly string[]).includes(claim.economicDomain)) {
    return fail('INVALID_ECONOMIC_DOMAIN', `invalid economic domain: ${claim.economicDomain}`);
  }
  const temporalError = validateTemporalRange(claim.temporalBounds.startUtc, claim.temporalBounds.endUtc);
  if (temporalError) {
    return fail('INVALID_TEMPORAL_RANGE', temporalError);
  }
  if (!claim.duplicateFingerprint.trim()) {
    return fail('MALFORMED_CLAIM', 'duplicate fingerprint is required');
  }
  if (claim.supportingFactIds.length === 0) {
    return fail('MALFORMED_CLAIM', 'claim requires supporting verified fact references');
  }
  if (claim.authority.mintsNativeAsset || claim.authority.isWalletBalance) {
    return fail('MONETARY_AUTHORITY_FORBIDDEN', 'claim cannot carry monetary authority');
  }
  return ok(claim);
}

export function assertSupportedSchemaVersion(
  kind: 'observation' | 'evidence' | 'verifiedFact' | 'claim',
  schemaVersion: string,
): ProofResult<string> {
  const supported =
    kind === 'observation'
      ? SUPPORTED_OBSERVATION_SCHEMA_VERSIONS
      : kind === 'evidence'
        ? SUPPORTED_EVIDENCE_SCHEMA_VERSIONS
        : kind === 'verifiedFact'
          ? SUPPORTED_VERIFIED_FACT_SCHEMA_VERSIONS
          : SUPPORTED_CLAIM_SCHEMA_VERSIONS;
  if (!(supported as readonly string[]).includes(schemaVersion)) {
    return fail('UNSUPPORTED_SCHEMA_VERSION', `unsupported ${kind} schema: ${schemaVersion}`);
  }
  return ok(schemaVersion);
}

export const CANONICAL_SCHEMA_VERSIONS = Object.freeze({
  observation: ECONOMIC_OBSERVATION_SCHEMA_VERSION,
  evidence: ECONOMIC_EVIDENCE_SCHEMA_VERSION,
  verifiedFact: VERIFIED_ECONOMIC_FACT_SCHEMA_VERSION,
  claim: CANONICAL_ECONOMIC_CLAIM_SCHEMA_VERSION,
});
