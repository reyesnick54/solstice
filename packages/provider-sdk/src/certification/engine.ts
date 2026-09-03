// @ts-nocheck
/**
 * Provider certification engine — derives status from evidence probes.
 */

import { ENVIRONMENT } from '../../../config/src/flags.ts';
import type { CatalogProviderEntry } from '../catalog/types.ts';
import type { ProviderConfiguration } from '../types.ts';
import { normalizeProviderFailure, type ProviderFailureCode } from './errors.ts';
import { deriveLifecycleState } from './state.ts';
import type {
  ProviderCertification,
  ProviderCertificationEnvironment,
  ProviderCertificationProbeResult,
  ProviderEndpointClass,
  ProviderCertificationEvidence,
} from './types.ts';
import { PROVIDER_CERTIFICATION_SCHEMA_VERSION } from './types.ts';

export type CertificationProbeContext = {
  readonly providerId: string;
  readonly catalogEntry: CatalogProviderEntry | null;
  readonly configuration: ProviderConfiguration | null;
  readonly explicitlyDisabled: boolean;
  readonly credentialAvailable: boolean;
  readonly environment?: ProviderCertificationEnvironment;
  readonly nowUtc?: () => string;
  readonly liveProbeEnabled?: boolean;
  readonly networkProbe?: () => Promise<NetworkProbeOutcome>;
};

export type NetworkProbeOutcome = {
  readonly reachable: boolean;
  readonly authenticated: boolean;
  readonly responseValidated: boolean;
  readonly liveNetworkCallObserved: boolean;
  readonly productionEndpointUsed: boolean;
  readonly simulated: boolean;
  readonly endpointClass: ProviderEndpointClass;
  readonly latencyMs: number | null;
  readonly failureCode: ProviderFailureCode | null;
  readonly message?: string;
};

export function resolveCertificationEnvironment(
  environment?: string,
): ProviderCertificationEnvironment {
  switch (environment ?? ENVIRONMENT) {
    case 'production':
      return 'production';
    case 'preproduction':
      return 'preproduction';
    case 'sandbox':
      return 'sandbox';
    default:
      return 'simulation';
  }
}

export function isConfigured(
  catalogEntry: CatalogProviderEntry | null,
  configuration: ProviderConfiguration | null,
): boolean {
  if (!catalogEntry) {
    return false;
  }
  const hasBaseUrl =
    typeof catalogEntry.endpoints.base_url === 'string' &&
    catalogEntry.endpoints.base_url.length > 0;
  const hasDocs =
    typeof catalogEntry.endpoints.documentation_url === 'string' &&
    catalogEntry.endpoints.documentation_url.length > 0;
  const hasRuntimeConfig = configuration !== null;
  return hasBaseUrl || hasDocs || hasRuntimeConfig;
}

export function credentialsPresent(
  catalogEntry: CatalogProviderEntry | null,
  configuration: ProviderConfiguration | null,
  credentialAvailable: boolean,
): boolean {
  if (!catalogEntry) {
    return false;
  }
  if (!catalogEntry.authentication.required) {
    return true;
  }
  if (credentialAvailable) {
    return true;
  }
  if (configuration?.secretReference) {
    const envName = configuration.secretReference.environmentVariable;
    const value = process.env[envName];
    return typeof value === 'string' && value.length > 0;
  }
  const catalogEnv = catalogEntry.authentication.environment_variable;
  if (catalogEnv) {
    const value = process.env[catalogEnv];
    return typeof value === 'string' && value.length > 0;
  }
  return false;
}

export function runCertificationProbes(context: CertificationProbeContext): ProviderCertificationProbeResult {
  const evidence: ProviderCertificationEvidence[] = [];
  const checkedAt = (context.nowUtc ?? (() => new Date().toISOString()))();

  if (!context.catalogEntry) {
    evidence.push(evidenceEntry('catalog_lookup', 'FAIL', 'provider not in catalog', checkedAt));
    return emptyProbeResult('catalog_documentation', 'PROVIDER_NOT_IN_CATALOG', evidence);
  }

  evidence.push(evidenceEntry('catalog_lookup', 'PASS', 'provider exists in catalog', checkedAt));

  if (context.explicitlyDisabled) {
    evidence.push(evidenceEntry('activation', 'FAIL', 'provider explicitly disabled', checkedAt));
    return Object.freeze({
      ...emptyProbeResult('catalog_documentation', 'PROVIDER_DISABLED', evidence),
      configured: isConfigured(context.catalogEntry, context.configuration),
    });
  }

  const configured = isConfigured(context.catalogEntry, context.configuration);
  evidence.push(
    evidenceEntry(
      'configuration',
      configured ? 'PASS' : 'FAIL',
      configured ? 'required configuration present' : 'required configuration missing',
      checkedAt,
    ),
  );

  const credsPresent = credentialsPresent(
    context.catalogEntry,
    context.configuration,
    context.credentialAvailable,
  );
  if (context.catalogEntry.authentication.required) {
    evidence.push(
      evidenceEntry(
        'credentials',
        credsPresent ? 'PASS' : 'FAIL',
        credsPresent ? 'required credentials resolve' : 'required credentials missing',
        checkedAt,
      ),
    );
  } else {
    evidence.push(evidenceEntry('credentials', 'SKIPPED', 'authentication not required', checkedAt));
  }

  const environment = resolveCertificationEnvironment(context.environment);
  const simulationOnly = environment === 'simulation' && context.liveProbeEnabled !== true;

  if (simulationOnly) {
    evidence.push(
      evidenceEntry(
        'network',
        'SKIPPED',
        'live network probes disabled in simulation without explicit live flag',
        checkedAt,
      ),
    );
    return Object.freeze({
      configured,
      credentialsPresent: credsPresent,
      networkReachable: false,
      authenticated: false,
      responseValidated: false,
      liveNetworkCallObserved: false,
      productionEndpointUsed: false,
      simulated: true,
      endpointClass: 'simulation_fixture',
      latencyMs: null,
      failureCode: null,
      evidence: Object.freeze(evidence),
    });
  }

  return Object.freeze({
    configured,
    credentialsPresent: credsPresent,
    networkReachable: false,
    authenticated: false,
    responseValidated: false,
    liveNetworkCallObserved: false,
    productionEndpointUsed: false,
    simulated: false,
    endpointClass: 'sandbox',
    latencyMs: null,
    failureCode: configured ? (credsPresent || !context.catalogEntry.authentication.required ? null : 'MISSING_CREDENTIALS') : 'NOT_CONFIGURED',
    evidence: Object.freeze(evidence),
  });
}

export async function runCertificationProbesAsync(
  context: CertificationProbeContext,
): Promise<ProviderCertificationProbeResult> {
  const base = runCertificationProbes(context);
  if (!context.networkProbe || context.explicitlyDisabled || !context.catalogEntry) {
    return base;
  }
  if (base.simulated) {
    return base;
  }
  if (!base.configured) {
    return base;
  }
  if (context.catalogEntry.authentication.required && !base.credentialsPresent) {
    return base;
  }

  const checkedAt = (context.nowUtc ?? (() => new Date().toISOString()))();
  const started = Date.now();
  try {
    const outcome = await context.networkProbe();
    const latencyMs = outcome.latencyMs ?? Date.now() - started;
    const evidence = [
      ...base.evidence,
      evidenceEntry(
        'network',
        outcome.reachable ? 'PASS' : 'FAIL',
        outcome.message ?? (outcome.reachable ? 'network reachable' : 'network unreachable'),
        checkedAt,
      ),
    ];
    if (outcome.reachable) {
      evidence.push(
        evidenceEntry(
          'authentication',
          outcome.authenticated ? 'PASS' : 'FAIL',
          outcome.authenticated ? 'authentication accepted' : 'authentication rejected',
          checkedAt,
        ),
      );
      evidence.push(
        evidenceEntry(
          'response_validation',
          outcome.responseValidated ? 'PASS' : 'FAIL',
          outcome.responseValidated ? 'response conforms to contract' : 'response validation failed',
          checkedAt,
        ),
      );
    }
    return Object.freeze({
      configured: base.configured,
      credentialsPresent: base.credentialsPresent,
      networkReachable: outcome.reachable,
      authenticated: outcome.authenticated,
      responseValidated: outcome.responseValidated,
      liveNetworkCallObserved: outcome.liveNetworkCallObserved,
      productionEndpointUsed: outcome.productionEndpointUsed,
      simulated: outcome.simulated,
      endpointClass: outcome.endpointClass,
      latencyMs,
      failureCode: outcome.failureCode,
      evidence: Object.freeze(evidence),
    });
  } catch (error) {
    const normalized = normalizeProviderFailure({
      providerId: context.providerId,
      message: error instanceof Error ? error.message : String(error),
    });
    return Object.freeze({
      ...base,
      networkReachable: false,
      failureCode: normalized.code,
      evidence: Object.freeze([
        ...base.evidence,
        evidenceEntry('network', 'FAIL', normalized.message, checkedAt),
      ]),
    });
  }
}

export function buildProviderCertification(input: {
  readonly providerId: string;
  readonly probe: ProviderCertificationProbeResult;
  readonly environment?: ProviderCertificationEnvironment;
  readonly explicitlyDisabled?: boolean;
  readonly degraded?: boolean;
  readonly nowUtc?: () => string;
}): ProviderCertification {
  const status = deriveLifecycleState(input.probe, {
    explicitlyDisabled: input.explicitlyDisabled,
    degraded: input.degraded,
  });
  return Object.freeze({
    schemaVersion: PROVIDER_CERTIFICATION_SCHEMA_VERSION,
    providerId: input.providerId,
    status,
    environment: input.environment ?? resolveCertificationEnvironment(),
    endpointClass: input.probe.endpointClass,
    configured: input.probe.configured,
    credentialsPresent: input.probe.credentialsPresent,
    networkReachable: input.probe.networkReachable,
    authenticated: input.probe.authenticated,
    responseValidated: input.probe.responseValidated,
    liveNetworkCallObserved: input.probe.liveNetworkCallObserved,
    productionEndpointUsed: input.probe.productionEndpointUsed,
    simulated: input.probe.simulated,
    lastCheckedAt: (input.nowUtc ?? (() => new Date().toISOString()))(),
    latencyMs: input.probe.latencyMs,
    failureCode: input.probe.failureCode,
    evidence: input.probe.evidence,
  });
}

function evidenceEntry(
  probe: string,
  outcome: 'PASS' | 'FAIL' | 'SKIPPED',
  message: string,
  checkedAt: string,
): ProviderCertificationEvidence {
  return Object.freeze({ probe, outcome, message, checkedAt });
}

function emptyProbeResult(
  endpointClass: ProviderEndpointClass,
  failureCode: ProviderFailureCode | null,
  evidence: ProviderCertificationEvidence[],
): ProviderCertificationProbeResult {
  return Object.freeze({
    configured: false,
    credentialsPresent: false,
    networkReachable: false,
    authenticated: false,
    responseValidated: false,
    liveNetworkCallObserved: false,
    productionEndpointUsed: false,
    simulated: false,
    endpointClass,
    latencyMs: null,
    failureCode,
    evidence: Object.freeze(evidence),
  });
}
