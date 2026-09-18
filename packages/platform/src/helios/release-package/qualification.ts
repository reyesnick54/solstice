/**
 * HELIOS H34 — release package qualification gate.
 */

import {
  HELIOS_RELEASE_PACKAGE_BLOCKED,
  HELIOS_RELEASE_PACKAGE_QUALIFIED,
  type HeliosReleasePackageGate,
  type HeliosReleasePackageManifest,
  type HeliosReleasePackageMarker,
} from './types.ts';

export function evaluateHeliosReleasePackageQualification(input: {
  readonly releaseId: string;
  readonly commitSha: string;
  readonly artifactDigest: string;
  readonly migrationImageDigest: string;
  readonly configurationPackage: string;
  readonly gates: readonly HeliosReleasePackageGate[];
  readonly rollbackArtifactRef: string;
  readonly qualifiedAtUtc?: string;
}): HeliosReleasePackageManifest {
  const blockers = input.gates.filter((gate) => gate.status === 'FAIL').map((gate) => gate.id);
  const marker: HeliosReleasePackageMarker =
    blockers.length === 0 ? HELIOS_RELEASE_PACKAGE_QUALIFIED : HELIOS_RELEASE_PACKAGE_BLOCKED;

  return Object.freeze({
    schema: 'sunrey.helios.release-package.v1',
    releaseId: input.releaseId,
    commitSha: input.commitSha,
    artifactDigest: input.artifactDigest,
    migrationImageDigest: input.migrationImageDigest,
    configurationPackage: input.configurationPackage,
    environment: 'simulation',
    marker,
    qualified: marker === HELIOS_RELEASE_PACKAGE_QUALIFIED,
    qualifiedAtUtc: input.qualifiedAtUtc ?? new Date().toISOString(),
    gates: Object.freeze([...input.gates]),
    blockers: Object.freeze(blockers),
    rollbackArtifactRef: input.rollbackArtifactRef,
    deploymentStack: 'deploy/sunrey-sandbox-hetzner',
  });
}
