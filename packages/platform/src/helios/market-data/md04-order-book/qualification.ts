/**
 * HELIOS MARKET DATA MD04 qualification gate.
 */

export const HELIOS_MD04_ORDER_BOOK_RECONSTRUCTION_QUALIFIED =
  'HELIOS_MD04_ORDER_BOOK_RECONSTRUCTION_QUALIFIED' as const;

export const HELIOS_MD04_ORDER_BOOK_RECONSTRUCTION_BLOCKED =
  'HELIOS_MD04_ORDER_BOOK_RECONSTRUCTION_BLOCKED' as const;

export type Md04OrderBookQualificationChecks = {
  readonly deterministicHash: boolean;
  readonly l1Projection: boolean;
  readonly l2Aggregation: boolean;
  readonly l3OrderTracking: boolean;
  readonly partialExecute: boolean;
  readonly phantomDeleteDetected: boolean;
  readonly duplicateOrderRejected: boolean;
  readonly sortInvariants: boolean;
  readonly haltBlocksExecutable: boolean;
  readonly metricsTracked: boolean;
};

export type Md04OrderBookQualificationResult = {
  readonly marker:
    | typeof HELIOS_MD04_ORDER_BOOK_RECONSTRUCTION_QUALIFIED
    | typeof HELIOS_MD04_ORDER_BOOK_RECONSTRUCTION_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

export function evaluateMd04OrderBookQualification(
  checks: Md04OrderBookQualificationChecks,
): Md04OrderBookQualificationResult {
  const entries: Array<[keyof Md04OrderBookQualificationChecks, string]> = [
    ['deterministicHash', 'deterministic_hash'],
    ['l1Projection', 'l1_projection'],
    ['l2Aggregation', 'l2_aggregation'],
    ['l3OrderTracking', 'l3_order_tracking'],
    ['partialExecute', 'partial_execute'],
    ['phantomDeleteDetected', 'phantom_delete'],
    ['duplicateOrderRejected', 'duplicate_order'],
    ['sortInvariants', 'sort_invariants'],
    ['haltBlocksExecutable', 'halt_executable_gate'],
    ['metricsTracked', 'metrics_tracked'],
  ];
  const blockers = entries.filter(([key]) => !checks[key]).map(([, label]) => label);
  const qualified = blockers.length === 0;
  return Object.freeze({
    marker: qualified
      ? HELIOS_MD04_ORDER_BOOK_RECONSTRUCTION_QUALIFIED
      : HELIOS_MD04_ORDER_BOOK_RECONSTRUCTION_BLOCKED,
    qualified,
    blockers: Object.freeze(blockers),
  });
}
