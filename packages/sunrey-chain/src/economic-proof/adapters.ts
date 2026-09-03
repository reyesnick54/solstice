// @ts-nocheck
/**
 * Adapters from mature domain-specific types to Wave 3 canonical proof lattice.
 *
 * Preserves existing oracle and economy-data types — does not replace them.
 */

import type { EconomicObservation as EconomyDataObservation } from '../productive/economy-data/types.ts';
import type { VerifiedEconomicFact as OracleVerifiedFact } from '../oracle/types.ts';
import {
  CANONICAL_ECONOMIC_CLAIM_SCHEMA_VERSION,
  ECONOMIC_EVIDENCE_SCHEMA_VERSION,
  ECONOMIC_OBSERVATION_SCHEMA_VERSION,
  VERIFIED_ECONOMIC_FACT_SCHEMA_VERSION,
} from './constants.ts';
import { duplicateClaimFingerprint } from './ids.ts';
import { evidenceCommitment } from './serialization.ts';
import type {
  CanonicalEconomicClaim,
  EconomicEvidence,
  EconomicObservation,
  VerifiedEconomicFact,
} from './types.ts';

const OBSERVATION_AUTHORITY = Object.freeze({
  mintsNativeAsset: false as const,
  issuesExecutionAuthority: false as const,
  setsExchangePrice: false as const,
  authorizesGovernance: false as const,
});

const EVIDENCE_AUTHORITY = Object.freeze({
  mintsNativeAsset: false as const,
  issuesExecutionAuthority: false as const,
  replacesVaultAuthority: false as const,
});

const VERIFIED_FACT_AUTHORITY = Object.freeze({
  mintsNativeAsset: false as const,
  issuesExecutionAuthority: false as const,
  overridesTaxonomy: false as const,
});

const CLAIM_AUTHORITY = Object.freeze({
  mintsNativeAsset: false as const,
  issuesExecutionAuthority: false as const,
  isWalletBalance: false as const,
});

export function fromEconomyDataObservation(
  source: EconomyDataObservation,
  input: { readonly observationId: string; readonly economicDomain: 'PRODUCTIVE_ECONOMIC' },
): EconomicObservation {
  return Object.freeze({
    schemaVersion: ECONOMIC_OBSERVATION_SCHEMA_VERSION,
    observationId: input.observationId,
    providerId: source.provider,
    sourceClass: source.provenance.sourceClass,
    economicDomain: input.economicDomain,
    subjectRef: source.resourceId,
    resourceRef: source.resourceId,
    metric: source.metric,
    quantity: {
      value: source.canonicalValue,
      unit: source.canonicalUnit,
      metric: source.metric,
    },
    observedAtUtc: source.timestampUtc,
    receivedAtUtc: source.timestampUtc,
    geographicContext: {
      jurisdiction: 'UNSCOPED',
      region: null,
      locality: null,
    },
    jurisdiction: 'UNSCOPED',
    provenanceRef: {
      provenanceId: source.provenance.evidenceRef,
      sourceId: source.provenance.sourceId,
      method: source.provenance.method,
      collectedAtUtc: source.provenance.collectedAtUtc,
    },
    evidenceRefs: [source.provenance.evidenceRef],
    licenseRef: {
      licenseId: source.license,
      licenseClass: source.license,
      permittedUseDigest: source.provenance.evidenceRef,
    },
    verificationStatus: source.verification === 'MULTI_SOURCE_CORROBORATED' ? 'VERIFIED' : 'PENDING',
    confidence: {
      scoreBps: Number(source.confidenceBps),
      sampleCount: 1,
      notesRef: null,
    },
    freshness: {
      state: source.freshness.state,
      observedAtUtc: source.timestampUtc,
      receivedAtUtc: source.timestampUtc,
      maxAgeSeconds: source.freshness.ageSeconds,
      expiresAtUtc: source.freshness.expiresAtUtc,
    },
    integrity: source.integrity,
    simulation: true as const,
    authority: OBSERVATION_AUTHORITY,
  });
}

export function fromOracleVerifiedFact(
  source: OracleVerifiedFact,
  input: { readonly verifiedFactId: string; readonly economicDomain: 'PRODUCTIVE_ECONOMIC' },
): VerifiedEconomicFact {
  return Object.freeze({
    schemaVersion: VERIFIED_ECONOMIC_FACT_SCHEMA_VERSION,
    verifiedFactId: input.verifiedFactId,
    economicDomain: input.economicDomain,
    subjectRef: source.subject,
    resourceRef: source.subject,
    metric: source.feedId,
    quantity: {
      value: source.aggregatedValue.mantissa,
      unit: source.aggregatedValue.unit,
      metric: source.feedId,
    },
    verificationMethodologyId: source.aggregationPolicy,
    verificationMethodologyVersion: '1',
    supportingEvidenceIds: [...source.sourceObservationIds],
    verifiedAtUtc: new Date(Number(source.observationWindow.endUnix) * 1000).toISOString(),
    verifiers: [
      {
        verifierId: 'oracle-quorum',
        verifierClass: 'ORACLE_QUORUM',
        signatureRef: null,
      },
    ],
    confidence: {
      scoreBps: 10_000,
      sampleCount: source.sourceObservationIds.length,
      notesRef: source.conflictReason,
    },
    verificationStatus: source.qualityStatus === 'VERIFIED' ? 'VERIFIED' : 'DISPUTED',
    challengeStatus: source.conflictReason ? 'OPEN' : 'NONE',
    temporalBounds: {
      startUtc: new Date(Number(source.observationWindow.startUnix) * 1000).toISOString(),
      endUtc: new Date(Number(source.observationWindow.endUnix) * 1000).toISOString(),
    },
    geographicBounds: {
      jurisdiction: 'UNSCOPED',
      region: null,
    },
    simulation: true as const,
    authority: VERIFIED_FACT_AUTHORITY,
  });
}

export function buildEvidenceFromObservation(
  observation: EconomicObservation,
  input: { readonly evidenceId: string; readonly purposeDigest: string },
): EconomicEvidence {
  const evidence: EconomicEvidence = Object.freeze({
    schemaVersion: ECONOMIC_EVIDENCE_SCHEMA_VERSION,
    evidenceId: input.evidenceId,
    economicDomain: observation.economicDomain,
    subjectRef: observation.subjectRef,
    observationIds: [observation.observationId],
    materials: [
      {
        kind: 'MEASUREMENT',
        materialDigest: observation.provenanceRef.provenanceId,
        externalRef: null,
        attestationRef: null,
      },
    ],
    provenanceRefs: [observation.provenanceRef],
    rightsRefs: [],
    licenseRef: observation.licenseRef,
    purposeDigest: input.purposeDigest,
    consentReceiptDigest: null,
    sealedAtUtc: observation.receivedAtUtc,
    contentCommitment: '',
    simulation: true as const,
    authority: EVIDENCE_AUTHORITY,
  });
  return Object.freeze({
    ...evidence,
    contentCommitment: evidenceCommitment(evidence),
  });
}

export function buildHumanEconomicClaim(input: {
  readonly economicClaimId: string;
  readonly canonicalEntityId: string;
  readonly canonicalEventId: string;
  readonly subjectRef: string;
  readonly supportingFactIds: readonly string[];
  readonly evidenceRefs: readonly string[];
  readonly temporalBounds: { readonly startUtc: string; readonly endUtc: string };
}): CanonicalEconomicClaim {
  const fingerprint = duplicateClaimFingerprint({
    economicDomain: 'HUMAN_ECONOMIC',
    claimType: 'HUMAN_CONTRIBUTION',
    canonicalEntityId: input.canonicalEntityId,
    canonicalEventId: input.canonicalEventId,
    subjectRef: input.subjectRef,
    temporalStartUtc: input.temporalBounds.startUtc,
    temporalEndUtc: input.temporalBounds.endUtc,
  });
  return Object.freeze({
    schemaVersion: CANONICAL_ECONOMIC_CLAIM_SCHEMA_VERSION,
    economicClaimId: input.economicClaimId,
    claimType: 'HUMAN_CONTRIBUTION',
    economicDomain: 'HUMAN_ECONOMIC',
    canonicalEntityId: input.canonicalEntityId,
    canonicalEventId: input.canonicalEventId,
    subjectRef: input.subjectRef,
    resourceRef: null,
    temporalBounds: input.temporalBounds,
    geographicBounds: { jurisdiction: 'UNSCOPED', region: null },
    supportingFactIds: input.supportingFactIds,
    evidenceRefs: input.evidenceRefs,
    provenanceRefs: [],
    rightsRefs: [],
    policyRefs: [],
    lineage: { parentClaimId: null, supersededByClaimId: null, derivationPath: [] },
    duplicateFingerprint: fingerprint,
    verificationStatus: 'VERIFIED',
    challengeStatus: 'NONE',
    monetizationStatus: 'ELIGIBLE_FOR_VALUATION',
    simulation: true as const,
    authority: CLAIM_AUTHORITY,
  });
}

export function buildProductiveEconomicClaim(input: {
  readonly economicClaimId: string;
  readonly canonicalEntityId: string;
  readonly canonicalEventId: string;
  readonly subjectRef: string;
  readonly resourceRef: string;
  readonly supportingFactIds: readonly string[];
  readonly evidenceRefs: readonly string[];
  readonly temporalBounds: { readonly startUtc: string; readonly endUtc: string };
}): CanonicalEconomicClaim {
  const fingerprint = duplicateClaimFingerprint({
    economicDomain: 'PRODUCTIVE_ECONOMIC',
    claimType: 'PRODUCTIVE_OUTPUT',
    canonicalEntityId: input.canonicalEntityId,
    canonicalEventId: input.canonicalEventId,
    subjectRef: input.subjectRef,
    temporalStartUtc: input.temporalBounds.startUtc,
    temporalEndUtc: input.temporalBounds.endUtc,
  });
  return Object.freeze({
    schemaVersion: CANONICAL_ECONOMIC_CLAIM_SCHEMA_VERSION,
    economicClaimId: input.economicClaimId,
    claimType: 'PRODUCTIVE_OUTPUT',
    economicDomain: 'PRODUCTIVE_ECONOMIC',
    canonicalEntityId: input.canonicalEntityId,
    canonicalEventId: input.canonicalEventId,
    subjectRef: input.subjectRef,
    resourceRef: input.resourceRef,
    temporalBounds: input.temporalBounds,
    geographicBounds: { jurisdiction: 'UNSCOPED', region: null },
    supportingFactIds: input.supportingFactIds,
    evidenceRefs: input.evidenceRefs,
    provenanceRefs: [],
    rightsRefs: [],
    policyRefs: [
      {
        policyId: 'moonrey-attribution',
        policyVersion: 'simulation-v1',
        methodologyDigest: 'sha256:simulation-only',
      },
    ],
    lineage: { parentClaimId: null, supersededByClaimId: null, derivationPath: [] },
    duplicateFingerprint: fingerprint,
    verificationStatus: 'VERIFIED',
    challengeStatus: 'NONE',
    monetizationStatus: 'ELIGIBLE_FOR_VALUATION',
    simulation: true as const,
    authority: CLAIM_AUTHORITY,
  });
}

export function buildVerifiedFactFromEvidence(
  evidence: EconomicEvidence,
  input: {
    readonly verifiedFactId: string;
    readonly metric: string;
    readonly quantity: { readonly value: bigint; readonly unit: string };
    readonly temporalBounds: { readonly startUtc: string; readonly endUtc: string };
  },
): VerifiedEconomicFact {
  return Object.freeze({
    schemaVersion: VERIFIED_ECONOMIC_FACT_SCHEMA_VERSION,
    verifiedFactId: input.verifiedFactId,
    economicDomain: evidence.economicDomain,
    subjectRef: evidence.subjectRef,
    resourceRef: evidence.subjectRef,
    metric: input.metric,
    quantity: {
      value: input.quantity.value,
      unit: input.quantity.unit,
      metric: input.metric,
    },
    verificationMethodologyId: 'wave3-simulation-verification',
    verificationMethodologyVersion: '1',
    supportingEvidenceIds: [evidence.evidenceId],
    verifiedAtUtc: evidence.sealedAtUtc,
    verifiers: [
      {
        verifierId: 'policy-engine',
        verifierClass: 'POLICY_ENGINE',
        signatureRef: null,
      },
    ],
    confidence: { scoreBps: 9_500, sampleCount: 1, notesRef: null },
    verificationStatus: 'VERIFIED',
    challengeStatus: 'NONE',
    temporalBounds: input.temporalBounds,
    geographicBounds: { jurisdiction: 'UNSCOPED', region: null },
    simulation: true as const,
    authority: VERIFIED_FACT_AUTHORITY,
  });
}
