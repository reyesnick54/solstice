import { evaluationMoney, subtractMoney } from './money.ts';
import { normalizeBaselineBudget } from './cost-accounting.ts';
import type {
  BenchmarkComparison,
  IntelligenceComparisonRow,
} from './types.ts';
import type { BenchmarkKind, IntelligenceBaseline } from './taxonomy.ts';

export function compareToBenchmark(input: {
  readonly currency: string;
  readonly benchmarkKind: BenchmarkKind;
  readonly methodology: string;
  readonly benchmarkNetMinor: string;
  readonly subjectNetMinor: string;
}): BenchmarkComparison {
  const benchmarkNetResult = evaluationMoney(input.benchmarkNetMinor, input.currency);
  const subjectNetResult = evaluationMoney(input.subjectNetMinor, input.currency);
  return Object.freeze({
    benchmarkKind: input.benchmarkKind,
    benchmarkNetResult,
    subjectNetResult,
    excessNetResult: subtractMoney(subjectNetResult, benchmarkNetResult),
    methodology: input.methodology,
  });
}

export function buildIntelligenceComparison(input: {
  readonly currency: string;
  readonly normalizedBudgetMinor: string;
  readonly rows: readonly {
    readonly baseline: IntelligenceBaseline;
    readonly researchBudgetMinor: string;
    readonly netResultMinor: string;
    readonly decisionCount: number;
  }[];
}): readonly IntelligenceComparisonRow[] {
  return Object.freeze(
    input.rows.map((row) => {
      const normalized = normalizeBaselineBudget({
        baselineBudgetMinor: row.researchBudgetMinor,
        subjectBudgetMinor: input.normalizedBudgetMinor,
        baselineNetMinor: row.netResultMinor,
        currency: input.currency,
      });
      return Object.freeze({
        baseline: row.baseline,
        researchBudget: evaluationMoney(row.researchBudgetMinor, input.currency),
        netResult: evaluationMoney(normalized.normalizedNetMinor, input.currency),
        decisionCount: row.decisionCount,
        budgetNormalized: true,
      });
    }),
  );
}
