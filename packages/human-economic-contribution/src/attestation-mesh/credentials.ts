/**
 * Credential verification for human contribution attestations.
 *
 * Do not rely solely on uploaded screenshots/documents when authoritative
 * verification exists.
 */

import type { UtcInstant } from '../../../domain/src/time.ts';
import type { AttestationSourceClass } from './source-classes.ts';

export type CredentialLifecycleState =
  | 'CREDENTIAL_ISSUED'
  | 'CREDENTIAL_VALID'
  | 'CREDENTIAL_REVOKED'
  | 'CREDENTIAL_EXPIRED'
  | 'CREDENTIAL_UNKNOWN';

export type CredentialIssuerTrust = 'TRUSTED' | 'RECOGNIZED' | 'UNTRUSTED' | 'UNKNOWN';

export type CredentialVerificationInput = {
  readonly credentialId: string;
  readonly issuerId: string;
  readonly issuerClass: AttestationSourceClass;
  readonly subjectRef: string;
  readonly issuedAt: UtcInstant;
  readonly expiresAt: UtcInstant | null;
  readonly revokedAt: UtcInstant | null;
  readonly evaluatedAt: UtcInstant;
  readonly screenshotOnly: boolean;
  readonly authoritativeVerificationAvailable: boolean;
};

export type CredentialVerificationResult = {
  readonly credentialId: string;
  readonly lifecycleState: CredentialLifecycleState;
  readonly issuerTrust: CredentialIssuerTrust;
  readonly valid: boolean;
  readonly explanationCodes: readonly string[];
};

const TRUSTED_ISSUER_CLASSES: readonly AttestationSourceClass[] = Object.freeze([
  'CREDENTIAL_ISSUER',
  'EDUCATIONAL_INSTITUTION',
  'GOVERNMENT',
  'PRIMARY_INSTITUTION',
]);

export function assessIssuerTrust(issuerClass: AttestationSourceClass): CredentialIssuerTrust {
  if (TRUSTED_ISSUER_CLASSES.includes(issuerClass)) {
    return 'TRUSTED';
  }
  if (issuerClass === 'OTHER_GOVERNANCE_APPROVED' || issuerClass === 'AUTHORIZED_DATA_PROVIDER') {
    return 'RECOGNIZED';
  }
  if (issuerClass === 'USER_SELF_ATTESTATION' || issuerClass === 'PEER_ATTESTATION') {
    return 'UNTRUSTED';
  }
  return 'UNKNOWN';
}

export function verifyCredential(input: CredentialVerificationInput): CredentialVerificationResult {
  const codes: string[] = [];
  const issuerTrust = assessIssuerTrust(input.issuerClass);

  if (input.screenshotOnly && input.authoritativeVerificationAvailable) {
    codes.push('SCREENSHOT_INSUFFICIENT_WHEN_AUTHORITATIVE_EXISTS');
  }

  if (input.revokedAt !== null && Date.parse(input.revokedAt) <= Date.parse(input.evaluatedAt)) {
    codes.push('CREDENTIAL_REVOKED');
    return Object.freeze({
      credentialId: input.credentialId,
      lifecycleState: 'CREDENTIAL_REVOKED',
      issuerTrust,
      valid: false,
      explanationCodes: Object.freeze(codes),
    });
  }

  if (input.expiresAt !== null && Date.parse(input.expiresAt) < Date.parse(input.evaluatedAt)) {
    codes.push('CREDENTIAL_EXPIRED');
    return Object.freeze({
      credentialId: input.credentialId,
      lifecycleState: 'CREDENTIAL_EXPIRED',
      issuerTrust,
      valid: false,
      explanationCodes: Object.freeze(codes),
    });
  }

  if (issuerTrust === 'UNTRUSTED') {
    codes.push('CREDENTIAL_ISSUER_UNTRUSTED');
    return Object.freeze({
      credentialId: input.credentialId,
      lifecycleState: 'CREDENTIAL_UNKNOWN',
      issuerTrust,
      valid: false,
      explanationCodes: Object.freeze(codes),
    });
  }

  codes.push('CREDENTIAL_VALID');
  return Object.freeze({
    credentialId: input.credentialId,
    lifecycleState: 'CREDENTIAL_VALID',
    issuerTrust,
    valid: true,
    explanationCodes: Object.freeze(codes),
  });
}
