/**
 * In-memory external production evidence registry.
 *
 * Accepts document references, secure-repository references, and
 * content digests. Does not require raw legal or audit documents
 * in Git. Does not write confidential payloads on-chain.
 */

import { applyFreshness, freshnessOf, isCurrentForEligibility } from './expiry.ts';
import { recordCommitmentHash } from './hash.ts';
import { revokeExternalEvidence, supersedeExternalEvidence } from './revocation.ts';
import { recordMatchesQuery, scopeFromParts } from './scope.ts';
import { invalidateVerificationAfterChange, rejectExternalEvidence, verifyExternalEvidence } from './verification.ts';
import {
  EXTERNAL_EVIDENCE_SCHEMA_VERSION,
  externalEvidenceErr,
  externalEvidenceOk,
  satisfiesProductionVerification,
  type ExternalEvidenceQuery,
  type ExternalEvidenceReference,
  type ExternalEvidenceResult,
  type ExternalEvidenceScope,
  type ExternalEvidenceSubjectType,
  type ExternalEvidenceVerifier,
  type ExternalProductionEvidenceClass,
  type ExternalProductionEvidenceRecord,
} from './types.ts';

export type ExternalEvidenceDraft = {
  readonly recordId: string;
  readonly evidenceClass: ExternalProductionEvidenceClass;
  readonly issuerOrSource: string;
  readonly subjectType: ExternalEvidenceSubjectType;
  readonly subjectId: string;
  readonly scope: ExternalEvidenceScope | {
    readonly label: string;
    readonly global?: boolean;
    readonly jurisdictions?: readonly string[];
    readonly activationDomains?: ExternalEvidenceScope['activationDomains'];
    readonly providerDomains?: ExternalEvidenceScope['providerDomains'];
  };
  readonly issuedAtUtc?: string | null;
  readonly validFromUtc?: string | null;
  readonly expiresAtUtc?: string | null;
  readonly reviewDueAtUtc?: string | null;
  readonly reference: ExternalEvidenceReference;
  readonly contentDigest: string;
  readonly confidential?: boolean;
  readonly fixture?: boolean;
  readonly engineeringOnly?: boolean;
  readonly version?: number;
  readonly previousVersionId?: string | null;
};

export class ExternalEvidenceRegistry {
  private readonly records = new Map<string, ExternalProductionEvidenceRecord>();

  register(draft: ExternalEvidenceDraft): ExternalEvidenceResult<ExternalProductionEvidenceRecord> {
    if (this.records.has(draft.recordId)) {
      return externalEvidenceErr('DUPLICATE_RECORD', `record ${draft.recordId} already exists`);
    }
    if (draft.reference.locator.length === 0 && draft.contentDigest.length === 0) {
      return externalEvidenceErr('REFERENCE_REQUIRED', 'document reference or content digest is required');
    }
    const scope =
      'global' in draft.scope || 'label' in draft.scope
        ? scopeFromParts({
            label: draft.scope.label,
            global: 'global' in draft.scope ? draft.scope.global : false,
            jurisdictions: draft.scope.jurisdictions,
            activationDomains: draft.scope.activationDomains,
            providerDomains: draft.scope.providerDomains,
          })
        : scopeFromParts(draft.scope);
    const fixture = draft.fixture === true;
    const engineeringOnly = draft.engineeringOnly === true || fixture;
    const base = {
      schemaVersion: EXTERNAL_EVIDENCE_SCHEMA_VERSION,
      recordId: draft.recordId,
      evidenceClass: draft.evidenceClass,
      issuerOrSource: draft.issuerOrSource,
      subjectType: draft.subjectType,
      subjectId: draft.subjectId,
      scope,
      jurisdictions: Object.freeze([...scope.jurisdictions]),
      activationDomains: Object.freeze([...scope.activationDomains]),
      providerDomains: Object.freeze([...scope.providerDomains]),
      issuedAtUtc: draft.issuedAtUtc ?? null,
      validFromUtc: draft.validFromUtc ?? null,
      expiresAtUtc: draft.expiresAtUtc ?? null,
      reviewDueAtUtc: draft.reviewDueAtUtc ?? null,
      reference: Object.freeze({ ...draft.reference }),
      contentDigest: draft.contentDigest,
      verificationState: 'PROVIDED_UNVERIFIED' as const,
      verifiedByRole: null,
      verifiedByActorId: null,
      verifiedAtUtc: null,
      verificationBindingHash: null,
      revoked: false,
      revokedAtUtc: null,
      revocationReason: null,
      confidential: draft.confidential === true,
      publicChainSafe: true as const,
      fixture,
      engineeringOnly,
      version: draft.version ?? 1,
      previousVersionId: draft.previousVersionId ?? null,
    };
    const record = Object.freeze({
      ...base,
      commitmentHash: recordCommitmentHash(base),
    });
    this.records.set(record.recordId, record);
    return externalEvidenceOk(record);
  }

  get(recordId: string): ExternalProductionEvidenceRecord | undefined {
    return this.records.get(recordId);
  }

  list(): readonly ExternalProductionEvidenceRecord[] {
    return Object.freeze([...this.records.values()]);
  }

  refresh(nowUtc: string): readonly ExternalProductionEvidenceRecord[] {
    for (const [id, record] of this.records) {
      this.records.set(id, applyFreshness(record, nowUtc));
    }
    return this.list();
  }

  verify(
    recordId: string,
    actor: ExternalEvidenceVerifier,
    nowUtc: string,
  ): ExternalEvidenceResult<ExternalProductionEvidenceRecord> {
    const current = this.records.get(recordId);
    if (!current) {
      return externalEvidenceErr('NOT_FOUND', `record ${recordId} is not registered`);
    }
    const verified = verifyExternalEvidence(applyFreshness(current, nowUtc), actor, nowUtc);
    if (verified.ok) {
      this.records.set(recordId, verified.value);
    }
    return verified;
  }

  reject(
    recordId: string,
    actor: ExternalEvidenceVerifier,
    nowUtc: string,
    reason: string,
  ): ExternalEvidenceResult<ExternalProductionEvidenceRecord> {
    const current = this.records.get(recordId);
    if (!current) {
      return externalEvidenceErr('NOT_FOUND', `record ${recordId} is not registered`);
    }
    const rejected = rejectExternalEvidence(current, actor, nowUtc, reason);
    if (rejected.ok) {
      this.records.set(recordId, rejected.value);
    }
    return rejected;
  }

  revoke(
    recordId: string,
    nowUtc: string,
    reason: string,
  ): ExternalEvidenceResult<ExternalProductionEvidenceRecord> {
    const current = this.records.get(recordId);
    if (!current) {
      return externalEvidenceErr('NOT_FOUND', `record ${recordId} is not registered`);
    }
    const revoked = revokeExternalEvidence(current, nowUtc, reason);
    if (revoked.ok) {
      this.records.set(recordId, revoked.value);
    }
    return revoked;
  }

  supersede(
    previousId: string,
    draft: ExternalEvidenceDraft,
    nowUtc: string,
  ): ExternalEvidenceResult<{
    readonly previous: ExternalProductionEvidenceRecord;
    readonly next: ExternalProductionEvidenceRecord;
  }> {
    const previous = this.records.get(previousId);
    if (!previous) {
      return externalEvidenceErr('NOT_FOUND', `record ${previousId} is not registered`);
    }
    const registered = this.register({
      ...draft,
      previousVersionId: previousId,
      version: draft.version ?? previous.version + 1,
    });
    if (!registered.ok) {
      return registered;
    }
    const linked = supersedeExternalEvidence(previous, registered.value, nowUtc);
    if (!linked.ok) {
      this.records.delete(registered.value.recordId);
      return linked;
    }
    this.records.set(previousId, linked.value.previous);
    this.records.set(linked.value.next.recordId, linked.value.next);
    return linked;
  }

  load(record: ExternalProductionEvidenceRecord): void {
    this.records.set(record.recordId, record);
  }

  replaceFields(
    recordId: string,
    patch: {
      readonly scope?: ExternalEvidenceDraft['scope'];
      readonly expiresAtUtc?: string | null;
      readonly jurisdictions?: readonly string[];
      readonly activationDomains?: ExternalEvidenceScope['activationDomains'];
      readonly providerDomains?: ExternalEvidenceScope['providerDomains'];
    },
  ): ExternalEvidenceResult<ExternalProductionEvidenceRecord> {
    const current = this.records.get(recordId);
    if (!current) {
      return externalEvidenceErr('NOT_FOUND', `record ${recordId} is not registered`);
    }
    const scope = patch.scope
      ? scopeFromParts({
          label: patch.scope.label,
          global: 'global' in patch.scope ? patch.scope.global : current.scope.global,
          jurisdictions: patch.scope.jurisdictions ?? patch.jurisdictions ?? current.jurisdictions,
          activationDomains: patch.scope.activationDomains ?? patch.activationDomains ?? current.activationDomains,
          providerDomains: patch.scope.providerDomains ?? patch.providerDomains ?? current.providerDomains,
        })
      : current.scope;
    const nextBase = {
      ...current,
      scope,
      jurisdictions: Object.freeze([...(patch.jurisdictions ?? scope.jurisdictions)]),
      activationDomains: Object.freeze([...(patch.activationDomains ?? scope.activationDomains)]),
      providerDomains: Object.freeze([...(patch.providerDomains ?? scope.providerDomains)]),
      expiresAtUtc: patch.expiresAtUtc === undefined ? current.expiresAtUtc : patch.expiresAtUtc,
    };
    const hashed = Object.freeze({
      ...nextBase,
      commitmentHash: recordCommitmentHash(nextBase),
    });
    const invalidated = invalidateVerificationAfterChange(hashed);
    this.records.set(recordId, invalidated);
    return externalEvidenceOk(invalidated);
  }

  findSatisfying(query: ExternalEvidenceQuery): ExternalProductionEvidenceRecord | null {
    this.refresh(query.nowUtc);
    for (const record of this.records.values()) {
      if (record.verificationState === 'SUPERSEDED') {
        continue;
      }
      if (!recordMatchesQuery(record, query)) {
        continue;
      }
      if (!isCurrentForEligibility(record, query.nowUtc)) {
        continue;
      }
      if (query.production === true) {
        if (!satisfiesProductionVerification(record)) {
          continue;
        }
      } else if (
        record.verificationState !== 'VERIFIED_EXTERNAL' &&
        record.verificationState !== 'VERIFIED_ENGINEERING_FIXTURE'
      ) {
        continue;
      }
      return record;
    }
    return null;
  }

  productionEligible(query: ExternalEvidenceQuery): boolean {
    return this.findSatisfying({ ...query, production: true }) !== null;
  }

  snapshot(nowUtc: string): ExternalEvidenceRegistrySnapshot {
    this.refresh(nowUtc);
    return Object.freeze({
      schemaVersion: EXTERNAL_EVIDENCE_SCHEMA_VERSION,
      generatedAtUtc: nowUtc,
      records: this.list(),
      fixtureCountsAsExternal: false as const,
      productionActive: false as const,
    });
  }
}

export type ExternalEvidenceRegistrySnapshot = {
  readonly schemaVersion: typeof EXTERNAL_EVIDENCE_SCHEMA_VERSION;
  readonly generatedAtUtc: string;
  readonly records: readonly ExternalProductionEvidenceRecord[];
  readonly fixtureCountsAsExternal: false;
  readonly productionActive: false;
};

export function registryFromSnapshot(snapshot: ExternalEvidenceRegistrySnapshot): ExternalEvidenceRegistry {
  const registry = new ExternalEvidenceRegistry();
  for (const record of snapshot.records) {
    registry.load(record);
  }
  return registry;
}

export function recordFreshness(record: ExternalProductionEvidenceRecord, nowUtc: string) {
  return freshnessOf(record, nowUtc);
}
