/**
 * Retry classification for events, jobs, workflows, and webhooks.
 *
 * Rejected financial work is never retried forever. Classification is
 * a filter, not a score.
 */

export const RETRY_CLASSES = [
  'RETRYABLE',
  'NON_RETRYABLE',
  'REQUIRES_HUMAN',
  'REQUIRES_PROVIDER',
  'REQUIRES_COMPLIANCE',
] as const;

export type RetryClass = (typeof RETRY_CLASSES)[number];

export type ClassifiedFailure = {
  readonly retryClass: RetryClass;
  readonly code: string;
  readonly message: string;
};

export const INFINITE_RETRY_FORBIDDEN = true as const;

const NON_RETRYABLE_CODES = new Set([
  'UNSUPPORTED_EVENT_VERSION',
  'INVALID_SIGNATURE',
  'SCHEMA_INVALID',
  'SCHEMA_UNSUPPORTED',
  'UNKNOWN_PROVIDER',
  'SENSITIVE_PAYLOAD',
  'PRIVILEGED_JOB_REFUSED',
  'EVENT_HANDLER_CANNOT_MUTATE_LEDGER',
  'NON_RETRYABLE',
  'REJECTED_FINAL',
]);

const HUMAN_CODES = new Set([
  'REQUIRES_HUMAN',
  'REQUIRES_MANUAL_REVIEW',
  'HUMAN_ACTION_REQUIRED',
]);

const COMPLIANCE_CODES = new Set([
  'REQUIRES_COMPLIANCE',
  'COMPLIANCE_HOLD',
  'KERNEL_BLOCK',
  'KERNEL_HOLD',
]);

const PROVIDER_CODES = new Set([
  'REQUIRES_PROVIDER',
  'PROVIDER_TIMEOUT',
  'PROVIDER_UNAVAILABLE',
  'SUBMISSION_UNKNOWN',
]);

export function classifyFailure(error: unknown): ClassifiedFailure {
  if (error && typeof error === 'object' && 'retryClass' in error) {
    const retryClass = String((error as { retryClass: string }).retryClass) as RetryClass;
    if ((RETRY_CLASSES as readonly string[]).includes(retryClass)) {
      return {
        retryClass,
        code: readCode(error),
        message: readMessage(error),
      };
    }
  }
  const code = readCode(error);
  if (NON_RETRYABLE_CODES.has(code)) {
    return { retryClass: 'NON_RETRYABLE', code, message: readMessage(error) };
  }
  if (HUMAN_CODES.has(code)) {
    return { retryClass: 'REQUIRES_HUMAN', code, message: readMessage(error) };
  }
  if (COMPLIANCE_CODES.has(code)) {
    return { retryClass: 'REQUIRES_COMPLIANCE', code, message: readMessage(error) };
  }
  if (PROVIDER_CODES.has(code)) {
    return { retryClass: 'REQUIRES_PROVIDER', code, message: readMessage(error) };
  }
  return { retryClass: 'RETRYABLE', code, message: readMessage(error) };
}

export function shouldRetry(failure: ClassifiedFailure): boolean {
  return failure.retryClass === 'RETRYABLE' || failure.retryClass === 'REQUIRES_PROVIDER';
}

export function holdsForOperator(failure: ClassifiedFailure): boolean {
  return (
    failure.retryClass === 'REQUIRES_HUMAN' ||
    failure.retryClass === 'REQUIRES_COMPLIANCE' ||
    failure.retryClass === 'NON_RETRYABLE'
  );
}

export class ClassifiedError extends Error {
  readonly retryClass: RetryClass;
  readonly reasonCode: string;

  constructor(retryClass: RetryClass, code: string, message: string) {
    super(message);
    this.name = 'ClassifiedError';
    this.retryClass = retryClass;
    this.reasonCode = code;
  }
}

function readCode(error: unknown): string {
  if (error && typeof error === 'object' && 'reasonCode' in error) {
    return String((error as { reasonCode: string }).reasonCode);
  }
  if (error instanceof Error && error.name && error.name !== 'Error') {
    return error.name;
  }
  return 'CONSUMER_FAILURE';
}

function readMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : 'operation failed';
  return raw.length > 240 ? `${raw.slice(0, 240)}…` : raw;
}
