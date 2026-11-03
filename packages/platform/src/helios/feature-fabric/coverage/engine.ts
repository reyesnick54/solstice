import { createHash } from 'node:crypto';

import type { UtcInstant } from '../../../../../domain/src/time.ts';
import { HELIOS_FEATURE_FABRIC_SCHEMA } from '../types.ts';
import { classifyMissingness, dispositionFromMissingness, type CoverageProbeSignal } from './classify.ts';
import { aggregateCoverageSlices, computeCoverageMetricSet, summarizeExclusions, tensorFingerprint } from './metrics.ts';
import {
  HELIOS_COVERAGE_TENSOR_SCHEMA,
  type CoverageManifest,
  type CoverageSnapshot,
  type CoverageTensor,
  type EligibleUniverseMember,
  type FeatureCoverageCell,
} from './types.ts';

export type FeatureCoverageProbe = {
  readonly member: EligibleUniverseMember;
  readonly featureId: string;
  readonly providerId: string | null;
  readonly signal: CoverageProbeSignal;
};

export type BuildCoverageTensorInput = {
  readonly universeId: string;
  readonly universeDefinition: string;
  readonly evaluationTimestamp: UtcInstant;
  readonly eligibleMembers: readonly EligibleUniverseMember[];
  readonly featureIds: readonly string[];
  readonly probes: readonly FeatureCoverageProbe[];
  readonly rollingHistoryBps?: readonly number[];
  readonly baselineCoverageRatioBps?: number | null;
};

function memberFeatureKey(member: EligibleUniverseMember, featureId: string): string {
  return `${member.canonicalEntityId}|${member.canonicalInstrumentId}|${member.evaluationTimestamp}|${featureId}`;
}

function buildCell(probe: FeatureCoverageProbe): FeatureCoverageCell {
  const missingnessReason = classifyMissingness(probe.signal);
  const disposition = dispositionFromMissingness(missingnessReason);
  const member = probe.member;
  return Object.freeze({
    canonicalEntityId: member.canonicalEntityId,
    canonicalInstrumentId: member.canonicalInstrumentId,
    evaluationTimestamp: member.evaluationTimestamp,
    featureId: probe.featureId,
    providerId: probe.providerId,
    sector: member.sector,
    industry: member.industry,
    marketCapBucket: member.marketCapBucket,
    liquidityBucket: member.liquidityBucket,
    geography: member.geography,
    venue: member.venue,
    assetClass: member.assetClass,
    disposition,
    missingnessReason,
    imputed: false,
  });
}

/**
 * Expands the full eligible-universe tensor. Probes may be sparse; unspecified cells become UNKNOWN missing.
 */
export function buildCoverageTensor(input: BuildCoverageTensorInput): CoverageTensor {
  const probeMap = new Map<string, FeatureCoverageProbe>();
  for (const probe of input.probes) {
    probeMap.set(memberFeatureKey(probe.member, probe.featureId), probe);
  }

  const cells: FeatureCoverageCell[] = [];
  for (const member of input.eligibleMembers) {
    for (const featureId of input.featureIds) {
      const key = memberFeatureKey(member, featureId);
      const probe = probeMap.get(key);
      if (probe) {
        cells.push(buildCell(probe));
      } else {
        cells.push(
          Object.freeze({
            canonicalEntityId: member.canonicalEntityId,
            canonicalInstrumentId: member.canonicalInstrumentId,
            evaluationTimestamp: member.evaluationTimestamp,
            featureId,
            providerId: null,
            sector: member.sector,
            industry: member.industry,
            marketCapBucket: member.marketCapBucket,
            liquidityBucket: member.liquidityBucket,
            geography: member.geography,
            venue: member.venue,
            assetClass: member.assetClass,
            disposition: 'MISSING',
            missingnessReason: 'UNKNOWN',
            imputed: false,
          }),
        );
      }
    }
  }

  const eligibleUniverseCount = input.eligibleMembers.length;
  const usableFeatureCount = cells.filter((row) => row.disposition === 'USABLE').length;
  const expectedCellCount = cells.length;
  const metrics = computeCoverageMetricSet({
    cells,
    eligibleUniverseCount,
    featureIds: input.featureIds,
    rollingHistoryBps: input.rollingHistoryBps,
    baselineCoverageRatioBps: input.baselineCoverageRatioBps ?? null,
  });
  const fingerprint = tensorFingerprint({
    universeId: input.universeId,
    evaluationTimestamp: input.evaluationTimestamp,
    featureIds: input.featureIds,
    cells,
  });
  const tensorId = `ctensor_${fingerprint.slice(0, 24)}`;

  return Object.freeze({
    schemaVersion: HELIOS_COVERAGE_TENSOR_SCHEMA,
    tensorId,
    universeId: input.universeId,
    universeDefinition: input.universeDefinition,
    evaluationTimestamp: input.evaluationTimestamp,
    featureIds: Object.freeze([...input.featureIds]),
    eligibleUniverseCount,
    usableFeatureCount,
    expectedCellCount,
    cells: Object.freeze(cells),
    slices: aggregateCoverageSlices(cells),
    metrics,
    featureFabricSchema: HELIOS_FEATURE_FABRIC_SCHEMA,
    grantsExecutionAuthority: false,
  });
}

export function sealCoverageSnapshot(input: {
  readonly tensor: CoverageTensor;
  readonly capturedAt: UtcInstant;
}): CoverageSnapshot {
  const fingerprint = tensorFingerprint({
    universeId: input.tensor.universeId,
    evaluationTimestamp: input.tensor.evaluationTimestamp,
    featureIds: input.tensor.featureIds,
    cells: input.tensor.cells,
  });
  const snapshotId = `csnap_${fingerprint.slice(0, 24)}`;
  return Object.freeze({
    snapshotId,
    capturedAt: input.capturedAt,
    tensorId: input.tensor.tensorId,
    universeId: input.tensor.universeId,
    evaluationTimestamp: input.tensor.evaluationTimestamp,
    eligibleUniverseCount: input.tensor.eligibleUniverseCount,
    usableFeatureCount: input.tensor.usableFeatureCount,
    expectedCellCount: input.tensor.expectedCellCount,
    metrics: input.tensor.metrics,
    tensorFingerprint: fingerprint,
    grantsExecutionAuthority: false,
  });
}

export function buildCoverageManifest(input: {
  readonly evaluationId: string | null;
  readonly universeDefinition: string;
  readonly universeId: string;
  readonly featureIds: readonly string[];
  readonly evaluationTensor: CoverageTensor;
  readonly evaluationSnapshot: CoverageSnapshot;
  readonly trainingSnapshot?: CoverageSnapshot | null;
}): CoverageManifest {
  const exclusionByReason = summarizeExclusions(input.evaluationTensor.cells);

  const manifestMaterial = JSON.stringify({
    evaluationId: input.evaluationId,
    universeId: input.universeId,
    featureIds: [...input.featureIds],
    evaluationSnapshotId: input.evaluationSnapshot.snapshotId,
    trainingSnapshotId: input.trainingSnapshot?.snapshotId ?? null,
    eligibleUniverseCount: input.evaluationSnapshot.eligibleUniverseCount,
    usableFeatureCount: input.evaluationSnapshot.usableFeatureCount,
    metrics: input.evaluationSnapshot.metrics,
  });
  const manifestFingerprint = createHash('sha256').update(manifestMaterial).digest('hex');
  const manifestId = `cmanifest_${manifestFingerprint.slice(0, 24)}`;

  return Object.freeze({
    schemaVersion: HELIOS_COVERAGE_TENSOR_SCHEMA,
    manifestId,
    evaluationId: input.evaluationId,
    universeDefinition: input.universeDefinition,
    universeId: input.universeId,
    featureIds: Object.freeze([...input.featureIds]),
    eligibleUniverseCount: input.evaluationSnapshot.eligibleUniverseCount,
    usableFeatureCount: input.evaluationSnapshot.usableFeatureCount,
    expectedCellCount: input.evaluationSnapshot.expectedCellCount,
    exclusionByReason,
    snapshotIds: Object.freeze([
      input.evaluationSnapshot.snapshotId,
      ...(input.trainingSnapshot ? [input.trainingSnapshot.snapshotId] : []),
    ]),
    metrics: input.evaluationSnapshot.metrics,
    trainingSnapshotId: input.trainingSnapshot?.snapshotId ?? null,
    evaluationSnapshotId: input.evaluationSnapshot.snapshotId,
    manifestFingerprint,
    grantsExecutionAuthority: false,
  });
}
