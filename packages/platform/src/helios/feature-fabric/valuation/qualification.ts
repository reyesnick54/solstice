import {
  HELIOS_VAL01_VALUATION_FEATURE_FABRIC_BLOCKED,
  HELIOS_VAL01_VALUATION_FEATURE_FABRIC_QUALIFIED,
} from './taxonomy.ts';

export type Val01FeatureFabricQualificationChecks = {
  readonly bridgeCompilesFromManifest: boolean;
  readonly knowableAtFiltered: boolean;
  readonly extendsVal01DomainNotDuplicate: boolean;
};

export type Val01FeatureFabricQualificationResult = {
  readonly marker:
    | typeof HELIOS_VAL01_VALUATION_FEATURE_FABRIC_QUALIFIED
    | typeof HELIOS_VAL01_VALUATION_FEATURE_FABRIC_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

export function evaluateVal01FeatureFabricQualification(
  checks: Val01FeatureFabricQualificationChecks,
): Val01FeatureFabricQualificationResult {
  const blockers: string[] = [];
  if (!checks.bridgeCompilesFromManifest) blockers.push('bridge');
  if (!checks.knowableAtFiltered) blockers.push('knowable_at');
  if (!checks.extendsVal01DomainNotDuplicate) blockers.push('domain_extension');

  const qualified = blockers.length === 0;
  return Object.freeze({
    marker: qualified
      ? HELIOS_VAL01_VALUATION_FEATURE_FABRIC_QUALIFIED
      : HELIOS_VAL01_VALUATION_FEATURE_FABRIC_BLOCKED,
    qualified,
    blockers: Object.freeze(blockers),
  });
}

export {
  HELIOS_VAL01_VALUATION_FEATURE_FABRIC_QUALIFIED,
  HELIOS_VAL01_VALUATION_FEATURE_FABRIC_BLOCKED,
};
