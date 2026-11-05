import {
  HELIOS_VAL01_VALUATION_DOMAIN_BLOCKED,
  HELIOS_VAL01_VALUATION_DOMAIN_QUALIFIED,
} from './taxonomy.ts';

export type Val01QualificationChecks = {
  readonly coreTypesDefined: boolean;
  readonly valuationMethodsComplete: boolean;
  readonly applicabilityRulesEnforced: boolean;
  readonly assumptionsExplicitAndVersioned: boolean;
  readonly knowableAtEnforced: boolean;
  readonly noExecutionAuthorityOnArtifacts: boolean;
  readonly consumesSecFundamentalsNotDuplicate: boolean;
  readonly consumesEarn09NotDuplicate: boolean;
  readonly consumesAafV2NotDuplicate: boolean;
  readonly consumesMacroYieldRates: boolean;
  readonly strategyLabBindingDefined: boolean;
  readonly featureFabricBridgeDefined: boolean;
};

export type Val01QualificationResult = {
  readonly marker:
    | typeof HELIOS_VAL01_VALUATION_DOMAIN_QUALIFIED
    | typeof HELIOS_VAL01_VALUATION_DOMAIN_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

export function evaluateVal01DomainQualification(
  checks: Val01QualificationChecks,
): Val01QualificationResult {
  const blockers: string[] = [];
  if (!checks.coreTypesDefined) blockers.push('core_types');
  if (!checks.valuationMethodsComplete) blockers.push('valuation_methods');
  if (!checks.applicabilityRulesEnforced) blockers.push('applicability_rules');
  if (!checks.assumptionsExplicitAndVersioned) blockers.push('assumptions');
  if (!checks.knowableAtEnforced) blockers.push('knowable_at');
  if (!checks.noExecutionAuthorityOnArtifacts) blockers.push('execution_authority');
  if (!checks.consumesSecFundamentalsNotDuplicate) blockers.push('sec_fundamentals_extension');
  if (!checks.consumesEarn09NotDuplicate) blockers.push('earn09_extension');
  if (!checks.consumesAafV2NotDuplicate) blockers.push('aaf_v2_extension');
  if (!checks.consumesMacroYieldRates) blockers.push('macro_yield_rates');
  if (!checks.strategyLabBindingDefined) blockers.push('strategy_lab_binding');
  if (!checks.featureFabricBridgeDefined) blockers.push('feature_fabric_bridge');

  const qualified = blockers.length === 0;
  return Object.freeze({
    marker: qualified ? HELIOS_VAL01_VALUATION_DOMAIN_QUALIFIED : HELIOS_VAL01_VALUATION_DOMAIN_BLOCKED,
    qualified,
    blockers: Object.freeze(blockers),
  });
}
