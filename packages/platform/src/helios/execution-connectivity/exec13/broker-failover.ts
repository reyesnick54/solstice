/**
 * Broker failover — never blind-resubmit after an ambiguous broker A timeout.
 */

import type { BrokerAcceptanceProbe, BrokerFailoverPlan } from './types.ts';

export type AmbiguousSubmitContext = {
  readonly businessKey: string;
  readonly brokerAId: string;
  readonly brokerBId: string;
  readonly submitTimedOut: boolean;
  readonly acceptanceProbe: BrokerAcceptanceProbe;
};

/**
 * After broker A times out, resubmit to broker B only when acceptance is known
 * and broker A did not accept the order.
 */
export function planBrokerFailover(context: AmbiguousSubmitContext): BrokerFailoverPlan {
  if (context.brokerAId === context.brokerBId) {
    return Object.freeze({
      ok: false,
      code: 'FAILOVER_REQUIRES_DISTINCT_BROKER',
      message: 'successor broker must differ from abandoned broker',
    });
  }
  if (!context.submitTimedOut) {
    return Object.freeze({
      ok: false,
      code: 'FAILOVER_NOT_REQUIRED',
      message: 'submit did not time out',
    });
  }
  if (!context.acceptanceProbe.known) {
    return Object.freeze({
      ok: false,
      code: 'BROKER_A_ACCEPTANCE_UNKNOWN',
      message:
        'cannot fail over until broker A acceptance is determined; query reconciliation first',
    });
  }
  if (context.acceptanceProbe.accepted) {
    return Object.freeze({
      ok: false,
      code: 'BROKER_A_ALREADY_ACCEPTED',
      message: 'broker A accepted the order; failover would duplicate exposure',
    });
  }
  return Object.freeze({
    ok: true,
    abandonedBrokerId: context.brokerAId,
    successorBrokerId: context.brokerBId,
    requiresNewLineage: true,
    priorState: 'RECONCILIATION_REQUIRED',
  });
}

export function blindResubmitBlocked(context: AmbiguousSubmitContext): boolean {
  if (!context.submitTimedOut) {
    return false;
  }
  return !context.acceptanceProbe.known;
}
