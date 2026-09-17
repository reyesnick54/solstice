import type { AiFailureCode } from '../taxonomy.ts';
import type { HttpsTransportFailure } from '../transport.ts';
import type { InferenceRetryCategory } from './taxonomy.ts';

const NON_RETRYABLE_CODES = new Set<AiFailureCode>([
  'MODEL_POLICY_BLOCKED',
  'MODEL_OUTPUT_INVALID',
  'INVALID_STRUCTURED_OUTPUT',
  'SECRET_IN_PAYLOAD',
  'NEVER_RELEASE_DATA_CLASS',
  'AUTHORIZATION_REQUIRED',
  'AUTHENTICATION_FAILURE',
  'MODEL_NOT_AVAILABLE',
  'MODEL_REF_UNRESOLVED',
  'MODEL_CANCELLED',
  'BILLING_DISABLED',
  'INSUFFICIENT_QUOTA',
  'FORBIDDEN_TOOL_REQUESTED',
  'PROMPT_INJECTION',
  'PRODUCTION_APPROVAL_UNREACHABLE',
]);

const RETRYABLE_CODES = new Set<AiFailureCode>([
  'MODEL_UNAVAILABLE',
  'MODEL_TIMEOUT',
  'PROVIDER_TIMEOUT',
  'MODEL_RATE_LIMITED',
  'PROVIDER_UNAVAILABLE',
  'PROVIDER_UNHEALTHY',
  'EXTERNAL_NETWORK_DISABLED',
]);

export function classifyInferenceRetry(code: AiFailureCode): InferenceRetryCategory {
  if (NON_RETRYABLE_CODES.has(code)) {
    return 'NON_RETRYABLE';
  }
  if (RETRYABLE_CODES.has(code)) {
    return 'RETRYABLE';
  }
  return 'NON_RETRYABLE';
}

export function classifyTransportRetry(failure: HttpsTransportFailure): InferenceRetryCategory {
  if (!failure.retryable) {
    return 'NON_RETRYABLE';
  }
  return classifyInferenceRetry(failure.code);
}

export function shouldRetryAttempt(input: {
  readonly category: InferenceRetryCategory;
  readonly attempt: number;
  readonly maxAttempts: number;
}): boolean {
  return input.category === 'RETRYABLE' && input.attempt < input.maxAttempts;
}

export function retryDelayMs(attempt: number): number {
  return Math.min(250 * 2 ** (attempt - 1), 4_000);
}
