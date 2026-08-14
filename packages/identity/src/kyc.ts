import type { Jurisdiction } from '../../domain/src/jurisdiction.ts';
import type { UtcInstant } from '../../domain/src/time.ts';
import type { KycRecordId, SolsticeIdentityId } from './ids.ts';

export const KYC_VERIFICATION_STATES = [
  'NOT_STARTED',
  'IN_PROGRESS',
  'VERIFIED',
  'FAILED',
  'EXPIRED',
] as const;

export type KycVerificationState = (typeof KYC_VERIFICATION_STATES)[number];

export const KYC_VERIFICATION_LEVELS = [
  'NONE',
  'BASIC',
  'STANDARD',
  'ENHANCED',
] as const;

export type KycVerificationLevel = (typeof KYC_VERIFICATION_LEVELS)[number];

export type KycVerifiedAttribute = {
  readonly name: string;
  readonly reference: string;
};

/**
 * Versioned KYC metadata. Raw identity-document images are not stored.
 * Prefer provider tokens, hashes, and Evidence Vault references.
 */
export type KycRecord = {
  readonly id: KycRecordId;
  readonly identityId: SolsticeIdentityId;
  readonly providerRef: string;
  readonly verificationState: KycVerificationState;
  readonly verificationLevel: KycVerificationLevel;
  readonly jurisdiction: Jurisdiction;
  readonly verifiedAttributes: readonly KycVerifiedAttribute[];
  readonly verifiedAt: UtcInstant | null;
  readonly expiresAt: UtcInstant | null;
  readonly reasonCodes: readonly string[];
  readonly evidenceRefs: readonly string[];
  readonly version: number;
};

export function kycIsFresh(record: KycRecord, now: UtcInstant): boolean {
  if (record.verificationState !== 'VERIFIED') {
    return false;
  }
  if (record.expiresAt === null) {
    return false;
  }
  return Date.parse(now) < Date.parse(record.expiresAt);
}

export function kycEffectiveState(record: KycRecord, now: UtcInstant): KycVerificationState {
  if (
    record.verificationState === 'VERIFIED' &&
    record.expiresAt !== null &&
    Date.parse(now) >= Date.parse(record.expiresAt)
  ) {
    return 'EXPIRED';
  }
  return record.verificationState;
}
