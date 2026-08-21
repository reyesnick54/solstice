import { randomUUID } from 'node:crypto';

import type { Jurisdiction } from '../../../domain/src/jurisdiction.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';
import { asKycRecordId } from '../ids.ts';
import { type KycRecord } from '../kyc.ts';
import type { IdentityAdapterStore } from './store.ts';
import {
  IDENTITY_ADAPTER_FLAGS,
  toPersistedKycState,
  type IdentityAdapterProfile,
  type IdentityApplicant,
  type IdentityVerificationRecord,
  type IdentityVerificationState,
} from './types.ts';

export type CreateApplicantInput = {
  readonly identityId: string;
  readonly jurisdiction: Jurisdiction;
  readonly now: UtcInstant;
};

export type StartVerificationInput = {
  readonly applicantId: string;
  readonly now: UtcInstant;
  readonly level?: IdentityVerificationRecord['level'];
};

export type KycProviderPort = {
  createApplicant(input: CreateApplicantInput): IdentityApplicant;
  startVerification(input: StartVerificationInput): IdentityVerificationRecord;
  retrieveVerification(verificationId: string): IdentityVerificationRecord | undefined;
  retrieveApplicant(applicantId: string): IdentityApplicant | undefined;
  refreshScreening(input: { readonly verificationId: string; readonly now: UtcInstant }): IdentityVerificationRecord;
  retrieveProviderEvidence(verificationId: string): { readonly providerEvidenceRef: string | null };
};

export class KycAdapter implements KycProviderPort {
  constructor(
    private readonly store: IdentityAdapterStore,
    private readonly profile: IdentityAdapterProfile,
    private readonly scenarioFor: (identityId: string) => IdentityVerificationState,
  ) {}

  createApplicant(input: CreateApplicantInput): IdentityApplicant {
    const applicant: IdentityApplicant = Object.freeze({
      applicantId: `apl_${randomUUID()}`,
      identityId: input.identityId,
      providerRef: `${this.profile.providerId}:applicant`,
      createdAt: input.now,
      jurisdiction: input.jurisdiction,
    });
    this.store.applicants.set(applicant.applicantId, applicant);
    return applicant;
  }

  startVerification(input: StartVerificationInput): IdentityVerificationRecord {
    const applicant = this.requireApplicant(input.applicantId);
    const state = this.scenarioFor(applicant.identityId);
    const record = this.buildRecord(applicant, input.now, state, input.level ?? 'STANDARD');
    this.store.verifications.set(record.verificationId, record);
    return record;
  }

  retrieveVerification(verificationId: string): IdentityVerificationRecord | undefined {
    return this.store.verifications.get(verificationId);
  }

  retrieveApplicant(applicantId: string): IdentityApplicant | undefined {
    return this.store.applicants.get(applicantId);
  }

  refreshScreening(input: { readonly verificationId: string; readonly now: UtcInstant }): IdentityVerificationRecord {
    const current = this.store.verifications.get(input.verificationId);
    if (!current) {
      throw new Error(`unknown verification ${input.verificationId}`);
    }
    const next: IdentityVerificationRecord = Object.freeze({
      ...current,
      observedAt: input.now,
      reasonCodes: Object.freeze([...current.reasonCodes, 'SCREENING_REFRESHED']),
    });
    this.store.verifications.set(next.verificationId, next);
    return next;
  }

  retrieveProviderEvidence(verificationId: string): { readonly providerEvidenceRef: string | null } {
    return Object.freeze({
      providerEvidenceRef: this.store.verifications.get(verificationId)?.providerEvidenceRef ?? null,
    });
  }

  applyVerifiedState(record: IdentityVerificationRecord): IdentityVerificationRecord {
    if (record.environment !== 'SIMULATION' && record.environment !== 'SANDBOX' && record.environment !== 'CERTIFICATION') {
      throw new Error('live identity verification is disabled');
    }
    this.store.verifications.set(record.verificationId, record);
    return record;
  }

  toKycRecord(record: IdentityVerificationRecord, jurisdiction: Jurisdiction): KycRecord {
    return Object.freeze({
      id: asKycRecordId(record.verificationId),
      identityId: record.identityId as KycRecord['identityId'],
      providerRef: record.providerRef,
      verificationState: toPersistedKycState(record.state),
      verificationLevel: record.level,
      jurisdiction,
      verifiedAttributes: Object.freeze([]),
      verifiedAt: record.state === 'VERIFIED' ? record.observedAt : null,
      expiresAt: record.expiresAt,
      reasonCodes: Object.freeze([
        ...record.reasonCodes,
        ...(record.state === 'REQUIRES_REVIEW' ? (['REQUIRES_REVIEW'] as const) : []),
      ]),
      evidenceRefs: record.evidenceRefs,
      version: 1,
    });
  }

  flags() {
    return IDENTITY_ADAPTER_FLAGS;
  }

  private buildRecord(
    applicant: IdentityApplicant,
    now: UtcInstant,
    state: IdentityVerificationState,
    level: IdentityVerificationRecord['level'],
  ): IdentityVerificationRecord {
    return Object.freeze({
      verificationId: `ver_${randomUUID()}`,
      applicantId: applicant.applicantId,
      identityId: applicant.identityId,
      providerRef: `${this.profile.providerId}:kyc:${applicant.identityId}`,
      state,
      level,
      environment: this.profile.environment,
      reasonCodes: Object.freeze(reasonCodesFor(state)),
      evidenceRefs: Object.freeze([`id-ev:${this.profile.providerId}:${applicant.identityId}`]),
      providerEvidenceRef: `prov-ev:${this.profile.providerId}:${applicant.identityId}`,
      observedAt: now,
      expiresAt: state === 'VERIFIED' ? addYear(now) : null,
      sandboxOnly: this.profile.environment !== 'SIMULATION' ? true : true,
      isProductionKyc: false,
    });
  }

  private requireApplicant(applicantId: string): IdentityApplicant {
    const applicant = this.store.applicants.get(applicantId);
    if (!applicant) {
      throw new Error(`unknown applicant ${applicantId}`);
    }
    return applicant;
  }
}

function reasonCodesFor(state: IdentityVerificationState): readonly string[] {
  switch (state) {
    case 'VERIFIED':
      return ['SANDBOX_IDENTITY_VERIFIED'];
    case 'IN_PROGRESS':
      return ['VERIFICATION_PENDING'];
    case 'REQUIRES_REVIEW':
      return ['REQUIRES_REVIEW'];
    case 'FAILED':
      return ['VERIFICATION_FAILED'];
    case 'EXPIRED':
      return ['VERIFICATION_EXPIRED'];
    case 'NOT_STARTED':
      return ['NOT_STARTED'];
  }
}

function addYear(now: UtcInstant): UtcInstant {
  const date = new Date(now);
  date.setUTCFullYear(date.getUTCFullYear() + 1);
  return date.toISOString() as UtcInstant;
}
