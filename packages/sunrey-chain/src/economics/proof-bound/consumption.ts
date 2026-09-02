/**
 * Wave 3 — Durable monetization consumption store.
 *
 * Blockchain-level consumption records survive process restart, node
 * restart, snapshot restore, state sync, and transaction replay.
 * A PostgreSQL flag alone is insufficient.
 */

import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import type { MonetizationConsumptionRecord } from './types.ts';

export type ConsumptionStore = {
  readonly consumedKeys: ReadonlySet<string>;
  readonly consumedAuthorizations: ReadonlySet<string>;
  readonly records: ReadonlyMap<string, MonetizationConsumptionRecord>;
  readonly appendLog: readonly MonetizationConsumptionRecord[];
};

export function emptyConsumptionStore(): ConsumptionStore {
  return {
    consumedKeys: new Set(),
    consumedAuthorizations: new Set(),
    records: new Map(),
    appendLog: [],
  };
}

export type ConsumptionAttempt =
  | { readonly ok: true; readonly record: MonetizationConsumptionRecord }
  | { readonly ok: false; readonly code: 'DUPLICATE_MONETIZATION_KEY' | 'DUPLICATE_GOVERNANCE_AUTHORIZATION' };

export function attemptConsume(
  store: ConsumptionStore,
  record: MonetizationConsumptionRecord,
): ConsumptionAttempt {
  if (store.consumedKeys.has(record.monetizationKey)) {
    return { ok: false, code: 'DUPLICATE_MONETIZATION_KEY' };
  }
  const authKey = `${record.assetId}:${record.bundleId}:${record.transactionId}`;
  if (store.consumedAuthorizations.has(authKey)) {
    return { ok: false, code: 'DUPLICATE_GOVERNANCE_AUTHORIZATION' };
  }
  store.consumedKeys.add(record.monetizationKey);
  store.consumedAuthorizations.add(authKey);
  store.records.set(record.monetizationKey, record);
  (store.appendLog as MonetizationConsumptionRecord[]).push(record);
  return { ok: true, record };
}

export function isMonetizationKeyConsumed(store: ConsumptionStore, monetizationKey: string): boolean {
  return store.consumedKeys.has(monetizationKey);
}

export function cloneConsumptionStore(store: ConsumptionStore): ConsumptionStore {
  return {
    consumedKeys: new Set(store.consumedKeys),
    consumedAuthorizations: new Set(store.consumedAuthorizations),
    records: new Map(store.records),
    appendLog: [...store.appendLog],
  };
}

export type PersistedProofBoundState = {
  readonly version: 1;
  readonly consumption: {
    readonly consumedKeys: readonly string[];
    readonly consumedAuthorizations: readonly string[];
    readonly appendLog: readonly MonetizationConsumptionRecord[];
  };
  readonly blockHeight: number;
  readonly stateCommitment: string;
};

export function serializeConsumptionStore(
  store: ConsumptionStore,
  blockHeight: number,
  stateCommitment: string,
): PersistedProofBoundState {
  return Object.freeze({
    version: 1,
    consumption: Object.freeze({
      consumedKeys: Object.freeze([...store.consumedKeys]),
      consumedAuthorizations: Object.freeze([...store.consumedAuthorizations]),
      appendLog: Object.freeze([...store.appendLog]),
    }),
    blockHeight,
    stateCommitment,
  });
}

export function deserializeConsumptionStore(state: PersistedProofBoundState): ConsumptionStore {
  const store = emptyConsumptionStore();
  for (const key of state.consumption.consumedKeys) {
    store.consumedKeys.add(key);
  }
  for (const auth of state.consumption.consumedAuthorizations) {
    store.consumedAuthorizations.add(auth);
  }
  for (const record of state.consumption.appendLog) {
    store.records.set(record.monetizationKey, record);
    (store.appendLog as MonetizationConsumptionRecord[]).push(record);
  }
  return store;
}

export function persistConsumptionStore(
  filePath: string,
  store: ConsumptionStore,
  blockHeight: number,
  stateCommitment: string,
): void {
  mkdirSync(dirname(filePath), { recursive: true });
  const payload = JSON.stringify(serializeConsumptionStore(store, blockHeight, stateCommitment), null, 0);
  const tmp = `${filePath}.tmp`;
  writeFileSync(tmp, payload, 'utf8');
  renameSync(tmp, filePath);
}

export function loadConsumptionStore(filePath: string): {
  readonly store: ConsumptionStore;
  readonly blockHeight: number;
  readonly stateCommitment: string;
} | null {
  try {
    const raw = readFileSync(filePath, 'utf8');
    const state = JSON.parse(raw) as PersistedProofBoundState;
    if (state.version !== 1) {
      return null;
    }
    return {
      store: deserializeConsumptionStore(state),
      blockHeight: state.blockHeight,
      stateCommitment: state.stateCommitment,
    };
  } catch {
    return null;
  }
}

export function replayConsumptionLog(
  log: readonly MonetizationConsumptionRecord[],
): ConsumptionStore {
  const store = emptyConsumptionStore();
  for (const record of log) {
    const result = attemptConsume(store, record);
    if (!result.ok) {
      throw new Error(`replay rejected duplicate consumption: ${result.code}`);
    }
  }
  return store;
}
