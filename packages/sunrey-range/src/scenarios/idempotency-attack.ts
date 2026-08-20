import { decideRetry } from '../../../payments/src/rail-retry.ts';
import { IdempotencyStore, bindIdempotencyKey } from '../../../sunrey-sdk/src/idempotency.ts';
import {
  createWithdrawalSubmission,
  queryBeforeRetry,
  resetWithdrawals,
  submitWithdrawal,
} from '../../../custody/src/provider-candidate/withdrawals.ts';
import { FixtureCustodyTransport } from '../../../custody/src/provider-candidate/transport.ts';
import { runProductionAttack, safetyScenario } from './production-helpers.ts';
import type { AttackResult, AttackScenario } from '../types.ts';
import type { RangeEnvironment } from '../environment.ts';

const INVARIANTS = [
  'UNKNOWN_SUBMISSION_NOT_BLINDLY_RETRIED',
  'NO_DUPLICATE_FINANCIAL_CONSEQUENCE',
  'LEDGER_APPEND_ONLY',
] as const;

export const idempotencyAttackScenarios: readonly AttackScenario[] = [
  'IDEM-PROVIDER-SUCCESS-LOST-RESPONSE',
  'IDEM-PROCESS-RESTART',
  'IDEM-DUPLICATE-COMMAND',
  'IDEM-QUERY-NOT-RESUBMIT',
  'IDEM-RETRY-PRESSURE',
].map((scenarioId, index) =>
  safetyScenario({
    scenarioId,
    seed: 15920 + index,
    category: 'DISTRIBUTED_IDEMPOTENCY_ABUSE',
    subsystem: 'idempotency',
    attack: scenarioId.toLowerCase().replace('idem-', '').replaceAll('-', ' '),
    invariants: INVARIANTS,
    detection: 'QUERY_BEFORE_RETRY',
    recovery: 'IDEMPOTENT_RECONCILE',
  }),
);

export function runIdempotencyAttack(env: RangeEnvironment, scenario: AttackScenario): AttackResult {
  return runProductionAttack(env, scenario, () => {
    resetWithdrawals();
    const store = new IdempotencyStore();
    const binding = bindIdempotencyKey({
      actor: 'cus_1',
      operation: 'withdraw',
      canonicalContent: JSON.stringify({ withdrawalId: 'wd_unknown', amount: '5' }),
    });
    store.remember('idem-wd', binding, '{"state":"SUBMISSION_UNKNOWN"}');
    const replay = store.remember('idem-wd', binding, '{"state":"SUBMISSION_UNKNOWN"}');
    const decision = decideRetry('SUBMIT', 'UNKNOWN', { executionUnknown: true });
    const withdrawal = createWithdrawalSubmission({
      withdrawalId: `wd_${scenario.seed}`,
      assetId: 'SUNREY_COIN',
      quantity: 5n,
      destination: 'sr1_clear_a',
    });
    const transport = new FixtureCustodyTransport();
    const first = submitWithdrawal(withdrawal.withdrawalId, transport, { timeoutAfterPossibleBroadcast: true });
    const second = submitWithdrawal(withdrawal.withdrawalId, transport);
    const queried = queryBeforeRetry({
      withdrawalId: withdrawal.withdrawalId,
      transport,
      providerFound: true,
      chainFound: true,
    });
    const blocked =
      replay === 'REPLAY' &&
      decision.allowed === false &&
      decision.retryClass === 'DO_NOT_RETRY_WITHOUT_QUERY' &&
      first.ok &&
      first.value.state === 'SUBMISSION_UNKNOWN' &&
      !second.ok &&
      queried.ok;
    return {
      blocked,
      safetyHeld: blocked,
      livenessDegraded: true,
      detail: `${scenario.scenarioId} replay=${replay} retry=${decision.retryClass} second=${second.ok} queried=${queried.ok}`,
    };
  });
}
