import type {
  ProactiveEventSubscription,
  ProactiveMonitorRegistration,
  ProactivePipelineRecord,
  ProactiveResearchEngineSnapshot,
} from './types.ts';

export class ProactiveResearchEngineStore {
  readonly #registrations = new Map<string, ProactiveMonitorRegistration>();
  readonly #subscriptions = new Map<string, ProactiveEventSubscription>();
  readonly #history: ProactivePipelineRecord[] = [];

  putRegistration(registration: ProactiveMonitorRegistration): void {
    this.#registrations.set(registration.registrationId, Object.freeze({ ...registration }));
  }

  getRegistration(registrationId: string): ProactiveMonitorRegistration | null {
    return this.#registrations.get(registrationId) ?? null;
  }

  listRegistrations(): readonly ProactiveMonitorRegistration[] {
    return Object.freeze([...this.#registrations.values()]);
  }

  listActiveRegistrations(): readonly ProactiveMonitorRegistration[] {
    return Object.freeze(
      [...this.#registrations.values()].filter(
        (row) => row.lifecycle !== 'DISABLED' && row.lifecycle !== 'PAUSED',
      ),
    );
  }

  putSubscription(subscription: ProactiveEventSubscription): void {
    this.#subscriptions.set(subscription.subscriptionId, Object.freeze({ ...subscription }));
  }

  listSubscriptions(): readonly ProactiveEventSubscription[] {
    return Object.freeze([...this.#subscriptions.values()]);
  }

  appendHistory(record: ProactivePipelineRecord): void {
    this.#history.push(Object.freeze({ ...record }));
  }

  listHistory(): readonly ProactivePipelineRecord[] {
    return Object.freeze([...this.#history]);
  }

  snapshot(monitorStore: import('../store.ts').InMemoryResearchMonitorStore): Omit<
    ProactiveResearchEngineSnapshot,
    'triggerRuns' | 'dedupe'
  > {
    return Object.freeze({
      monitorStore: monitorStore.snapshot(),
      registrations: this.listRegistrations(),
      subscriptions: this.listSubscriptions(),
      history: this.listHistory(),
    });
  }

  loadPartial(snapshot: Omit<ProactiveResearchEngineSnapshot, 'triggerRuns' | 'dedupe'>): void {
    this.#registrations.clear();
    this.#subscriptions.clear();
    this.#history.length = 0;
    for (const registration of snapshot.registrations) {
      this.#registrations.set(registration.registrationId, registration);
    }
    for (const subscription of snapshot.subscriptions) {
      this.#subscriptions.set(subscription.subscriptionId, subscription);
    }
    for (const record of snapshot.history) {
      this.#history.push(record);
    }
  }
}
