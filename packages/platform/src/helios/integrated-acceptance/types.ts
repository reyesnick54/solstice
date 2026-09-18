/**
 * HELIOS H35 — integrated Hetzner + app acceptance report schema.
 */

export const HELIOS_INTEGRATED_ACCEPTANCE_SCHEMA = 'sunrey.helios.integrated-acceptance.v1' as const;

export const HELIOS_HETZNER_APP_ACCEPTANCE_QUALIFIED = 'HELIOS_HETZNER_APP_ACCEPTANCE_QUALIFIED' as const;
export const HELIOS_HETZNER_APP_ACCEPTANCE_BLOCKED = 'HELIOS_HETZNER_APP_ACCEPTANCE_BLOCKED' as const;

export type HeliosAcceptanceMarker =
  | typeof HELIOS_HETZNER_APP_ACCEPTANCE_QUALIFIED
  | typeof HELIOS_HETZNER_APP_ACCEPTANCE_BLOCKED;

export type AcceptanceCheckStatus =
  | 'PASS'
  | 'FAIL'
  | 'SKIP'
  | 'DEGRADED'
  | 'BLOCKED'
  | 'REHEARSAL';

export type AcceptanceCheck = {
  readonly category: string;
  readonly label: string;
  readonly status: AcceptanceCheckStatus;
  readonly detail?: string;
};

export type HeliosIntegratedAcceptanceReport = {
  readonly schema: typeof HELIOS_INTEGRATED_ACCEPTANCE_SCHEMA;
  readonly marker: HeliosAcceptanceMarker;
  readonly qualified: boolean;
  readonly releaseId: string;
  readonly commitSha: string;
  readonly artifactDigest: string;
  readonly environment: string;
  readonly deploymentTimestamp: string;
  readonly mode: 'local' | 'remote';
  readonly preDeployGates: readonly AcceptanceCheck[];
  readonly migrations: readonly AcceptanceCheck[];
  readonly healthChecks: readonly AcceptanceCheck[];
  readonly readinessChecks: readonly AcceptanceCheck[];
  readonly endToEndFlows: readonly AcceptanceCheck[];
  readonly restartProof: readonly AcceptanceCheck[];
  readonly multiCustomerProof: readonly AcceptanceCheck[];
  readonly degradedStateTests: readonly AcceptanceCheck[];
  readonly frontendBackendAcceptance: readonly AcceptanceCheck[];
  readonly providerModelQualification: readonly AcceptanceCheck[];
  readonly rollbackReadiness: readonly AcceptanceCheck[];
  readonly operationalObservability: readonly AcceptanceCheck[];
  readonly securityPosture: readonly AcceptanceCheck[];
  readonly safetyPosture: readonly AcceptanceCheck[];
  readonly failures: readonly string[];
  readonly limitations: readonly string[];
  readonly blockers: readonly string[];
};
