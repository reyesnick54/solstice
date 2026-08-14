import type { PersonalDataCategory } from '@solstice/kernel';

/**
 * Per-category key handling.
 *
 * SECURITY REVIEW REQUIRED: real HSM / KMS / enclave integration is
 * explicitly out of scope. This interface exists so a later reviewed
 * provider can replace the simulated local implementation without
 * changing vault call sites. Do not treat the simulated provider as
 * production key management.
 */

export type KeyRef = {
  readonly category: PersonalDataCategory;
  readonly keyId: string;
  readonly algorithm: 'AES-256-GCM-SIMULATED';
  readonly provider: 'SIMULATED_LOCAL';
  readonly securityReviewRequired: true;
};

export type SealedEnvelope = {
  readonly category: PersonalDataCategory;
  readonly keyId: string;
  readonly ivHex: string;
  readonly ciphertextHex: string;
  readonly authTagHex: string;
  readonly plaintextSha256: string;
};

export interface CategoryKeyProvider {
  readonly providerId: 'SIMULATED_LOCAL';
  readonly hsmIntegrated: false;
  readonly kmsIntegrated: false;
  readonly securityReviewRequired: true;
  keyRefFor(category: PersonalDataCategory): KeyRef;
  wrap(category: PersonalDataCategory, plaintext: Uint8Array): SealedEnvelope;
  unwrap(category: PersonalDataCategory, envelope: SealedEnvelope): Uint8Array;
}
