/**
 * Crash-safe Exchange core snapshot. Not a second ledger.
 * FILE_NOT_FOUND initializes empty. Corruption fails closed.
 */

import { dirname, join } from 'node:path';

import {
  decodeSnapshot,
  encodeSnapshot,
  type ExchangeCoreSnapshot,
} from '../../../sunrey-exchange/src/production-core/snapshot.ts';
import type { ExchangeCorePersistencePort } from '../../../sunrey-exchange/src/production-core/persistence-port.ts';
import {
  loadEnvelopeOrEmpty,
  persistEnvelopeAtomic,
  wrapSnapshot,
  type SnapshotPersistOptions,
} from '../production/snapshot-envelope.ts';

export class DurableExchangeCoreStore implements ExchangeCorePersistencePort {
  readonly path: string;
  private sequence: number;
  private persistOptions: SnapshotPersistOptions;
  private snapshot: ExchangeCoreSnapshot | null;

  constructor(directory: string, persistOptions: SnapshotPersistOptions = {}) {
    this.path = join(directory, 'exchange-core.durable.json');
    this.persistOptions = persistOptions;
    const loaded = loadEnvelopeOrEmpty(this.path, 'EXCHANGE', isCoreEnvelope);
    if (loaded.kind === 'EMPTY') {
      this.snapshot = null;
      this.sequence = 0;
      return;
    }
    this.snapshot = decodeSnapshot(JSON.stringify(loaded.envelope.payload));
    this.sequence = loaded.envelope.sequence;
  }

  save(snapshot: ExchangeCoreSnapshot): void {
    if (snapshot.productionActive !== false || snapshot.liveTradingEnabled !== false) {
      throw new Error('refusing to persist a live-trading Exchange snapshot');
    }
    this.snapshot = snapshot;
    this.sequence += 1;
    persistEnvelopeAtomic(
      this.path,
      wrapSnapshot({
        storeKind: 'EXCHANGE',
        sequence: this.sequence,
        createdAt: new Date().toISOString(),
        payload: JSON.parse(encodeSnapshot(snapshot)) as never,
      }),
      this.persistOptions,
    );
  }

  load(): ExchangeCoreSnapshot | null {
    return this.snapshot;
  }

  reopen(): DurableExchangeCoreStore {
    return new DurableExchangeCoreStore(dirname(this.path));
  }
}

function isCoreEnvelope(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const record = value as Record<string, unknown>;
  return record.schema === 'sunrey-exchange-core/1' && record.productionActive === false;
}
