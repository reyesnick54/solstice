import {
  EMPTY_OPERATIONS_SNAPSHOT,
  type OperationsSnapshot,
} from '../../../kernel/src/operations/store.ts';

export class MemoryOperationsControlStore {
  private snapshot: OperationsSnapshot = EMPTY_OPERATIONS_SNAPSHOT;

  export(): OperationsSnapshot {
    return this.snapshot;
  }

  import(snapshot: OperationsSnapshot): void {
    this.snapshot = snapshot;
  }

  clear(): void {
    this.snapshot = EMPTY_OPERATIONS_SNAPSHOT;
  }
}
