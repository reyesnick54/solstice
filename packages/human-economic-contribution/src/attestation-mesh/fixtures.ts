/**
 * Deterministic fixtures for Human Contribution Attestation Mesh tests.
 */

import { asUtcInstant } from '../../../domain/src/time.ts';
import {
  asContributionId,
  asEventReference,
  asEvidenceRef,
  asProvenanceRef,
  asSubjectRef,
  evidenceRefFor,
  eventReferenceFor,
  provenanceRefFor,
  subjectRefFor,
} from '../ids.ts';
import { FIXTURE_NOW } from '../fixtures.ts';
import { createContributionAttestation } from './engine.ts';
import type { AttestationMeshVerificationInput, ContributionAttestation } from './types.ts';
import type { AttestationSourceClass } from './source-classes.ts';
import type { CredentialVerificationInput } from './credentials.ts';

export const MESH_FIXTURE_NOW = FIXTURE_NOW;
export const MESH_FIXTURE_SUBJECT = subjectRefFor('attestation-mesh-ada');
export const MESH_FIXTURE_EVENT = eventReferenceFor('attestation-mesh-event');
export const MESH_FIXTURE_CONTRIBUTION_ID = asContributionId('hec_a1b2c3d4e5f6789012345678abcdef01');

function attestationIdFor(seed: string): string {
  return `cat_${seed.replace(/[^a-z0-9-]/gi, '').slice(0, 32)}`;
}

function baseAttestation(
  seed: string,
  issuerClass: AttestationSourceClass,
  overrides: Partial<Omit<ContributionAttestation, 'schemaVersion' | 'grantsMonetaryAuthority' | 'grantsExecutionAuthority' | 'createsPeve' | 'authorizesSunReyIssuance'>> = {},
): ContributionAttestation {
  return createContributionAttestation({
    attestationId: attestationIdFor(seed),
    issuer: `issuer:${seed}`,
    issuerClass,
    subjectPseudonymousRef: MESH_FIXTURE_SUBJECT,
    contributionEventRef: MESH_FIXTURE_EVENT,
    claimRef: null,
    statementType: 'CONTRIBUTION_OCCURRED',
    issuedAt: MESH_FIXTURE_NOW,
    validity: 'VALID',
    signatureReference: `sig:${seed}`,
    evidenceReferences: [evidenceRefFor(seed)],
    provenance: [provenanceRefFor(seed)],
    rights: Object.freeze({ status: 'CLEAR', refs: [] }),
    verificationStatus: 'ACCEPTED',
    lineageRootId: `lineage:${seed}`,
    upstreamOrganizationId: `org:${seed}`,
    ...overrides,
  });
}

export function fixtureResearchPublisherAttestation(seed = 'pubmed-primary'): ContributionAttestation {
  return baseAttestation(seed, 'RESEARCH_PUBLISHER', {
    statementType: 'AUTHORSHIP',
    lineageRootId: 'lineage:doi:10.1234/example',
    upstreamOrganizationId: 'org:ncbi-pubmed',
  });
}

export function fixtureResearchRegistryAttestation(seed = 'clinicaltrials'): ContributionAttestation {
  return baseAttestation(seed, 'RESEARCH_REGISTRY', {
    statementType: 'CONTRIBUTION_OCCURRED',
    lineageRootId: 'lineage:nct:00001234',
    upstreamOrganizationId: 'org:nlm-clinicaltrials',
  });
}

export function fixtureCopiedLineageAttestations(): readonly ContributionAttestation[] {
  const root = 'lineage:doi:10.1234/example';
  const org = 'org:ncbi-pubmed';
  return Object.freeze([
    baseAttestation('pubmed-db', 'RESEARCH_PUBLISHER', {
      statementType: 'AUTHORSHIP',
      lineageRootId: root,
      upstreamOrganizationId: org,
    }),
    baseAttestation('aggregator-b', 'RESEARCH_PUBLISHER', {
      issuer: 'issuer:aggregator-b',
      statementType: 'AUTHORSHIP',
      lineageRootId: root,
      upstreamOrganizationId: org,
    }),
    baseAttestation('profile-c', 'PRIMARY_INSTITUTION', {
      issuer: 'issuer:profile-c',
      statementType: 'AUTHORSHIP',
      lineageRootId: root,
      upstreamOrganizationId: org,
    }),
  ]);
}

export function fixtureEducationCredentialAttestation(seed = 'credential-issuer'): ContributionAttestation {
  return baseAttestation(seed, 'CREDENTIAL_ISSUER', {
    statementType: 'CREDENTIAL_VALID',
    lineageRootId: 'lineage:credential:bs-computer-science',
    upstreamOrganizationId: 'org:university-accreditor',
  });
}

export function fixtureWorkEmployerAttestation(seed = 'employer-attestation'): ContributionAttestation {
  return baseAttestation(seed, 'EMPLOYER', {
    statementType: 'EMPLOYMENT',
    lineageRootId: 'lineage:employment:2026-q1',
    upstreamOrganizationId: 'org:employer-simulation',
  });
}

export function fixtureSignedWorkReceiptAttestation(seed = 'work-receipt'): ContributionAttestation {
  return baseAttestation(seed, 'SIGNED_WORK_RECEIPT', {
    statementType: 'WORK_RECEIPT',
    lineageRootId: 'lineage:work-receipt:signed-001',
    upstreamOrganizationId: 'org:work-receipt-signer',
  });
}

export function fixtureComputationReceiptAttestation(seed = 'computation-receipt'): ContributionAttestation {
  return baseAttestation(seed, 'SIGNED_COMPUTATION_RECEIPT', {
    statementType: 'COMPUTATION_COMPLETED',
    lineageRootId: 'lineage:computation:job-001',
    upstreamOrganizationId: 'org:approved-computation',
  });
}

export function fixtureAuthorizedDataAttestation(
  seed = 'hin-data-provider',
  statementType: ContributionAttestation['statementType'] = 'AUTHORIZED_DATA_CONTRIBUTION',
): ContributionAttestation {
  return baseAttestation(seed, 'AUTHORIZED_DATA_PROVIDER', {
    statementType,
    lineageRootId: 'lineage:hin:usage-001',
    upstreamOrganizationId: 'org:human-information-network',
  });
}

export function fixtureSelfAttestation(seed = 'self-attest'): ContributionAttestation {
  return baseAttestation(seed, 'USER_SELF_ATTESTATION', {
    statementType: 'SELF_DECLARATION',
    signatureReference: null,
    lineageRootId: 'lineage:self',
    upstreamOrganizationId: 'org:self',
  });
}

export function fixtureForgedAttestation(): ContributionAttestation {
  return baseAttestation('forged', 'RESEARCH_PUBLISHER', {
    verificationStatus: 'REJECTED',
    validity: 'VALID',
  });
}

export function fixtureRevokedCredentialCheck(): CredentialVerificationInput {
  return Object.freeze({
    credentialId: 'cred-revoked-001',
    issuerId: 'issuer:university',
    issuerClass: 'CREDENTIAL_ISSUER',
    subjectRef: String(MESH_FIXTURE_SUBJECT),
    issuedAt: asUtcInstant('2024-01-01T00:00:00.000Z'),
    expiresAt: asUtcInstant('2028-01-01T00:00:00.000Z'),
    revokedAt: asUtcInstant('2026-07-01T00:00:00.000Z'),
    evaluatedAt: MESH_FIXTURE_NOW,
    screenshotOnly: false,
    authoritativeVerificationAvailable: true,
  });
}

export function fixtureValidCredentialCheck(): CredentialVerificationInput {
  return Object.freeze({
    credentialId: 'cred-valid-001',
    issuerId: 'issuer:university',
    issuerClass: 'CREDENTIAL_ISSUER',
    subjectRef: String(MESH_FIXTURE_SUBJECT),
    issuedAt: asUtcInstant('2024-01-01T00:00:00.000Z'),
    expiresAt: asUtcInstant('2028-01-01T00:00:00.000Z'),
    revokedAt: null,
    evaluatedAt: MESH_FIXTURE_NOW,
    screenshotOnly: false,
    authoritativeVerificationAvailable: true,
  });
}

export function fixtureDuplicateReceiptAttestations(): readonly ContributionAttestation[] {
  const sharedReceipt = evidenceRefFor('shared-work-receipt');
  return Object.freeze([
    baseAttestation('actor-a-receipt', 'SIGNED_WORK_RECEIPT', {
      subjectPseudonymousRef: subjectRefFor('actor-a'),
      evidenceReferences: [sharedReceipt],
      statementType: 'WORK_RECEIPT',
    }),
    baseAttestation('actor-b-receipt', 'SIGNED_WORK_RECEIPT', {
      subjectPseudonymousRef: subjectRefFor('actor-b'),
      evidenceReferences: [sharedReceipt],
      statementType: 'WORK_RECEIPT',
    }),
  ]);
}

export function fixtureWrongPersonAttestation(): ContributionAttestation {
  return baseAttestation('wrong-person', 'RESEARCH_PUBLISHER', {
    subjectPseudonymousRef: subjectRefFor('different-person'),
    statementType: 'AUTHORSHIP',
  });
}

export function fixtureMeshInput(
  contributionClass: AttestationMeshVerificationInput['contributionClass'],
  attestations: readonly ContributionAttestation[],
): AttestationMeshVerificationInput {
  return Object.freeze({
    contributionClass,
    contributionId: MESH_FIXTURE_CONTRIBUTION_ID,
    humanActorRef: MESH_FIXTURE_SUBJECT,
    contributionEventRef: MESH_FIXTURE_EVENT,
    attestations,
    evaluatedAt: MESH_FIXTURE_NOW,
  });
}

export function fixtureStaleAttestation(): ContributionAttestation {
  return baseAttestation('stale-research', 'RESEARCH_PUBLISHER', {
    issuedAt: asUtcInstant('2020-01-01T00:00:00.000Z'),
    statementType: 'AUTHORSHIP',
  });
}

export function fixturePublicationAuthorMismatchAttestation(): ContributionAttestation {
  return baseAttestation('author-mismatch', 'RESEARCH_PUBLISHER', {
    issuer: 'issuer:unexpected-author',
    statementType: 'AUTHORSHIP',
  });
}

export {
  asContributionId,
  asEventReference,
  asEvidenceRef,
  asProvenanceRef,
  asSubjectRef,
};
