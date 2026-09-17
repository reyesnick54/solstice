import type { GrowIndependentOutcomeAttribution } from './types.ts';

export type OutcomeAttributionStoreSnapshot = {
  readonly byCustomer: Readonly<Record<string, GrowIndependentOutcomeAttribution>>;
};

export class InMemoryGrowOutcomeAttributionStore {
  private readonly byCustomer = new Map<string, GrowIndependentOutcomeAttribution>();

  put(attribution: GrowIndependentOutcomeAttribution): void {
    this.byCustomer.set(attribution.customerId, attribution);
  }

  get(customerId: string): GrowIndependentOutcomeAttribution | undefined {
    return this.byCustomer.get(customerId);
  }

  snapshot(): OutcomeAttributionStoreSnapshot {
    return Object.freeze({
      byCustomer: Object.freeze(Object.fromEntries(this.byCustomer.entries())),
    });
  }

  load(snapshot: OutcomeAttributionStoreSnapshot): void {
    this.byCustomer.clear();
    for (const [customerId, row] of Object.entries(snapshot.byCustomer)) {
      this.byCustomer.set(customerId, row);
    }
  }

  clear(): void {
    this.byCustomer.clear();
  }
}

export function reconstructGrowOutcomeAttribution(input: {
  readonly store: InMemoryGrowOutcomeAttributionStore;
  readonly customerId: string;
  readonly rebuild: () => GrowIndependentOutcomeAttribution;
}): GrowIndependentOutcomeAttribution {
  const cached = input.store.get(input.customerId);
  if (cached) {
    return cached;
  }
  const rebuilt = input.rebuild();
  input.store.put(rebuilt);
  return rebuilt;
}
