import { commitCanonical } from '../../hash.ts';
import { RIGHTS_COMMITMENT_DOMAINS } from './taxonomy.ts';
import type {
  ConsentGrant,
  LicenseAuthorization,
  PurposeAuthorization,
  RightsCommitment,
  RightsDelta,
  RightsGrant,
  RightsRevocation,
} from './types.ts';

type CommitField = string | number | boolean | null;

function sortedFields(
  fields: Readonly<Record<string, CommitField>>,
): Readonly<Record<string, CommitField>> {
  return Object.fromEntries(Object.entries(fields).sort(([left], [right]) => left.localeCompare(right)));
}

export function commitRightsDomain(
  domain: string,
  fields: Readonly<Record<string, CommitField>>,
): string {
  return commitCanonical({ domain, fields: sortedFields(fields) });
}

export function rightsGrantCommitment(grant: RightsGrant): string {
  return commitRightsDomain(RIGHTS_COMMITMENT_DOMAINS.RIGHTS_GRANT, {
    schemaVersion: grant.schemaVersion,
    rightsGrantId: grant.rightsGrantId,
    economyKind: grant.economyKind,
    subjectCommitment: grant.subjectCommitment,
    controllerRef: grant.controllerRef,
    dataScopeCommitment: grant.dataScopeCommitment,
    evidenceScopeCommitment: grant.evidenceScopeCommitment,
    permittedPurposes: [...grant.permittedPurposes].sort().join(','),
    prohibitedPurposes: [...grant.prohibitedPurposes].sort().join(','),
    jurisdiction: grant.jurisdiction,
    effectiveFrom: grant.effectiveFrom,
    effectiveUntil: grant.effectiveUntil,
    revocationRef: grant.revocationRef,
    delegable: grant.delegation.delegable,
    issuerRef: grant.issuerRef,
    authorizationRef: grant.authorizationRef,
    authorizesMonetaryIssuance: grant.authorizesMonetaryIssuance,
    authorizesEconomicValuation: grant.authorizesEconomicValuation,
  });
}

export function consentGrantCommitment(grant: ConsentGrant): string {
  return commitRightsDomain(RIGHTS_COMMITMENT_DOMAINS.CONSENT_GRANT, {
    schemaVersion: grant.schemaVersion,
    consentGrantId: grant.consentGrantId,
    rightsGrantId: grant.rightsGrantId,
    authorizerRef: grant.authorizerRef,
    contributionCategory: grant.contributionCategory,
    dataCategoryCommitment: grant.dataCategoryCommitment,
    purposeId: grant.purposeId,
    scopeCommitment: grant.scopeCommitment,
    effectiveFrom: grant.effectiveFrom,
    effectiveUntil: grant.effectiveUntil,
    revocationRef: grant.revocationRef,
    proofRef: grant.proofRef,
    authorizesMonetaryIssuance: grant.authorizesMonetaryIssuance,
    authorizesEconomicValuation: grant.authorizesEconomicValuation,
  });
}

export function purposeAuthorizationCommitment(purpose: PurposeAuthorization): string {
  return commitRightsDomain(RIGHTS_COMMITMENT_DOMAINS.PURPOSE_AUTHORIZATION, {
    schemaVersion: purpose.schemaVersion,
    purposeId: purpose.purposeId,
    purposeVersion: purpose.purposeVersion,
    code: purpose.code,
    description: purpose.description,
  });
}

export function licenseAuthorizationCommitment(license: LicenseAuthorization): string {
  return commitRightsDomain(RIGHTS_COMMITMENT_DOMAINS.LICENSE_AUTHORIZATION, {
    schemaVersion: license.schemaVersion,
    licenseId: license.licenseId,
    providerRef: license.providerRef,
    sourceScopeCommitment: license.sourceScopeCommitment,
    commercialUse: license.commercialUse,
    persistence: license.persistence,
    derivedUse: license.derivedUse,
    redistribution: license.redistribution,
    attributionRequired: license.attributionRequired,
    effectiveFrom: license.effectiveFrom,
    expiresAt: license.expiresAt,
    configurationRef: license.configurationRef,
    authorizesMonetaryIssuance: license.authorizesMonetaryIssuance,
  });
}

export function rightsCommitmentDigest(commitment: RightsCommitment): string {
  return commitRightsDomain(RIGHTS_COMMITMENT_DOMAINS.RIGHTS_COMMITMENT, {
    schemaVersion: commitment.schemaVersion,
    commitmentId: commitment.commitmentId,
    rightsGrantCommitment: commitment.rightsGrantCommitment,
    consentGrantCommitment: commitment.consentGrantCommitment,
    licenseAuthorizationCommitment: commitment.licenseAuthorizationCommitment,
    purposeId: commitment.purposeId,
    jurisdiction: commitment.jurisdiction,
    evaluatedAt: commitment.evaluatedAt,
    economyKind: commitment.economyKind,
  });
}

export function rightsRevocationCommitment(revocation: RightsRevocation): string {
  return commitRightsDomain(RIGHTS_COMMITMENT_DOMAINS.RIGHTS_REVOCATION, {
    schemaVersion: revocation.schemaVersion,
    revocationId: revocation.revocationId,
    targetGrantId: revocation.targetGrantId,
    targetKind: revocation.targetKind,
    revokedAt: revocation.revokedAt,
    reason: revocation.reason,
    effectiveForFutureUse: revocation.effectiveForFutureUse,
    preservesHistoricalProof: revocation.preservesHistoricalProof,
  });
}

export function rightsDeltaCommitment(delta: RightsDelta): string {
  return commitRightsDomain(RIGHTS_COMMITMENT_DOMAINS.RIGHTS_DELTA, {
    schemaVersion: delta.schemaVersion,
    deltaId: delta.deltaId,
    sequence: delta.sequence,
    commitment: delta.commitment,
    occurredAt: delta.occurredAt,
  });
}

export function scopeCommitmentFromLabels(labels: readonly string[]): string {
  return commitRightsDomain('sunrey.economic-proof.scope.v1', {
    labels: [...labels].sort().join(','),
    count: labels.length,
  });
}

export function subjectCommitment(subjectRef: string, jurisdiction: string): string {
  return commitRightsDomain('sunrey.economic-proof.subject.v1', {
    subjectRef,
    jurisdiction,
  });
}

export function verifyRightsCommitmentIntegrity(
  commitment: RightsCommitment,
  expectedDigest: string,
): boolean {
  return rightsCommitmentDigest(commitment) === expectedDigest;
}
