/**
 * Wave 2 live economic data probes (Frankfurter FX, World Bank indicators).
 */

import { randomUUID } from 'node:crypto';

import {
  createFetchProviderTransport,
  createProviderTransportConfig,
  NO_AUTH_PROVIDER_RESOLVER,
} from '../../../provider-sdk/src/index.ts';
import { deriveExecutionProvenance } from '../certification/types.ts';

export type EconomicLiveProbeResult = {
  readonly liveCall: boolean;
  readonly validated: boolean;
  readonly latencyMs: number | null;
  readonly httpStatus: number | null;
  readonly resultCount: number | null;
  readonly error: string | null;
  readonly provenance: ReturnType<typeof deriveExecutionProvenance>;
};

async function probeGet(input: {
  readonly providerId: string;
  readonly baseUrl: string;
  readonly path: string;
  readonly query?: Readonly<Record<string, string>>;
  readonly validate: (body: unknown) => boolean;
  readonly count: (body: unknown) => number;
}): Promise<EconomicLiveProbeResult> {
  const started = Date.now();
  const transport = createFetchProviderTransport({
    config: createProviderTransportConfig({
      serviceVersion: 'wave2-economic-live/1',
      environment: 'preview',
      endpoint: {
        providerId: input.providerId,
        baseUrl: input.baseUrl,
        defaultTimeoutMs: 15_000,
      },
    }),
    authResolver: NO_AUTH_PROVIDER_RESOLVER,
    authStrategy: { kind: 'none' },
  });

  const response = await transport.request({
    providerId: input.providerId,
    requestId: randomUUID(),
    method: 'GET',
    path: input.path,
    query: input.query,
    headers: { Accept: 'application/json' },
  });
  const latencyMs = Date.now() - started;

  if (!response.ok) {
    return {
      liveCall: true,
      validated: false,
      latencyMs,
      httpStatus: response.error.httpStatus ?? null,
      resultCount: null,
      error: response.error.message,
      provenance: deriveExecutionProvenance({
        simulated: false,
        liveNetworkCallObserved: true,
        productionEndpointUsed: true,
        httpStatus: response.error.httpStatus ?? null,
        latencyMs,
      }),
    };
  }

  const validated = input.validate(response.value.parsed ?? response.value.body.value);
  return {
    liveCall: true,
    validated,
    latencyMs,
    httpStatus: response.value.metadata.httpStatus,
    resultCount: validated ? input.count(response.value.parsed ?? response.value.body.value) : null,
    error: validated ? null : 'payload validation failed',
    provenance: deriveExecutionProvenance({
      simulated: false,
      liveNetworkCallObserved: true,
      productionEndpointUsed: true,
      httpStatus: response.value.metadata.httpStatus,
      latencyMs,
    }),
  };
}

export async function fetchLiveFxRate(): Promise<EconomicLiveProbeResult> {
  return probeGet({
    providerId: 'frankfurter',
    baseUrl: 'https://api.frankfurter.dev',
    path: '/v1/latest',
    query: { from: 'USD', to: 'EUR' },
    validate: (body) =>
      typeof body === 'object' &&
      body !== null &&
      typeof (body as { rates?: unknown }).rates === 'object',
    count: (body) => Object.keys((body as { rates: Record<string, number> }).rates).length,
  });
}

export async function fetchLiveWorldBankIndicator(): Promise<EconomicLiveProbeResult> {
  return probeGet({
    providerId: 'world-bank',
    baseUrl: 'https://api.worldbank.org',
    path: '/v2/country/US/indicator/NY.GDP.MKTP.CD',
    query: { format: 'json', per_page: '1' },
    validate: (body) => Array.isArray(body) && body.length >= 2 && Array.isArray(body[1]),
    count: (body) => (body as [unknown, unknown[]])[1].length,
  });
}
