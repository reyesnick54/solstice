export const HELIOS_MD01_MARKET_DATA_FABRIC_QUALIFIED = 'HELIOS_MD01_MARKET_DATA_FABRIC_QUALIFIED' as const;

export const HELIOS_MD01_MARKET_DATA_FABRIC_BLOCKED = 'HELIOS_MD01_MARKET_DATA_FABRIC_BLOCKED' as const;

export type Md01QualificationChecks = {
  readonly allEventKindsDeclared: boolean;
  readonly requiredEnvelopeFieldsValidated: boolean;
  readonly knowableAtRespected: boolean;
  readonly noExecutionAuthority: boolean;
  readonly decimalPricesOnly: boolean;
  readonly extendsCanonicalOwners: boolean;
  readonly observationFabricIntegrated: boolean;
  readonly featureFabricSlicePresent: boolean;
  readonly certificationPlaneAligned: boolean;
};

export type Md01QualificationResult = {
  readonly marker: typeof HELIOS_MD01_MARKET_DATA_FABRIC_QUALIFIED | typeof HELIOS_MD01_MARKET_DATA_FABRIC_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

export function evaluateMd01Qualification(checks: Md01QualificationChecks): Md01QualificationResult {
  const blockers: string[] = [];
  if (!checks.allEventKindsDeclared) blockers.push('event_kinds');
  if (!checks.requiredEnvelopeFieldsValidated) blockers.push('envelope_fields');
  if (!checks.knowableAtRespected) blockers.push('knowable_at');
  if (!checks.noExecutionAuthority) blockers.push('execution_authority');
  if (!checks.decimalPricesOnly) blockers.push('decimal_prices');
  if (!checks.extendsCanonicalOwners) blockers.push('canonical_owners');
  if (!checks.observationFabricIntegrated) blockers.push('observation_fabric');
  if (!checks.featureFabricSlicePresent) blockers.push('feature_fabric_slice');
  if (!checks.certificationPlaneAligned) blockers.push('certification_plane');

  const qualified = blockers.length === 0;
  return Object.freeze({
    marker: qualified ? HELIOS_MD01_MARKET_DATA_FABRIC_QUALIFIED : HELIOS_MD01_MARKET_DATA_FABRIC_BLOCKED,
    qualified,
    blockers: Object.freeze(blockers),
  });
}
