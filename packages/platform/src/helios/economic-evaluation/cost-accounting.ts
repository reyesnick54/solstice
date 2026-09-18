import { evaluationMoney, sumMoney } from './money.ts';
import type { EvaluationMoney, ResearchCostLine } from './types.ts';
import type { CostLabel, ResearchCostSource } from './taxonomy.ts';

export function allocateResearchCost(input: {
  readonly currency: string;
  readonly source: ResearchCostSource;
  readonly amountMinor: string;
  readonly label: CostLabel;
  readonly reference: string;
}): ResearchCostLine {
  return Object.freeze({
    source: input.source,
    label: input.label,
    amount: evaluationMoney(input.amountMinor, input.currency),
    reference: input.reference,
  });
}

export function totalResearchCost(lines: readonly ResearchCostLine[]): EvaluationMoney {
  return sumMoney(lines.map((row) => row.amount));
}

export function splitOperatingAndAllocated(lines: readonly ResearchCostLine[]): {
  readonly operating: readonly ResearchCostLine[];
  readonly economicallyAllocated: readonly ResearchCostLine[];
} {
  return Object.freeze({
    operating: Object.freeze(lines.filter((row) => row.label === 'OPERATING_COST')),
    economicallyAllocated: Object.freeze(lines.filter((row) => row.label === 'ECONOMICALLY_ALLOCATED_COST')),
  });
}

export function normalizeBaselineBudget(input: {
  readonly baselineBudgetMinor: string;
  readonly subjectBudgetMinor: string;
  readonly baselineNetMinor: string;
  readonly currency: string;
}): { readonly normalizedNetMinor: string; readonly budgetNormalized: true } {
  const baselineBudget = BigInt(input.baselineBudgetMinor);
  const subjectBudget = BigInt(input.subjectBudgetMinor);
  const baselineNet = BigInt(input.baselineNetMinor);
  if (baselineBudget === 0n || subjectBudget === 0n) {
    return Object.freeze({ normalizedNetMinor: input.baselineNetMinor, budgetNormalized: true });
  }
  const scaled = (baselineNet * subjectBudget) / baselineBudget;
  return Object.freeze({ normalizedNetMinor: scaled.toString(), budgetNormalized: true });
}
