export const HELIOS_ALT01_CANONICAL_FABRIC_QUALIFIED = 'HELIOS_ALT01_CANONICAL_FABRIC_QUALIFIED' as const;

export const HELIOS_ALT01_CANONICAL_FABRIC_BLOCKED = 'HELIOS_ALT01_CANONICAL_FABRIC_BLOCKED' as const;

export type Alt01QualificationChecks = {
  readonly signalFamiliesDeclared: boolean;
  readonly knowableAtRespected: boolean;
  readonly noBackfillBeforeAvailability: boolean;
  readonly noExecutionAuthority: boolean;
  readonly extendsExternalDataPlane: boolean;
  readonly extendsFeatureFabric: boolean;
  readonly entityResolutionBound: boolean;
  readonly coverageTensorEmitted: boolean;
  readonly revisionLedgerCompatible: boolean;
  readonly authorityReferenceOnly: boolean;
};

export type Alt01QualificationResult = {
  readonly marker: typeof HELIOS_ALT01_CANONICAL_FABRIC_QUALIFIED | typeof HELIOS_ALT01_CANONICAL_FABRIC_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

export function evaluateAlt01Qualification(checks: Alt01QualificationChecks): Alt01QualificationResult {
  const blockers: string[] = [];
  if (!checks.signalFamiliesDeclared) blockers.push('signal_families');
  if (!checks.knowableAtRespected) blockers.push('knowable_at');
  if (!checks.noBackfillBeforeAvailability) blockers.push('backfill_availability');
  if (!checks.noExecutionAuthority) blockers.push('execution_authority');
  if (!checks.extendsExternalDataPlane) blockers.push('external_data_plane');
  if (!checks.extendsFeatureFabric) blockers.push('feature_fabric');
  if (!checks.entityResolutionBound) blockers.push('entity_resolution');
  if (!checks.coverageTensorEmitted) blockers.push('coverage_tensor');
  if (!checks.revisionLedgerCompatible) blockers.push('revision_ledger');
  if (!checks.authorityReferenceOnly) blockers.push('authority_reference_only');

  const qualified = blockers.length === 0;
  return Object.freeze({
    marker: qualified ? HELIOS_ALT01_CANONICAL_FABRIC_QUALIFIED : HELIOS_ALT01_CANONICAL_FABRIC_BLOCKED,
    qualified,
    blockers: Object.freeze(blockers),
  });
}
