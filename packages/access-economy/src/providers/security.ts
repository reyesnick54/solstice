/**
 * ACCESS-14 — Provider security interfaces.
 *
 * Credentials flow through existing secret infrastructure. Simulation
 * adapters require no secrets.
 */

import type { AccessProviderId } from './types.ts';

export type ProviderCredentialRef = {
  readonly secretRef: string;
  readonly providerId: AccessProviderId;
  readonly kind: 'API_KEY' | 'OAUTH_CLIENT' | 'WEBHOOK_SIGNING_KEY';
};

export type ProviderCredentialPort = {
  readonly getCredential: (ref: ProviderCredentialRef) => Promise<string | null>;
  readonly rotateCredential: (ref: ProviderCredentialRef) => Promise<void>;
};

export type ProviderRateLimitPolicy = {
  readonly maxRequestsPerMinute: number;
  readonly burst: number;
};

export type ProviderRetryPolicy = {
  readonly maxAttempts: number;
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
};

export type ProviderCircuitBreakerPolicy = {
  readonly failureThreshold: number;
  readonly resetAfterMs: number;
};

export type ProviderTimeoutPolicy = {
  readonly requestTimeoutMs: number;
};

export type ProviderSecurityPolicy = {
  readonly rateLimit: ProviderRateLimitPolicy;
  readonly retry: ProviderRetryPolicy;
  readonly circuitBreaker: ProviderCircuitBreakerPolicy;
  readonly timeout: ProviderTimeoutPolicy;
};

export const DEFAULT_PROVIDER_SECURITY_POLICY: ProviderSecurityPolicy = Object.freeze({
  rateLimit: Object.freeze({ maxRequestsPerMinute: 120, burst: 20 }),
  retry: Object.freeze({ maxAttempts: 3, baseDelayMs: 250, maxDelayMs: 4_000 }),
  circuitBreaker: Object.freeze({ failureThreshold: 5, resetAfterMs: 30_000 }),
  timeout: Object.freeze({ requestTimeoutMs: 15_000 }),
});

export type WebhookSignatureVerifier = {
  readonly verify: (input: {
    readonly providerId: AccessProviderId;
    readonly payload: string;
    readonly signature: string | null;
    readonly timestamp: string | null;
  }) => boolean;
};

export class SimulationWebhookSignatureVerifier implements WebhookSignatureVerifier {
  verify(input: {
    readonly providerId: AccessProviderId;
    readonly payload: string;
    readonly signature: string | null;
    readonly timestamp: string | null;
    readonly simulationOnly?: boolean;
  }): boolean {
    if (input.simulationOnly === false) {
      return input.signature !== null && input.signature.length > 0;
    }
    return true;
  }
}

export class NoOpProviderCredentialPort implements ProviderCredentialPort {
  async getCredential(): Promise<string | null> {
    return null;
  }

  async rotateCredential(): Promise<void> {
    return;
  }
}
