import { randomUUID } from 'node:crypto';

import type { MarketFeatureEvent, ProactiveEventSubscription } from './types.ts';
import type { ProactiveMonitorRegistration } from './types.ts';

export function createEventSubscription(input: {
  readonly instrumentIds: readonly string[] | null;
}): ProactiveEventSubscription {
  return Object.freeze({
    subscriptionId: `prsub_${randomUUID().slice(0, 12)}`,
    instrumentIds: input.instrumentIds ? Object.freeze([...input.instrumentIds]) : null,
    active: true,
  });
}

export function registrationMatchesEvent(
  registration: ProactiveMonitorRegistration,
  event: MarketFeatureEvent,
): boolean {
  if (registration.lifecycle === 'DISABLED' || registration.lifecycle === 'PAUSED') {
    return false;
  }
  const watch = registration.definition.watch;
  if (watch.length === 0) {
    return true;
  }
  const eventSet = new Set(event.instrumentIds);
  return watch.some((symbol) => eventSet.has(symbol));
}

export function subscriptionMatchesEvent(
  subscription: ProactiveEventSubscription,
  event: MarketFeatureEvent,
): boolean {
  if (!subscription.active) {
    return false;
  }
  if (!subscription.instrumentIds || subscription.instrumentIds.length === 0) {
    return true;
  }
  const eventSet = new Set(event.instrumentIds);
  return subscription.instrumentIds.some((symbol) => eventSet.has(symbol));
}
