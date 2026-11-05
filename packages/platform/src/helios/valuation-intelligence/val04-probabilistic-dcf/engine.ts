import { evaluateMedianAssumptionPath, runMonteCarloDcf } from './monte-carlo.ts';
import { distributionPercentiles } from './percentiles.ts';
import { buildSensitivitySurfaces } from './sensitivity.ts';
import {
  DEFAULT_VAL04_SEED,
  HELIOS_VAL04_PROBABILISTIC_DCF_QUALIFIED,
  VAL04_PROBABILISTIC_DCF_SCHEMA,
} from './taxonomy.ts';
import type { ProbabilisticDcfInput, ProbabilisticDcfResult, TerminalValueMethod } from './types.ts';

export function runProbabilisticDcfEngine(input: ProbabilisticDcfInput): ProbabilisticDcfResult {
  const seed = input.seed ?? DEFAULT_VAL04_SEED;
  const withSeed = input.seed === undefined ? { ...input, seed } : input;
  const mc = runMonteCarloDcf(withSeed);
  const representativePath = evaluateMedianAssumptionPath(withSeed);

  const enterpriseValues = mc.paths.map((p) => p.enterpriseValue);
  const equityValues = mc.paths.map((p) => p.equityValue);
  const perShare = mc.paths.map((p) => p.valuePerShare);
  const terminalFcff = mc.paths.map((p) => p.yearly[p.yearly.length - 1]!.fcff);
  const terminalFcfe = mc.paths.map((p) => p.yearly[p.yearly.length - 1]!.fcfe);

  const terminalMethod = resolveTerminalMethod(input.terminal.method);

  return Object.freeze({
    schema: VAL04_PROBABILISTIC_DCF_SCHEMA,
    valuationId: input.valuationId,
    entityLabel: input.entityLabel,
    grantsExecutionAuthority: false,
    researchOnly: true,
    seed,
    pathCount: mc.paths.length,
    terminalMethod,
    representativePath,
    enterpriseValue: distributionPercentiles(enterpriseValues),
    equityValue: distributionPercentiles(equityValues),
    valuePerShare: distributionPercentiles(perShare),
    fcffTerminalYear: distributionPercentiles(terminalFcff),
    fcfeTerminalYear: distributionPercentiles(terminalFcfe),
    sensitivitySurfaces: buildSensitivitySurfaces(withSeed),
    constraintViolations: mc.constraintViolations,
    qualificationMarker: HELIOS_VAL04_PROBABILISTIC_DCF_QUALIFIED,
  });
}

function resolveTerminalMethod(method: ProbabilisticDcfInput['terminal']['method']): TerminalValueMethod {
  if (method === 'FADE_TO_MATURITY') {
    return 'FADE_TO_MATURITY';
  }
  return method;
}
