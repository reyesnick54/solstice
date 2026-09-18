import type { CustomerId } from '../../../../domain/src/customer.ts';
import type { UtcInstant } from '../../../../domain/src/time.ts';
import { evaluationRunIdFor, type HeliosEvaluationRunId, type HeliosExperimentId } from './ids.ts';
import { detectHiddenCapital, rejectHiddenCapital } from './hidden-capital.ts';
import { computeNetEconomics } from './net-economics.ts';
import { evaluationMoney } from './money.ts';
import type { ChallengeTrack, RunOutcome } from './taxonomy.ts';
import type { EvaluationRunInput, EvaluationRunRecord } from './types.ts';

export function recordEvaluationRun(input: EvaluationRunInput & { readonly now: UtcInstant }): EvaluationRunRecord {
  const currency = input.startCapital.currency;
  const net = computeNetEconomics({
    currency,
    grossResultMinor: input.grossResultMinor,
    commissionsMinor: input.commissionsMinor,
    spreadCostMinor: input.spreadCostMinor,
    slippageCostMinor: input.slippageCostMinor,
    fundingCostMinor: input.fundingCostMinor,
    dataCostMinor: input.dataCostMinor,
    researchCostMinor: input.researchCostMinor,
    realizedMinor: input.realizedMinor,
    cashMinor: input.cashMinor,
  });
  const endingCapital = evaluationMoney(
    (BigInt(input.startCapital.minorUnits) + BigInt(net.netResult.minorUnits)).toString(),
    currency,
  );
  const hiddenFindings = detectHiddenCapital({
    startCapital: input.startCapital,
    endingCapital,
    declaredDeposits: input.depositsDuringRun ?? [],
    netResultMinor: net.netResult.minorUnits,
    researchCostMinor: input.researchCostMinor,
    ...(input.hiddenCapitalEvents ? { hiddenCapitalEvents: input.hiddenCapitalEvents } : {}),
  });
  const outcome: RunOutcome =
    hiddenFindings.some((row) => row.detected) ? 'FAILED' : (input.outcome ?? 'COMPLETED');
  return Object.freeze({
    runId: evaluationRunIdFor(),
    experimentId: input.experimentId,
    customerId: input.customerId,
    track: input.track ?? null,
    startedAt: input.now,
    endedAt: input.now,
    outcome,
    startCapital: input.startCapital,
    endingCapital,
    maxDrawdownBps: input.maxDrawdownBps,
    grossResult: net.grossResult,
    netResult: net.netResult,
    realizableNetValue: net.realizableNetValue,
    researchCost: evaluationMoney(input.researchCostMinor, currency),
    fees: evaluationMoney(input.commissionsMinor, currency),
    failedStrategies: Object.freeze([...(input.failedStrategies ?? [])]),
    outageMs: input.outageMs ?? 0,
    noActionPeriodMs: input.noActionPeriodMs ?? 0,
    liquidationReason: input.liquidationReason ?? null,
    limitations: Object.freeze([...(input.limitations ?? [])]),
    decisionCount: input.decisionCount ?? 0,
    tradeCount: input.tradeCount ?? 0,
    hiddenCapitalFindings: hiddenFindings,
    principalDepositsExcludedFromGrowth: true,
    deleted: false,
  });
}

export function assertRunPersists(record: EvaluationRunRecord): true {
  if (record.deleted) {
    throw new Error('failed runs must not be deleted from registry');
  }
  return true;
}

export function listRunsForExperiment(
  runs: readonly EvaluationRunRecord[],
  experimentId: HeliosExperimentId,
): readonly EvaluationRunRecord[] {
  return Object.freeze(runs.filter((row) => row.experimentId === experimentId));
}

export function listRunsForCustomer(
  runs: readonly EvaluationRunRecord[],
  customerId: CustomerId,
): readonly EvaluationRunRecord[] {
  return Object.freeze(runs.filter((row) => row.customerId === customerId));
}

export function validateRunForRegistry(record: EvaluationRunRecord): {
  readonly accepted: boolean;
  readonly reason: string | null;
} {
  const hidden = rejectHiddenCapital(record.hiddenCapitalFindings);
  if (!hidden.ok) {
    return Object.freeze({ accepted: true, reason: 'recorded with hidden-capital finding' });
  }
  return Object.freeze({ accepted: true, reason: null });
}

export function findRunById(
  runs: readonly EvaluationRunRecord[],
  runId: HeliosEvaluationRunId,
): EvaluationRunRecord | undefined {
  return runs.find((row) => row.runId === runId);
}
