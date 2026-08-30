/**
 * Provider transport environment and endpoint configuration.
 *
 * Base URLs are controlled configuration. Development overrides cannot
 * silently affect production because each environment carries its own profile.
 */

export const PROVIDER_TRANSPORT_ENVIRONMENTS = ['development', 'test', 'preview', 'production'] as const;
export type ProviderTransportEnvironment = (typeof PROVIDER_TRANSPORT_ENVIRONMENTS)[number];

export type ProviderEndpointConfig = {
  readonly providerId: string;
  readonly baseUrl: string;
  readonly allowHttp?: boolean | undefined;
  readonly maximumRequestBytes: number;
  readonly maximumResponseBytes: number;
  readonly defaultTimeoutMs: number;
  readonly maxRedirects: number;
  readonly sensitiveHeaders?: readonly string[] | undefined;
  readonly sensitiveQueryParams?: readonly string[] | undefined;
  readonly allowLoopbackInTest?: boolean | undefined;
};

export type ProviderTransportConfig = {
  readonly serviceVersion: string;
  readonly environment: ProviderTransportEnvironment;
  readonly endpoint: ProviderEndpointConfig;
};

export const DEFAULT_PROVIDER_TRANSPORT_LIMITS = Object.freeze({
  maximumRequestBytes: 1_048_576,
  maximumResponseBytes: 8_388_608,
  defaultTimeoutMs: 30_000,
  maxRedirects: 3,
});

export function createProviderTransportConfig(input: {
  readonly serviceVersion: string;
  readonly environment: ProviderTransportEnvironment;
  readonly endpoint: Omit<ProviderEndpointConfig, 'maximumRequestBytes' | 'maximumResponseBytes' | 'defaultTimeoutMs' | 'maxRedirects'> &
    Partial<
      Pick<
        ProviderEndpointConfig,
        'maximumRequestBytes' | 'maximumResponseBytes' | 'defaultTimeoutMs' | 'maxRedirects'
      >
    >;
}): ProviderTransportConfig {
  if (input.environment === 'production' && input.endpoint.allowHttp === true) {
    throw new Error('HTTP is not permitted for production provider endpoints');
  }
  if (input.environment === 'production' && input.endpoint.allowLoopbackInTest === true) {
    throw new Error('loopback allowance is not permitted in production');
  }
  return Object.freeze({
    serviceVersion: input.serviceVersion,
    environment: input.environment,
    endpoint: Object.freeze({
      ...DEFAULT_PROVIDER_TRANSPORT_LIMITS,
      ...input.endpoint,
    }),
  });
}

export function parseApprovedEndpoint(baseUrl: string): {
  readonly scheme: 'http' | 'https';
  readonly hostname: string;
  readonly port: number;
} {
  const parsed = new URL(baseUrl);
  const scheme = parsed.protocol.replace(':', '').toLowerCase();
  if (scheme !== 'http' && scheme !== 'https') {
    throw new Error('provider base URL must use http or https');
  }
  const port = parsed.port.length > 0 ? Number(parsed.port) : scheme === 'https' ? 443 : 80;
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error('provider base URL port is invalid');
  }
  return Object.freeze({
    scheme,
    hostname: parsed.hostname.toLowerCase(),
    port,
  });
}
