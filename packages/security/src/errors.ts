/**
 * Fail-closed security errors. None of these degrade to allow.
 */

export const SECURITY_FAILURE_CODES = [
  'KEY_NOT_FOUND',
  'KEY_VERSION_UNKNOWN',
  'KEY_REVOKED',
  'KEY_NOT_USABLE',
  'KEY_PENDING',
  'KEY_RETIRED',
  'SIGNATURE_INVALID',
  'CIPHERTEXT_MALFORMED',
  'AUTHENTICATION_FAILED',
  'WRONG_ENCRYPTION_KEY',
  'PROVIDER_UNAVAILABLE',
  'CREDENTIAL_EXPIRED',
  'PURPOSE_MISMATCH',
  'SECRET_UNRESOLVED',
  'INVALID_SECRET_REFERENCE',
  'UNSUPPORTED_ALGORITHM',
  'UNKNOWN_SUITE',
  'UNKNOWN_ALGORITHM',
  'SUITE_NOT_USABLE',
  'SUITE_VERIFY_ONLY',
  'SUITE_DEPRECATED',
  'HYBRID_COMPONENT_INVALID',
  'BINDING_MISMATCH',
  'DOWNGRADE_REJECTED',
  'POLICY_REJECTED',
  'PRIVATE_KEY_LEAKAGE',
  'DIRECT_INSTANTIATION_FORBIDDEN',
  'PROVIDER_ALGORITHM_MISMATCH',
  'CEREMONY_STATE_INVALID',
  'CEREMONY_APPROVAL_REJECTED',
  'CEREMONY_ATTESTATION_INVALID',
  'CEREMONY_TRANSCRIPT_TAMPERED',
  'CEREMONY_FIXTURE_REJECTED',
  'AUTHORITY_SEPARATION',
  'AI_ROLE_FORBIDDEN',
  'PRODUCTION_CLAIM_FORBIDDEN',
] as const;

export type SecurityFailureCode = (typeof SECURITY_FAILURE_CODES)[number];

export type SecurityFailure = {
  readonly code: SecurityFailureCode;
  readonly message: string;
};

export class SecurityError extends Error {
  readonly code: SecurityFailureCode;

  constructor(code: SecurityFailureCode, message: string) {
    super(message);
    this.name = 'SecurityError';
    this.code = code;
  }
}

export type SecurityResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: SecurityFailure };

export function securityOk<T>(value: T): SecurityResult<T> {
  return Object.freeze({ ok: true, value });
}

export function securityErr<T = never>(
  code: SecurityFailureCode,
  message: string,
): SecurityResult<T> {
  return Object.freeze({ ok: false, error: Object.freeze({ code, message }) });
}

export function unwrapSecurity<T>(result: SecurityResult<T>): T {
  if (!result.ok) {
    throw new SecurityError(result.error.code, result.error.message);
  }
  return result.value;
}
