import { createHash } from 'node:crypto';

import type { UtcInstant } from '../../../../../domain/src/time.ts';
import type {
  CoverageSnapshot,
  CoverageTensor,
  EligibleUniverseMember,
  FeatureCoverageProbe,
} from './types.ts';

function probeUsable(probe: FeatureCoverageProbe): boolean {
  const signal = probe.signal;
  return (
    signal.applicable &&
    signal.entityResolved &&
    signal.providerCoversInstrument &&
    signal.providerAvailable &&
    signal.knowableAtEvaluationTime &&
    signal.valuePresent &&
    signal.qualityState === 'VALID' &&
    signal.entitlementState === 'USABLE'
  );
}

function coverageRatioBps(usable: number, total: number): number {
  if (total <= 0) {
    return 0;
  }
  return Math.round((usable * 10_000) / total);
}

export function buildCoverageTensor(input: {
  readonly universeId: string;
  readonly universeDefinition: string;
  readonly evaluationTimestamp: UtcInstant;
  readonly eligibleMembers: readonly EligibleUniverseMember[];
  readonly featureIds: readonly string[];
  readonly probes: readonly FeatureCoverageProbe[];
  readonly baselineCoverageRatioBps: number | null;
}): CoverageTensor {
  const totalProbeCount = input.probes.length;
  const usableProbeCount = input.probes.filter(probeUsable).length;
  const coverageRatio = coverageRatioBps(usableProbeCount, totalProbeCount);
  return Object.freeze({
    universeId: input.universeId,
    universeDefinition: input.universeDefinition,
    evaluationTimestamp: input.evaluationTimestamp,
    eligibleMembers: Object.freeze([...input.eligibleMembers]),
    featureIds: Object.freeze([...input.featureIds]),
    probes: Object.freeze([...input.probes]),
    baselineCoverageRatioBps: input.baselineCoverageRatioBps,
    totalProbeCount,
    usableProbeCount,
    coverageRatioBps: coverageRatio,
    grantsExecutionAuthority: false,
  });
}

function tensorFingerprint(tensor: CoverageTensor): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        universeId: tensor.universeId,
        evaluationTimestamp: tensor.evaluationTimestamp,
        featureIds: tensor.featureIds,
        coverageRatioBps: tensor.coverageRatioBps,
        usableProbeCount: tensor.usableProbeCount,
        totalProbeCount: tensor.totalProbeCount,
      }),
    )
    .digest('hex');
}

export function sealCoverageSnapshot(input: {
  readonly tensor: CoverageTensor;
  readonly capturedAt: UtcInstant;
}): CoverageSnapshot {
  const fingerprint = tensorFingerprint(input.tensor);
  return Object.freeze({
    snapshotId: `coverage-snapshot:${fingerprint.slice(0, 16)}`,
    tensorFingerprint: fingerprint,
    capturedAt: input.capturedAt,
    coverageRatioBps: input.tensor.coverageRatioBps,
    usableProbeCount: input.tensor.usableProbeCount,
    totalProbeCount: input.tensor.totalProbeCount,
    grantsExecutionAuthority: false,
  });
}
