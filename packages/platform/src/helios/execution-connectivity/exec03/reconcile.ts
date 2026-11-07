import type { FixtureExec03BrokerPort } from './broker-port.ts';
import type { ExecutionIntent, ProviderOrderLookup, ProviderOrderLookupSignal } from './types.ts';

export function providerOrderLookup(
  intent: ExecutionIntent,
  broker: FixtureExec03BrokerPort,
  now: string,
  safeWindowEndsAt: string,
): ProviderOrderLookup {
  const signals: ProviderOrderLookupSignal[] = [
    broker.queryByClientOrderId(intent.clientOrderId, now),
    broker.dropCopySignal(intent.clientOrderId, now),
    broker.openOrdersSignal(intent.clientOrderId, now),
  ];

  const foundSignal = signals.find((row) => row.found) ?? null;
  const aggregateFound = foundSignal !== null;
  const notFoundAfterSafeWindow = !aggregateFound && now >= safeWindowEndsAt;

  return Object.freeze({
    operationId: intent.operationId,
    clientOrderId: intent.clientOrderId,
    queriedAt: now,
    signals: Object.freeze(signals),
    aggregateFound,
    providerOrderId: foundSignal?.providerOrderId ?? null,
    notFoundAfterSafeWindow,
  });
}

export function reconcileStateFromLookup(
  intent: ExecutionIntent,
  lookup: ProviderOrderLookup,
  now: string,
): ExecutionIntent {
  if (lookup.aggregateFound && lookup.providerOrderId) {
    const status = lookup.signals.find((row) => row.found)?.status ?? 'ACKNOWLEDGED';
    if (status === 'REJECTED') {
      return Object.freeze({
        ...intent,
        state: 'REJECTED',
        providerOrderId: lookup.providerOrderId,
        updatedAt: now,
      });
    }
    if (status === 'CONFIRMED') {
      return Object.freeze({
        ...intent,
        state: 'CONFIRMED',
        providerOrderId: lookup.providerOrderId,
        confirmedAt: now,
        updatedAt: now,
      });
    }
    return Object.freeze({
      ...intent,
      state: 'ACKNOWLEDGED',
      providerOrderId: lookup.providerOrderId,
      acknowledgedAt: intent.acknowledgedAt ?? now,
      updatedAt: now,
    });
  }

  if (lookup.notFoundAfterSafeWindow) {
    return Object.freeze({
      ...intent,
      state: 'NOT_SUBMITTED',
      governedResubmitPermitted: true,
      submittedOnce: true,
      providerOrderId: null,
      updatedAt: now,
    });
  }

  return Object.freeze({
    ...intent,
    state: 'SUBMISSION_UNKNOWN',
    updatedAt: now,
  });
}
