import type { DomainEvent } from '../../../events/src/events.ts';
import type { CompiledEconomicMandate } from '../mandate/types.ts';
import type { GrowthPlan } from './types.ts';

const INVALIDATING_EVENT_TYPES = new Set([
  'EconomicGraphFactUpdated',
  'EconomicGraphSnapshotCreated',
  'DepositPosted',
  'WithdrawalPosted',
  'PaymentSettled',
  'AccountPositionChanged',
  'CardTransactionSettled',
  'MandateRevoked',
  'MandatePaused',
  'MandateActivated',
]);

export function eventInvalidatesPlan(eventType: string): boolean {
  return INVALIDATING_EVENT_TYPES.has(eventType);
}

export function shouldInvalidatePlan(input: {
  readonly plan: GrowthPlan;
  readonly mandate?: CompiledEconomicMandate;
  readonly event?: Pick<DomainEvent, 'eventType'>;
  readonly reason?: string;
}): boolean {
  if (input.plan.state === 'STALE') {
    return false;
  }
  if (input.mandate && input.mandate.state !== 'ACTIVE') {
    return true;
  }
  if (input.mandate && input.mandate.version !== input.plan.mandateVersion) {
    return true;
  }
  if (input.event && eventInvalidatesPlan(input.event.eventType)) {
    return true;
  }
  if (input.reason) {
    return true;
  }
  return false;
}

/**
 * Event arrival never executes money movement. It only marks planning state.
 */
export function invalidationExecutesNothing(): true {
  return true;
}
