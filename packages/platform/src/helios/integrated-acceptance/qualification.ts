/**
 * HELIOS H35 — integrated acceptance qualification gate.
 */

import {
  HELIOS_HETZNER_APP_ACCEPTANCE_BLOCKED,
  HELIOS_HETZNER_APP_ACCEPTANCE_QUALIFIED,
  type AcceptanceCheck,
  type HeliosAcceptanceMarker,
  type HeliosIntegratedAcceptanceReport,
} from './types.ts';

const CRITICAL_CATEGORIES = new Set([
  'preDeploy',
  'migration',
  'health',
  'readiness',
  'endToEnd',
  'restart',
  'multiCustomer',
  'safety',
]);

function isCriticalFailure(check: AcceptanceCheck): boolean {
  if (check.status !== 'FAIL' && check.status !== 'BLOCKED') {
    return false;
  }
  return CRITICAL_CATEGORIES.has(check.category);
}

export function evaluateHeliosIntegratedAcceptance(input: {
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
  readonly limitations?: readonly string[];
}): HeliosIntegratedAcceptanceReport {
  const allChecks = [
    ...input.preDeployGates,
    ...input.migrations,
    ...input.healthChecks,
    ...input.readinessChecks,
    ...input.endToEndFlows,
    ...input.restartProof,
    ...input.multiCustomerProof,
    ...input.degradedStateTests,
    ...input.frontendBackendAcceptance,
    ...input.providerModelQualification,
    ...input.rollbackReadiness,
    ...input.operationalObservability,
    ...input.securityPosture,
    ...input.safetyPosture,
  ];

  const blockers = allChecks
    .filter(isCriticalFailure)
    .map((check) => `${check.category}:${check.label}${check.detail ? ` (${check.detail})` : ''}`);

  const failures = allChecks
    .filter((check) => check.status === 'FAIL')
    .map((check) => `${check.category}:${check.label}`);

  const marker: HeliosAcceptanceMarker =
    blockers.length === 0 ? HELIOS_HETZNER_APP_ACCEPTANCE_QUALIFIED : HELIOS_HETZNER_APP_ACCEPTANCE_BLOCKED;

  return Object.freeze({
    schema: 'sunrey.helios.integrated-acceptance.v1',
    marker,
    qualified: marker === HELIOS_HETZNER_APP_ACCEPTANCE_QUALIFIED,
    releaseId: input.releaseId,
    commitSha: input.commitSha,
    artifactDigest: input.artifactDigest,
    environment: input.environment,
    deploymentTimestamp: input.deploymentTimestamp,
    mode: input.mode,
    preDeployGates: Object.freeze([...input.preDeployGates]),
    migrations: Object.freeze([...input.migrations]),
    healthChecks: Object.freeze([...input.healthChecks]),
    readinessChecks: Object.freeze([...input.readinessChecks]),
    endToEndFlows: Object.freeze([...input.endToEndFlows]),
    restartProof: Object.freeze([...input.restartProof]),
    multiCustomerProof: Object.freeze([...input.multiCustomerProof]),
    degradedStateTests: Object.freeze([...input.degradedStateTests]),
    frontendBackendAcceptance: Object.freeze([...input.frontendBackendAcceptance]),
    providerModelQualification: Object.freeze([...input.providerModelQualification]),
    rollbackReadiness: Object.freeze([...input.rollbackReadiness]),
    operationalObservability: Object.freeze([...input.operationalObservability]),
    securityPosture: Object.freeze([...input.securityPosture]),
    safetyPosture: Object.freeze([...input.safetyPosture]),
    failures: Object.freeze(failures),
    limitations: Object.freeze([...(input.limitations ?? [])]),
    blockers: Object.freeze(blockers),
  });
}
