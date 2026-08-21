import type { UtcInstant } from '../../../domain/src/time.ts';
import type { ReconciliationRunId } from '../ids.ts';
import type { ReconciliationBreak } from './breaks.ts';
import type { ReconciliationEngineResult } from './reconciliation-engine.ts';

export type ReconciliationRun = {
  readonly runId: ReconciliationRunId;
  readonly periodStart: UtcInstant;
  readonly periodEnd: UtcInstant;
  readonly provider: string;
  readonly sourceVersion: string;
  readonly inputHash: string;
  readonly matchedCount: number;
  readonly breakCount: number;
  readonly breakIds: readonly string[];
  readonly createdAt: UtcInstant;
};

export function freezeReconciliationRun(input: ReconciliationRun): ReconciliationRun {
  return Object.freeze({
    ...input,
    breakIds: Object.freeze([...input.breakIds]),
  });
}

export function runFromEngineResult(input: {
  readonly runId: ReconciliationRunId;
  readonly periodStart: UtcInstant;
  readonly periodEnd: UtcInstant;
  readonly provider: string;
  readonly sourceVersion: string;
  readonly result: ReconciliationEngineResult;
  readonly breaks: readonly ReconciliationBreak[];
  readonly createdAt: UtcInstant;
}): ReconciliationRun {
  return freezeReconciliationRun({
    runId: input.runId,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    provider: input.provider,
    sourceVersion: input.sourceVersion,
    inputHash: input.result.inputHash,
    matchedCount: input.result.matchedCount,
    breakCount: input.result.breakCount,
    breakIds: input.breaks.map((row) => row.breakId),
    createdAt: input.createdAt,
  });
}
