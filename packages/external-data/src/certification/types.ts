/**
 * Wave 4 Prompt 10/11 — external provider certification types.
 *
 * Certification records evidence from controlled live endpoint calls.
 * Unit tests alone never confer LIVE_VALIDATED status.
 */

export const PROVIDER_INTEGRATION_STATUSES = Object.freeze([
  'CATALOGED',
  'IMPLEMENTED',
  'LIVE_VALIDATED',
  'PRODUCTION_QUALIFIED',
  'DEGRADED',
  'BLOCKED',
] as const);
export type ProviderIntegrationStatus = (typeof PROVIDER_INTEGRATION_STATUSES)[number];

export type ProviderExecutionProvenance = {
  readonly simulated: boolean;
  readonly liveNetworkCallObserved: boolean;
  readonly productionEndpointUsed: boolean;
  readonly fromCache: boolean;
  readonly httpStatus: number | null;
  readonly latencyMs: number | null;
};

export type ProviderCertificationResult = {
  readonly providerId: string;
  readonly status: ProviderIntegrationStatus;
  readonly liveCall: boolean;
  readonly validated: boolean;
  readonly latencyMs: number | null;
  readonly httpStatus: number | null;
  readonly resultCount: number | null;
  readonly error: string | null;
  readonly provenance: ProviderExecutionProvenance;
  readonly certifiedAtUtc: string;
};

export type ProviderCertificationReport = {
  readonly certifiedAtUtc: string;
  readonly environmentAllowsNetwork: boolean;
  readonly results: readonly ProviderCertificationResult[];
};

export function deriveExecutionProvenance(input: {
  readonly simulated: boolean;
  readonly liveNetworkCallObserved: boolean;
  readonly productionEndpointUsed?: boolean;
  readonly fromCache?: boolean;
  readonly httpStatus?: number | null;
  readonly latencyMs?: number | null;
}): ProviderExecutionProvenance {
  return Object.freeze({
    simulated: input.simulated,
    liveNetworkCallObserved: input.liveNetworkCallObserved,
    productionEndpointUsed: input.productionEndpointUsed ?? input.liveNetworkCallObserved,
    fromCache: input.fromCache ?? false,
    httpStatus: input.httpStatus ?? null,
    latencyMs: input.latencyMs ?? null,
  });
}

export function certificationStatusFromResult(result: {
  readonly liveCall: boolean;
  readonly validated: boolean;
  readonly implemented: boolean;
  readonly blocked: boolean;
}): ProviderIntegrationStatus {
  if (result.blocked) {
    return 'BLOCKED';
  }
  if (result.validated && result.liveCall) {
    return 'LIVE_VALIDATED';
  }
  if (result.implemented) {
    return 'IMPLEMENTED';
  }
  return 'CATALOGED';
}
