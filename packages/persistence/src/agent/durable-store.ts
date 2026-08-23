/**
 * Crash-safe Agent runtime fixture store.
 * Conversations survive process restart. Not a second ledger or EA store.
 */

import { dirname, join } from 'node:path';

import {
  deserializeAgentRuntimeSnapshot,
  serializeAgentRuntimeSnapshot,
  type SerializedAgentRuntimeSnapshot,
} from '../../../sunrey-agent/src/serialize.ts';
import { InMemoryAgentMandateStore } from '../../../sunrey-agent/src/store.ts';
import type { AgentRuntimeSnapshot } from '../../../sunrey-agent/src/types.ts';
import {
  DurableStoreError,
  type SnapshotPersistOptions,
  loadEnvelopeOrEmpty,
  persistEnvelopeAtomic,
  wrapSnapshot,
} from '../production/snapshot-envelope.ts';

export type AgentDurableSnapshot = {
  readonly runtime: SerializedAgentRuntimeSnapshot;
  readonly grantsExecutionAuthority: false;
};

const EMPTY: AgentDurableSnapshot = Object.freeze({
  runtime: serializeAgentRuntimeSnapshot({
    agents: [],
    mandates: [],
    proposals: [],
    usage: [],
    conversations: [],
    messages: [],
    toolEvents: [],
    memories: [],
    personalization: [],
    runtimeEvents: [],
  }),
  grantsExecutionAuthority: false,
});

export class DurableAgentRuntimeStore {
  readonly path: string;
  private snapshot: AgentDurableSnapshot;
  private sequence: number;
  private persistOptions: SnapshotPersistOptions;

  constructor(directory: string, persistOptions: SnapshotPersistOptions = {}) {
    this.path = join(directory, 'agent.durable.json');
    this.persistOptions = persistOptions;
    const loaded = loadEnvelopeOrEmpty(this.path, 'AGENT', isAgentSnapshot);
    if (loaded.kind === 'EMPTY') {
      this.snapshot = EMPTY;
      this.sequence = 0;
      return;
    }
    this.snapshot = loaded.envelope.payload;
    this.sequence = loaded.envelope.sequence;
  }

  save(store: InMemoryAgentMandateStore): void {
    this.snapshot = Object.freeze({
      runtime: serializeAgentRuntimeSnapshot(store.snapshot()),
      grantsExecutionAuthority: false,
    });
    this.persist();
  }

  hydrate(store: InMemoryAgentMandateStore): AgentRuntimeSnapshot {
    const runtime = deserializeAgentRuntimeSnapshot(this.snapshot.runtime);
    store.hydrate(runtime);
    return runtime;
  }

  reopen(): DurableAgentRuntimeStore {
    return new DurableAgentRuntimeStore(dirname(this.path));
  }

  list(): AgentDurableSnapshot {
    return this.snapshot;
  }

  private persist(): void {
    this.sequence += 1;
    persistEnvelopeAtomic(
      this.path,
      wrapSnapshot({
        storeKind: 'AGENT',
        sequence: this.sequence,
        createdAt: new Date().toISOString(),
        payload: this.snapshot,
      }),
      this.persistOptions,
    );
  }
}

function isAgentSnapshot(value: unknown): value is AgentDurableSnapshot {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (record.grantsExecutionAuthority !== false || record.runtime === null || typeof record.runtime !== 'object') {
    return false;
  }
  const runtime = record.runtime as Record<string, unknown>;
  return Array.isArray(runtime.agents) && Array.isArray(runtime.conversations) && Array.isArray(runtime.messages);
}

export { DurableStoreError };
