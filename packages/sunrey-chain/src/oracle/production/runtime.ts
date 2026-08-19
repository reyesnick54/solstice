/**
 * Off-chain economic data connector runtime.
 *
 * External Provider → transport → schema validation → provenance →
 * CanonicalCollectedObservation draft. This never finalizes an oracle
 * fact and never mints MoonRey. Consensus does not import this module.
 */

import { err, ok, type Result } from '../../../../domain/src/result.ts';
import { normalizeAgainstCanonicalCatalog, normalizeExternalInteger } from './normalize.ts';
import { provenanceCommitment, recordProvenance } from './provenance.ts';
import { validateExternalRecord, type ExternalSourceRecord } from './schema.ts';
import { ConnectorCircuitBreaker, type CircuitBreakerPolicy, DEFAULT_CIRCUIT_BREAKER_POLICY } from './circuit-breaker.ts';
import { ConnectorObservability, classifyHttpStatus, classifyRejection } from './observability.ts';
import { ConnectorRateLimiter, DEFAULT_RATE_LIMIT_POLICY, type RateLimitPolicy } from './rate-limit.ts';
import { DEFAULT_RETRY_POLICY, isRetryableRejection, retryDelayMs, sleepMs, type RetryPolicy } from './retry.ts';
import {
  approveEndpointProfile,
  destinationMatchesProfile,
  enforceSsrfPolicy,
  enforceTlsPolicy,
  governRedirect,
  parseDestination,
} from './security-policy.ts';
import { OauthTokenCache, prepareAuthenticatedRequest, profileUrl } from './auth-runtime.ts';
import { headerValue } from './transport.ts';
import type { ProductiveCategory } from '../../productive/types.ts';
import type {
  CanonicalCollectedObservation,
  DataSourceCategory,
  ProductionOracleRejection,
} from './types.ts';
import { CONNECTOR_VERSION, CANONICAL_NORMALIZATION_VERSION } from './types.ts';
import type {
  ConnectorAuthConfig,
  ConnectorClock,
  ConnectorFetchSuccess,
  ConnectorHttpMethod,
  ConnectorRandom,
  ConnectorRuntimeConfig,
  ConnectorRuntimeContext,
  ExternalHttpResponse,
  ExternalHttpTransport,
  OracleSourceAdapterV2,
  ProviderEndpointProfile,
  SourceFetchRequestV2,
} from './runtime-types.ts';
import {
  ALLOWED_CONTENT_TYPES,
  DEFAULT_CONNECTOR_RUNTIME_CONFIG,
  FETCH_AUTO_FINALIZED_ORACLE,
  FETCH_AUTO_MINTED_MOONREY,
} from './runtime-types.ts';

export type ConnectorRuntimeDependencies = {
  readonly config?: ConnectorRuntimeConfig;
  readonly transport: ExternalHttpTransport;
  readonly clock: ConnectorClock;
  readonly random: ConnectorRandom;
  readonly retry?: RetryPolicy;
  readonly rateLimit?: RateLimitPolicy;
  readonly circuit?: CircuitBreakerPolicy;
  readonly sleeper?: (ms: number) => Promise<void>;
};

export class EconomicDataConnectorRuntime {
  readonly config: ConnectorRuntimeConfig;
  readonly observability = new ConnectorObservability();
  private readonly transport: ExternalHttpTransport;
  private readonly clock: ConnectorClock;
  private readonly random: ConnectorRandom;
  private readonly retry: RetryPolicy;
  private readonly rateLimiter: ConnectorRateLimiter;
  private readonly circuit: ConnectorCircuitBreaker;
  private readonly oauthCache = new OauthTokenCache();
  private readonly sleeper: ((ms: number) => Promise<void>) | undefined;

  constructor(deps: ConnectorRuntimeDependencies) {
    this.config = deps.config ?? DEFAULT_CONNECTOR_RUNTIME_CONFIG;
    this.transport = deps.transport;
    this.clock = deps.clock;
    this.random = deps.random;
    this.retry = deps.retry ?? DEFAULT_RETRY_POLICY;
    this.rateLimiter = new ConnectorRateLimiter(deps.rateLimit ?? DEFAULT_RATE_LIMIT_POLICY, deps.clock);
    this.circuit = new ConnectorCircuitBreaker(deps.circuit ?? DEFAULT_CIRCUIT_BREAKER_POLICY, deps.clock);
    this.sleeper = deps.sleeper;
  }

  context(input: { readonly secrets: ConnectorRuntimeContext['secrets']; readonly auth: ConnectorAuthConfig }): ConnectorRuntimeContext {
    return {
      config: this.config,
      transport: this.transport,
      secrets: input.secrets,
      clock: this.clock,
      random: this.random,
      auth: input.auth,
    };
  }

  async collect(input: {
    readonly request: SourceFetchRequestV2;
    readonly secrets: ConnectorRuntimeContext['secrets'];
    readonly auth: ConnectorAuthConfig;
    readonly method?: ConnectorHttpMethod;
  }): Promise<Result<ConnectorFetchSuccess, ProductionOracleRejection>> {
    const startedMs = this.clock.nowMs();
    this.observability.recordAttempt();
    const collected = await this.collectInner(input);
    this.observability.recordLatency(Number(this.clock.nowMs() - startedMs));
    const attemptCount = this.retry.maxAttempts;
    if (collected.ok) {
      this.circuit.recordSuccess(input.request.source.providerId, input.request.source.sourceId);
      this.observability.recordSuccess({
        providerId: input.request.source.providerId,
        sourceId: input.request.source.sourceId,
        requestProfileId: input.request.endpointProfile.profileId,
        status: 'ACCEPTED',
        attemptCount,
        responseClass: 'SUCCESS',
        schemaResult: 'VALID',
        provenanceHash: provenanceCommitment(collected.value.provenance),
        timestampUnix: input.request.nowUnix,
        rejectionCode: null,
        payloadPersisted: false,
      });
      return collected;
    }
    this.circuit.recordFailure(input.request.source.providerId, input.request.source.sourceId);
    this.observability.recordFailure(collected.error.code, {
      providerId: input.request.source.providerId,
      sourceId: input.request.source.sourceId,
      requestProfileId: input.request.endpointProfile.profileId,
      status: 'REJECTED',
      attemptCount,
      responseClass: classifyRejection(collected.error.code),
      schemaResult:
        collected.error.code === 'SCHEMA_INCOMPATIBLE' ||
        collected.error.code === 'SCHEMA_DRIFT' ||
        collected.error.code === 'SOURCE_RECORD_INVALID'
          ? 'INVALID'
          : 'NOT_EVALUATED',
      provenanceHash: null,
      timestampUnix: input.request.nowUnix,
      rejectionCode: collected.error.code,
      payloadPersisted: false,
    });
    return collected;
  }

  private async collectInner(input: {
    readonly request: SourceFetchRequestV2;
    readonly secrets: ConnectorRuntimeContext['secrets'];
    readonly auth: ConnectorAuthConfig;
    readonly method?: ConnectorHttpMethod;
  }): Promise<Result<ConnectorFetchSuccess, ProductionOracleRejection>> {
    const connectivity = this.ensureConnectivity();
    if (!connectivity.ok) {
      return connectivity;
    }
    if (this.transport.contactsPublicInternet && (this.config.mode === 'FIXTURE' || this.config.mode === 'SANDBOX')) {
      return err({
        code: 'CONNECTIVITY_DISABLED',
        detail: `${this.config.mode} cannot use a public-internet transport`,
      });
    }
    const profile = input.request.endpointProfile;
    const approved = approveEndpointProfile(profile, input.request.source.sourceId, input.request.source.providerId);
    if (!approved.ok) {
      return approved;
    }
    if (profile.authenticationClass !== input.request.source.authenticationMethod) {
      return err({
        code: 'ENDPOINT_NOT_APPROVED',
        detail: 'endpoint authentication class does not match the economic data source',
      });
    }
    const opened = this.circuit.guard(input.request.source.providerId, input.request.source.sourceId);
    if (!opened.ok) {
      return opened;
    }
    const limited = this.rateLimiter.acquire(input.request.source.providerId, input.request.source.sourceId);
    if (!limited.ok) {
      return limited;
    }

    const method = input.method ?? profile.allowedMethods[0];
    if (!method || !profile.allowedMethods.includes(method)) {
      return err({ code: 'ENDPOINT_NOT_APPROVED', detail: 'HTTP method is not on the approved profile' });
    }
    const url = profileUrl(profile);
    const destination = parseDestination(url);
    if (!destination.ok) {
      return destination;
    }
    const matched = destinationMatchesProfile(destination.value, profile);
    if (!matched.ok) {
      return matched;
    }
    const ssrf = enforceSsrfPolicy(destination.value, profile, this.config.mode);
    if (!ssrf.ok) {
      return ssrf;
    }
    const tls = enforceTlsPolicy(destination.value, profile);
    if (!tls.ok) {
      return tls;
    }

    const prepared = await prepareAuthenticatedRequest({
      method,
      url,
      body: undefined,
      sourceId: input.request.source.sourceId,
      identity: input.request.identity,
      authenticationClass: input.request.source.authenticationMethod,
      profile,
      auth: input.auth,
      secrets: input.secrets,
      transport: this.transport,
      clock: this.clock,
      oauthCache: this.oauthCache,
      nowUnix: input.request.nowUnix,
    });
    if (!prepared.ok) {
      return prepared;
    }

    const fetched = await this.fetchWithRetry(prepared.value, profile);
    if (!fetched.ok) {
      return fetched;
    }
    const parsed = parseJsonSourceRecord(fetched.value.body, this.config.maximumArrayLength, profile.maximumResponseBytes);
    if (!parsed.ok) {
      return parsed;
    }
    const validated = validateExternalRecord(input.request.feed.schema, parsed.value);
    if (!validated.ok) {
      return validated;
    }
    const timestamps = enforceSourceTimestamp(
      validated.value.sourceTimestampUnix,
      input.request.nowUnix,
      input.request.feed.maximumAgeSeconds,
    );
    if (!timestamps.ok) {
      return timestamps;
    }
    const normalized = normalizeExternalInteger({
      sourceValue: validated.value.numericValue,
      sourceUnit: input.request.feed.measurementUnit,
      targetUnit: input.request.feed.measurementUnit,
      targetScale: input.request.feed.quantityScale,
    });
    if (!normalized.ok) {
      return normalized;
    }
    const provenance = recordProvenance({
      providerId: input.request.source.providerId,
      sourceId: input.request.source.sourceId,
      sourceObservationId: `${input.request.source.sourceId}:${validated.value.sourceTimestampUnix}`,
      collectionTimestampUnix: input.request.nowUnix,
      sourceTimestampUnix: timestamps.value,
      schemaVersionRecord: validated.value.schemaVersion,
      unit: input.request.feed.measurementUnit,
      normalizationVersion: CANONICAL_NORMALIZATION_VERSION,
      credentialRefHref: input.request.source.credentialRef?.href ?? null,
      authMethod: input.request.source.authenticationMethod,
      payload: validated.value,
      collectorVersion: CONNECTOR_VERSION,
    });
    if (provenance.contentHash.length === 0) {
      return err({ code: 'PROVENANCE_HASH_FAILED', detail: 'canonical content hash was empty' });
    }
    const catalog = normalizeAgainstCanonicalCatalog({
      sourceValue: validated.value.numericValue,
      sourceUnit: input.request.feed.measurementUnit,
      productiveCategory: productiveCategoryForSource(input.request.source.category),
      factType: input.request.source.factType,
      measurementStart: timestamps.value,
      measurementEnd: timestamps.value,
    });
    const canonical: CanonicalCollectedObservation = Object.freeze({
      schemaVersion: 1,
      observationDraftId: `draft_${provenance.contentHash.slice(0, 24)}`,
      providerId: input.request.source.providerId,
      sourceId: input.request.source.sourceId,
      feedId: input.request.feed.feedId,
      subject: input.request.subject,
      value: normalized.value,
      sourceValue: normalized.value,
      ...(catalog.ok ? { canonicalMeasurement: catalog.value.measurement } : {}),
      provenance,
    });
    return ok(
      Object.freeze({
        record: validated.value,
        canonical,
        provenance,
        verifiedEconomicFact: null,
        productiveContribution: null,
        productiveValue: null,
        moonreyIssuance: null,
        finalizedOracle: FETCH_AUTO_FINALIZED_ORACLE,
        mintedMoonRey: FETCH_AUTO_MINTED_MOONREY,
        collectorVersion: CONNECTOR_VERSION,
      }),
    );
  }

  private ensureConnectivity(): Result<true, ProductionOracleRejection> {
    if (this.config.mainnetConnectivity !== 'DISABLED' && this.config.mainnetConnectivity !== 'UNCONFIGURED') {
      return err({ code: 'CONNECTIVITY_DISABLED', detail: 'mainnet connectivity is not a boolean production flag' });
    }
    if (this.config.mode === 'FIXTURE' || this.config.mode === 'SANDBOX') {
      return ok(true);
    }
    if (this.config.mode === 'TESTNET_EXTERNAL') {
      if (this.config.externalNetworkEnabled !== true) {
        return err({
          code: 'CONNECTIVITY_DISABLED',
          detail: 'TESTNET_EXTERNAL requires explicit externalNetworkEnabled',
        });
      }
      return ok(true);
    }
    if (this.config.mode === 'PRODUCTION_CANDIDATE_EXTERNAL') {
      if (this.config.externalNetworkEnabled !== true || this.config.productionCandidateExternalConfigured !== true) {
        return err({
          code: 'CONNECTIVITY_DISABLED',
          detail: 'PRODUCTION_CANDIDATE_EXTERNAL remains DISABLED / UNCONFIGURED',
        });
      }
      return ok(true);
    }
    return err({ code: 'CONNECTIVITY_DISABLED', detail: 'unknown connector runtime mode' });
  }

  private async fetchWithRetry(
    prepared: {
      readonly method: ConnectorHttpMethod;
      readonly url: string;
      readonly headers: Readonly<Record<string, string>>;
      readonly body?: string;
      readonly clientCertificatePresent: boolean;
    },
    profile: ProviderEndpointProfile,
  ): Promise<Result<ExternalHttpResponse, ProductionOracleRejection>> {
    let last: Result<ExternalHttpResponse, ProductionOracleRejection> = err({
      code: 'CONNECTIVITY_DISABLED',
      detail: 'no attempts executed',
    });
    for (let attempt = 0; attempt < this.retry.maxAttempts; attempt += 1) {
      const response = await this.dispatch(prepared, profile);
      last = response;
      if (response.ok) {
        if (response.value.status === 429) {
          const retryAfter = Number(headerValue(response.value.headers, 'retry-after') ?? '0');
          if (Number.isFinite(retryAfter) && retryAfter > 0) {
            this.rateLimiter.applyRetryAfter(profile.providerId, profile.sourceId, retryAfter);
          }
          last = err({ code: 'RATE_LIMITED', detail: 'provider returned 429' });
        } else if (response.value.status >= 500) {
          last = err({ code: 'HTTP_STATUS_REJECTED', detail: `provider returned ${response.value.status}` });
        } else if (response.value.status >= 400) {
          return err({ code: 'HTTP_STATUS_REJECTED', detail: `provider returned ${response.value.status}` });
        } else {
          const contentType = headerValue(response.value.headers, 'content-type') ?? '';
          if (!ALLOWED_CONTENT_TYPES.some((allowed) => contentType.toLowerCase().startsWith(allowed))) {
            return err({ code: 'CONTENT_TYPE_INVALID', detail: contentType || 'missing content-type' });
          }
          if (Buffer.byteLength(response.value.body, 'utf8') > profile.maximumResponseBytes) {
            return err({
              code: 'RESPONSE_TOO_LARGE',
              detail: `response exceeded ${profile.maximumResponseBytes} bytes`,
            });
          }
          return response;
        }
      }
      const status = response.ok ? response.value.status : undefined;
      const failure = last.ok ? err({ code: 'HTTP_STATUS_REJECTED', detail: 'unexpected success' }) : last;
      if (attempt + 1 >= this.retry.maxAttempts || !isRetryableRejection(failure.error, status)) {
        return failure;
      }
      await sleepMs(this.clock, retryDelayMs(this.retry, attempt, this.random), this.sleeper);
    }
    return last;
  }

  private async dispatch(
    prepared: {
      readonly method: ConnectorHttpMethod;
      readonly url: string;
      readonly headers: Readonly<Record<string, string>>;
      readonly body?: string;
      readonly clientCertificatePresent: boolean;
    },
    profile: ProviderEndpointProfile,
  ): Promise<Result<ExternalHttpResponse, ProductionOracleRejection>> {
    let url = prepared.url;
    let hops = 0;
    while (true) {
      const response = await this.transport.request({
        method: prepared.method,
        url,
        headers: prepared.headers,
        body: prepared.body,
        timeoutMs: profile.timeoutMs,
        maximumResponseBytes: profile.maximumResponseBytes,
        tls: { rejectUnauthorized: true, clientCertificatePresent: prepared.clientCertificatePresent },
      });
      if (!response.ok) {
        return response;
      }
      if (response.value.status >= 300 && response.value.status < 400) {
        const location = headerValue(response.value.headers, 'location');
        if (!location) {
          return err({ code: 'SSRF_DESTINATION_FORBIDDEN', detail: 'redirect omitted Location' });
        }
        const current = parseDestination(url);
        if (!current.ok) {
          return current;
        }
        const next = governRedirect(current.value, location, profile, hops, this.config.mode);
        if (!next.ok) {
          return next;
        }
        url = next.value.href;
        hops += 1;
        continue;
      }
      return ok(
        Object.freeze({
          ...response.value,
          finalUrl: url,
          redirected: hops > 0,
        }),
      );
    }
  }
}

export class ConnectorRuntimeAdapterV2 implements OracleSourceAdapterV2 {
  readonly adapterId: string;
  readonly adapterContract = 'v2' as const;
  readonly authenticationClass: SourceFetchRequestV2['source']['authenticationMethod'];
  private readonly runtime: EconomicDataConnectorRuntime;
  private readonly secrets: ConnectorRuntimeContext['secrets'];
  private readonly auth: ConnectorAuthConfig;

  constructor(
    runtime: EconomicDataConnectorRuntime,
    authenticationClass: SourceFetchRequestV2['source']['authenticationMethod'],
    secrets: ConnectorRuntimeContext['secrets'],
    auth: ConnectorAuthConfig,
  ) {
    this.runtime = runtime;
    this.authenticationClass = authenticationClass;
    this.secrets = secrets;
    this.auth = auth;
    this.adapterId = `oracle.source.connector.${authenticationClass.toLowerCase()}`;
  }

  async retrieve(
    request: SourceFetchRequestV2,
    _context: ConnectorRuntimeContext,
  ): Promise<Result<ExternalSourceRecord, ProductionOracleRejection>> {
    const collected = await this.runtime.collect({ request, secrets: this.secrets, auth: this.auth });
    if (!collected.ok) {
      return collected;
    }
    return ok(collected.value.record);
  }
}

export function parseJsonSourceRecord(
  body: string,
  maxArrayLength: number,
  maxBytes: number,
): Result<ExternalSourceRecord, ProductionOracleRejection> {
  if (Buffer.byteLength(body, 'utf8') > maxBytes) {
    return err({ code: 'RESPONSE_TOO_LARGE', detail: `record exceeded ${maxBytes} bytes` });
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return err({ code: 'SOURCE_RECORD_INVALID', detail: 'response is not JSON' });
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return err({ code: 'SOURCE_RECORD_INVALID', detail: 'response is not a JSON object' });
  }
  const row = parsed as Record<string, unknown>;
  if (typeof row.identifier !== 'string' || typeof row.numericValue !== 'string' || typeof row.unit !== 'string') {
    return err({ code: 'SOURCE_RECORD_INVALID', detail: 'required string fields are missing' });
  }
  if (typeof row.sourceTimestampUnix !== 'string') {
    return err({ code: 'SOURCE_TIMESTAMP_MISSING', detail: 'source timestamp is required and must be a string' });
  }
  if (typeof row.schemaId !== 'string' || typeof row.schemaVersion !== 'number' || !Number.isInteger(row.schemaVersion)) {
    return err({ code: 'SOURCE_RECORD_INVALID', detail: 'schema identity is invalid' });
  }
  if (row.extras && typeof row.extras === 'object' && !Array.isArray(row.extras)) {
    for (const [key, value] of Object.entries(row.extras as Record<string, unknown>)) {
      if (Array.isArray(value) && value.length > maxArrayLength) {
        return err({ code: 'UNBOUNDED_ARRAY', detail: `${key} exceeds maxArrayLength ${maxArrayLength}` });
      }
    }
  }
  return ok(
    Object.freeze({
      identifier: row.identifier,
      numericValue: row.numericValue,
      unit: row.unit,
      sourceTimestampUnix: row.sourceTimestampUnix,
      schemaId: row.schemaId,
      schemaVersion: row.schemaVersion,
      ...(row.extras && typeof row.extras === 'object' && !Array.isArray(row.extras)
        ? { extras: row.extras as Readonly<Record<string, unknown>> }
        : {}),
    }),
  );
}

export function enforceSourceTimestamp(
  sourceTimestampUnix: string,
  collectionUnix: bigint,
  maximumAgeSeconds: number,
): Result<bigint, ProductionOracleRejection> {
  if (sourceTimestampUnix.length === 0) {
    return err({ code: 'SOURCE_TIMESTAMP_MISSING', detail: 'source timestamp is required' });
  }
  if (!/^-?\d+$/.test(sourceTimestampUnix)) {
    return err({ code: 'SOURCE_TIMESTAMP_MISSING', detail: 'source timestamp must be an integer unix second' });
  }
  const source = BigInt(sourceTimestampUnix);
  if (collectionUnix - source > BigInt(maximumAgeSeconds)) {
    return err({ code: 'SOURCE_TIMESTAMP_STALE', detail: 'source observation time is older than the feed maximum age' });
  }
  return ok(source);
}

function productiveCategoryForSource(category: DataSourceCategory): ProductiveCategory {
  switch (category) {
    case 'energy':
      return 'ENERGY';
    case 'food_agriculture':
      return 'FOOD_AGRICULTURE';
    case 'water':
      return 'WATER';
    case 'compute':
      return 'COMPUTE';
    case 'ai_usage':
    case 'ai_compute':
      return 'AI_COMPUTE';
    case 'manufacturing':
      return 'MANUFACTURING';
    case 'real_estate_use':
      return 'REAL_ESTATE_USE';
    case 'storage':
      return 'STORAGE';
    case 'logistics':
      return 'LOGISTICS_TRANSPORTATION';
    case 'bandwidth':
      return 'BANDWIDTH_COMMUNICATIONS';
    case 'resources':
    case 'minerals_resources':
      return 'MINERALS_RAW_MATERIALS';
    case 'service_delivery':
    case 'services':
      return 'SERVICES';
    case 'infrastructure':
      return 'INFRASTRUCTURE';
    case 'goods':
      return 'GOODS';
    case 'automated_machine_output':
      return 'AUTOMATED_MACHINE_OUTPUT';
    default:
      return 'ENERGY';
  }
}

export function createFrozenConnectorClock(nowUnix: bigint, nowMs = nowUnix * 1000n): ConnectorClock {
  return {
    nowUnix: () => nowUnix,
    nowMs: () => nowMs,
  };
}

export function createDeterministicRandom(sequence: readonly number[] = [0.25, 0.5, 0.75]): ConnectorRandom {
  let index = 0;
  return {
    nextUnitInterval() {
      const value = sequence[index % sequence.length] ?? 0;
      index += 1;
      return value;
    },
  };
}
