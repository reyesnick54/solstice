/**
 * Wave 9 qualification gates — invariant checks for chaos/reliability runs.
 */

import { ENVIRONMENT, LIVE_MONEY_ENABLED, LIVE_PAYMENTS_ENABLED } from '../../../packages/config/src/flags.ts';
import type { QualificationStatus } from '../../lib/targets.ts';

export type Wave9GateResult = {
  readonly gate: string;
  readonly passed: boolean;
  readonly note: string;
};

export function assertSimulationOnly(): Wave9GateResult {
  const passed = ENVIRONMENT === 'simulation' && !LIVE_MONEY_ENABLED && !LIVE_PAYMENTS_ENABLED;
  return {
    gate: 'SIMULATION_ONLY',
    passed,
    note: passed ? 'ENVIRONMENT=simulation; LIVE_* flags false' : 'Production flags must not change during chaos',
  };
}

export function assertNoInventedJournals(journalCountBefore: number, journalCountAfter: number): Wave9GateResult {
  const passed = journalCountAfter <= journalCountBefore;
  return {
    gate: 'NO_INVENTED_JOURNALS',
    passed,
    note: passed
      ? `Journals ${journalCountBefore} → ${journalCountAfter}`
      : `Journal count increased without Execution Authority: ${journalCountBefore} → ${journalCountAfter}`,
  };
}

export function assertSupplyUnchanged(before: bigint, after: bigint): Wave9GateResult {
  const passed = before === after;
  return {
    gate: 'SUPPLY_UNCHANGED',
    passed,
    note: passed ? `Supply ${before.toString()}` : `Supply mutated: ${before.toString()} → ${after.toString()}`,
  };
}

export function assertFailClosedOnWrite(httpStatus: number): Wave9GateResult {
  const passed = httpStatus === 401 || httpStatus === 403 || httpStatus === 503 || httpStatus === 429;
  return {
    gate: 'SENSITIVE_WRITE_FAIL_CLOSED',
    passed,
    note: passed ? `Write refused/degraded with ${httpStatus}` : `Unexpected write status ${httpStatus}`,
  };
}

export function assertControlledDegradation(
  httpStatuses: readonly number[],
  allowed: readonly number[],
): Wave9GateResult {
  const unexpected = httpStatuses.filter((status) => !allowed.includes(status));
  const passed = unexpected.length === 0;
  return {
    gate: 'CONTROLLED_DEGRADATION',
    passed,
    note: passed
      ? `All ${httpStatuses.length} responses within allowed set`
      : `Unexpected statuses: ${unexpected.join(', ')}`,
  };
}

export function mergeGateStatus(gates: readonly Wave9GateResult[]): QualificationStatus {
  if (gates.every((gate) => gate.passed)) return 'TARGET_MET';
  if (gates.some((gate) => !gate.passed)) return 'TARGET_NOT_MET';
  return 'BENCHMARKED';
}
