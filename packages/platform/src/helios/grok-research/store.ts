import type { CustomerId } from '../../../../domain/src/customer.ts';
import type { HeliosTaskId } from '../ids.ts';
import type { GrokResearchResult } from './types.ts';

export type GrokResearchStoreSnapshot = {
  readonly results: readonly GrokResearchResult[];
};

export class InMemoryGrokResearchStore {
  private readonly byTaskId = new Map<string, GrokResearchResult>();
  private readonly byCustomer = new Map<string, Set<string>>();

  put(result: GrokResearchResult): void {
    this.byTaskId.set(result.taskId, Object.freeze(result));
    const customerTasks = this.byCustomer.get(result.customerId) ?? new Set();
    customerTasks.add(result.taskId);
    this.byCustomer.set(result.customerId, customerTasks);
  }

  get(taskId: HeliosTaskId, customerId: CustomerId): GrokResearchResult | undefined {
    const result = this.byTaskId.get(taskId);
    if (!result || result.customerId !== customerId) {
      return undefined;
    }
    return result;
  }

  listForCustomer(customerId: CustomerId): readonly GrokResearchResult[] {
    const ids = this.byCustomer.get(customerId);
    if (!ids) return Object.freeze([]);
    return Object.freeze(
      [...ids]
        .map((id) => this.byTaskId.get(id))
        .filter((item): item is GrokResearchResult => item !== undefined),
    );
  }

  snapshot(): GrokResearchStoreSnapshot {
    return Object.freeze({
      results: Object.freeze([...this.byTaskId.values()]),
    });
  }

  restore(snapshot: GrokResearchStoreSnapshot): void {
    this.byTaskId.clear();
    this.byCustomer.clear();
    for (const result of snapshot.results) {
      this.put(result);
    }
  }
}
