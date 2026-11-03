import { coverageTensorContentDigest } from '../../coverage/tensor.ts';
import type { CoverageTensor, FeatureCoverageCell } from '../../coverage/types.ts';
import type { UniverseMemberProfile } from '../types.ts';

function cellUsable(cell: FeatureCoverageCell): boolean {
  return cell.disposition === 'USABLE';
}

function cellToProfile(entityId: string, cells: readonly FeatureCoverageCell[]): UniverseMemberProfile {
  const sample = cells[0]!;
  const usableCount = cells.filter(cellUsable).length;
  const rateBps = cells.length === 0 ? null : Math.round((usableCount * 10_000) / cells.length);
  const providerId = cells.find((row) => row.providerId)?.providerId ?? null;
  return Object.freeze({
    canonicalEntityId: entityId,
    marketCapMinor: null,
    liquidityScore: null,
    volatilityBps: null,
    sector: sample.sector,
    industry: sample.industry,
    geography: sample.geography,
    jurisdiction: sample.geography,
    venue: sample.venue,
    assetClass: sample.assetClass,
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
  const byEntity = new Map<string, FeatureCoverageCell[]>();
  for (const cell of input.tensor.cells) {
    const list = byEntity.get(cell.canonicalEntityId) ?? [];
    list.push(cell);
    byEntity.set(cell.canonicalEntityId, list);
  }
  const intendedEligibleUniverse: UniverseMemberProfile[] = [];
  for (const [entityId, cells] of byEntity) {
    intendedEligibleUniverse.push(cellToProfile(entityId, cells));
  }
  const observedUsableEntityIds = Object.freeze(
    [...byEntity.entries()]
      .filter(([, cells]) => cells.some(cellUsable))
      .map(([entityId]) => entityId),
  );
  const coverageTensorDigest = coverageTensorContentDigest(input.tensor);
  return Object.freeze({
    intendedEligibleUniverse: Object.freeze(intendedEligibleUniverse),
    observedUsableEntityIds,
    coverageTensorDigest,
  });
}
