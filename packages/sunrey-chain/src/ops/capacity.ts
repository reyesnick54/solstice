import { evaluateDisk, recommendedLimits, warnDiskPressure } from './resources.ts';
import { opsErr, opsOk, type OpsResult } from './types.ts';

export type StorageCapacityReport = {
  readonly warn: boolean;
  readonly guards: readonly string[];
  readonly loggingBounded: boolean;
};

export function storageCapacityGuards(input: {
  readonly chainDbBytes: number;
  readonly walBytes: number;
  readonly snapshotBytes: number;
  readonly logBytes: number;
  readonly postgresBytes: number;
  readonly capacityBytes: number;
}): OpsResult<StorageCapacityReport> {
  const limits = recommendedLimits({ diskBytes: input.capacityBytes });
  const disk = evaluateDisk(
    {
      chainDbBytes: input.chainDbBytes,
      walBytes: input.walBytes,
      snapshotBytes: input.snapshotBytes,
      logBytes: input.logBytes,
      capacityBytes: input.capacityBytes,
    },
    limits,
  );
  const guards: string[] = [];
  if (disk.warn) {
    guards.push('DISK_EXHAUSTION');
  }
  if (input.walBytes * 10 > input.capacityBytes) {
    guards.push('WAL_GROWTH');
  }
  if (input.snapshotBytes * 4 > input.capacityBytes) {
    guards.push('SNAPSHOT_EXHAUSTION');
  }
  if (input.postgresBytes * 2 > input.capacityBytes) {
    guards.push('DATABASE_STORAGE_EXHAUSTION');
  }
  const loggingBounded = input.logBytes <= Math.floor(input.capacityBytes / 20);
  if (!loggingBounded) {
    guards.push('LOG_GROWTH');
  }
  const report = { warn: guards.length > 0, guards, loggingBounded };
  if (report.warn) {
    const pressure = warnDiskPressure(
      {
        chainDbBytes: input.chainDbBytes,
        walBytes: input.walBytes,
        snapshotBytes: input.snapshotBytes,
        logBytes: input.logBytes,
        capacityBytes: input.capacityBytes,
      },
      limits,
    );
    if (!pressure.ok) {
      return pressure;
    }
    return opsErr('DISK_PRESSURE', report.guards.join(',') || 'capacity guard');
  }
  return opsOk(report);
}
