import type { CoverageDriftEvent, CoverageManifest, CoverageSnapshot } from './types.ts';

export type HeliosCoverageStoreSnapshot = {
  readonly snapshots: readonly CoverageSnapshot[];
  readonly manifests: readonly CoverageManifest[];
  readonly driftEvents: readonly CoverageDriftEvent[];
};

export type HeliosCoverageStore = {
  readonly putSnapshot: (snapshot: CoverageSnapshot) => void;
  readonly getSnapshot: (snapshotId: string) => CoverageSnapshot | undefined;
  readonly listSnapshots: () => readonly CoverageSnapshot[];
  readonly putManifest: (manifest: CoverageManifest) => void;
  readonly getManifest: (manifestId: string) => CoverageManifest | undefined;
  readonly putDriftEvent: (event: CoverageDriftEvent) => void;
  readonly listDriftEvents: () => readonly CoverageDriftEvent[];
  readonly snapshot: () => HeliosCoverageStoreSnapshot;
  readonly restore: (snapshot: HeliosCoverageStoreSnapshot) => void;
};

export function createHeliosCoverageStore(): HeliosCoverageStore {
  const snapshots = new Map<string, CoverageSnapshot>();
  const manifests = new Map<string, CoverageManifest>();
  const driftEvents = new Map<string, CoverageDriftEvent>();

  return Object.freeze({
    putSnapshot(row: CoverageSnapshot) {
      snapshots.set(row.snapshotId, row);
    },
    getSnapshot(snapshotId: string) {
      return snapshots.get(snapshotId);
    },
    listSnapshots() {
      return Object.freeze([...snapshots.values()]);
    },
    putManifest(row: CoverageManifest) {
      manifests.set(row.manifestId, row);
    },
    getManifest(manifestId: string) {
      return manifests.get(manifestId);
    },
    putDriftEvent(row: CoverageDriftEvent) {
      driftEvents.set(row.eventId, row);
    },
    listDriftEvents() {
      return Object.freeze([...driftEvents.values()]);
    },
    snapshot() {
      return Object.freeze({
        snapshots: Object.freeze([...snapshots.values()]),
        manifests: Object.freeze([...manifests.values()]),
        driftEvents: Object.freeze([...driftEvents.values()]),
      });
    },
    restore(state: HeliosCoverageStoreSnapshot) {
      snapshots.clear();
      manifests.clear();
      driftEvents.clear();
      for (const row of state.snapshots) {
        snapshots.set(row.snapshotId, row);
      }
      for (const row of state.manifests) {
        manifests.set(row.manifestId, row);
      }
      for (const row of state.driftEvents) {
        driftEvents.set(row.eventId, row);
      }
    },
  });
}
