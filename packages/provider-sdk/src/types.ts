/**
 * Wave 1 — shared provider SDK types.
 *
 * Simulation only. No live provider connectivity.
 */

export const HTTP_METHODS = ['GET', 'HEAD', 'POST', 'PATCH', 'PUT', 'DELETE'] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];

export const CIRCUIT_STATES = ['CLOSED', 'OPEN', 'HALF_OPEN'] as const;
export type CircuitState = (typeof CIRCUIT_STATES)[number];

export const FAILURE_CLASSIFICATIONS = [
  'retryable',
  'non_retryable',
  'rate_limited',
  'authentication_failure',
  'provider_unavailable',
  'invalid_payload',
  'security_failure',
] as const;
export type FailureClassification = (typeof FAILURE_CLASSIFICATIONS)[number];

export type ProviderTransportRequest = {
  readonly method: HttpMethod;
  readonly path: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: unknown;
  /** When true, mutation retries are permitted under policy. */
  readonly idempotent?: boolean;
};

export type ProviderTransportResponse = {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: unknown;
};

/**
 * Injectable transport from Prompt 3. Reliability middleware wraps this.
 */
export type ProviderTransport = {
  readonly providerId: string;
  execute(
    request: ProviderTransportRequest,
    options?: { readonly signal?: AbortSignal; readonly deadlineMs?: number },
  ): Promise<ProviderTransportResponse>;
};

export type ProviderError = {
  readonly classification: FailureClassification;
  readonly code: string;
  readonly message: string;
  readonly status?: number;
  readonly retryAfterMs?: number;
  readonly providerId: string;
};

export type ReliabilityOutcome<T> =
  | {
      readonly ok: true;
      readonly value: T;
      readonly attempts: number;
      readonly durationMs: number;
      readonly circuitState: CircuitState;
      readonly fallbackEligible: boolean;
    }
  | {
      readonly ok: false;
      readonly error: ProviderError;
      readonly attempts: number;
      readonly durationMs: number;
      readonly circuitState: CircuitState;
      readonly fallbackEligible: boolean;
      readonly cooldownUntilMs?: number;
    };

export type DeadlineContext = {
  readonly deadlineMs: number;
  readonly nowMs?: () => number;
};

export type FallbackContext = {
  readonly providerId: string;
  readonly error: ProviderError;
  readonly attempts: number;
  readonly staleFallbackAllowed: boolean;
  readonly circuitState: CircuitState;
};

export type FallbackDecision =
  | { readonly action: 'none' }
  | { readonly action: 'try_alternate'; readonly reason: string }
  | { readonly action: 'use_stale_cache'; readonly reason: string };

export type FallbackHook = (context: FallbackContext) => FallbackDecision;

export type Clock = {
  readonly nowMs: () => number;
  readonly sleep: (ms: number) => Promise<void>;
};

export const defaultClock = (): Clock => ({
  nowMs: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
});

export function isSafeReadMethod(method: HttpMethod): boolean {
  return method === 'GET' || method === 'HEAD';
}
