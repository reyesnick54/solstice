/**
 * Wave 4 Prompt 10 — canonical provider certification lifecycle types.
 *
 * Catalog presence does not imply live status. Certification is derived by
 * backend evidence probes, never from client-supplied claims.
 */

import type { ProviderId } from '../types.ts';

export const PROVIDER_CERTIFICATION_SCHEMA_VERSION = 'sunrey.provider-certification.v1' as const;

/**
 * Monotonic lifecycle states for external provider integration.
 * Higher states require evidence from all preceding states.
 */
export const PROVIDER_LIFECYCLE_STATES = [
  'CATALOGED',
  'CONFIGURED',
  'CREDENTIALS_PRESENT',
  'REACHABLE',
  'AUTHENTICATED',
  'RESPONSE_VALIDATED',
  'LIVE_VALIDATED',
  'PRODUCTION_QUALIFIED',
  'DEGRADED',
  'DISABLED',
  'SIMULATED',
] as const;

export type ProviderLifecycleState = (typeof PROVIDER_LIFECYCLE_STATES)[number];

export const PROVIDER_ENDPOINT_CLASSES = [
  'catalog_documentation',
  'simulation_fixture',
  'sandbox',
  'production_candidate',
  'production',
] as const;

export type ProviderEndpointClass = (typeof PROVIDER_ENDPOINT_CLASSES)[number];

export const PROVIDER_CERTIFICATION_ENVIRONMENTS = [
  'simulation',
  'sandbox',
  'preproduction',
  'production',
] as const;

export type ProviderCertificationEnvironment =
  (typeof PROVIDER_CERTIFICATION_ENVIRONMENTS)[number];

export const CERTIFICATION_PROBE_OUTCOMES = ['PASS', 'FAIL', 'SKIPPED'] as const;
export type CertificationProbeOutcome = (typeof CERTIFICATION_PROBE_OUTCOMES)[number];

export type ProviderCertificationEvidence = {
  readonly probe: string;
  readonly outcome: CertificationProbeOutcome;
  readonly message: string;
  readonly checkedAt: string;
};

/**
 * Strongly typed certification result. Boolean flags reflect probe evidence.
 * Status is the highest lifecycle state supported by evidence — never inferred
 * from catalog metadata alone.
 */
export type ProviderCertification = {
  readonly schemaVersion: typeof PROVIDER_CERTIFICATION_SCHEMA_VERSION;
  readonly providerId: ProviderId;
  readonly status: ProviderLifecycleState;
  readonly environment: ProviderCertificationEnvironment;
  readonly endpointClass: ProviderEndpointClass;
  readonly configured: boolean;
  readonly credentialsPresent: boolean;
  readonly networkReachable: boolean;
  readonly authenticated: boolean;
  readonly responseValidated: boolean;
  readonly liveNetworkCallObserved: boolean;
  readonly productionEndpointUsed: boolean;
  readonly simulated: boolean;
  readonly lastCheckedAt: string;
  readonly latencyMs: number | null;
  readonly failureCode: string | null;
  readonly evidence: readonly ProviderCertificationEvidence[];
};

export type ProviderCertificationProbeResult = {
  readonly configured: boolean;
  readonly credentialsPresent: boolean;
  readonly networkReachable: boolean;
  readonly authenticated: boolean;
  readonly responseValidated: boolean;
  readonly liveNetworkCallObserved: boolean;
  readonly productionEndpointUsed: boolean;
  readonly simulated: boolean;
  readonly endpointClass: ProviderEndpointClass;
  readonly latencyMs: number | null;
  readonly failureCode: string | null;
  readonly evidence: readonly ProviderCertificationEvidence[];
};

export type ProviderCertificationReport = {
  readonly schemaVersion: typeof PROVIDER_CERTIFICATION_SCHEMA_VERSION;
  readonly generatedAt: string;
  readonly environment: ProviderCertificationEnvironment;
  readonly mode: 'unit' | 'live';
  readonly summary: {
    readonly total: number;
    readonly pass: number;
    readonly fail: number;
    readonly skipped: number;
  };
  readonly providers: readonly ProviderCertification[];
};
