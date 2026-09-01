/**
 * Response data provenance — backend must know whether data is real.
 */

import type { ProviderEndpointClass } from './types.ts';

export const RESPONSE_PROVENANCE_SCHEMA_VERSION = 'sunrey.response-provenance.v1' as const;

export type ResponseDataProvenance = {
  readonly schemaVersion: typeof RESPONSE_PROVENANCE_SCHEMA_VERSION;
  readonly providerId: string;
  readonly simulated: boolean;
  readonly retrievedAt: string;
  readonly endpointClass: ProviderEndpointClass;
  readonly normalizationVersion: string;
  readonly requestId: string;
  readonly correlationId: string | null;
};

export function buildResponseProvenance(input: {
  readonly providerId: string;
  readonly simulated: boolean;
  readonly retrievedAt: string;
  readonly endpointClass: ProviderEndpointClass;
  readonly normalizationVersion?: string;
  readonly requestId: string;
  readonly correlationId?: string | null;
}): ResponseDataProvenance {
  return Object.freeze({
    schemaVersion: RESPONSE_PROVENANCE_SCHEMA_VERSION,
    providerId: input.providerId,
    simulated: input.simulated,
    retrievedAt: input.retrievedAt,
    endpointClass: input.endpointClass,
    normalizationVersion: input.normalizationVersion ?? '1',
    requestId: input.requestId,
    correlationId: input.correlationId ?? null,
  });
}

export function assertLiveProvenance(
  provenance: ResponseDataProvenance,
  context: string,
): void {
  if (provenance.simulated) {
    throw new Error(
      `${context}: simulated provider data cannot be represented as live (provider=${provenance.providerId})`,
    );
  }
  if (provenance.endpointClass === 'simulation_fixture') {
    throw new Error(
      `${context}: simulation_fixture endpoint class cannot be represented as live (provider=${provenance.providerId})`,
    );
  }
}

export type ExplicitSimulationPolicy = {
  readonly allowSimulation: boolean;
  readonly simulationReason: string | null;
};

export function resolveDataPathPolicy(input: {
  readonly environment: string;
  readonly explicitSimulationRequested: boolean;
  readonly providerDisabled: boolean;
}): ExplicitSimulationPolicy {
  if (input.providerDisabled) {
    return Object.freeze({ allowSimulation: false, simulationReason: 'provider_disabled' });
  }
  if (input.environment === 'simulation' || input.explicitSimulationRequested) {
    return Object.freeze({
      allowSimulation: true,
      simulationReason: input.explicitSimulationRequested
        ? 'explicit_simulation_requested'
        : 'simulation_environment',
    });
  }
  return Object.freeze({ allowSimulation: false, simulationReason: null });
}

/**
 * Reject silent mock fallback: real path failure must not return unlabeled simulation.
 */
export function rejectSilentSimulationFallback(input: {
  readonly primaryFailed: boolean;
  readonly fallbackToSimulation: boolean;
  readonly simulationLabeled: boolean;
  readonly environment: string;
  readonly explicitSimulationAllowed: boolean;
}): { readonly allowed: boolean; readonly failureCode: string | null } {
  if (!input.primaryFailed) {
    return Object.freeze({ allowed: true, failureCode: null });
  }
  if (!input.fallbackToSimulation) {
    return Object.freeze({ allowed: true, failureCode: null });
  }
  if (input.simulationLabeled && input.explicitSimulationAllowed) {
    return Object.freeze({ allowed: true, failureCode: null });
  }
  return Object.freeze({
    allowed: false,
    failureCode: 'SILENT_SIMULATION_REJECTED',
  });
}
