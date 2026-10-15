import { canonicalJsonStringify, hashRawJsonPayload } from '../../../../../provider-sdk/src/hash.ts';
import type { CoverageTensor, FeatureCoverageProbe } from './types.ts';
import { HELIOS_FEATURE_COVERAGE_SCHEMA } from './types.ts';
import type { UtcInstant } from '../../../../../domain/src/time.ts';

function probeSatisfied(probe: FeatureCoverageProbe): boolean {
  return (
    probe.signal.published &&
    probe.signal.providerAvailable &&
    probe.signal.providerCoversInstrument &&
    probe.signal.entityResolved &&
    probe.signal.applicable &&
    probe.signal.knowableAtEvaluationTime &&
    probe.signal.valuePresent &&
    probe.signal.qualityState === 'VALID'
  );
}

export function buildCoverageTensor(input: {
  readonly universeId: string;
  readonly universeDefinition: string;
  readonly evaluationTimestamp: UtcInstant;
  readonly eligibleMembers: readonly import('./types.ts').EligibleUniverseMember[];
  readonly featureIds: readonly string[];
  readonly probes: readonly FeatureCoverageProbe[];
  readonly baselineCoverageRatioBps?: number | null;
}): CoverageTensor {
  const eligibleMemberCount = input.eligibleMembers.length;
  const totalCells = Math.max(1, input.probes.length);
  const satisfied = input.probes.filter(probeSatisfied).length;
  const coverageRatioBps = Math.round((satisfied * 10_000) / totalCells);
  const baseline = input.baselineCoverageRatioBps ?? null;
  const driftFromBaselineBps = baseline === null ? null : coverageRatioBps - baseline;

  return Object.freeze({
    schemaVersion: HELIOS_FEATURE_COVERAGE_SCHEMA,
    universeId: input.universeId,
    universeDefinition: input.universeDefinition,
    evaluationTimestamp: input.evaluationTimestamp,
    eligibleMemberCount,
    featureIds: Object.freeze([...input.featureIds]),
    probes: Object.freeze([...input.probes]),
    coverageRatioBps,
    driftFromBaselineBps,
  });
}

export function sealCoverageSnapshot(input: {
  readonly tensor: CoverageTensor;
  readonly capturedAt: UtcInstant;
}): import('./types.ts').CoverageSnapshot {
  const digest = hashRawJsonPayload(canonicalJsonStringify(input.tensor)).digest;
  return Object.freeze({
    schemaVersion: HELIOS_FEATURE_COVERAGE_SCHEMA,
    snapshotId: `coverage:${input.tensor.universeId}:${input.capturedAt}`,
    capturedAt: input.capturedAt,
    tensorDigest: digest,
    coverageRatioBps: input.tensor.coverageRatioBps,
  });
}
