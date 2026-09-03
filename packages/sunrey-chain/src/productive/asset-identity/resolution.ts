/**
 * Productive asset identity resolution with confidence scoring.
 */

import type {
  AssetResolutionHint,
  AssetResolutionResult,
  CanonicalProductiveAsset,
  IdentityConfidence,
  ProductiveAssetAlias,
  ProductiveAssetId,
} from './types.ts';
import { aliasValueCommitment, type ProductiveAssetAliasRegistry } from './alias.ts';
import { commitCoordinates, commitValue } from './commitment.ts';
import { deriveAssetFingerprint } from './fingerprint.ts';

const AUTO_MERGE_CONFIDENCE: ReadonlySet<IdentityConfidence> = new Set(['EXACT']);

export function policyAllowsAutomatedConsolidation(confidence: IdentityConfidence): boolean {
  return AUTO_MERGE_CONFIDENCE.has(confidence);
}

type ResolutionHintRow = {
  aliasKind: import('./types.ts').ProductiveAliasKind;
  aliasValueCommitment: string;
  sourceSystem: string;
  providerId: string | null;
  weight: number;
};

export function buildResolutionHints(hint: AssetResolutionHint): readonly ResolutionHintRow[] {
  const rows: ResolutionHintRow[] = [];

  const sourceSystem = hint.sourceSystem ?? 'unknown';
  const providerId = hint.providerId ?? null;

  if (hint.aliasKind && (hint.aliasValue || hint.aliasValueCommitment)) {
    rows.push({
      aliasKind: hint.aliasKind,
      aliasValueCommitment:
        hint.aliasValueCommitment ?? aliasValueCommitment(hint.aliasKind, hint.aliasValue ?? ''),
      sourceSystem,
      providerId,
      weight: 100,
    });
  }
  if (hint.officialFacilityId) {
    rows.push({
      aliasKind: 'GOVERNMENT_REGISTRY_ID',
      aliasValueCommitment: commitValue('official-facility-id', hint.officialFacilityId),
      sourceSystem,
      providerId,
      weight: 95,
    });
  }
  if (hint.operatorAssetId) {
    rows.push({
      aliasKind: 'OPERATOR_ASSET_ID',
      aliasValueCommitment: commitValue('operator-asset-id', hint.operatorAssetId),
      sourceSystem,
      providerId,
      weight: 80,
    });
  }
  if (hint.governmentRegistryId) {
    rows.push({
      aliasKind: 'GOVERNMENT_REGISTRY_ID',
      aliasValueCommitment: commitValue('government-registry-id', hint.governmentRegistryId),
      sourceSystem,
      providerId,
      weight: 95,
    });
  }
  if (hint.enterpriseId) {
    rows.push({
      aliasKind: 'ENTERPRISE_ID',
      aliasValueCommitment: commitValue('enterprise-id', hint.enterpriseId),
      sourceSystem,
      providerId,
      weight: 70,
    });
  }
  if (hint.coordinatesCommitment) {
    rows.push({
      aliasKind: 'COORDINATES',
      aliasValueCommitment: hint.coordinatesCommitment,
      sourceSystem,
      providerId,
      weight: 60,
    });
  }
  if (hint.displayName && hint.jurisdiction) {
    rows.push({
      aliasKind: 'DISPLAY_NAME',
      aliasValueCommitment: aliasValueCommitment('DISPLAY_NAME', `${hint.displayName}|${hint.jurisdiction}`),
      sourceSystem,
      providerId,
      weight: 30,
    });
  }

  return Object.freeze(rows);
}

export function resolveProductiveAssetIdentity(input: {
  readonly hint: AssetResolutionHint;
  readonly aliases: ProductiveAssetAliasRegistry;
  readonly assets: ReadonlyMap<string, CanonicalProductiveAsset>;
  readonly fingerprintIndex: ReadonlyMap<string, ProductiveAssetId[]>;
}): AssetResolutionResult {
  const hints = buildResolutionHints(input.hint);
  const matchedAliases: ProductiveAssetAlias[] = [];
  const candidateScores = new Map<ProductiveAssetId, number>();

  for (const row of hints) {
    const alias = input.aliases.resolve({
      aliasKind: row.aliasKind,
      aliasValueCommitment: row.aliasValueCommitment,
      sourceSystem: row.sourceSystem,
      providerId: row.providerId,
    });
    if (alias) {
      matchedAliases.push(alias);
      candidateScores.set(alias.productiveAssetId, (candidateScores.get(alias.productiveAssetId) ?? 0) + row.weight);
    }
  }

  if (input.hint.assetClass && input.hint.jurisdiction) {
    const fingerprint = deriveAssetFingerprint({
      assetClass: input.hint.assetClass,
      jurisdiction: input.hint.jurisdiction,
      geography: {
        jurisdiction: input.hint.jurisdiction,
        region: null,
        locality: null,
        coordinatesCommitment: input.hint.coordinatesCommitment ?? null,
        precision: input.hint.coordinatesCommitment ? 'COORDINATES' : 'JURISDICTION',
      },
      ...(input.hint.technology ? { technologyMetadata: { technology: input.hint.technology } } : {}),
      ...(input.hint.commissionedYear
        ? { commissionedAtUtc: `${input.hint.commissionedYear}-01-01T00:00:00.000Z` }
        : {}),
      resolutionHint: input.hint,
    });
    for (const assetId of input.fingerprintIndex.get(fingerprint) ?? []) {
      candidateScores.set(assetId, (candidateScores.get(assetId) ?? 0) + 50);
    }
  }

  const ranked = [...candidateScores.entries()].sort((left, right) => right[1] - left[1]);
  if (ranked.length === 0) {
    return Object.freeze({
      confidence: 'NO_MATCH',
      productiveAssetId: null,
      candidates: Object.freeze([]),
      matchedAliasIds: Object.freeze(matchedAliases.map((row) => row.aliasId)),
      conflictReason: null,
    });
  }

  const topScore = ranked[0]?.[1] ?? 0;
  const topCandidates = ranked.filter(([, score]) => score === topScore).map(([assetId]) => assetId);
  if (topCandidates.length > 1) {
    return Object.freeze({
      confidence: 'CONFLICT',
      productiveAssetId: null,
      candidates: Object.freeze(topCandidates),
      matchedAliasIds: Object.freeze(matchedAliases.map((row) => row.aliasId)),
      conflictReason: 'multiple productive assets match with equal confidence',
    });
  }

  const productiveAssetId = topCandidates[0] ?? null;
  if (matchedAliases.length > 0 && topCandidates.length === 1) {
    return Object.freeze({
      confidence: 'EXACT',
      productiveAssetId,
      candidates: Object.freeze([productiveAssetId].filter(Boolean) as ProductiveAssetId[]),
      matchedAliasIds: Object.freeze(matchedAliases.map((row) => row.aliasId)),
      conflictReason: null,
    });
  }

  const hasStrongAlias = matchedAliases.some(
    (alias) => alias.aliasKind === 'EIA_PLANT_ID' || alias.aliasKind === 'GOVERNMENT_REGISTRY_ID',
  );
  const hasWeakOnly = !hasStrongAlias && matchedAliases.length > 0;
  const confidence: IdentityConfidence =
    topScore >= 95 || hasStrongAlias ? 'EXACT' : topScore >= 70 ? 'PROBABLE' : hasWeakOnly ? 'POSSIBLE' : 'PROBABLE';

  return Object.freeze({
    confidence,
    productiveAssetId,
    candidates: Object.freeze([productiveAssetId].filter(Boolean) as ProductiveAssetId[]),
    matchedAliasIds: Object.freeze(matchedAliases.map((row) => row.aliasId)),
    conflictReason: null,
  });
}

export function commitCoordinatesHint(latitude: number, longitude: number): string {
  return commitCoordinates(latitude, longitude);
}
