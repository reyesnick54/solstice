/**
 * HELIOS H35 — integrated release package and Hetzner app acceptance qualification.
 * Composed into H36 release evidence; does not activate live connectivity.
 */

import {
  HELIOS_HETZNER_APP_ACCEPTANCE_BLOCKED,
  HELIOS_HETZNER_APP_ACCEPTANCE_QUALIFIED,
  HELIOS_RELEASE_PACKAGE_BLOCKED,
  HELIOS_RELEASE_PACKAGE_QUALIFIED,
} from './taxonomy.ts';

export type ReleasePackageQualificationChecks = {
  readonly architectureChecksPass: boolean;
  readonly typecheckBuildPass: boolean;
  readonly databaseQualificationPass: boolean;
  readonly migrationsCurrent: boolean;
  readonly apiOpenApiPass: boolean;
  readonly persistenceRestartPass: boolean;
  readonly customerIsolationPass: boolean;
  readonly securitySafetyChecksPass: boolean;
  readonly resilienceH31Qualified: boolean;
  readonly economicEvaluationH32Qualified: boolean;
  readonly capacityH33Qualified: boolean;
  readonly rollbackH34Qualified: boolean;
  readonly growProductContractQualified: boolean;
  readonly releaseShaBound: boolean;
  readonly liveFlagsRemainFalse: boolean;
};

export type HetznerAppAcceptanceChecks = {
  readonly deploymentManifestPresent: boolean;
  readonly consumerBffWired: boolean;
  readonly growControlsDocumented: boolean;
  readonly environmentLabelingCorrect: boolean;
  readonly restartAcceptancePass: boolean;
  readonly appAcceptanceEvidenceBound: boolean;
  readonly noLiveConnectivityClaimed: boolean;
};

export type IntegratedAcceptanceQualificationResult = {
  readonly releasePackageMarker:
    | typeof HELIOS_RELEASE_PACKAGE_QUALIFIED
    | typeof HELIOS_RELEASE_PACKAGE_BLOCKED;
  readonly hetznerAcceptanceMarker:
    | typeof HELIOS_HETZNER_APP_ACCEPTANCE_QUALIFIED
    | typeof HELIOS_HETZNER_APP_ACCEPTANCE_BLOCKED;
  readonly releasePackageQualified: boolean;
  readonly hetznerAcceptanceQualified: boolean;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

export function evaluateReleasePackageQualification(
  checks: ReleasePackageQualificationChecks,
): {
  readonly marker: typeof HELIOS_RELEASE_PACKAGE_QUALIFIED | typeof HELIOS_RELEASE_PACKAGE_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
} {
  const blockers: string[] = [];
  const entries: [keyof ReleasePackageQualificationChecks, string][] = [
    ['architectureChecksPass', 'architecture checks failed'],
    ['typecheckBuildPass', 'typecheck/build failed'],
    ['databaseQualificationPass', 'database qualification failed'],
    ['migrationsCurrent', 'migrations not current'],
    ['apiOpenApiPass', 'API/OpenAPI qualification failed'],
    ['persistenceRestartPass', 'persistence/restart qualification failed'],
    ['customerIsolationPass', 'customer isolation failed'],
    ['securitySafetyChecksPass', 'security/safety checks failed'],
    ['resilienceH31Qualified', 'resilience H31 not qualified'],
    ['economicEvaluationH32Qualified', 'economic evaluation H32 not qualified'],
    ['capacityH33Qualified', 'capacity/latency H33 not qualified'],
    ['rollbackH34Qualified', 'rollback H34 not qualified'],
    ['growProductContractQualified', 'Grow product contract not qualified'],
    ['releaseShaBound', 'release evidence not bound to Git SHA'],
    ['liveFlagsRemainFalse', 'LIVE_* flags or ENVIRONMENT changed from simulation posture'],
  ];
  for (const [key, message] of entries) {
    if (!checks[key]) blockers.push(message);
  }
  if (blockers.length > 0) {
    return Object.freeze({
      marker: HELIOS_RELEASE_PACKAGE_BLOCKED,
      qualified: false,
      blockers: Object.freeze(blockers),
    });
  }
  return Object.freeze({
    marker: HELIOS_RELEASE_PACKAGE_QUALIFIED,
    qualified: true,
    blockers: Object.freeze([]),
  });
}

export function evaluateHetznerAppAcceptanceQualification(
  checks: HetznerAppAcceptanceChecks,
): {
  readonly marker:
    | typeof HELIOS_HETZNER_APP_ACCEPTANCE_QUALIFIED
    | typeof HELIOS_HETZNER_APP_ACCEPTANCE_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
} {
  const blockers: string[] = [];
  const entries: [keyof HetznerAppAcceptanceChecks, string][] = [
    ['deploymentManifestPresent', 'Hetzner deployment manifest missing'],
    ['consumerBffWired', 'Consumer BFF not wired in deployed runtime'],
    ['growControlsDocumented', 'Grow controls not documented in OpenAPI'],
    ['environmentLabelingCorrect', 'environment labeling incorrect'],
    ['restartAcceptancePass', 'restart acceptance failed'],
    ['appAcceptanceEvidenceBound', 'app acceptance evidence not bound to release SHA'],
    ['noLiveConnectivityClaimed', 'live connectivity incorrectly claimed in acceptance'],
  ];
  for (const [key, message] of entries) {
    if (!checks[key]) blockers.push(message);
  }
  if (blockers.length > 0) {
    return Object.freeze({
      marker: HELIOS_HETZNER_APP_ACCEPTANCE_BLOCKED,
      qualified: false,
      blockers: Object.freeze(blockers),
    });
  }
  return Object.freeze({
    marker: HELIOS_HETZNER_APP_ACCEPTANCE_QUALIFIED,
    qualified: true,
    blockers: Object.freeze([]),
  });
}

export function evaluateIntegratedAcceptanceQualification(input: {
  readonly releasePackage: ReleasePackageQualificationChecks;
  readonly hetznerAcceptance: HetznerAppAcceptanceChecks;
}): IntegratedAcceptanceQualificationResult {
  const release = evaluateReleasePackageQualification(input.releasePackage);
  const hetzner = evaluateHetznerAppAcceptanceQualification(input.hetznerAcceptance);
  const blockers = Object.freeze([...release.blockers, ...hetzner.blockers]);
  return Object.freeze({
    releasePackageMarker: release.marker,
    hetznerAcceptanceMarker: hetzner.marker,
    releasePackageQualified: release.qualified,
    hetznerAcceptanceQualified: hetzner.qualified,
    qualified: release.qualified && hetzner.qualified,
    blockers,
  });
}
