import type { ExecutionTwinStoreSnapshot } from './types.ts';
import type { ExecutionTwinRunState } from './taxonomy.ts';

export class InMemoryExecutionTwinStore {
  private snapshot: ExecutionTwinStoreSnapshot | null = null;

  save(snapshot: ExecutionTwinStoreSnapshot): void {
    this.snapshot = Object.freeze(structuredClone(snapshot));
  }

  load(runId: string): ExecutionTwinStoreSnapshot | null {
    if (!this.snapshot || this.snapshot.runId !== runId) {
      return null;
    }
    return this.snapshot;
  }

  clear(): void {
    this.snapshot = null;
  }

  updateState(runId: string, state: ExecutionTwinRunState): ExecutionTwinStoreSnapshot | null {
    const current = this.load(runId);
    if (!current) {
      return null;
    }
    const next = Object.freeze({ ...current, state });
    this.save(next);
    return next;
  }
}
