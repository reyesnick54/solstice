// @ts-nocheck
/**
 * Wave 4 — REST connector implementation with fixture simulation mode.
 */

import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { ProviderDefinition } from './provider-definition.ts';
import type {
  ConnectorFetchResult,
  ConnectorRequestContext,
  GovernedConnector,
} from './governed-connector.ts';
import { assertGovernedConnectorDoesNotMint } from './governed-connector.ts';
import type { ProviderLineageRecord } from './lineage.ts';
import type { ProviderOperationalHealth } from './operational-health.ts';
import {
  createOperationalHealth,
  mapTransportErrorToHealth,
} from './operational-health.ts';
import { ProviderReliabilityControlPlane } from '../reliability.ts';
import {
  createFetchProviderTransport,
  type FetchLike,
} from '../transport.ts';
import { createProviderTransportConfig } from '../config.ts';
import { NO_AUTH_PROVIDER_RESOLVER } from '../auth.ts';
import type { ProviderAuthStrategy } from '../auth.ts';
import { SecretBackedProviderAuthResolver } from '../auth.ts';
import type { SecretProvider } from '../../../security/src/secrets.ts';
import { hashRawPayload } from '../hash.ts';

export type RestConnectorFixture = {
  readonly operation: string;
  readonly filename: string;
};

export type RestConnectorOptions = {
  readonly definition: ProviderDefinition;
  readonly connectorId?: string;
  readonly fixturesDir?: string;
  readonly fixtures?: readonly RestConnectorFixture[];
  readonly reliability?: ProviderReliabilityControlPlane;
  readonly secrets?: SecretProvider;
  readonly authStrategy?: ProviderAuthStrategy;
  readonly fetchFn?: FetchLike;
  readonly simulationOnly?: boolean;
  readonly lineage?: ProviderLineageRecord | null;
  readonly pathForOperation?: (operation: string, params: unknown) => string;
  readonly disabled?: boolean;
  readonly forceTimeout?: boolean;
  readonly forceRateLimit?: boolean;
  readonly forceAuthFailure?: boolean;
  readonly forceSchemaFailure?: boolean;
};

const NORMALIZATION_VERSION = 'sunrey.wave4.connector.v1';

export class RestGovernedConnector implements GovernedConnector {
  readonly definition: ProviderDefinition;
  readonly connectorId: string;
  readonly #fixturesDir: string;
  readonly #fixtureMap: ReadonlyMap<string, string>;
  readonly #reliability: ProviderReliabilityControlPlane;
  readonly #secrets?: SecretProvider;
  readonly #authStrategy: ProviderAuthStrategy;
  readonly #fetchFn?: FetchLike;
  readonly #simulationOnly: boolean;
  readonly #lineage: ProviderLineageRecord | null;
  readonly #pathForOperation?: RestConnectorOptions['pathForOperation'];
  readonly #disabled: boolean;
  readonly #forceTimeout: boolean;
  readonly #forceRateLimit: boolean;
  readonly #forceAuthFailure: boolean;
  readonly #forceSchemaFailure: boolean;
  #health: ProviderOperationalHealth;
  #consecutiveFailures = 0;
  #lastSuccessAt: string | null = null;

  constructor(options: RestConnectorOptions) {
    this.definition = options.definition;
    this.connectorId = options.connectorId ?? `rest:${options.definition.providerId}`;
    this.#fixturesDir =
      options.fixturesDir ??
      join(dirname(fileURLToPath(import.meta.url)), 'fixtures', options.definition.providerId);
    this.#fixtureMap = new Map(
      (options.fixtures ?? []).map((f) => [f.operation, f.filename]),
    );
    this.#reliability = options.reliability ?? new ProviderReliabilityControlPlane();
    this.#secrets = options.secrets;
    this.#authStrategy = options.authStrategy ?? { kind: 'none' };
    this.#fetchFn = options.fetchFn;
    this.#simulationOnly = options.simulationOnly ?? true;
    this.#lineage = options.lineage ?? null;
    this.#pathForOperation = options.pathForOperation;
    this.#disabled = options.disabled ?? false;
    this.#forceTimeout = options.forceTimeout ?? false;
    this.#forceRateLimit = options.forceRateLimit ?? false;
    this.#forceAuthFailure = options.forceAuthFailure ?? false;
    this.#forceSchemaFailure = options.forceSchemaFailure ?? false;
    this.#health = createOperationalHealth({
      providerId: options.definition.providerId,
      state: this.#disabled ? 'DISABLED' : 'AVAILABLE',
      checkedAt: new Date().toISOString(),
      message: this.#disabled ? 'provider disabled' : 'initialized',
    });
    assertGovernedConnectorDoesNotMint(this);
  }

  async fetch<T = unknown>(
    operation: string,
    params: unknown,
    context: ConnectorRequestContext,
  ): Promise<ConnectorFetchResult<T>> {
    const started = Date.now();
    if (this.#disabled) {
      return this.#fail('PROVIDER_DISABLED', 'provider is disabled', context, started, 1);
    }
    if (!this.definition.enabledEnvironments.includes(context.environment)) {
      return this.#fail(
        'ENVIRONMENT_RESTRICTED',
        `provider not enabled for ${context.environment}`,
        context,
        started,
        1,
      );
    }
    if (this.#forceTimeout) {
      return this.#failAndUpdateHealth('TIMEOUT', 'forced timeout', context, started, 1);
    }
    if (this.#forceRateLimit) {
      return this.#failAndUpdateHealth('RATE_LIMITED', 'forced rate limit', context, started, 1);
    }
    if (this.#forceAuthFailure) {
      return this.#failAndUpdateHealth('AUTH_FAILURE', 'forced auth failure', context, started, 1);
    }
    if (this.#forceSchemaFailure) {
      return this.#failAndUpdateHealth('SCHEMA_CHANGED', 'forced schema failure', context, started, 1);
    }

    if (this.#simulationOnly || context.environment === 'simulation') {
      return this.#fetchFixture<T>(operation, context, started);
    }

    return this.#fetchLive<T>(operation, params, context, started);
  }

  getOperationalHealth(): ProviderOperationalHealth {
    return this.#health;
  }

  getLineage(): ProviderLineageRecord | null {
    return this.#lineage;
  }

  #fetchFixture<T>(
    operation: string,
    context: ConnectorRequestContext,
    started: number,
  ): ConnectorFetchResult<T> {
    const filename = this.#fixtureMap.get(operation);
    if (!filename) {
      return this.#failAndUpdateHealth(
        'OPERATION_NOT_SUPPORTED',
        `no fixture for operation '${operation}'`,
        context,
        started,
        1,
      );
    }
    try {
      const raw = readFileSync(join(this.#fixturesDir, filename), 'utf8');
      const data = JSON.parse(raw) as T;
      const hash = hashRawPayload(raw);
      this.#recordSuccess(context.nowUtc, Date.now() - started);
      return Object.freeze({
        ok: true,
        data,
        handoff: Object.freeze({
          providerId: this.definition.providerId,
          operation,
          rawPayloadHash: hash.digest,
          providerSchemaVersion: 'fixture',
          normalizationVersion: NORMALIZATION_VERSION,
          transportRetryIdentity: context.transportRetryIdentity,
          capturedRaw: null,
          httpStatus: 200,
          contentType: 'application/json',
        }),
        attemptCount: 1,
        latencyMs: Date.now() - started,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return this.#failAndUpdateHealth('INVALID_PAYLOAD', message, context, started, 1);
    }
  }

  async #fetchLive<T>(
    operation: string,
    params: unknown,
    context: ConnectorRequestContext,
    started: number,
  ): Promise<ConnectorFetchResult<T>> {
    const baseUrl = this.definition.baseEndpoint;
    if (!baseUrl) {
      return this.#fail('ENDPOINT_NOT_CONFIGURED', 'missing baseEndpoint', context, started, 1);
    }

    const path = this.#pathForOperation?.(operation, params) ?? `/${operation}`;
    const authResolver =
      this.#secrets
        ? new SecretBackedProviderAuthResolver({ secrets: this.#secrets })
        : NO_AUTH_PROVIDER_RESOLVER;

    const transport = createFetchProviderTransport({
      config: createProviderTransportConfig({
        serviceVersion: NORMALIZATION_VERSION,
        environment: context.environment === 'production_candidate' ? 'preview' : 'test',
        endpoint: {
          providerId: this.definition.providerId,
          baseUrl,
          defaultTimeoutMs: 15_000,
        },
      }),
      authResolver,
      authStrategy: this.#authStrategy,
      fetchFn: this.#fetchFn,
    });

    const reliabilityTransport: import('../reliability-types.ts').ReliabilityTransport = {
      providerId: this.definition.providerId,
      execute: async (request) => {
        const response = await transport.request<unknown>({
          providerId: this.definition.providerId,
          requestId: context.requestId,
          method: request.method === 'GET' || request.method === 'HEAD' ? request.method : 'GET',
          path: request.path,
          headers: request.headers ?? { Accept: 'application/json' },
        });
        if (!response.ok) {
          const status = response.error.httpStatus ?? 503;
          return {
            status,
            headers: {},
            body: response.error.message,
          };
        }
        return {
          status: response.value.metadata.httpStatus,
          headers: {},
          body: response.value.parsed ?? response.value.body,
        };
      },
    };

    const outcome = await this.#reliability.execute(
      reliabilityTransport,
      {
        method: 'GET',
        path,
        idempotent: true,
        headers: { Accept: 'application/json' },
      },
    );

    const latencyMs = Date.now() - started;
    if (!outcome.ok) {
      return this.#failAndUpdateHealth(
        outcome.error.code,
        outcome.error.message,
        context,
        started,
        outcome.attempts,
      );
    }

    const body =
      typeof outcome.value.body === 'string'
        ? outcome.value.body
        : JSON.stringify(outcome.value.body);
    const hash = hashRawPayload(body);
    let data: T;
    try {
      data = JSON.parse(body) as T;
    } catch {
      return this.#failAndUpdateHealth(
        'INVALID_PAYLOAD',
        'response is not JSON',
        context,
        started,
        outcome.attempts,
      );
    }

    this.#recordSuccess(context.nowUtc, latencyMs);
    return Object.freeze({
      ok: true,
      data,
      handoff: Object.freeze({
        providerId: this.definition.providerId,
        operation,
        rawPayloadHash: hash.digest,
        providerSchemaVersion: this.definition.schemaVersion,
        normalizationVersion: NORMALIZATION_VERSION,
        transportRetryIdentity: context.transportRetryIdentity,
        capturedRaw: null,
        httpStatus: outcome.value.status,
        contentType: 'application/json',
      }),
      attemptCount: outcome.attempts,
      latencyMs,
    });
  }

  #fail(
    code: string,
    message: string,
    context: ConnectorRequestContext,
    started: number,
    attemptCount: number,
  ): ConnectorFetchResult {
    return Object.freeze({
      ok: false,
      code,
      message,
      attemptCount,
      latencyMs: Date.now() - started,
      transportRetryIdentity: context.transportRetryIdentity,
    });
  }

  #failAndUpdateHealth(
    code: string,
    message: string,
    context: ConnectorRequestContext,
    started: number,
    attemptCount: number,
  ): ConnectorFetchResult {
    this.#consecutiveFailures += 1;
    const state = mapTransportErrorToHealth(code);
    this.#health = createOperationalHealth({
      providerId: this.definition.providerId,
      state,
      checkedAt: context.nowUtc,
      message,
      latencyMs: Date.now() - started,
      consecutiveFailures: this.#consecutiveFailures,
      lastSuccessAt: this.#lastSuccessAt,
      lastErrorCode: code,
    });
    return this.#fail(code, message, context, started, attemptCount);
  }

  #recordSuccess(nowUtc: string, latencyMs: number): void {
    this.#consecutiveFailures = 0;
    this.#lastSuccessAt = nowUtc;
    this.#health = createOperationalHealth({
      providerId: this.definition.providerId,
      state: 'AVAILABLE',
      checkedAt: nowUtc,
      message: 'last fetch succeeded',
      latencyMs,
      consecutiveFailures: 0,
      lastSuccessAt: nowUtc,
      lastErrorCode: null,
    });
  }
}

export function buildTransportRetryIdentity(input: {
  readonly providerId: string;
  readonly operation: string;
  readonly correlationId: string;
  readonly paramsDigest?: string;
}): string {
  const material = [
    input.providerId,
    input.operation,
    input.correlationId,
    input.paramsDigest ?? '',
  ].join('|');
  return createHash('sha256').update(material).digest('hex');
}

export function createConnectorRequestContext(input: {
  readonly operation: string;
  readonly providerId: string;
  readonly correlationId?: string;
  readonly environment?: ConnectorRequestContext['environment'];
  readonly nowUtc?: string;
  readonly params?: unknown;
}): ConnectorRequestContext {
  const correlationId = input.correlationId ?? randomUUID();
  const paramsDigest =
    input.params !== undefined
      ? createHash('sha256').update(JSON.stringify(input.params)).digest('hex')
      : undefined;
  return Object.freeze({
    requestId: randomUUID(),
    correlationId,
    operation: input.operation,
    environment: input.environment ?? 'simulation',
    nowUtc: input.nowUtc ?? new Date().toISOString(),
    transportRetryIdentity: buildTransportRetryIdentity({
      providerId: input.providerId,
      operation: input.operation,
      correlationId,
      paramsDigest,
    }),
  });
}
