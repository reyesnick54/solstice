import {
  HELIOS_VAL10_UNCERTAINTY_ENGINE_BLOCKED,
  HELIOS_VAL10_UNCERTAINTY_ENGINE_QUALIFIED,
} from './taxonomy.ts';
import type { Val10UncertaintyEngineResult } from './types.ts';

export { HELIOS_VAL10_UNCERTAINTY_ENGINE_QUALIFIED, HELIOS_VAL10_UNCERTAINTY_ENGINE_BLOCKED };

export type Val10QualificationChecks = {
  readonly monteCarloAttributionPresent: boolean;
  readonly terminalDependencePresent: boolean;
  readonly fragilityDimensionsExposed: boolean;
  readonly confidencePolicyApplied: boolean;
  readonly deterministicSeedRecorded: boolean;
};

export type Val10QualificationResult = {
  readonly qualified: boolean;
  readonly marker:
    | typeof HELIOS_VAL10_UNCERTAINTY_ENGINE_QUALIFIED
    | typeof HELIOS_VAL10_UNCERTAINTY_ENGINE_BLOCKED;
  readonly blockers: readonly string[];
};

export function evaluateVal10UncertaintyQualification(
  result: Val10UncertaintyEngineResult,
): Val10QualificationResult {
  const checks: Val10QualificationChecks = {
    monteCarloAttributionPresent: result.uncertainty.varianceContributions.length >= 6,
    terminalDependencePresent: result.terminalDependence.terminalValueShareOfEnterpriseValue >= 0,
    fragilityDimensionsExposed: result.fragility.fragility.dimensions.length >= 7,
    confidencePolicyApplied: result.confidence.policyVersion === 'val10-confidence-v1',
    deterministicSeedRecorded: Number.isFinite(result.seed),
  };

  const blockers: string[] = [];
  for (const [key, ok] of Object.entries(checks)) {
    if (!ok) blockers.push(key);
  }

  const qualified = blockers.length === 0;
  return Object.freeze({
    qualified,
    marker: qualified ? HELIOS_VAL10_UNCERTAINTY_ENGINE_QUALIFIED : HELIOS_VAL10_UNCERTAINTY_ENGINE_BLOCKED,
    blockers: Object.freeze(blockers),
  });
}
