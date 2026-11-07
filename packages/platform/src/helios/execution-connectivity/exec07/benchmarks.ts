import type { UtcInstant } from '@solstice/domain';
import { HELIOS_EXEC07_TCA_SCHEMA } from './taxonomy.ts';
import type { ExecutionBenchmarkKind } from './taxonomy.ts';
import type { ExecutionBenchmark } from './types.ts';

export type ExecutionBenchmarkPriceInput = {
  readonly decisionPriceMinor: bigint | null;
  readonly decisionAt: UtcInstant | null;
  readonly arrivalPriceMinor: bigint | null;
  readonly arrivalAt: UtcInstant | null;
  readonly midAtArrivalMinor: bigint | null;
  readonly nbboMidMinor: bigint | null;
  readonly bboMidMinor: bigint | null;
  readonly vwapMinor: bigint | null;
  readonly closeMinor: bigint | null;
  readonly implementationShortfallBenchmarkMinor: bigint | null;
};

function bench(
  kind: ExecutionBenchmarkKind,
  priceMinor: bigint | null,
  asOf: UtcInstant | null,
  explanation: string,
): ExecutionBenchmark {
  const dataComplete = priceMinor != null && priceMinor > 0n;
  return Object.freeze({
    schema: HELIOS_EXEC07_TCA_SCHEMA,
    kind,
    priceMinor: dataComplete ? priceMinor : null,
    asOf,
    dataComplete,
    explanation,
  });
}

export function buildExecutionBenchmarks(input: ExecutionBenchmarkPriceInput): readonly ExecutionBenchmark[] {
  const useNbbo = input.nbboMidMinor != null;
  const useBbo = !useNbbo && input.bboMidMinor != null;
  const quotes: ExecutionBenchmark[] = [
    bench('DECISION_PRICE', input.decisionPriceMinor, input.decisionAt, 'strategy_decision_reference'),
    bench('ARRIVAL_PRICE', input.arrivalPriceMinor, input.arrivalAt, 'order_arrival_reference'),
    bench('MID_AT_ARRIVAL', input.midAtArrivalMinor, input.arrivalAt, 'midpoint_at_arrival'),
  ];
  if (useNbbo) {
    quotes.push(bench('NBBO', input.nbboMidMinor, input.arrivalAt, 'consolidated_nbbo_mid'));
  } else if (useBbo) {
    quotes.push(bench('BBO', input.bboMidMinor, input.arrivalAt, 'venue_bbo_mid'));
  }
  quotes.push(
    bench('VWAP', input.vwapMinor, input.arrivalAt, 'session_vwap_reference'),
    bench('CLOSE', input.closeMinor, input.arrivalAt, 'session_close_reference'),
    bench(
      'IMPLEMENTATION_SHORTFALL',
      input.implementationShortfallBenchmarkMinor ?? input.arrivalPriceMinor,
      input.arrivalAt,
      'implementation_shortfall_benchmark',
    ),
  );
  return Object.freeze(quotes);
}

export function pickPrimaryBenchmark(
  benchmarks: readonly ExecutionBenchmark[],
  preferred: ExecutionBenchmarkKind = 'ARRIVAL_PRICE',
): ExecutionBenchmark | null {
  const primary = benchmarks.find((row) => row.kind === preferred);
  if (primary?.dataComplete) {
    return primary;
  }
  const fallback = benchmarks.find((row) => row.dataComplete);
  return fallback ?? null;
}

export function benchmarkConstructionComplete(benchmarks: readonly ExecutionBenchmark[]): boolean {
  const required: ExecutionBenchmarkKind[] = ['DECISION_PRICE', 'ARRIVAL_PRICE', 'IMPLEMENTATION_SHORTFALL'];
  return required.every((kind) => benchmarks.some((row) => row.kind === kind && row.dataComplete));
}
