/**
 * HELIOS EARN02 earnings event graph service — ingest, project, compile PIT snapshots.
 */

import type { UtcInstant } from '../../../../../domain/src/time.ts';
import type { EarningsExternalObservation } from '../../../../../external-data/src/earnings/types.ts';
import type { EarningsDataPorts } from '../../../../../external-data/src/earnings/ports.ts';
import { bindEarningsEventToTemporalEntity } from './aaf-temporal-bridge.ts';
import { appendEarningsSecRevisionIfAbsent } from './revision-bridge.ts';
import { compilePointInTimeEarningsEventSnapshot } from './snapshot.ts';
import { createEarningsEventGraphStore, type EarningsEventGraphStore } from './store.ts';
import type { CompilePointInTimeSnapshotInput, PointInTimeEarningsEventSnapshot } from './types.ts';
import {
  createRevisionLedgerStore,
  type RevisionLedgerStore,
} from '../../feature-fabric/revision-ledger/store.ts';

export type EarningsEventGraphServiceOptions = {
  readonly store?: EarningsEventGraphStore;
  readonly revisionLedger?: RevisionLedgerStore;
  readonly ports?: EarningsDataPorts;
};

export class EarningsEventGraphService {
  readonly #store: EarningsEventGraphStore;
  readonly #revisionLedger: RevisionLedgerStore;
  readonly #ports: EarningsDataPorts;

  constructor(options: EarningsEventGraphServiceOptions = {}) {
    this.#store = options.store ?? createEarningsEventGraphStore();
    this.#revisionLedger = options.revisionLedger ?? createRevisionLedgerStore();
    this.#ports = options.ports ?? {};
  }

  store(): EarningsEventGraphStore {
    return this.#store;
  }

  revisionLedger(): RevisionLedgerStore {
    return this.#revisionLedger;
  }

  ingestObservation(observation: EarningsExternalObservation, sealedAt: UtcInstant = observation.times.sunreyArrivalTime): void {
    this.#store.ingest(observation, sealedAt);
    bindEarningsEventToTemporalEntity(observation, sealedAt);
    appendEarningsSecRevisionIfAbsent(observation, this.#revisionLedger);
  }

  ingestMany(observations: readonly EarningsExternalObservation[], sealedAt: UtcInstant): void {
    for (const row of observations) {
      this.ingestObservation(row, sealedAt);
    }
  }

  async syncFromPorts(input: {
    readonly canonicalEntityId: string;
    readonly cik: string;
    readonly asOfKnowableCutoff: UtcInstant;
    readonly sealedAt: UtcInstant;
  }): Promise<readonly EarningsExternalObservation[]> {
    const collected: EarningsExternalObservation[] = [];
    if (this.#ports.secEdgar) {
      const rows = await this.#ports.secEdgar.fetchEarningsFilings({
        canonicalEntityId: input.canonicalEntityId,
        cik: input.cik,
        asOfKnowableCutoff: input.asOfKnowableCutoff,
      });
      collected.push(...rows);
    }
    this.ingestMany(collected, input.sealedAt);
    return Object.freeze(collected);
  }

  snapshotAt(input: CompilePointInTimeSnapshotInput): PointInTimeEarningsEventSnapshot | null {
    return compilePointInTimeEarningsEventSnapshot(this.#store, this.#revisionLedger, input);
  }
}

export function createEarningsEventGraphService(
  options: EarningsEventGraphServiceOptions = {},
): EarningsEventGraphService {
  return new EarningsEventGraphService(options);
}
