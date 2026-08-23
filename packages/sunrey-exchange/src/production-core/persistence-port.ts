import type { ExchangeCoreSnapshot } from './snapshot.ts';

/**
 * Persistence port only. The Exchange package does not talk to disks,
 * networks, or databases. Adapters live in packages/persistence.
 */
export type ExchangeCorePersistencePort = {
  save(snapshot: ExchangeCoreSnapshot): void;
  load(): ExchangeCoreSnapshot | null;
};

export class InMemoryExchangeCorePersistence implements ExchangeCorePersistencePort {
  private snapshot: ExchangeCoreSnapshot | null = null;

  save(snapshot: ExchangeCoreSnapshot): void {
    this.snapshot = snapshot;
  }

  load(): ExchangeCoreSnapshot | null {
    return this.snapshot;
  }

  clear(): void {
    this.snapshot = null;
  }
}
