import { coverageTensorContentDigest } from '../../coverage/tensor.ts';
import type { CoverageTensor, EligibleUniverseMember, FeatureCoverageProbe } from '../../coverage/types.ts';
import type { UniverseMemberProfile } from '../types.ts';

function probeUsable(probe: FeatureCoverageProbe): boolean {
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

function memberToProfile(
  member: EligibleUniverseMember,
  probes: readonly FeatureCoverageProbe[],
): UniverseMemberProfile {
  const usableCount = probes.filter(probeUsable).length;
  const rateBps =
    probes.length === 0 ? null : Math.round((usableCount * 10_000) / probes.length);
  const providerId = probes.find((row) => row.providerId)?.providerId ?? null;
  return Object.freeze({
    canonicalEntityId: member.canonicalEntityId,
    marketCapMinor: null,
    liquidityScore: null,
    volatilityBps: null,
    sector: member.sector,
    industry: member.industry,
    geography: member.geography,
    jurisdiction: member.geography,
    venue: member.venue,
    assetClass: member.assetClass,
    listingAgeDays: null,
    assetAgeDays: null,
    historicalReturnBps: null,
    primaryProviderId: providerId,
    featureCoverageRateBps: rateBps,
    delisted: false,
    delistedBeforeEvaluation: false,
    hadCorporateActionInWindow: false,
  });
}

export function biasSentinelInputFromCoverageTensor(input: {
  readonly tensor: CoverageTensor;
}): {
  readonly intendedEligibleUniverse: readonly UniverseMemberProfile[];
  readonly observedUsableEntityIds: readonly string[];
  readonly coverageTensorDigest: string;
} {
  const byEntity = new Map<string, FeatureCoverageProbe[]>();
  for (const probe of input.tensor.probes) {
    const list = byEntity.get(probe.member.canonicalEntityId) ?? [];
    list.push(probe);
    byEntity.set(probe.member.canonicalEntityId, list);
  }
  const intendedEligibleUniverse: UniverseMemberProfile[] = [];
  for (const [entityId, probes] of byEntity) {
    const member = probes[0]!.member;
    intendedEligibleUniverse.push(memberToProfile(member, probes));
    void entityId;
  }
  const observedUsableEntityIds = Object.freeze(
    [...byEntity.entries()]
      .filter(([, probes]) => probes.some(probeUsable))
      .map(([entityId]) => entityId),
  );
  const coverageTensorDigest = coverageTensorContentDigest(input.tensor);
  return Object.freeze({
    intendedEligibleUniverse: Object.freeze(intendedEligibleUniverse),
    observedUsableEntityIds,
    coverageTensorDigest,
  });
}
