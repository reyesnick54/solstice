import { createHash } from 'node:crypto';

import type { UtcInstant } from '../../../../../domain/src/time.ts';
import { coverageDriftBps } from './formulas.ts';
import type { CoverageDriftEvent, CoverageSnapshot } from './types.ts';

export function detectCoverageDrift(input: {
  readonly detectedAt: UtcInstant;
  readonly universeId: string;
  readonly baseline: CoverageSnapshot;
  readonly current: CoverageSnapshot;
  readonly materialDriftThresholdBps: number;
  readonly featureId?: string | null;
}): CoverageDriftEvent | null {
  const baselineValueBps = input.baseline.metrics.coverageRatioBps;
  const currentValueBps = input.current.metrics.coverageRatioBps;
  const driftBps = coverageDriftBps(baselineValueBps, currentValueBps);
  if (driftBps < input.materialDriftThresholdBps) {
    return null;
  }
  const eventMaterial = JSON.stringify({
    universeId: input.universeId,
    baseline: input.baseline.snapshotId,
    current: input.current.snapshotId,
    driftBps,
  });
  const eventId = `cdrift_${createHash('sha256').update(eventMaterial).digest('hex').slice(0, 24)}`;
  return Object.freeze({
    eventId,
    detectedAt: input.detectedAt,
    universeId: input.universeId,
    featureId: input.featureId ?? null,
    baselineSnapshotId: input.baseline.snapshotId,
    currentSnapshotId: input.current.snapshotId,
    metric: 'coverageRatioBps',
    baselineValueBps,
    currentValueBps,
    driftBps,
    material: true,
    grantsExecutionAuthority: false,
  });
}
