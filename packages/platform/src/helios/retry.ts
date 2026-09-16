import type { TaskFailureCategory } from './taxonomy.ts';
import type { TaskRetryMetadata } from './execution-types.ts';

export const DEFAULT_TERMINAL_THRESHOLD = 5;
export const DEFAULT_BASE_BACKOFF_MS = 1_000;
export const DEFAULT_MAX_BACKOFF_MS = 60_000;

export function isRetryableCategory(category: TaskFailureCategory): boolean {
  switch (category) {
    case 'TRANSIENT_DEPENDENCY':
    case 'RATE_LIMIT':
    case 'PROVIDER_UNAVAILABLE':
      return true;
    case 'AUTHORIZATION_CHANGED':
    case 'CAPABILITY_DISABLED':
    case 'BUDGET_EXHAUSTED':
    case 'PERMANENT_VALIDATION':
    case 'INVALID_INPUT':
    case 'CANCELLED_REVOKED':
      return false;
    default: {
      const exhaustive: never = category;
      return exhaustive;
    }
  }
}

export function nextBackoffMs(attemptCount: number): number {
  const delay = DEFAULT_BASE_BACKOFF_MS * 2 ** Math.max(0, attemptCount - 1);
  return Math.min(delay, DEFAULT_MAX_BACKOFF_MS);
}

export function initialRetryMetadata(): TaskRetryMetadata {
  return Object.freeze({
    attemptCount: 0,
    lastFailureAt: null,
    nextEligibleAt: null,
    failureCategory: null,
    backoffMs: DEFAULT_BASE_BACKOFF_MS,
    terminalThreshold: DEFAULT_TERMINAL_THRESHOLD,
  });
}

export function classifyTaskError(error: unknown): TaskFailureCategory {
  if (error && typeof error === 'object' && 'failureCategory' in error) {
    const category = String((error as { failureCategory: string }).failureCategory) as TaskFailureCategory;
    return category;
  }
  const message = error instanceof Error ? error.message : String(error);
  if (/rate.?limit/i.test(message)) return 'RATE_LIMIT';
  if (/provider|unavailable/i.test(message)) return 'PROVIDER_UNAVAILABLE';
  if (/auth|revok|mandate/i.test(message)) return 'AUTHORIZATION_CHANGED';
  if (/budget/i.test(message)) return 'BUDGET_EXHAUSTED';
  if (/invalid|validation/i.test(message)) return 'PERMANENT_VALIDATION';
  if (/cancel/i.test(message)) return 'CANCELLED_REVOKED';
  return 'TRANSIENT_DEPENDENCY';
}

export class HeliosTaskError extends Error {
  readonly failureCategory: TaskFailureCategory;

  constructor(category: TaskFailureCategory, message: string) {
    super(message);
    this.name = 'HeliosTaskError';
    this.failureCategory = category;
  }
}
