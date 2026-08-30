/**
 * Wave 1 Prompt 3 — universal provider HTTP transport and authentication layer.
 */

export {
  PROVIDER_HTTP_METHODS,
  PROVIDER_CONTENT_TYPES,
  type ProviderHttpMethod,
  type ProviderContentType,
  type ProviderRequestContext,
  type ProviderResponseMetadata,
  type ProviderParsedBody,
  type ProviderTransportResponse,
  type ProviderTransportResult,
  type ProviderTransportSuccess,
  type ProviderTransportFailure,
  type ProviderTransport,
} from './types.ts';

export {
  PROVIDER_TRANSPORT_ERROR_KINDS,
  ProviderTransportError,
  type ProviderTransportErrorKind,
  type ProviderTransportErrorFields,
  networkError,
  timeoutError,
  authenticationError,
  rateLimitError,
  clientError,
  serverError,
  invalidResponseError,
  securityError,
  mapHttpStatusToError,
} from './errors.ts';

export {
  DEFAULT_SENSITIVE_HEADERS,
  DEFAULT_SENSITIVE_QUERY_PARAMS,
  REDACTED,
  createRedactionCatalog,
  redactHeaderRecord,
  redactUrlForLog,
  redactErrorMessage,
  headersAreSafeToLog,
  type RedactionCatalog,
} from './redaction.ts';

export {
  type ProviderAuthStrategy,
  type ProviderAuthInjection,
  type ProviderAuthResolver,
  SecretBackedProviderAuthResolver,
  basicAuthHeader,
  bearerAuthHeader,
  unresolvedSecretMessage,
  type SecretBackedAuthResolverOptions,
} from './auth.ts';

export {
  PROVIDER_TRANSPORT_ENVIRONMENTS,
  DEFAULT_PROVIDER_TRANSPORT_LIMITS,
  createProviderTransportConfig,
  parseApprovedEndpoint,
  type ProviderTransportEnvironment,
  type ProviderEndpointConfig,
  type ProviderTransportConfig,
} from './config.ts';

export {
  parseDestination,
  enforceSsrfPolicy,
  resolveRedirectLocation,
  buildAbsoluteUrl,
  isLoopbackHostname,
  isLinkLocalOrMetadata,
  isPrivateIpv4,
  isPrivateIpv6,
  type ResolvedDestination,
  type SsrfDecision,
} from './ssrf.ts';

export {
  FetchProviderTransport,
  createFetchProviderTransport,
  systemClock,
  type FetchProviderTransportOptions,
  type FetchLike,
  type Clock,
} from './transport.ts';
export * from './types.ts';
export * from './contract.ts';
export * from './adapter.ts';
export * from './errors.ts';
export * from './activation-policy.ts';
export * from './registry.ts';
export * from './factory.ts';
export * from './catalog/types.ts';
export * from './catalog/loader.ts';
export * from './mocks/index.ts';
