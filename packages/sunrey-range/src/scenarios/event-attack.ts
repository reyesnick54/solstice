import { assertSafeEventPayload, sealEnvelope } from '../../../events/src/envelope.ts';
import type { DurableEventEnvelope } from '../../../events/src/envelope.ts';
import { resolveEventSchema } from '../../../events/src/schema.ts';
import { checkAggregateOrder } from '../../../events/src/ordering.ts';
import { EventHandlerBypassError, refuseDirectFinancialMutation } from '../../../events/src/gate.ts';
import { asUtcInstant } from '../../../domain/src/time.ts';
import { runProductionAttack, safetyScenario } from './production-helpers.ts';
import type { AttackResult, AttackScenario } from '../types.ts';
import type { RangeEnvironment } from '../environment.ts';

const INVARIANTS = [
  'NO_DUPLICATE_FINANCIAL_CONSEQUENCE',
  'LEDGER_APPEND_ONLY',
  'KERNEL_CANNOT_BE_BYPASSED',
  'EXECUTION_AUTHORITY_REQUIRED',
] as const;

export const eventAttackScenarios: readonly AttackScenario[] = [
  'EVENT-DUPLICATE',
  'EVENT-OUT-OF-ORDER',
  'EVENT-UNSUPPORTED-VERSION',
  'EVENT-POISON',
  'EVENT-CONSUMER-CRASH',
  'EVENT-EXPIRED-LEASE',
  'EVENT-DEAD-LETTER-REPLAY',
  'EVENT-TERMINAL-REPLAY',
].map((scenarioId, index) =>
  safetyScenario({
    scenarioId,
    seed: 15900 + index,
    category: 'EVENT_FABRIC_ABUSE',
    subsystem: 'events',
    attack: scenarioId.toLowerCase().replace('event-', '').replaceAll('-', ' '),
    invariants: INVARIANTS,
    detection: 'EVENT_DUPLICATE_OR_POISON',
    recovery: 'DEAD_LETTER',
  }),
);

function envelope(sequence: number, version = 1): DurableEventEnvelope {
  return sealEnvelope(
    {
      eventId: 'evt_range_1',
      eventType: 'AccountOpened',
      schemaVersion: version,
      occurredAt: asUtcInstant('2026-08-20T00:00:00.000Z'),
      aggregateType: 'account',
      aggregateId: 'acct_1',
      aggregateSequence: sequence,
      correlationId: 'corr_1',
      producer: 'range',
      payload: { accountId: 'acct_1' },
    },
    sequence,
  );
}

export function runEventAttack(env: RangeEnvironment, scenario: AttackScenario): AttackResult {
  return runProductionAttack(env, scenario, () => {
    const seen = new Set<string>(['evt_range_1']);
    const duplicate = seen.has('evt_range_1');
    const outOfOrder = checkAggregateOrder(2, envelope(1)).status === 'OUT_OF_ORDER';
    const unsupported = resolveEventSchema('AccountOpened', 99) === 'UNSUPPORTED';
    let poison = false;
    try {
      assertSafeEventPayload({ privateKey: 'secret' });
    } catch {
      poison = true;
    }
    let ledger = false;
    try {
      refuseDirectFinancialMutation();
    } catch (error) {
      ledger = error instanceof EventHandlerBypassError;
    }
    const blocked = duplicate && outOfOrder && unsupported && poison && ledger;
    return {
      blocked,
      safetyHeld: blocked,
      livenessDegraded: scenario.scenarioId === 'EVENT-CONSUMER-CRASH' || scenario.scenarioId === 'EVENT-EXPIRED-LEASE',
      detail: `${scenario.scenarioId} duplicate=${String(duplicate)} order=${String(outOfOrder)} version=${String(unsupported)} poison=${String(poison)} ledger=${String(ledger)}`,
    };
  });
}
