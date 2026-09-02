import { err, ok, type Result } from '../../../domain/src/result.ts';
import type { AssertionFailure } from './types.ts';

/**
 * Field-level minimization policies. Verification purposes map to the
 * minimum fields required; overbroad requests are denied.
 */
export const VERIFICATION_FIELD_POLICIES = Object.freeze({
  credentialStatus: Object.freeze({
    required: ['credentialStatus'] as const,
    forbidden: ['transcript', 'fullTranscript', 'address', 'dateOfBirth', 'ssn', 'nationalId'] as const,
  }),
  employmentVerified: Object.freeze({
    required: ['employmentStatus', 'employerRef'] as const,
    forbidden: ['payrollDetails', 'salary', 'ssn', 'fullTranscript'] as const,
  }),
  ageThreshold: Object.freeze({
    required: ['thresholdSatisfied', 'minimumAgeYears'] as const,
    forbidden: ['dateOfBirth', 'birthDate', 'ageYears'] as const,
  }),
  contributionVerified: Object.freeze({
    required: ['contributionClass', 'verificationState'] as const,
    forbidden: ['hinContents', 'rawContribution', 'vaultContents'] as const,
  }),
  jurisdictionSatisfied: Object.freeze({
    required: ['jurisdictionCode', 'satisfied'] as const,
    forbidden: ['fullAddress', 'gpsCoordinates', 'travelHistory'] as const,
  }),
  computationCompleted: Object.freeze({
    required: ['computationReceiptRef', 'outputClass'] as const,
    forbidden: ['datasetCopy', 'rowExport', 'vaultContents', 'healthRecord'] as const,
  }),
  datasetUsageAuthorized: Object.freeze({
    required: ['purposeId', 'authorized'] as const,
    forbidden: ['consentDocument', 'rawCredential', 'privateKey'] as const,
  }),
} as const);

export type VerificationPurpose = keyof typeof VERIFICATION_FIELD_POLICIES;

export function resolveAllowedFields(purpose: VerificationPurpose): readonly string[] {
  return VERIFICATION_FIELD_POLICIES[purpose].required;
}

export function denyOverbroadFieldRequest(input: {
  readonly purpose: VerificationPurpose;
  readonly requestedFields: readonly string[];
}): Result<readonly string[], AssertionFailure> {
  const policy = VERIFICATION_FIELD_POLICIES[input.purpose];
  const forbidden = new Set<string>(policy.forbidden);
  const required = new Set<string>(policy.required);
  const violations = input.requestedFields.filter((field) => forbidden.has(field));
  if (violations.length > 0) {
    return err({
      code: 'OVERBROAD_FIELD_REQUEST',
      message: `requested forbidden fields: ${violations.join(', ')}`,
    });
  }
  const extra = input.requestedFields.filter((field) => !required.has(field) && !forbidden.has(field));
  if (extra.length > 0) {
    return err({
      code: 'OVERBROAD_FIELD_REQUEST',
      message: `requested fields beyond minimization policy: ${extra.join(', ')}`,
    });
  }
  const minimized = input.requestedFields.length > 0 ? input.requestedFields : [...policy.required];
  return ok(Object.freeze([...minimized]));
}

export function minimizeRecord(
  source: Readonly<Record<string, unknown>>,
  allowedFields: readonly string[],
): Readonly<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (field in source) {
      out[field] = source[field];
    }
  }
  return Object.freeze(out);
}
