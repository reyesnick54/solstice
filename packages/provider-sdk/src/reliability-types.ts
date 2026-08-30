/**
 * Wave 1 Prompt 4 — provider reliability control plane types.
 * Wave 1 Prompt 4 — reliability-layer transport types.
 *
 * Distinct from HTTP transport types in http-transport-types.ts.
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

export type ReliabilityTransportRequest = {
  readonly method: HttpMethod;
  readonly path: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: unknown;
  readonly idempotent?: boolean;
};

export type ReliabilityTransportResponse = {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: unknown;
};

export type ReliabilityProviderTransport = {
/** Injectable transport wrapped by the reliability control plane. */
export type ReliabilityTransport = {
  readonly providerId: string;
  execute(
    request: ReliabilityTransportRequest,
    options?: { readonly signal?: AbortSignal; readonly deadlineMs?: number },
  ): Promise<ReliabilityTransportResponse>;
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

export type ReliabilityClock = {
  readonly nowMs: () => number;
  readonly sleep: (ms: number) => Promise<void>;
};

export const defaultClock = (): ReliabilityClock => ({
  nowMs: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
});

export function isSafeReadMethod(method: HttpMethod): boolean {
  return method === 'GET' || method === 'HEAD';
}

/** @deprecated Use ReliabilityTransportRequest */
export type ProviderTransportRequest = ReliabilityTransportRequest;
/** @deprecated Use ReliabilityTransportResponse */
export type ProviderTransportResponse = ReliabilityTransportResponse;
/** @deprecated Use ReliabilityProviderTransport */
export type ProviderTransport = ReliabilityProviderTransport;
/** @deprecated Use ReliabilityClock */
export type Clock = ReliabilityClock;
