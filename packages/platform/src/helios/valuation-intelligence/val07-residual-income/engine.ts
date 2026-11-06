import type { UtcInstant } from '@solstice/domain';

import { distributionPercentiles } from '../val04-probabilistic-dcf/percentiles.ts';
import { VAL07_RESIDUAL_INCOME_SCHEMA } from './taxonomy.ts';

export type ResidualIncomePathInput = {
  readonly bookValuePerShare: number;
  readonly roeSamples: readonly number[];
  readonly costOfEquitySamples: readonly number[];
  readonly persistenceYears: number;
  readonly terminalGrowth: number;
};

export type ResidualIncomeResult = {
  readonly schema: typeof VAL07_RESIDUAL_INCOME_SCHEMA;
  readonly entityId: string;
  readonly asOf: UtcInstant;
  readonly valuePerShare: ReturnType<typeof distributionPercentiles>;
  readonly pathCount: number;
  readonly evidenceRef: string;
  readonly grantsExecutionAuthority: false;
  readonly researchOnly: true;
};

function pvResidualIncome(input: {
  readonly book: number;
  readonly roe: number;
  readonly coe: number;
  readonly years: number;
  readonly terminalGrowth: number;
}): number {
  let value = input.book;
  let pv = 0;
  for (let year = 1; year <= input.years; year += 1) {
    const residual = (input.roe - input.coe) * value;
    pv += residual / (1 + input.coe) ** year;
    value *= 1 + input.roe * 0.35;
  }
  const terminalResidual = (input.roe - input.coe) * value;
  const terminal = terminalResidual * (1 + input.terminalGrowth);
  pv += terminal / ((input.coe - input.terminalGrowth) * (1 + input.coe) ** input.years);
  return input.book + pv;
}

export function runResidualIncomeEngine(input: {
  readonly entityId: string;
  readonly asOf: UtcInstant;
  readonly paths: ResidualIncomePathInput;
  readonly evidenceRef: string;
}): ResidualIncomeResult {
  const count = Math.min(
    input.paths.roeSamples.length,
    input.paths.costOfEquitySamples.length,
  );
  const perShare: number[] = [];
  for (let i = 0; i < count; i += 1) {
    perShare.push(
      pvResidualIncome({
        book: input.paths.bookValuePerShare,
        roe: input.paths.roeSamples[i]!,
        coe: input.paths.costOfEquitySamples[i]!,
        years: input.paths.persistenceYears,
        terminalGrowth: input.paths.terminalGrowth,
      }),
    );
  }
  return Object.freeze({
    schema: VAL07_RESIDUAL_INCOME_SCHEMA,
    entityId: input.entityId,
    asOf: input.asOf,
    valuePerShare: distributionPercentiles(perShare),
    pathCount: perShare.length,
    evidenceRef: input.evidenceRef,
    grantsExecutionAuthority: false,
    researchOnly: true,
  });
}
