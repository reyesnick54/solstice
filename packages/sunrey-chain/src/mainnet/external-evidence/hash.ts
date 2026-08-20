/**
 * Deterministic commitment hash for external production evidence.
 *
 * Bound fields: document/reference digest, scope, subject, jurisdiction,
 * activation domains, provider domains, issue/expiration dates, version.
 * Changing any bound field changes the hash and invalidates verification.
 */

import { encodeString, sha256Hex } from '../../validators/canonical.ts';

import {
  EXTERNAL_EVIDENCE_HASH_DOMAIN,
  type ExternalEvidenceReference,
  type ExternalEvidenceScope,
  type ExternalProductionEvidenceRecord,
} from './types.ts';

export type ExternalEvidenceHashInput = {
  readonly recordId: string;
  readonly evidenceClass: ExternalProductionEvidenceRecord['evidenceClass'];
  readonly issuerOrSource: string;
  readonly subjectType: ExternalProductionEvidenceRecord['subjectType'];
  readonly subjectId: string;
  readonly scope: ExternalEvidenceScope;
  readonly jurisdictions: readonly string[];
  readonly activationDomains: readonly string[];
  readonly providerDomains: readonly string[];
  readonly issuedAtUtc: string | null;
  readonly validFromUtc: string | null;
  readonly expiresAtUtc: string | null;
  readonly reviewDueAtUtc: string | null;
  readonly reference: ExternalEvidenceReference;
  readonly contentDigest: string;
  readonly fixture: boolean;
  readonly engineeringOnly: boolean;
  readonly confidential: boolean;
  readonly version: number;
  readonly previousVersionId: string | null;
};

function sortedJoin(values: readonly string[]): string {
  return [...values].slice().sort().join(',');
}

export function canonicalizeScope(scope: ExternalEvidenceScope): string {
  return [
    scope.label,
    scope.global ? 'GLOBAL' : 'BOUND',
    sortedJoin(scope.jurisdictions),
    sortedJoin(scope.activationDomains),
    sortedJoin(scope.providerDomains),
  ].join('|');
}

export function canonicalizeReference(reference: ExternalEvidenceReference): string {
  return [reference.kind, reference.locator, reference.repositoryId ?? ''].join('|');
}

export function externalEvidenceCommitmentHash(input: ExternalEvidenceHashInput): string {
  return sha256Hex(
    Buffer.concat([
      encodeString(EXTERNAL_EVIDENCE_HASH_DOMAIN),
      encodeString(input.recordId),
      encodeString(input.evidenceClass),
      encodeString(input.issuerOrSource),
      encodeString(input.subjectType),
      encodeString(input.subjectId),
      encodeString(canonicalizeScope(input.scope)),
      encodeString(sortedJoin(input.jurisdictions)),
      encodeString(sortedJoin(input.activationDomains)),
      encodeString(sortedJoin(input.providerDomains)),
      encodeString(input.issuedAtUtc ?? ''),
      encodeString(input.validFromUtc ?? ''),
      encodeString(input.expiresAtUtc ?? ''),
      encodeString(input.reviewDueAtUtc ?? ''),
      encodeString(canonicalizeReference(input.reference)),
      encodeString(input.contentDigest),
      encodeString(input.fixture ? 'fixture' : 'external'),
      encodeString(input.engineeringOnly ? 'engineering' : 'governed'),
      encodeString(input.confidential ? 'confidential' : 'public-safe'),
      encodeString(String(input.version)),
      encodeString(input.previousVersionId ?? ''),
    ]),
  );
}

export function recordCommitmentHash(
  record: Pick<ExternalProductionEvidenceRecord, keyof ExternalEvidenceHashInput>,
): string {
  return externalEvidenceCommitmentHash(record);
}

export function verificationSurvivesSemanticChange(
  record: Pick<ExternalProductionEvidenceRecord, 'verificationBindingHash' | keyof ExternalEvidenceHashInput>,
): boolean {
  if (record.verificationBindingHash === null) {
    return false;
  }
  return record.verificationBindingHash === recordCommitmentHash(record);
}
