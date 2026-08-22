import type {
  DocumentVerificationRecord,
  IdentityApplicant,
  IdentityVerificationRecord,
  KybRecord,
} from './types.ts';

export type IdentityAdapterSnapshot = {
  readonly applicants: readonly IdentityApplicant[];
  readonly verifications: readonly IdentityVerificationRecord[];
  readonly documents: readonly DocumentVerificationRecord[];
  readonly kyb: readonly KybRecord[];
  readonly webhookKeys: readonly string[];
};

export class IdentityAdapterStore {
  readonly applicants = new Map<string, IdentityApplicant>();
  readonly verifications = new Map<string, IdentityVerificationRecord>();
  readonly documents = new Map<string, DocumentVerificationRecord>();
  readonly kyb = new Map<string, KybRecord>();
  readonly webhookKeys = new Set<string>();

  snapshot(): IdentityAdapterSnapshot {
    return Object.freeze({
      applicants: Object.freeze([...this.applicants.values()]),
      verifications: Object.freeze([...this.verifications.values()]),
      documents: Object.freeze([...this.documents.values()]),
      kyb: Object.freeze([...this.kyb.values()]),
      webhookKeys: Object.freeze([...this.webhookKeys]),
    });
  }

  hydrate(snapshot: IdentityAdapterSnapshot): void {
    this.applicants.clear();
    this.verifications.clear();
    this.documents.clear();
    this.kyb.clear();
    this.webhookKeys.clear();
    for (const applicant of snapshot.applicants) {
      this.applicants.set(applicant.applicantId, applicant);
    }
    for (const verification of snapshot.verifications) {
      this.verifications.set(verification.verificationId, verification);
    }
    for (const document of snapshot.documents) {
      this.documents.set(document.documentRef, document);
    }
    for (const record of snapshot.kyb) {
      this.kyb.set(record.kybId, record);
    }
    for (const key of snapshot.webhookKeys) {
      this.webhookKeys.add(key);
    }
  }

  latestVerification(identityId: string): IdentityVerificationRecord | undefined {
    let latest: IdentityVerificationRecord | undefined;
    for (const record of this.verifications.values()) {
      if (record.identityId !== identityId) {
        continue;
      }
      if (!latest || record.observedAt > latest.observedAt) {
        latest = record;
      }
    }
    return latest;
  }
}
