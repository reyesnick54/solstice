import { createHash } from 'node:crypto';

import type { UtcInstant } from '@solstice/domain';
import { pickPrimaryBenchmark } from './benchmarks.ts';
import { bpsFromMinorDelta, signedSlippageMinor } from './numeric.ts';
import { EXEC07_RULE_FLAGS } from './taxonomy.ts';
import { HELIOS_EXEC07_TCA_SCHEMA } from './taxonomy.ts';
import type { ExecutionBenchmarkKind } from './taxonomy.ts';
import type { StrategyExecutionAlphaDecomposition, TransactionCostAnalysis } from './types.ts';

export type AlphaDecompositionInput = {
  readonly strategyCapsuleId: string;
  readonly orderId: string;
  readonly currency: string;
  readonly side: 'BUY' | 'SELL';
  readonly decisionPriceMinor: bigint | null;
  readonly exitOrMarkPriceMinor: bigint;
  readonly quantityFilledUnits: bigint;
  readonly transactionCost: TransactionCostAnalysis;
  readonly benchmarkKind?: ExecutionBenchmarkKind;
  readonly computedAt: UtcInstant;
};

/**
 * Separates strategy timing/selection PnL from execution quality.
 * When benchmarks are incomplete, strategy alpha is withheld — poor construction must not inflate strategy credit.
 */
export function decomposeStrategyAndExecutionAttribution(
  input: AlphaDecompositionInput,
): StrategyExecutionAlphaDecomposition {
  const preferred = input.benchmarkKind ?? 'DECISION_PRICE';
  const strategyBenchmark =
    input.transactionCost.benchmarks.find((row) => row.kind === preferred && row.dataComplete) ??
    pickPrimaryBenchmark(input.transactionCost.benchmarks, preferred);

  const fillBenchmark = pickPrimaryBenchmark(input.transactionCost.benchmarks, 'ARRIVAL_PRICE');

  const benchmarkConstructionComplete = input.transactionCost.benchmarkConstructionComplete;
  const suppressesStrategyCredit = !benchmarkConstructionComplete || strategyBenchmark == null;

  const filledQty = input.quantityFilledUnits;
  let strategyAlphaMinor: bigint | null = null;
  let executionAlphaOrCostMinor: bigint | null = null;

  if (!suppressesStrategyCredit && strategyBenchmark?.priceMinor != null && filledQty > 0n) {
    const decision = strategyBenchmark.priceMinor;
    const mark = input.exitOrMarkPriceMinor;
    const directional = input.side === 'BUY' ? mark - decision : decision - mark;
    strategyAlphaMinor = directional * filledQty;
  }

  if (input.transactionCost.slippageMinor != null) {
    executionAlphaOrCostMinor = -input.transactionCost.slippageMinor;
  } else if (input.transactionCost.implementationShortfallMinor != null) {
    executionAlphaOrCostMinor = -input.transactionCost.implementationShortfallMinor;
  }

  const totalObservedPnlMinor =
    strategyAlphaMinor != null && executionAlphaOrCostMinor != null
      ? strategyAlphaMinor + executionAlphaOrCostMinor
      : strategyAlphaMinor ?? executionAlphaOrCostMinor ?? 0n;

  const notional =
    strategyBenchmark?.priceMinor != null && filledQty > 0n
      ? strategyBenchmark.priceMinor * filledQty
      : fillBenchmark?.priceMinor != null && filledQty > 0n
        ? fillBenchmark.priceMinor * filledQty
        : 0n;

  const material = `${input.orderId}:${input.strategyCapsuleId}:${totalObservedPnlMinor.toString()}`;
  const decompositionId = `exec07_alpha_${createHash('sha256').update(material).digest('hex').slice(0, 18)}`;

  const benchmarkKindUsed = strategyBenchmark?.kind ?? preferred;

  return Object.freeze({
    decompositionId,
    schema: HELIOS_EXEC07_TCA_SCHEMA,
    strategyCapsuleId: input.strategyCapsuleId,
    orderId: input.orderId,
    currency: input.currency,
    totalObservedPnlMinor,
    strategyAlphaMinor,
    executionAlphaOrCostMinor,
    strategyAlphaBps:
      strategyAlphaMinor != null && notional > 0n ? bpsFromMinorDelta(strategyAlphaMinor, notional) : null,
    executionAlphaOrCostBps:
      executionAlphaOrCostMinor != null && notional > 0n
        ? bpsFromMinorDelta(executionAlphaOrCostMinor, notional)
        : null,
    benchmarkKindUsed,
    benchmarkConstructionComplete,
    suppressesStrategyCredit,
    rules: EXEC07_RULE_FLAGS,
    computedAt: input.computedAt,
  });
}

/** Guardrail helper — rejects strategy promotion when benchmarks were not built correctly. */
export function strategyCreditAllowed(decomposition: StrategyExecutionAlphaDecomposition): boolean {
  return !decomposition.suppressesStrategyCredit && decomposition.strategyAlphaMinor != null;
}

/** Cross-check slippage sign vs fill for diagnostics (does not mutate attribution). */
export function crossCheckSlippage(input: {
  readonly side: 'BUY' | 'SELL';
  readonly arrivalPriceMinor: bigint;
  readonly fillPriceMinor: bigint;
  readonly quantityUnits: bigint;
}): bigint {
  return signedSlippageMinor({
    side: input.side,
    benchmarkPriceMinor: input.arrivalPriceMinor,
    fillPriceMinor: input.fillPriceMinor,
    quantityUnits: input.quantityUnits,
  });
}
