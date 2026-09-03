/**
 * Simulation fixtures for Wave 3 economic proof tests.
 */

import {
  CANONICAL_ECONOMIC_CLAIM_SCHEMA_VERSION,
  ECONOMIC_EVIDENCE_SCHEMA_VERSION,
  ECONOMIC_OBSERVATION_SCHEMA_VERSION,
  VERIFIED_ECONOMIC_FACT_SCHEMA_VERSION,
} from './constants.ts';
import { buildEvidenceFromObservation, buildHumanEconomicClaim, buildProductiveEconomicClaim, buildVerifiedFactFromEvidence } from './adapters.ts';
import { duplicateClaimFingerprint } from './ids.ts';
import type { CanonicalEconomicClaim, EconomicObservation } from './types.ts';

const TEMPORAL = {
  startUtc: '2026-01-01T00:00:00.000Z',
  endUtc: '2026-01-01T01:00:00.000Z',
} as const;

export function fixtureHumanObservation(observationId = 'obs_human_fixture'): EconomicObservation {
  return Object.freeze({
    schemaVersion: ECONOMIC_OBSERVATION_SCHEMA_VERSION,
    observationId,
    providerId: 'hin-network-fixture',
    sourceClass: 'HUMAN_INFORMATION_NETWORK',
    economicDomain: 'HUMAN_ECONOMIC',
    subjectRef: 'subj_human_001',
    resourceRef: null,
    metric: 'information_right_realization',
    quantity: { value: 1n, unit: 'event', metric: 'information_right_realization' },
    observedAtUtc: TEMPORAL.startUtc,
    receivedAtUtc: TEMPORAL.endUtc,
    geographicContext: { jurisdiction: 'US', region: 'CA', locality: null },
    jurisdiction: 'US',
    provenanceRef: {
      provenanceId: 'prov_hin_001',
      sourceId: 'hin-fixture',
      method: 'usage-receipt',
      collectedAtUtc: TEMPORAL.startUtc,
    },
    evidenceRefs: ['prov_hin_001'],
    licenseRef: {
      licenseId: 'lic_sandbox_fixture',
      licenseClass: 'SANDBOX_FIXTURE',
      permittedUseDigest: 'sha256:purpose-digest',
    },
    verificationStatus: 'PENDING',
    confidence: { scoreBps: 8_000, sampleCount: 1, notesRef: null },
    freshness: {
      state: 'FRESH' as const,
      observedAtUtc: TEMPORAL.startUtc,
      receivedAtUtc: TEMPORAL.endUtc,
      maxAgeSeconds: 3_600n,
      expiresAtUtc: '2026-01-01T02:00:00.000Z',
    },
    integrity: 'INTACT',
    simulation: true as const,
    authority: {
      mintsNativeAsset: false as const,
      issuesExecutionAuthority: false as const,
      setsExchangePrice: false as const,
      authorizesGovernance: false as const,
    },
  });
}

export function fixtureProductiveObservation(observationId = 'obs_productive_fixture'): EconomicObservation {
  return Object.freeze({
    schemaVersion: ECONOMIC_OBSERVATION_SCHEMA_VERSION,
    observationId,
    providerId: 'oracle-fixture-provider',
    sourceClass: 'ORACLE_NETWORK',
    economicDomain: 'PRODUCTIVE_ECONOMIC',
    subjectRef: 'resource_compute_001',
    resourceRef: 'resource_compute_001',
    metric: 'gpu_seconds',
    quantity: { value: 3_600n, unit: 'gpu_s', metric: 'gpu_seconds' },
    observedAtUtc: TEMPORAL.startUtc,
    receivedAtUtc: TEMPORAL.endUtc,
    geographicContext: { jurisdiction: 'US', region: 'TX', locality: null },
    jurisdiction: 'US',
    provenanceRef: {
      provenanceId: 'prov_oracle_001',
      sourceId: 'oracle-fixture',
      method: 'signed-observation',
      collectedAtUtc: TEMPORAL.startUtc,
    },
    evidenceRefs: ['prov_oracle_001'],
    licenseRef: {
      licenseId: 'lic_sandbox_fixture',
      licenseClass: 'SANDBOX_FIXTURE',
      permittedUseDigest: 'sha256:oracle-purpose',
    },
    verificationStatus: 'PENDING',
    confidence: { scoreBps: 9_500, sampleCount: 3, notesRef: null },
    freshness: {
      state: 'FRESH' as const,
      observedAtUtc: TEMPORAL.startUtc,
      receivedAtUtc: TEMPORAL.endUtc,
      maxAgeSeconds: 1_800n,
      expiresAtUtc: '2026-01-01T01:30:00.000Z',
    },
    integrity: 'INTACT',
    simulation: true as const,
    authority: {
      mintsNativeAsset: false as const,
      issuesExecutionAuthority: false as const,
      setsExchangePrice: false as const,
      authorizesGovernance: false as const,
    },
  });
}

export function fixtureHumanProofPipeline() {
  const observation = fixtureHumanObservation();
  const evidence = buildEvidenceFromObservation(observation, {
    evidenceId: 'evd_human_fixture',
    purposeDigest: 'sha256:human-purpose',
  });
  const fact = buildVerifiedFactFromEvidence(evidence, {
    verifiedFactId: 'vef_human_fixture',
    metric: observation.metric,
    quantity: { value: observation.quantity.value, unit: observation.quantity.unit },
    temporalBounds: TEMPORAL,
  });
  const claim = buildHumanEconomicClaim({
    economicClaimId: 'cec_human_fixture',
    canonicalEntityId: 'entity_human_001',
    canonicalEventId: 'event_hin_001',
    subjectRef: observation.subjectRef,
    supportingFactIds: [fact.verifiedFactId],
    evidenceRefs: [evidence.evidenceId],
    temporalBounds: TEMPORAL,
  });
  return { observation, evidence, fact, claim };
}

export function fixtureProductiveProofPipeline() {
  const observation = fixtureProductiveObservation();
  const evidence = buildEvidenceFromObservation(observation, {
    evidenceId: 'evd_productive_fixture',
    purposeDigest: 'sha256:productive-purpose',
  });
  const fact = buildVerifiedFactFromEvidence(evidence, {
    verifiedFactId: 'vef_productive_fixture',
    metric: observation.metric,
    quantity: { value: observation.quantity.value, unit: observation.quantity.unit },
    temporalBounds: TEMPORAL,
  });
  const claim = buildProductiveEconomicClaim({
    economicClaimId: 'cec_productive_fixture',
    canonicalEntityId: 'entity_compute_001',
    canonicalEventId: 'event_gpu_001',
    subjectRef: observation.subjectRef,
    resourceRef: observation.resourceRef!,
    supportingFactIds: [fact.verifiedFactId],
    evidenceRefs: [evidence.evidenceId],
    temporalBounds: TEMPORAL,
  });
  return { observation, evidence, fact, claim };
}

export function malformedClaim(): CanonicalEconomicClaim {
  return Object.freeze({
    schemaVersion: CANONICAL_ECONOMIC_CLAIM_SCHEMA_VERSION,
    economicClaimId: '',
    claimType: 'HUMAN_CONTRIBUTION',
    economicDomain: 'HUMAN_ECONOMIC',
    canonicalEntityId: 'entity_bad',
    canonicalEventId: 'event_bad',
    subjectRef: 'subj_bad',
    resourceRef: null,
    temporalBounds: { startUtc: '2026-02-01T00:00:00.000Z', endUtc: '2026-01-01T00:00:00.000Z' },
    geographicBounds: { jurisdiction: 'US', region: null },
    supportingFactIds: [],
    evidenceRefs: [],
    provenanceRefs: [],
    rightsRefs: [],
    policyRefs: [],
    lineage: { parentClaimId: null, supersededByClaimId: null, derivationPath: [] },
    duplicateFingerprint: '',
    verificationStatus: 'INVALID',
    challengeStatus: 'NONE',
    monetizationStatus: 'NOT_ELIGIBLE',
    simulation: true as const,
    authority: {
      mintsNativeAsset: false as const,
      issuesExecutionAuthority: false as const,
      isWalletBalance: false as const,
    },
  });
}

export { duplicateClaimFingerprint, TEMPORAL };
