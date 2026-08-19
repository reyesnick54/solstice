import type { HumanContributionRegistrySnapshot } from './types.ts';

/**
 * Persistence port for the Human Economic Contribution registry.
 * Implementations must not invent a second database framework.
 * Unit tests and CI use the in-memory adapter.
 */
export type HumanContributionRegistryStore = {
  persist(snapshot: HumanContributionRegistrySnapshot): void;
  load(): HumanContributionRegistrySnapshot | undefined;
};

export class InMemoryHumanContributionRegistryStore implements HumanContributionRegistryStore {
  private snapshot: HumanContributionRegistrySnapshot | undefined;

  persist(snapshot: HumanContributionRegistrySnapshot): void {
    this.snapshot = snapshot;
  }

  load(): HumanContributionRegistrySnapshot | undefined {
    return this.snapshot;
  }

  clear(): void {
    this.snapshot = undefined;
  }
}
