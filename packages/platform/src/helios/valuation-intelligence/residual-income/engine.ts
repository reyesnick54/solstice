import { computeEconomicProfitState, classifyEconomicValueCreation } from './economic-profit.ts';
import { computeExcessReturnState } from './excess-return.ts';
import { computeResidualCashFlowState } from './residual-cash-flow.ts';
import { runResidualIncomeValuation } from './residual-income-engine.ts';
import { HELIOS_VAL07_RESIDUAL_INCOME_QUALIFIED } from './taxonomy.ts';
import type {
  EconomicProfitInput,
  ExcessReturnInput,
  ResidualCashFlowInput,
  ResidualIncomeEngineInput,
  Val07AnalysisResult,
} from './types.ts';

export type Val07AnalysisOptions = {
  readonly economicProfit?: readonly EconomicProfitInput[];
  readonly excessReturn?: readonly ExcessReturnInput[];
  readonly residualCashFlowResearch?: readonly ResidualCashFlowInput[];
};

export function runVal07ResidualIncomeAnalysis(
  residualIncomeInput: ResidualIncomeEngineInput,
  options: Val07AnalysisOptions = {},
): Val07AnalysisResult {
  const residualIncome = runResidualIncomeValuation(residualIncomeInput);

  const economicProfit = Object.freeze(
    (options.economicProfit ?? []).map((row) => computeEconomicProfitState(row)),
  );

  const lastEp = economicProfit[economicProfit.length - 1];
  const economicValueCreation =
    lastEp === undefined
      ? null
      : classifyEconomicValueCreation({
          roicBps: lastEp.roicBps,
          waccBps: lastEp.waccBps,
          investedCapital: lastEp.investedCapital,
          economicProfit: lastEp.economicProfit,
        });

  const excessReturn = Object.freeze(
    (options.excessReturn ?? []).map((row) => computeExcessReturnState(row)),
  );

  const residualCashFlowResearch = Object.freeze(
    (options.residualCashFlowResearch ?? []).map((row) => computeResidualCashFlowState(row)),
  );

  return Object.freeze({
    schema: residualIncome.schema,
    residualIncome,
    economicProfit,
    economicValueCreation,
    excessReturn,
    residualCashFlowResearch,
    qualificationMarker: HELIOS_VAL07_RESIDUAL_INCOME_QUALIFIED,
    researchOnly: true,
    grantsExecutionAuthority: false,
  });
}
