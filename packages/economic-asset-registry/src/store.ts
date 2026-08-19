import type { EconomicAssetRegistrySnapshot } from './types.ts';

/**
 * Persistence port for the Economic Asset Registry.
 * Implementations must not invent a second database or blob store.
 * Unit tests and CI use the in-memory adapter.
 */
export type EconomicAssetRegistryStore = {
  persist(snapshot: EconomicAssetRegistrySnapshot): void;
  load(): EconomicAssetRegistrySnapshot | undefined;
};

export class InMemoryEconomicAssetRegistryStore implements EconomicAssetRegistryStore {
  private snapshot: EconomicAssetRegistrySnapshot | undefined;

  persist(snapshot: EconomicAssetRegistrySnapshot): void {
    this.snapshot = snapshot;
  }

  load(): EconomicAssetRegistrySnapshot | undefined {
    return this.snapshot;
  }

  clear(): void {
    this.snapshot = undefined;
  }
}
