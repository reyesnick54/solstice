import { asUtcInstant } from '../../../../domain/src/time.ts';
import {
  CANONICAL_SYSTEM_OWNERS,
  EconomicAssetRegistry,
  assetIdFor,
  fixtureAsset,
  type AssetId,
  type EconomicAssetDescriptor,
  type LineageEdgeKind,
  type RegisterAssetInput,
} from '../../../../economic-asset-registry/src/index.ts';
import type { ProductiveClaimCandidate } from './types.ts';

export type CompatibilityLineageRefs = {
  readonly oracleSourceDatasetId: AssetId;
  readonly oracleObservationSetId: AssetId;
  readonly verifiedEconomicFactId: AssetId;
  readonly productiveClaimId: AssetId;
  readonly verifiedProductiveContributionId: AssetId | null;
};

/**
 * Optional Chunk 113 lineage projection for the compatibility path.
 *
 * Registry availability is never a minting dependency. A missing
 * registry leaves the candidate path unchanged.
 */
export function recordCompatibilityLineage(
  registry: EconomicAssetRegistry | null,
  candidate: ProductiveClaimCandidate,
  nowIso = '2026-08-19T12:00:00.000Z',
): CompatibilityLineageRefs | null {
  if (!registry) {
    return null;
  }
  const createdAt = asUtcInstant(nowIso);
  const source = registerOrThrow(registry, {
    ...fixtureAsset('oracle-source', `compat-source:${candidate.objectId}:${candidate.mappingId}`),
    createdAt,
  });
  const observations = registerOrThrow(
    registry,
    childAsset(source.assetId, 'AGGREGATED_FROM', {
      ...fixtureAsset('oracle-source', `compat-obs:${candidate.factId}`),
      assetClass: 'ORACLE_OBSERVATION_SET',
      sourceClass: 'ORACLE_NETWORK',
      canonicalOwnerSystem: CANONICAL_SYSTEM_OWNERS.oracle,
      sourceSystem: CANONICAL_SYSTEM_OWNERS.oracle,
      contentCommitmentMaterial: `commit:obs:${candidate.factId}`,
      provenanceMaterial: `prov:obs:${candidate.factId}`,
      createdAt,
    }),
  );
  const fact = registerOrThrow(
    registry,
    childAsset(observations.assetId, 'DERIVED_FROM', {
      ...fixtureAsset('verified-fact', `compat-fact:${candidate.factId}`),
      createdAt,
    }),
  );
  const claim = registerOrThrow(
    registry,
    childAsset(fact.assetId, 'DERIVED_FROM', {
      ...fixtureAsset('productive-object', `compat-claim:${candidate.candidateId}`),
      assetClass: 'PRODUCTIVE_CLAIM',
      sourceClass: 'PRODUCTIVE_CLAIM_REGISTRY',
      canonicalOwnerSystem: CANONICAL_SYSTEM_OWNERS.productive,
      sourceSystem: CANONICAL_SYSTEM_OWNERS.productive,
      economicCategory: candidate.productiveCategory,
      contentCommitmentMaterial: `commit:claim:${candidate.candidateId}`,
      provenanceMaterial: `prov:claim:${candidate.candidateId}`,
      createdAt,
    }),
  );
  return Object.freeze({
    oracleSourceDatasetId: source.assetId,
    oracleObservationSetId: observations.assetId,
    verifiedEconomicFactId: fact.assetId,
    productiveClaimId: claim.assetId,
    verifiedProductiveContributionId: null,
  });
}

export function attachVerifiedContributionLineage(
  registry: EconomicAssetRegistry,
  prior: CompatibilityLineageRefs,
  contributionId: string,
  nowIso = '2026-08-19T12:00:00.000Z',
): CompatibilityLineageRefs {
  const createdAt = asUtcInstant(nowIso);
  const contribution = registerOrThrow(
    registry,
    childAsset(prior.productiveClaimId, 'CONTRIBUTED_TO', {
      ...fixtureAsset('productive-contribution', `compat-contrib:${contributionId}`),
      createdAt,
    }),
  );
  return Object.freeze({
    ...prior,
    verifiedProductiveContributionId: contribution.assetId,
  });
}

export function registryDoesNotAuthorizeMint(registry: EconomicAssetRegistry, assetId: AssetId): false {
  const descriptor = registry.get(assetId);
  if (!descriptor) {
    return false;
  }
  return registry.authorizeMint(descriptor).authorized;
}

function childAsset(
  parentId: AssetId,
  kind: LineageEdgeKind,
  input: RegisterAssetInput,
): RegisterAssetInput {
  return {
    ...input,
    lineage: [
      {
        kind,
        fromAssetId: assetIdFor(`edge:${kind}:${parentId}:${input.contentCommitmentMaterial}`),
        toAssetId: parentId,
      },
    ],
  };
}

function registerOrThrow(
  registry: EconomicAssetRegistry,
  input: RegisterAssetInput,
): EconomicAssetDescriptor {
  const registered = registry.register(input);
  if (!registered.ok) {
    throw new Error(registered.error.message);
  }
  return registered.value;
}
