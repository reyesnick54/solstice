import {
  HELIOS_ALPHA12_CAPACITY_ENGINE_BLOCKED,
  HELIOS_ALPHA12_CAPACITY_ENGINE_QUALIFIED,
} from './taxonomy.ts';
import { allScaleMultipliersPresent } from './break-even.ts';
import type { Alpha12CapacityEngineResult } from './types.ts';

export { HELIOS_ALPHA12_CAPACITY_ENGINE_QUALIFIED, HELIOS_ALPHA12_CAPACITY_ENGINE_BLOCKED };

export type Alpha12QualificationChecks = {
  readonly allScaleMultipliersPresent: boolean;
  readonly nonLinearReturnsEnforced: boolean;
  readonly breakEvenPresent: boolean;
  readonly ceilingPresent: boolean;
  readonly liquidityEnvelopePresent: boolean;
  readonly researchOnly: boolean;
  readonly noExecutionAuthority: boolean;
};

export type Alpha12QualificationResult = {
  readonly qualified: boolean;
  readonly marker:
    | typeof HELIOS_ALPHA12_CAPACITY_ENGINE_QUALIFIED
    | typeof HELIOS_ALPHA12_CAPACITY_ENGINE_BLOCKED;
  readonly blockers: readonly string[];
};

export function evaluateAlpha12CapacityQualification(
  result: Alpha12CapacityEngineResult,
): Alpha12QualificationResult {
  const curve = result.curve;
  const checks: Alpha12QualificationChecks = {
    allScaleMultipliersPresent: allScaleMultipliersPresent(curve.scenarios),
    nonLinearReturnsEnforced: curve.nonLinearReturnsEnforced === true,
    breakEvenPresent: curve.breakEven.method === 'INTERPOLATED_SCALE_CURVE',
    ceilingPresent: curve.ceiling.uncertaintyBps >= 0,
    liquidityEnvelopePresent: curve.liquidity.bindingConstraint !== undefined,
    researchOnly: result.researchOnly === true,
    noExecutionAuthority: result.grantsExecutionAuthority === false,
  };

  const blockers: string[] = [];
  for (const [key, ok] of Object.entries(checks)) {
    if (!ok) blockers.push(key);
  }

  const at1 = curve.scenarios.find((row) => row.scaleMultiplier === 1 && row.liquidityPermitted);
  const at2 = curve.scenarios.find((row) => row.scaleMultiplier === 2 && row.liquidityPermitted);
  if (at1 && at2 && !(at2.grossAlphaBps < at1.grossAlphaBps - 1e-6)) {
    blockers.push('gross_alpha_linear_extrapolation_detected');
  }

  const qualified = blockers.length === 0;
  return Object.freeze({
    qualified,
    marker: qualified ? HELIOS_ALPHA12_CAPACITY_ENGINE_QUALIFIED : HELIOS_ALPHA12_CAPACITY_ENGINE_BLOCKED,
    blockers: Object.freeze(blockers),
  });
}
