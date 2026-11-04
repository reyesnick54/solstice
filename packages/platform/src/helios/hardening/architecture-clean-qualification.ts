/**
 * HEALTH03 — package-boundary and type-safety qualification marker.
 */

export const HELIOS_ARCHITECTURE_CLEAN_QUALIFIED = 'HELIOS_ARCHITECTURE_CLEAN_QUALIFIED' as const;
export const HELIOS_ARCHITECTURE_CLEAN_BLOCKED = 'HELIOS_ARCHITECTURE_CLEAN_BLOCKED' as const;

export type HeliosArchitectureCleanMarker =
  | typeof HELIOS_ARCHITECTURE_CLEAN_QUALIFIED
  | typeof HELIOS_ARCHITECTURE_CLEAN_BLOCKED;

export type HeliosArchitectureCleanQualification = {
  readonly marker: HeliosArchitectureCleanMarker;
  readonly qualified: boolean;
  readonly auditPackages: readonly string[];
  readonly packageBoundaryViolations: number;
  readonly tsNocheckCount: number;
  readonly tsIgnoreCount: number;
  readonly deepCrossPackageImports: number;
};

const AUDIT_PACKAGES = Object.freeze([
  'packages/platform/src/helios',
  'packages/strategy-lab',
  'packages/agentic-capital-mesh',
  'packages/external-data',
  'packages/provider-sdk',
] as const);

export function assessHeliosArchitectureCleanQualification(input: {
  readonly packageBoundaryViolations: number;
  readonly tsNocheckCount: number;
  readonly tsIgnoreCount: number;
  readonly deepCrossPackageImports: number;
}): HeliosArchitectureCleanQualification {
  const qualified =
    input.packageBoundaryViolations === 0 &&
    input.tsNocheckCount === 0 &&
    input.tsIgnoreCount === 0 &&
    input.deepCrossPackageImports === 0;
  return Object.freeze({
    marker: qualified ? HELIOS_ARCHITECTURE_CLEAN_QUALIFIED : HELIOS_ARCHITECTURE_CLEAN_BLOCKED,
    qualified,
    auditPackages: AUDIT_PACKAGES,
    packageBoundaryViolations: input.packageBoundaryViolations,
    tsNocheckCount: input.tsNocheckCount,
    tsIgnoreCount: input.tsIgnoreCount,
    deepCrossPackageImports: input.deepCrossPackageImports,
  });
}
