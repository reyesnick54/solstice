import { sha256Hex } from '../../../security/src/hash.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';
import type { IdentityVerificationResult } from '../ports.ts';
import type { IdentityNormalizedStoreRecord, RawIdentityVendorResponse } from './types.ts';

const RAW_SENSITIVE_KEYS = [
  'documentImage',
  'selfieImage',
  'livenessVideo',
  'biometricTemplate',
  'passportImage',
  'nationalIdImage',
  'driverLicenseImage',
] as const;

export function normalizeIdentityVendorResponse(
  raw: RawIdentityVendorResponse,
  input: { readonly providerRef: string; readonly now: UtcInstant },
): IdentityVerificationResult {
  if (raw.scenario === 'timeout') {
    return failed(input, ['KYC_TIMEOUT', 'PROVIDER_TIMEOUT']);
  }
  if (raw.scenario === 'unavailable') {
    return failed(input, ['PROVIDER_UNAVAILABLE']);
  }
  if (raw.scenario === 'auth_failure') {
    return failed(input, ['PROVIDER_AUTH_FAILURE']);
  }
  if (raw.scenario === 'schema_drift' || !isRecognizedOutcome(raw.vendorOutcome)) {
    return failed(input, ['DOCUMENT_SCHEMA_DRIFT', 'SCHEMA_INVALID']);
  }
  if (containsRawSensitiveMaterial(raw)) {
    return failed(input, ['RAW_SENSITIVE_MATERIAL_REJECTED']);
  }
  return Object.freeze({
    providerRef: input.providerRef,
    outcome: 'VERIFIED',
    reasonCodes: Object.freeze(['FIXTURE_IDENTITY_VERIFIED']),
    evidenceRefs: Object.freeze([`id-ev:${input.providerRef}`]),
    observedAt: input.now,
  });
}

export function toStoreRecord(
  result: IdentityVerificationResult,
): IdentityNormalizedStoreRecord {
  return Object.freeze({
    providerRef: result.providerRef,
    outcome: result.outcome,
    reasonCodes: result.reasonCodes,
    evidenceRefs: result.evidenceRefs,
    evidenceCommitment: sha256Hex(
      JSON.stringify({
        providerRef: result.providerRef,
        outcome: result.outcome,
        reasonCodes: result.reasonCodes,
        observedAt: result.observedAt,
      }),
    ),
    observedAt: result.observedAt,
    rawDocumentPersisted: false,
    biometricPersisted: false,
    rawVendorResponsePersisted: false,
  });
}

export function containsRawSensitiveMaterial(raw: RawIdentityVendorResponse): boolean {
  for (const key of RAW_SENSITIVE_KEYS) {
    const value = raw[key as keyof RawIdentityVendorResponse];
    if (typeof value === 'string' && value.length > 0) {
      return true;
    }
  }
  return false;
}

export function assertNoSensitiveIdentityLog(payload: unknown): void {
  const serialized = JSON.stringify(payload ?? {});
  for (const key of RAW_SENSITIVE_KEYS) {
    if (serialized.includes(key) && /data:image|base64|template|video\//i.test(serialized)) {
      throw new Error(`biometric or document material must not be logged: ${key}`);
    }
  }
  if (/biometricTemplate|livenessVideo|selfieImage/.test(serialized) && /[A-Za-z0-9+/]{80,}/.test(serialized)) {
    throw new Error('biometric material must not be logged');
  }
}

function isRecognizedOutcome(outcome: string | undefined): boolean {
  return outcome === 'VERIFIED' || outcome === 'FAILED' || outcome === 'IN_PROGRESS';
}

function failed(
  input: { readonly providerRef: string; readonly now: UtcInstant },
  reasonCodes: readonly string[],
): IdentityVerificationResult {
  return Object.freeze({
    providerRef: input.providerRef,
    outcome: 'FAILED',
    reasonCodes: Object.freeze([...reasonCodes]),
    evidenceRefs: Object.freeze([`id-ev:${input.providerRef}:failed`]),
    observedAt: input.now,
  });
}
