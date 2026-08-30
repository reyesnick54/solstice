/**
 * Provider adapter contract for future external API integrations.
 *
 * Adapters translate vendor requests, validate responses, and normalize
 * observations. They must not implement retry, circuit breaking, secret
 * storage, caching, or business authority — those belong to shared infra.
 */

import type { ProviderId, ProviderRequestContext, ProviderResponseMetadata } from './registry-types.ts';

export type AdapterRequest<TParams = unknown> = {
  readonly providerId: ProviderId;
  readonly operation: string;
  readonly params: TParams;
  readonly context: ProviderRequestContext;
};

export type AdapterResponse<TData = unknown> = {
  readonly data: TData;
  readonly metadata: ProviderResponseMetadata;
};

export type ProviderAdapter<TParams = unknown, TData = unknown> = {
  readonly providerId: ProviderId;
  readonly supportedOperations: readonly string[];

  translateRequest(request: AdapterRequest<TParams>): unknown;
  validateResponse(raw: unknown): void;
  normalize(raw: unknown, context: ProviderRequestContext): AdapterResponse<TData>;
};

export function createAdapterContract<TParams, TData>(
  adapter: ProviderAdapter<TParams, TData>,
): ProviderAdapter<TParams, TData> {
  return Object.freeze(adapter);
}
