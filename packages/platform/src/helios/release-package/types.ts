/**
 * HELIOS H34 — qualified release package manifest.
 */

export const HELIOS_RELEASE_PACKAGE_SCHEMA = 'sunrey.helios.release-package.v1' as const;

export const HELIOS_RELEASE_PACKAGE_QUALIFIED = 'HELIOS_RELEASE_PACKAGE_QUALIFIED' as const;
export const HELIOS_RELEASE_PACKAGE_BLOCKED = 'HELIOS_RELEASE_PACKAGE_BLOCKED' as const;

export type HeliosReleasePackageMarker =
  | typeof HELIOS_RELEASE_PACKAGE_QUALIFIED
  | typeof HELIOS_RELEASE_PACKAGE_BLOCKED;

export type HeliosReleasePackageGate = {
  readonly id: string;
  readonly status: 'PASS' | 'FAIL' | 'SKIPPED';
  readonly detail?: string;
};

export type HeliosReleasePackageManifest = {
  readonly schema: typeof HELIOS_RELEASE_PACKAGE_SCHEMA;
  readonly releaseId: string;
  readonly commitSha: string;
  readonly artifactDigest: string;
  readonly migrationImageDigest: string;
  readonly configurationPackage: string;
  readonly environment: 'simulation';
  readonly marker: HeliosReleasePackageMarker;
  readonly qualified: boolean;
  readonly qualifiedAtUtc: string;
  readonly gates: readonly HeliosReleasePackageGate[];
  readonly blockers: readonly string[];
  readonly rollbackArtifactRef: string;
  readonly deploymentStack: 'deploy/sunrey-sandbox-hetzner';
};
