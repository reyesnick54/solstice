import { opsErr, opsOk, type OpsResult, type ResourceLimits } from './types.ts';

export type DiskUsage = {
  readonly chainDbBytes: number;
  readonly walBytes: number;
  readonly snapshotBytes: number;
  readonly logBytes: number;
  readonly capacityBytes: number;
};

export type DiskReport = {
  readonly usedBytes: number;
  readonly freeBytes: number;
  readonly ratio: number;
  readonly warn: boolean;
};

export function evaluateDisk(usage: DiskUsage, limits: ResourceLimits): DiskReport {
  const usedBytes = usage.chainDbBytes + usage.walBytes + usage.snapshotBytes + usage.logBytes;
  const capacity = Math.min(usage.capacityBytes, limits.diskBytes);
  const ratio = capacity === 0 ? 1 : usedBytes / capacity;
  return {
    usedBytes,
    freeBytes: Math.max(0, capacity - usedBytes),
    ratio,
    warn: ratio >= limits.diskWarnRatio,
  };
}

export function warnDiskPressure(usage: DiskUsage, limits: ResourceLimits): OpsResult<DiskReport> {
  const report = evaluateDisk(usage, limits);
  if (report.warn) {
    return opsErr('DISK_PRESSURE', `storage ratio ${report.ratio.toFixed(2)} exceeds operator warn threshold`);
  }
  return opsOk(report);
}

export const PRUNABLE_CLASSES = ['LOG_STORAGE', 'EXPIRED_SNAPSHOT'] as const;
export type PrunableClass = (typeof PRUNABLE_CLASSES)[number];

export function prune(className: string, policyAllows: boolean): OpsResult<{ readonly pruned: string }> {
  if (!(PRUNABLE_CLASSES as readonly string[]).includes(className) || !policyAllows) {
    return opsErr(
      'PRUNE_FORBIDDEN',
      'never prune data required for consensus verification without an explicit prune policy',
    );
  }
  return opsOk({ pruned: className });
}

export function recommendedLimits(overrides: Partial<ResourceLimits> = {}): ResourceLimits {
  return Object.freeze({
    cpuMillis: overrides.cpuMillis ?? 2_000,
    memoryBytes: overrides.memoryBytes ?? 4 * 1024 * 1024 * 1024,
    openFiles: overrides.openFiles ?? 65_536,
    diskBytes: overrides.diskBytes ?? 200 * 1024 * 1024 * 1024,
    maxNetworkConnections: overrides.maxNetworkConnections ?? 256,
    diskWarnRatio: overrides.diskWarnRatio ?? 0.85,
  });
}
