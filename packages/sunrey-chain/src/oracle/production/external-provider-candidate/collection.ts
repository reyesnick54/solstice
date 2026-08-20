import { err, ok, type Result } from '../../../../../domain/src/result.ts';
import { sha256Hex } from '../../../../../security/src/hash.ts';
import type { ExternalSourceRecord } from '../schema.ts';
import type { FeedSchemaDefinition } from '../types.ts';
import { ConnectorCircuitBreaker } from '../circuit-breaker.ts';
import { ConnectorRateLimiter } from '../rate-limit.ts';
import { isRetryableRejection } from '../retry.ts';
import type { ExternalHttpTransport } from '../runtime-types.ts';
import { admitCollection } from '../economic-data-fabric/admission.ts';
import type { CollectionCandidate, EconomicDataCollectionEnvelope } from '../economic-data-fabric/types.ts';
import { issueOauthHandle, credentialIsExpired, assertOauthHandleNotPersisted } from './credentials.ts';
import { enforceApprovedDestination, governCandidateRedirect, toConnectorEndpointProfile } from './endpoints.ts';
import { advanceCursor, initialCursor, rejectInfinitePagination, retainPartialPage, type PartialCollectionOutcome } from './pagination.ts';
import { profileMayCollect } from './profiles.ts';
import { materializeApprovedUrl } from './requests.ts';
import { vendorDtoMustNotEscape, type ExternalProviderResponseTranslator } from './responses.ts';
import { referencePriceCannotCreateProductiveOutput } from './routing.ts';
import {
  candidateRejection,
  PROVIDER_SUCCESS_MINTS,
  type ExternalEconomicOracleProviderCandidateProfile,
  type ExternalProviderCredentialBinding,
  type ExternalProviderEndpointProfile,
  type ExternalProviderFeedProfile,
  type ExternalProviderRequestBlueprint,
  type ProviderCandidateRejection,
} from './types.ts';

export type CandidateCollectionSuccess = {
  readonly records: readonly ExternalSourceRecord[];
  readonly pagesCollected: number;
  readonly partial: PartialCollectionOutcome | null;
  readonly fabricEnvelopes: readonly EconomicDataCollectionEnvelope[];
  readonly oauthHandlePersisted: false;
  readonly credentialsPresent: false;
  readonly rawVendorDtoEscaped: false;
  readonly finalizedOracle: false;
  readonly mintedMoonRey: false;
  readonly productionAuthorized: false;
};

export async function collectCandidateFeed(input: {
  readonly profile: ExternalEconomicOracleProviderCandidateProfile;
  readonly feed: ExternalProviderFeedProfile;
  readonly endpoint: ExternalProviderEndpointProfile;
  readonly blueprint: ExternalProviderRequestBlueprint;
  readonly binding: ExternalProviderCredentialBinding;
  readonly translator: ExternalProviderResponseTranslator;
  readonly schema: FeedSchemaDefinition;
  readonly transport: ExternalHttpTransport;
  readonly rateLimiter: ConnectorRateLimiter;
  readonly circuitBreaker: ConnectorCircuitBreaker;
  readonly nowUnix: bigint;
  readonly pathParameters?: Readonly<Record<string, string>> | undefined;
}): Promise<Result<CandidateCollectionSuccess, ProviderCandidateRejection>> {
  const allowed = profileMayCollect(input.profile);
  if (!allowed.ok) {
    return allowed;
  }
  if (input.binding.providerId !== input.profile.providerId) {
    return err(candidateRejection('PROFILE_INVALID', 'credential binding provider mismatch'));
  }
  if (credentialIsExpired(input.binding, input.nowUnix)) {
    return err(candidateRejection('EXPIRED_CREDENTIAL', `${input.binding.descriptorRef} expired`));
  }
  if (referencePriceCannotCreateProductiveOutput(input.feed) && input.feed.productiveCategory !== null) {
    return err(candidateRejection('REFERENCE_PRICE_IS_NOT_PRODUCTIVE', 'reference price cannot become productive output'));
  }
  const connectorProfile = toConnectorEndpointProfile({
    endpoint: input.endpoint,
    sourceId: input.feed.sourceId,
    authenticationClass: input.binding.authenticationMethod,
  });
  if (!connectorProfile.ok) {
    return connectorProfile;
  }
  if (input.transport.contactsPublicInternet === true) {
    return err(candidateRejection('ARBITRARY_URL_FORBIDDEN', 'real network transports are forbidden on this plane'));
  }

  let handle = input.binding.authenticationMethod === 'OAUTH_CLIENT'
    ? issueOauthHandle({ providerId: input.profile.providerId, nowUnix: input.nowUnix })
    : null;
  if (handle) {
    const leaked = assertOauthHandleNotPersisted(handle);
    if (!leaked.ok) {
      return leaked;
    }
  }

  const records: ExternalSourceRecord[] = [];
  const envelopes: EconomicDataCollectionEnvelope[] = [];
  let cursor = initialCursor(input.feed.paginationMode);
  let pages = 0;
  let nextToken: string | null = null;

  while (true) {
    const bound = rejectInfinitePagination(pages + 1, input.feed.maxPages);
    if (!bound.ok) {
      return bound;
    }
    const guarded = input.circuitBreaker.guard(input.profile.providerId, input.feed.sourceId);
    if (!guarded.ok) {
      return err(candidateRejection('CIRCUIT_OPEN', guarded.error.detail));
    }
    const limited = input.rateLimiter.acquire(input.profile.providerId, input.feed.sourceId);
    if (!limited.ok) {
      return err(candidateRejection('RATE_LIMITED', limited.error.detail));
    }

    const query = { ...input.blueprint.queryTemplate };
    if (input.feed.paginationMode === 'CURSOR' && nextToken) {
      query.cursor = nextToken;
    }
    if (input.feed.paginationMode === 'PAGE_NUMBER') {
      query.page = String(pages + 1);
    }
    const href = materializeApprovedUrl({
      endpoint: input.endpoint,
      blueprint: { ...input.blueprint, queryTemplate: query },
      pathParameters: input.pathParameters,
    });
    if (!href.ok) {
      return href;
    }
    const approved = enforceApprovedDestination({
      href: href.value,
      endpoint: input.endpoint,
      connectorProfile: connectorProfile.value,
    });
    if (!approved.ok) {
      return approved;
    }

    const response = await input.transport.request({
      method: input.blueprint.method,
      url: href.value,
      headers: Object.freeze({
        accept: input.endpoint.expectedContentTypes[0] ?? 'application/json',
        ...(handle ? { 'x-oauth-handle': handle.handleId } : {}),
      }),
      timeoutMs: input.endpoint.timeoutMs,
      maximumResponseBytes: input.endpoint.maxResponseBytes,
      tls: { rejectUnauthorized: true, clientCertificatePresent: input.binding.authenticationMethod === 'MTLS' },
    });
    if (!response.ok) {
      if (response.error.code === 'AUTH_FAILED' || response.error.code === 'OAUTH_TOKEN_FAILED') {
        input.circuitBreaker.recordFailure(input.profile.providerId, input.feed.sourceId);
        return err(candidateRejection('AUTH_FAILED', response.error.detail));
      }
      if (!isRetryableRejection(response.error) && pages > 0) {
        return ok(success(records, pages, retainPartialPage({ retained: records, pagesCollected: pages, failedPage: pages + 1 }), envelopes));
      }
      input.circuitBreaker.recordFailure(input.profile.providerId, input.feed.sourceId);
      if (pages > 0) {
        return ok(success(records, pages, retainPartialPage({ retained: records, pagesCollected: pages, failedPage: pages + 1 }), envelopes));
      }
      return err(candidateRejection(mapTransportCode(response.error.code), response.error.detail));
    }

    if (response.value.status === 301 || response.value.status === 302) {
      const location = response.value.headers.location ?? response.value.headers.Location;
      if (!location) {
        return err(candidateRejection('REDIRECT_ESCAPE', 'redirect without location'));
      }
      const next = governCandidateRedirect({
        currentHref: href.value,
        location,
        endpoint: input.endpoint,
        connectorProfile: connectorProfile.value,
        hopsUsed: 1,
      });
      if (!next.ok) {
        return next;
      }
      return err(candidateRejection('REDIRECT_ESCAPE', 'redirects must stay on the approved origin'));
    }
    if (response.value.status === 401 || response.value.status === 403) {
      input.circuitBreaker.recordFailure(input.profile.providerId, input.feed.sourceId);
      return err(candidateRejection('AUTH_FAILED', `HTTP ${response.value.status}`));
    }
    if (Buffer.byteLength(response.value.body, 'utf8') > input.endpoint.maxResponseBytes) {
      return err(candidateRejection('RESPONSE_TOO_LARGE', 'response exceeded maxResponseBytes'));
    }
    const contentType = (response.value.headers['content-type'] ?? response.value.headers['Content-Type'] ?? '').split(';')[0]!;
    if (contentType && !input.endpoint.expectedContentTypes.includes(contentType)) {
      return err(candidateRejection('CONTENT_TYPE_INVALID', contentType));
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(response.value.body) as unknown;
    } catch {
      return err(candidateRejection('SCHEMA_DRIFT', 'response is not JSON'));
    }
    const escaped = vendorDtoMustNotEscape(parsed);
    if (!escaped.ok) {
      return escaped;
    }
    const translated = input.translator.translate({
      body: parsed,
      feed: input.feed,
      schema: input.schema,
      providerId: input.profile.providerId,
    });
    if (!translated.ok) {
      if (pages > 0) {
        return ok(success(records, pages, retainPartialPage({ retained: records, pagesCollected: pages, failedPage: pages + 1 }), envelopes));
      }
      return translated;
    }
    const leaked = assertOauthHandleNotPersisted(translated.value);
    if (!leaked.ok) {
      return leaked;
    }

    const pageBody = parsed as { nextCursor?: string | null };
    const advanced = advanceCursor({
      cursor,
      nextToken: pageBody.nextCursor ?? null,
      bounds: { maxPages: input.feed.maxPages, maxRecordsPerPage: input.feed.maxRecordsPerPage },
      pageRecords: translated.value,
    });
    if (!advanced.ok) {
      return advanced;
    }
    cursor = advanced.value;
    records.push(...translated.value);
    input.circuitBreaker.recordSuccess(input.profile.providerId, input.feed.sourceId);
    pages += 1;
    nextToken = pageBody.nextCursor ?? null;

    for (const record of translated.value) {
      const admitted = admitTranslatedRecord({
        record,
        profile: input.profile,
        feed: input.feed,
        nowUnix: input.nowUnix,
      });
      if (admitted.ok) {
        envelopes.push(admitted.value);
      } else if (input.feed.isReferencePrice && admitted.error.code === 'REFERENCE_PRICE_IS_NOT_PRODUCTIVE') {
        return admitted;
      }
    }

    if (input.feed.paginationMode === 'NONE' || nextToken === null || nextToken.length === 0) {
      break;
    }
  }

  return ok(success(records, pages, null, envelopes));
}

function admitTranslatedRecord(input: {
  readonly record: ExternalSourceRecord;
  readonly profile: ExternalEconomicOracleProviderCandidateProfile;
  readonly feed: ExternalProviderFeedProfile;
  readonly nowUnix: bigint;
}): Result<EconomicDataCollectionEnvelope, ProviderCandidateRejection> {
  const candidate: CollectionCandidate = {
    providerId: input.profile.providerId,
    sourceId: input.feed.sourceId,
    feedId: input.feed.feedId,
    sourceCategory: input.feed.dataSourceCategory,
    factType: input.feed.factType,
    schemaId: input.record.schemaId,
    schemaVersion: input.record.schemaVersion,
    sourceObservationId:
      typeof input.record.extras?.sourceObservationId === 'string'
        ? input.record.extras.sourceObservationId
        : input.record.identifier,
    subjectRef: `${input.feed.subjectNamespace}:${input.record.identifier}`,
    sourceQuantity: { mantissa: BigInt(input.record.numericValue), scale: 0, unit: input.record.unit as CollectionCandidate['sourceQuantity']['unit'] },
    measurementStart: BigInt(input.record.sourceTimestampUnix),
    measurementEnd: BigInt(input.record.sourceTimestampUnix),
    sourceTimestamp: BigInt(input.record.sourceTimestampUnix),
    collectionTimestamp: input.nowUnix,
    geography: { jurisdiction: 'US', region: 'sim-west', locality: 'zone-a' },
    provenanceRef: `prov.${input.record.identifier}`,
    contentCommitment: sha256Hex(`chunk150.record:${input.record.identifier}:${input.record.numericValue}`),
    certificationStatus: 'ENGINEERING_SANDBOX',
    sourceRegistered: true,
    endpointApproved: true,
    connectorResultValid: true,
    schemaValid: true,
    claimedFamilyId: input.feed.familyId,
    controllerId: input.profile.controllerId,
    upstreamOrganizationId: input.profile.upstreamOrganizationId,
    sharedControlGroup: input.profile.sharedControlGroup,
  };
  const admitted = admitCollection(candidate, 'FIXTURE_ONLY', input.nowUnix);
  if (!admitted.ok) {
    if (admitted.error.code === 'REFERENCE_PRICE_CANNOT_CREATE_CLAIM') {
      return err(candidateRejection('REFERENCE_PRICE_IS_NOT_PRODUCTIVE', admitted.error.detail));
    }
    return err(candidateRejection('FAMILY_ROUTING_INVALID', admitted.error.detail));
  }
  return ok(admitted.value);
}

function success(
  records: readonly ExternalSourceRecord[],
  pagesCollected: number,
  partial: PartialCollectionOutcome | null,
  fabricEnvelopes: readonly EconomicDataCollectionEnvelope[],
): CandidateCollectionSuccess {
  return Object.freeze({
    records: Object.freeze([...records]),
    pagesCollected,
    partial,
    fabricEnvelopes: Object.freeze([...fabricEnvelopes]),
    oauthHandlePersisted: false,
    credentialsPresent: false,
    rawVendorDtoEscaped: false,
    finalizedOracle: false,
    mintedMoonRey: PROVIDER_SUCCESS_MINTS,
    productionAuthorized: false,
  });
}

function mapTransportCode(code: string): ProviderCandidateRejection['code'] {
  if (code === 'RATE_LIMITED') return 'RATE_LIMITED';
  if (code === 'CIRCUIT_OPEN') return 'CIRCUIT_OPEN';
  if (code === 'RESPONSE_TOO_LARGE') return 'RESPONSE_TOO_LARGE';
  if (code === 'CONTENT_TYPE_INVALID') return 'CONTENT_TYPE_INVALID';
  if (code === 'AUTH_FAILED' || code === 'OAUTH_TOKEN_FAILED') return 'AUTH_FAILED';
  if (code === 'SSRF_DESTINATION_FORBIDDEN') return 'SSRF_DESTINATION_FORBIDDEN';
  return 'ENDPOINT_NOT_APPROVED';
}
