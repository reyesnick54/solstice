/**
 * Adversarial fixtures for Information Consensus tests.
 */

import type {
  CandidateEconomicProposition,
  NormalizedEconomicObservation,
  ProviderLineage,
} from '../types.ts';
import type { InformationConsensusInput } from './types.ts';
import type { ReputationRecord } from './reputation.ts';
import {
  HUMAN_CONTRIBUTION_METHODOLOGY,
  PRODUCTIVE_ENERGY_METHODOLOGY,
} from './methodology.ts';

const EIA_ROOT = 'lineage-root:eia';
const EIA_UPSTREAM = 'org:eia';

function lineage(input: {
  providerId: string;
  sourceId: string;
  sourceClass: ProviderLineage['sourceClass'];
  lineageRootId?: string;
  upstreamOrganizationId?: string;
}): ProviderLineage {
  return Object.freeze({
    providerId: input.providerId,
    sourceId: input.sourceId,
    upstreamSourceId: input.lineageRootId ?? EIA_ROOT,
    upstreamOrganizationId: input.upstreamOrganizationId ?? EIA_UPSTREAM,
    controllerId: `controller:${input.providerId}`,
    sharedControlGroup: null,
    lineageRootId: input.lineageRootId ?? EIA_ROOT,
    sourceClass: input.sourceClass,
    canonicalSourceCategory: input.sourceClass === 'GOVERNMENT_REFERENCE' ? 'energy' : 'energy',
  });
}

function observation(input: {
  observationId: string;
  providerId: string;
  sourceClass: ProviderLineage['sourceClass'];
  numericValue: number;
  observedAt?: string;
  rightsStatus?: NormalizedEconomicObservation['rightsStatus'];
  providerVerified?: boolean;
  lineageRootId?: string;
  upstreamOrganizationId?: string;
}): NormalizedEconomicObservation {
  const observedAt = input.observedAt ?? '2026-09-02T09:00:00.000Z';
  return Object.freeze({
    observationId: input.observationId,
    providerId: input.providerId,
    sourceId: `source:${input.providerId}`,
    sourceClass: input.sourceClass,
    canonicalSourceCategory: 'energy',
    factType: 'ENERGY_PRODUCTION',
    subjectRef: 'facility:grid-west-1',
    numericValue: input.numericValue,
    categoricalValue: null,
    unit: 'MWh',
    authorityClass: input.sourceClass === 'GOVERNMENT_REFERENCE' ? 'authoritative_official' : 'regulated_provider',
    observedAt,
    collectedAt: observedAt,
    provenanceRef: `prov:${input.observationId}`,
    integrityStatus: 'VERIFIED',
    rightsStatus: input.rightsStatus ?? 'CLEAR',
    providerVerified: input.providerVerified ?? true,
    lineage: lineage({
      providerId: input.providerId,
      sourceId: `source:${input.providerId}`,
      sourceClass: input.sourceClass,
      lineageRootId: input.lineageRootId,
      upstreamOrganizationId: input.upstreamOrganizationId,
    }),
  });
}

export const PRODUCTIVE_ENERGY_CANDIDATE: CandidateEconomicProposition = Object.freeze({
  propositionId: 'prop:energy:grid-west-1:2026-09-02',
  domain: 'PRODUCTIVE',
  factType: 'ENERGY_PRODUCTION',
  subjectRef: 'facility:grid-west-1',
  claimText: 'Grid west facility produced measurable energy output',
  unit: 'MWh',
  expectedNumericValue: 500,
  measurementWindowStart: '2026-09-02T08:00:00.000Z',
  measurementWindowEnd: '2026-09-02T09:00:00.000Z',
});

export const HUMAN_CONTRIBUTION_CANDIDATE: CandidateEconomicProposition = Object.freeze({
  propositionId: 'prop:human:research:2026-09-02',
  domain: 'HUMAN',
  factType: 'SERVICE_DELIVERY',
  subjectRef: 'person:researcher-42',
  claimText: 'Verified research contribution with attestation',
  unit: null,
  expectedNumericValue: null,
  measurementWindowStart: '2026-06-01T00:00:00.000Z',
  measurementWindowEnd: '2026-09-02T00:00:00.000Z',
});

export const THREE_PROVIDERS_ONE_UPSTREAM: readonly NormalizedEconomicObservation[] = Object.freeze([
  observation({ observationId: 'obs-a', providerId: 'provider-a', sourceClass: 'AGGREGATOR', numericValue: 500 }),
  observation({ observationId: 'obs-b', providerId: 'provider-b', sourceClass: 'AGGREGATOR', numericValue: 498 }),
  observation({ observationId: 'obs-c', providerId: 'provider-c', sourceClass: 'AGGREGATOR', numericValue: 501 }),
]);

export const THREE_INDEPENDENT_SOURCES: readonly NormalizedEconomicObservation[] = Object.freeze([
  observation({
    observationId: 'obs-sensor',
    providerId: 'sensor-op',
    sourceClass: 'DIRECT_SENSOR',
    numericValue: 500,
    lineageRootId: 'lineage-root:sensor',
    upstreamOrganizationId: 'org:sensor-op',
  }),
  observation({
    observationId: 'obs-operator',
    providerId: 'grid-operator',
    sourceClass: 'PRIMARY_OPERATOR',
    numericValue: 495,
    lineageRootId: 'lineage-root:operator',
    upstreamOrganizationId: 'org:grid-operator',
  }),
  observation({
    observationId: 'obs-gov',
    providerId: 'eia',
    sourceClass: 'GOVERNMENT_REFERENCE',
    numericValue: 498,
    lineageRootId: 'lineage-root:gov',
    upstreamOrganizationId: 'org:gov-eia',
  }),
]);

export const STALE_OBSERVATION: NormalizedEconomicObservation = observation({
  observationId: 'obs-stale',
  providerId: 'eia',
  sourceClass: 'GOVERNMENT_REFERENCE',
  numericValue: 500,
  observedAt: '2026-09-01T00:00:00.000Z',
});

export const CONFLICTING_OBSERVATIONS: readonly NormalizedEconomicObservation[] = Object.freeze([
  observation({
    observationId: 'obs-500',
    providerId: 'sensor-a',
    sourceClass: 'DIRECT_SENSOR',
    numericValue: 500,
    lineageRootId: 'lineage-root:a',
    upstreamOrganizationId: 'org:a',
  }),
  observation({
    observationId: 'obs-495',
    providerId: 'sensor-b',
    sourceClass: 'PRIMARY_OPERATOR',
    numericValue: 495,
    lineageRootId: 'lineage-root:b',
    upstreamOrganizationId: 'org:b',
  }),
  observation({
    observationId: 'obs-900',
    providerId: 'sensor-c',
    sourceClass: 'DERIVED_MODEL',
    numericValue: 900,
    lineageRootId: 'lineage-root:c',
    upstreamOrganizationId: 'org:c',
  }),
]);

export const UNVERIFIED_PROVIDER_OBSERVATION = observation({
  observationId: 'obs-unverified',
  providerId: 'unknown-provider',
  sourceClass: 'AGGREGATOR',
  numericValue: 500,
  providerVerified: false,
});

export const RIGHTS_RESTRICTED_OBSERVATION = observation({
  observationId: 'obs-rights',
  providerId: 'restricted-provider',
  sourceClass: 'ENTERPRISE_SYSTEM',
  numericValue: 500,
  rightsStatus: 'RESTRICTED',
  lineageRootId: 'lineage-root:restricted',
  upstreamOrganizationId: 'org:restricted',
});

export const HUMAN_ATTESTATION_OBSERVATION: NormalizedEconomicObservation = Object.freeze({
  observationId: 'obs-human-attestation',
  providerId: 'university-registry',
  sourceId: 'source:university-registry',
  sourceClass: 'ATTESTATION',
  canonicalSourceCategory: 'services',
  factType: 'SERVICE_DELIVERY',
  subjectRef: 'person:researcher-42',
  numericValue: null,
  categoricalValue: 'peer-reviewed-publication',
  unit: null,
  authorityClass: 'regulated_provider',
  observedAt: '2026-08-15T12:00:00.000Z',
  collectedAt: '2026-08-15T12:00:00.000Z',
  provenanceRef: 'prov:human-attestation',
  integrityStatus: 'VERIFIED',
  rightsStatus: 'CLEAR',
  providerVerified: true,
  lineage: Object.freeze({
    providerId: 'university-registry',
    sourceId: 'source:university-registry',
    upstreamSourceId: 'lineage-root:university',
    upstreamOrganizationId: 'org:university',
    controllerId: 'controller:university-registry',
    sharedControlGroup: null,
    lineageRootId: 'lineage-root:university',
    sourceClass: 'ATTESTATION',
    canonicalSourceCategory: 'services',
  }),
});

export const REPUTATION_RECORDS: Readonly<Record<string, ReputationRecord>> = Object.freeze({
  'sensor-op': Object.freeze({
    providerId: 'sensor-op',
    historicalAvailability: 0.99,
    schemaStability: 0.95,
    integrityHistory: 0.98,
    correctionFrequency: 0.02,
    knownUpstreamLineage: 1,
    verificationPerformance: 0.97,
    timeliness: 0.96,
    disputeHistory: 0.01,
  }),
  'trusted-aggregator': Object.freeze({
    providerId: 'trusted-aggregator',
    historicalAvailability: 0.95,
    schemaStability: 0.9,
    integrityHistory: 0.92,
    correctionFrequency: 0.05,
    knownUpstreamLineage: 0.8,
    verificationPerformance: 0.9,
    timeliness: 0.88,
    disputeHistory: 0.04,
  }),
});

export function buildConsensusInput(
  candidate: CandidateEconomicProposition,
  observations: readonly NormalizedEconomicObservation[],
  overrides: Partial<InformationConsensusInput> = {},
): InformationConsensusInput {
  const methodology =
    candidate.domain === 'HUMAN'
      ? HUMAN_CONTRIBUTION_METHODOLOGY.methodology
      : PRODUCTIVE_ENERGY_METHODOLOGY.methodology;
  return Object.freeze({
    candidate,
    observations,
    sourceIdentities: Object.freeze([...new Set(observations.map((row) => row.sourceId))].sort()),
    sourceClasses: Object.freeze([...new Set(observations.map((row) => row.sourceClass))].sort()),
    providerLineage: Object.freeze(observations.map((row) => row.lineage)),
    provenanceRefs: Object.freeze(observations.map((row) => row.provenanceRef)),
    freshness: 'fresh',
    confidence: Object.freeze({ score: 0.8, band: 'HIGH', basis: Object.freeze(['fixture']) }),
    rightsStatus: observations.some((row) => row.rightsStatus !== 'CLEAR') ? 'RESTRICTED' : 'CLEAR',
    integrityStatus: observations.every((row) => row.integrityStatus === 'VERIFIED') ? 'VERIFIED' : 'UNVERIFIED',
    entityResolution: Object.freeze({
      entityId: candidate.subjectRef,
      resolutionMethod: 'fixture-binding',
      confidence: 'HIGH',
      bindingRef: `entity:${candidate.subjectRef}`,
    }),
    contradictions: Object.freeze([]),
    methodology,
    evaluatedAt: '2026-09-02T09:30:00.000Z',
    ...overrides,
  });
}
