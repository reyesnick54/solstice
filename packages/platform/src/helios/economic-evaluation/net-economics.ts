import { addMoney, evaluationMoney, subtractMoney } from './money.ts';
import type { EvaluationMoney, NetEconomicsBreakdown } from './types.ts';

export function computeNetEconomics(input: {
  readonly currency: string;
  readonly grossResultMinor: string;
  readonly commissionsMinor: string;
  readonly spreadCostMinor: string;
  readonly slippageCostMinor: string;
  readonly fundingCostMinor: string;
  readonly dataCostMinor: string;
  readonly researchCostMinor: string;
  readonly realizedMinor: string;
  readonly cashMinor: string;
}): NetEconomicsBreakdown {
  const currency = input.currency;
  const grossResult = evaluationMoney(input.grossResultMinor, currency);
  const commissions = evaluationMoney(input.commissionsMinor, currency);
  const spreadCost = evaluationMoney(input.spreadCostMinor, currency);
  const slippageCost = evaluationMoney(input.slippageCostMinor, currency);
  const fundingCost = evaluationMoney(input.fundingCostMinor, currency);
  const dataCost = evaluationMoney(input.dataCostMinor, currency);
  const researchCost = evaluationMoney(input.researchCostMinor, currency);
  const totalCosts = sumCosts([
    commissions,
    spreadCost,
    slippageCost,
    fundingCost,
    dataCost,
    researchCost,
  ]);
  const netResult = subtractMoney(grossResult, totalCosts);
  const realizableNetValue = evaluationMoney(
    (BigInt(input.realizedMinor) + BigInt(input.cashMinor)).toString(),
    currency,
  );
  return Object.freeze({
    grossResult,
    commissions,
    spreadCost,
    slippageCost,
    fundingCost,
    dataCost,
    researchCost,
    netResult,
    realizableNetValue,
  });
}

function sumCosts(rows: readonly EvaluationMoney[]): EvaluationMoney {
  return rows.reduce((acc, row) => addMoney(acc, row));
}

export function principalExcludedGrowth(input: {
  readonly startCapitalMinor: string;
  readonly endingCapitalMinor: string;
  readonly additionalDepositsMinor: readonly string[];
}): { readonly growthMinor: string; readonly principalExcluded: true } {
  const deposits = input.additionalDepositsMinor.reduce((acc, row) => acc + BigInt(row), 0n);
  const growth = BigInt(input.endingCapitalMinor) - BigInt(input.startCapitalMinor) - deposits;
  return Object.freeze({
    growthMinor: growth.toString(),
    principalExcluded: true,
  });
}
