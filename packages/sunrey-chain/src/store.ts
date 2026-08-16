import { SIMULATION_ADAPTER_ID } from './ids.ts';
import { INITIAL_CHAIN_NETWORK_MODE } from './taxonomy.ts';
import type {
  ChainHealth,
  ChainOperation,
  ChainReceipt,
  ChainWriteIntent,
  ReconciliationRecord,
  SunReyChainStoreSnapshot,
} from './types.ts';

export class InMemorySunReyChainStore {
  readonly intents = new Map<string, ChainWriteIntent>();
  readonly operations = new Map<string, ChainOperation>();
  readonly receipts = new Map<string, ChainReceipt>();
  readonly reconciliations: ReconciliationRecord[] = [];
  health: ChainHealth;

  constructor(now: string) {
    this.health = {
      status: 'AVAILABLE',
      networkMode: INITIAL_CHAIN_NETWORK_MODE,
      adapterId: SIMULATION_ADAPTER_ID,
      height: 1,
      reason: null,
      observedAt: now as ChainHealth['observedAt'],
    };
  }

  snapshot(): SunReyChainStoreSnapshot {
    return {
      intents: [...this.intents.values()],
      operations: [...this.operations.values()],
      receipts: [...this.receipts.values()],
      reconciliations: [...this.reconciliations],
      health: this.health,
    };
  }
}
