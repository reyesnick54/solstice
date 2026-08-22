/**
 * Data minimization for identity-verification adapters.
 * Document images, selfies, and full identity payloads stay out of
 * logs, generic events, and adapter stores.
 */

const SENSITIVE_KEYS = [
  'documentImage',
  'selfieImage',
  'livenessVideo',
  'biometricTemplate',
  'passportImage',
  'nationalIdImage',
  'driverLicenseImage',
  'legalName',
  'dateOfBirth',
  'nationalId',
  'ssn',
  'taxId',
] as const;

const BASE64ISH = /[A-Za-z0-9+/]{80,}/;
const IMAGE_HINT = /data:image|base64|video\/|passport|national.?id|selfie/i;

export type IdentityRetentionPolicy = {
  readonly mode: 'REFERENCE_ONLY';
  readonly retainDocumentImages: false;
  readonly retainBiometrics: false;
  readonly retainRawVendorPayload: false;
  readonly purpose: 'IDENTITY_VERIFICATION';
  readonly maxEvidenceAgeHours: number;
};

export const DEFAULT_IDENTITY_RETENTION: IdentityRetentionPolicy = Object.freeze({
  mode: 'REFERENCE_ONLY',
  retainDocumentImages: false,
  retainBiometrics: false,
  retainRawVendorPayload: false,
  purpose: 'IDENTITY_VERIFICATION',
  maxEvidenceAgeHours: 24,
});

export type RedactedLogRecord = {
  readonly providerId: string;
  readonly eventType: string;
  readonly subjectRef: string;
  readonly state: string;
  readonly reasonCodes: readonly string[];
  readonly evidenceRefs: readonly string[];
  readonly rawIdentityPayloadPresent: false;
  readonly documentImagePresent: false;
};

export function redactIdentityLog(input: {
  readonly providerId: string;
  readonly eventType: string;
  readonly subjectRef: string;
  readonly state: string;
  readonly reasonCodes: readonly string[];
  readonly evidenceRefs: readonly string[];
}): RedactedLogRecord {
  return Object.freeze({
    providerId: input.providerId,
    eventType: input.eventType,
    subjectRef: input.subjectRef,
    state: input.state,
    reasonCodes: Object.freeze([...input.reasonCodes]),
    evidenceRefs: Object.freeze([...input.evidenceRefs]),
    rawIdentityPayloadPresent: false,
    documentImagePresent: false,
  });
}

export function containsSensitiveIdentityMaterial(payload: unknown): boolean {
  const serialized = JSON.stringify(payload ?? {});
  for (const key of SENSITIVE_KEYS) {
    if (serialized.includes(key) && (IMAGE_HINT.test(serialized) || BASE64ISH.test(serialized))) {
      return true;
    }
  }
  return IMAGE_HINT.test(serialized) && BASE64ISH.test(serialized);
}

export function assertNoKycDocumentInLog(payload: unknown): void {
  if (containsSensitiveIdentityMaterial(payload)) {
    throw new Error('KYC documents and full identity payloads must not appear in application logs');
  }
}

export function genericEventAllowsFullIdentityPayload(): false {
  return false;
}
