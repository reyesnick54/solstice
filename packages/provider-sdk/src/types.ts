/**
 * Unified provider-sdk type surface.
 *
 * Split across observation, registry, HTTP transport, and reliability modules
 * to avoid merge collisions between Wave 1 prompts.
 */

export * from './observation-types.ts';
export * from './registry-types.ts';
export {
  PROVIDER_HTTP_METHODS,
  PROVIDER_CONTENT_TYPES,
  type ProviderHttpMethod,
  type ProviderContentType,
  type ProviderHttpRequestContext,
  type ProviderHttpResponseMetadata,
  type ProviderParsedBody,
  type ProviderHttpTransportResponse,
  type ProviderHttpTransportSuccess,
  type ProviderHttpTransportFailure,
  type ProviderHttpTransportResult,
  type ProviderHttpTransport,
} from './http-transport-types.ts';
export {
  HTTP_METHODS,
  CIRCUIT_STATES,
  FAILURE_CLASSIFICATIONS,
  defaultClock,
  isSafeReadMethod,
  type HttpMethod,
  type CircuitState,
  type FailureClassification,
  type ReliabilityTransportRequest,
  type ReliabilityTransportResponse,
  type ReliabilityProviderTransport,
  type ProviderError,
  type ReliabilityOutcome,
  type DeadlineContext,
  type FallbackContext,
  type FallbackDecision,
  type FallbackHook,
  type ReliabilityClock,
} from './reliability-types.ts';

/** Observation category alias used by normalization pipeline. */
export { OBSERVATION_PROVIDER_CATEGORIES as PROVIDER_CATEGORIES } from './observation-types.ts';
export type { ObservationProviderCategory as ProviderCategory } from './observation-types.ts';
