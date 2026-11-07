export const HELIOS_ALT01_POINT_IN_TIME_ALTERNATIVE_DATA_QUALIFIED =
  'HELIOS_ALT01_POINT_IN_TIME_ALTERNATIVE_DATA_QUALIFIED' as const;

export const HELIOS_ALT01_POINT_IN_TIME_ALTERNATIVE_DATA_BLOCKED =
  'HELIOS_ALT01_POINT_IN_TIME_ALTERNATIVE_DATA_BLOCKED' as const;

export type Alt01FabricQualificationChecks = {
  readonly pitObservationsFiltered: boolean;
  readonly altDataTemporalKind: boolean;
  readonly revisionLedgerAppend: boolean;
  readonly noExecutionAuthority: boolean;
  readonly entityLinkPresent: boolean;
};

export type Alt01FabricQualificationResult = {
  readonly marker:
    | typeof HELIOS_ALT01_POINT_IN_TIME_ALTERNATIVE_DATA_QUALIFIED
    | typeof HELIOS_ALT01_POINT_IN_TIME_ALTERNATIVE_DATA_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

export function evaluateAlt01FabricQualification(
  checks: Alt01FabricQualificationChecks,
): Alt01FabricQualificationResult {
  const blockers: string[] = [];
  if (!checks.pitObservationsFiltered) blockers.push('pit_observations');
  if (!checks.altDataTemporalKind) blockers.push('alt_data_kind');
  if (!checks.revisionLedgerAppend) blockers.push('revision_ledger');
  if (!checks.noExecutionAuthority) blockers.push('execution_authority');
  if (!checks.entityLinkPresent) blockers.push('entity_link');

  const qualified = blockers.length === 0;
  return Object.freeze({
    marker: qualified
      ? HELIOS_ALT01_POINT_IN_TIME_ALTERNATIVE_DATA_QUALIFIED
      : HELIOS_ALT01_POINT_IN_TIME_ALTERNATIVE_DATA_BLOCKED,
    qualified,
    blockers: Object.freeze(blockers),
  });
}
