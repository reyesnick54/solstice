/**
 * Deterministic local mock servers for every provider class touched by CI.
 */

import { createHash } from 'node:crypto';

import type { ProviderDomain } from '../providers/types.ts';
import { PROVIDER_DOMAINS } from '../providers/types.ts';
import type { MockScenario, ProviderCircuitState } from './types.ts';
import { runtimeErr, runtimeOk, type ProviderRuntimeResult } from './types.ts';

export type MockRequest = {
  readonly domain: ProviderDomain;
  readonly operation: string;
  readonly idempotencyKey?: string;
  readonly schemaVersion?: number;
  readonly body?: Readonly<Record<string, unknown>>;
};

export type MockResponse = {
  readonly status: ProviderCircuitState;
  readonly operation: string;
  readonly body: Readonly<Record<string, unknown>>;
  readonly providerTransactionRef: string | null;
  readonly secretValuePresent: false;
};

export class LocalProviderMockServer {
  readonly providerId: string;
  readonly domain: ProviderDomain;
  #scenario: MockScenario = 'healthy';
  readonly #seenCallbacks = new Set<string>();
  readonly #financialRefs = new Map<string, string>();
  #calls = 0;

  constructor(providerId: string, domain: ProviderDomain) {
    this.providerId = providerId;
    this.domain = domain;
  }

  setScenario(scenario: MockScenario): void {
    this.#scenario = scenario;
  }

  scenario(): MockScenario {
    return this.#scenario;
  }

  calls(): number {
    return this.#calls;
  }

  handle(request: MockRequest): ProviderRuntimeResult<MockResponse> {
    this.#calls += 1;
    if (request.domain !== this.domain) {
      return runtimeErr('MOCK_DOMAIN', `mock ${this.domain} cannot serve ${request.domain}`);
    }
    if (this.#scenario === 'timeout') {
      return runtimeErr('TIMEOUT', 'mock timeout');
    }
    if (this.#scenario === 'auth_failure') {
      return runtimeErr('AUTH_FAILED', 'mock auth failure');
    }
    if (this.#scenario === 'outage') {
      return runtimeErr('UNAVAILABLE', 'mock outage');
    }
    if (this.#scenario === 'rate_limit') {
      return runtimeErr('RATE_LIMITED', 'mock rate limit');
    }
    if (this.#scenario === 'schema_change' || (request.schemaVersion !== undefined && request.schemaVersion !== 1)) {
      return runtimeErr('SCHEMA_INCOMPATIBLE', 'schema change detected');
    }
    if (this.#scenario === 'partial_response') {
      return runtimeOk({
        status: 'DEGRADED',
        operation: request.operation,
        body: Object.freeze({ partial: true }),
        providerTransactionRef: null,
        secretValuePresent: false,
      });
    }
    if (request.operation === 'callback') {
      const nonce = String(request.body?.nonce ?? '');
      if (this.#scenario === 'duplicate_callback' || this.#seenCallbacks.has(nonce)) {
        return runtimeErr('WEBHOOK_REPLAY', 'duplicate callback');
      }
      this.#seenCallbacks.add(nonce);
    }
    if (request.idempotencyKey) {
      const existing = this.#financialRefs.get(request.idempotencyKey);
      if (existing) {
        return runtimeOk({
          status: 'HEALTHY',
          operation: request.operation,
          body: Object.freeze({ duplicate: true, ref: existing }),
          providerTransactionRef: existing,
          secretValuePresent: false,
        });
      }
      const ref = `pref_${createHash('sha256').update(request.idempotencyKey).digest('hex').slice(0, 16)}`;
      this.#financialRefs.set(request.idempotencyKey, ref);
      return runtimeOk({
        status: 'HEALTHY',
        operation: request.operation,
        body: Object.freeze({ accepted: true }),
        providerTransactionRef: ref,
        secretValuePresent: false,
      });
    }
    return runtimeOk({
      status: 'HEALTHY',
      operation: request.operation,
      body: Object.freeze({ ok: true, domain: this.domain, operation: request.operation }),
      providerTransactionRef: null,
      secretValuePresent: false,
    });
  }
}

export class LocalMockFleet {
  readonly #servers = new Map<ProviderDomain, LocalProviderMockServer>();

  constructor() {
    for (const domain of PROVIDER_DOMAINS) {
      this.#servers.set(domain, new LocalProviderMockServer(`mock_${domain.toLowerCase()}`, domain));
    }
  }

  get(domain: ProviderDomain): LocalProviderMockServer {
    const server = this.#servers.get(domain);
    if (!server) {
      throw new TypeError(`no mock for ${domain}`);
    }
    return server;
  }

  setAll(scenario: MockScenario): void {
    for (const server of this.#servers.values()) {
      server.setScenario(scenario);
    }
  }

  domains(): readonly ProviderDomain[] {
    return PROVIDER_DOMAINS;
  }
}
