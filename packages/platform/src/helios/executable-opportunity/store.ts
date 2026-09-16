import type { CustomerId } from '../../../../domain/src/customer.ts';
import type { ExecutableOpportunity, OpportunityCandidate } from './types.ts';

export type ExecutableOpportunityStoreSnapshot = {
  readonly candidates: readonly OpportunityCandidate[];
  readonly executableOpportunities: readonly ExecutableOpportunity[];
};

export class InMemoryExecutableOpportunityStore {
  private readonly candidates = new Map<string, OpportunityCandidate>();
  private readonly executableOpportunities = new Map<string, ExecutableOpportunity>();

  putCandidate(candidate: OpportunityCandidate): OpportunityCandidate {
    this.candidates.set(candidate.candidateId, candidate);
    return candidate;
  }

  getCandidate(candidateId: string): OpportunityCandidate | undefined {
    return this.candidates.get(candidateId);
  }

  putExecutableOpportunity(opportunity: ExecutableOpportunity): ExecutableOpportunity {
    this.executableOpportunities.set(opportunity.executableOpportunityId, opportunity);
    return opportunity;
  }

  getExecutableOpportunity(
    executableOpportunityId: string,
    customerId: CustomerId,
  ): ExecutableOpportunity | undefined {
    const found = this.executableOpportunities.get(executableOpportunityId);
    if (!found || found.customerId !== customerId) {
      return undefined;
    }
    return found;
  }

  executableOpportunitiesFor(customerId: CustomerId): readonly ExecutableOpportunity[] {
    return Object.freeze(
      [...this.executableOpportunities.values()].filter((item) => item.customerId === customerId),
    );
  }

  snapshot(): ExecutableOpportunityStoreSnapshot {
    return Object.freeze({
      candidates: Object.freeze([...this.candidates.values()]),
      executableOpportunities: Object.freeze([...this.executableOpportunities.values()]),
    });
  }

  static fromSnapshot(snapshot: ExecutableOpportunityStoreSnapshot): InMemoryExecutableOpportunityStore {
    const store = new InMemoryExecutableOpportunityStore();
    for (const candidate of snapshot.candidates) {
      store.putCandidate(candidate);
    }
    for (const opportunity of snapshot.executableOpportunities) {
      store.putExecutableOpportunity(opportunity);
    }
    return store;
  }
}
