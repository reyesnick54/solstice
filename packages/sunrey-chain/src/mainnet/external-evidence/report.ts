/**
 * Public-safe external evidence views. Confidential document contents
 * are never present. Raw legal/audit text is never on-chain.
 */

import { freshnessOf } from './expiry.ts';
import type { ExternalProductionEvidenceRecord, PublicExternalEvidenceView } from './types.ts';

export function publicSafeView(
  record: ExternalProductionEvidenceRecord,
  nowUtc: string,
): PublicExternalEvidenceView {
  const hideSensitive = record.confidential || !record.publicChainSafe;
  return Object.freeze({
    recordId: record.recordId,
    evidenceClass: record.evidenceClass,
    subjectType: record.subjectType,
    subjectId: record.subjectId,
    scopeLabel: record.scope.label,
    jurisdictions: record.jurisdictions,
    activationDomains: record.activationDomains,
    providerDomains: record.providerDomains,
    issuedAtUtc: record.issuedAtUtc,
    validFromUtc: record.validFromUtc,
    expiresAtUtc: record.expiresAtUtc,
    reviewDueAtUtc: record.reviewDueAtUtc,
    referenceKind: record.reference.kind,
    contentDigest: record.contentDigest,
    verificationState: record.verificationState,
    freshness: freshnessOf(record, nowUtc),
    revoked: record.revoked,
    fixture: record.fixture,
    engineeringOnly: record.engineeringOnly,
    confidential: record.confidential,
    publicChainSafe: true,
    confidentialDocumentPresent: false,
    rawDocumentOnChain: false,
    version: record.version,
    previousVersionId: record.previousVersionId,
    commitmentHash: record.commitmentHash,
    issuerOrSource: hideSensitive ? null : record.issuerOrSource,
    referenceLocator: hideSensitive ? null : record.reference.locator,
  });
}

export function assertNoConfidentialDocument(view: unknown): boolean {
  const text = JSON.stringify(view);
  return (
    !/"WHEREAS\b/.test(text) &&
    !/"audit finding:/.test(text) &&
    !/"BEGIN [A-Z ]+PRIVATE KEY/.test(text) &&
    !text.includes('confidentialDocumentBody') &&
    !text.includes('rawContractText')
  );
}

export function confidentialContentsAbsentFromPublicView(
  record: ExternalProductionEvidenceRecord,
  nowUtc: string,
): boolean {
  const view = publicSafeView(record, nowUtc);
  if (view.confidentialDocumentPresent || view.rawDocumentOnChain) {
    return false;
  }
  if (record.confidential && (view.issuerOrSource !== null || view.referenceLocator !== null)) {
    return false;
  }
  return assertNoConfidentialDocument(view);
}
