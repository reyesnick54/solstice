import type { ProductiveClaim } from './claims.ts';
import type { ProductiveCapacityGraph } from './graph.ts';
import type { MoonReyIssuanceReceipt } from './issuance.ts';
import type { ProductiveEconomicObject } from './objects.ts';
import type { ClaimType, ProductiveCategory } from './types.ts';
import type { VerifiedProductiveContribution } from './verification.ts';

export type CategoryAggregate = {
  readonly category: ProductiveCategory;
  readonly claimType: ClaimType;
  readonly quantity: bigint;
  readonly unit: string;
  readonly contributionCount: number;
};

export type GeographyAggregate = {
  readonly geographyId: string;
  readonly jurisdiction: string;
  readonly contributionCount: number;
  readonly moonreyIssued: bigint;
};

export type EpochAggregate = {
  readonly epoch: number;
  readonly moonreyIssued: bigint;
  readonly contributionCount: number;
};

export type LineageView = {
  readonly contributionId: string;
  readonly fingerprint: string;
  readonly objectId: string;
  readonly claimType: ClaimType;
  readonly oracleFactIds: readonly string[];
  readonly upstreamContributionIds: readonly string[];
  readonly downstreamContributionIds: readonly string[];
  readonly issuanceId: string | null;
};

export type AttributionView = {
  readonly issuanceId: string;
  readonly category: ProductiveCategory;
  readonly contributionId: string;
  readonly objectId: string;
  readonly moonreyQuantity: bigint;
  readonly policyVersion: number;
  readonly oracleFacts: readonly string[];
};

function publicObject(object: ProductiveEconomicObject): ProductiveEconomicObject {
  return object;
}

export function queryObject(
  objects: readonly ProductiveEconomicObject[],
  objectId: string,
): ProductiveEconomicObject | undefined {
  return objects.find((object) => object.objectId === objectId);
}

export function capacityByCategory(
  claims: readonly ProductiveClaim[],
): readonly CategoryAggregate[] {
  return aggregateClaims(claims, 'CAPACITY');
}

export function outputByCategory(
  claims: readonly ProductiveClaim[],
): readonly CategoryAggregate[] {
  return aggregateClaims(claims, 'OUTPUT');
}

export function contributionLineage(
  contributions: readonly VerifiedProductiveContribution[],
  receipts: readonly MoonReyIssuanceReceipt[],
  contributionId: string,
): LineageView | undefined {
  const contribution = contributions.find((item) => item.contributionId === contributionId);
  if (!contribution) {
    return undefined;
  }
  const receipt = receipts.find((item) => item.productiveContributionId === contributionId);
  return Object.freeze({
    contributionId: contribution.contributionId,
    fingerprint: contribution.fingerprint,
    objectId: contribution.objectId,
    claimType: contribution.claimType,
    oracleFactIds: contribution.oracleFactIds,
    upstreamContributionIds: contribution.upstreamContributionIds,
    downstreamContributionIds: contribution.downstreamContributionIds,
    issuanceId: receipt?.issuanceId ?? null,
  });
}

export function issuanceAttribution(
  receipts: readonly MoonReyIssuanceReceipt[],
  contributions: readonly VerifiedProductiveContribution[],
): readonly AttributionView[] {
  return receipts
    .map((receipt) => {
      const contribution = contributions.find((item) => item.contributionId === receipt.productiveContributionId);
      return Object.freeze({
        issuanceId: receipt.issuanceId,
        category: receipt.category,
        contributionId: receipt.productiveContributionId,
        objectId: contribution?.objectId ?? '',
        moonreyQuantity: receipt.moonreyQuantity,
        policyVersion: receipt.policyVersion,
        oracleFacts: receipt.oracleFacts,
      });
    })
    .sort((left, right) => left.issuanceId.localeCompare(right.issuanceId));
}

export function geographicAggregates(
  contributions: readonly VerifiedProductiveContribution[],
  receipts: readonly MoonReyIssuanceReceipt[],
): readonly GeographyAggregate[] {
  const map = new Map<string, GeographyAggregate>();
  for (const contribution of contributions) {
    const key = contribution.geography.geographyId;
    const issued = receipts
      .filter((receipt) => receipt.productiveContributionId === contribution.contributionId)
      .reduce((sum, receipt) => sum + receipt.moonreyQuantity, 0n);
    const current = map.get(key);
    map.set(
      key,
      Object.freeze({
        geographyId: key,
        jurisdiction: contribution.geography.jurisdiction,
        contributionCount: (current?.contributionCount ?? 0) + 1,
        moonreyIssued: (current?.moonreyIssued ?? 0n) + issued,
      }),
    );
  }
  return [...map.values()].sort((left, right) => left.geographyId.localeCompare(right.geographyId));
}

export function epochAggregates(receipts: readonly MoonReyIssuanceReceipt[]): readonly EpochAggregate[] {
  const map = new Map<number, EpochAggregate>();
  for (const receipt of receipts) {
    const epoch = Number(receipt.formulaInputs.eligibleQuantity >= 0n ? receipt.blockHeight : 0);
    const current = map.get(receipt.blockHeight) ?? {
      epoch: receipt.blockHeight,
      moonreyIssued: 0n,
      contributionCount: 0,
    };
    map.set(
      receipt.blockHeight,
      Object.freeze({
        epoch,
        moonreyIssued: current.moonreyIssued + receipt.moonreyQuantity,
        contributionCount: current.contributionCount + 1,
      }),
    );
  }
  return [...map.values()].sort((left, right) => left.epoch - right.epoch);
}

export function graphSummary(graph: ProductiveCapacityGraph): {
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly projectionHash: string;
} {
  return {
    nodeCount: graph.nodes.length,
    edgeCount: graph.edges.length,
    projectionHash: graph.projectionHash,
  };
}

function aggregateClaims(
  claims: readonly ProductiveClaim[],
  claimType: ClaimType,
): readonly CategoryAggregate[] {
  const map = new Map<string, CategoryAggregate>();
  for (const claim of claims.filter((item) => item.claimType === claimType)) {
    const key = `${claim.category}:${claim.unit}`;
    const current = map.get(key);
    map.set(
      key,
      Object.freeze({
        category: claim.category,
        claimType,
        quantity: (current?.quantity ?? 0n) + claim.quantity,
        unit: claim.unit,
        contributionCount: (current?.contributionCount ?? 0) + 1,
      }),
    );
  }
  return [...map.values()].sort((left, right) => left.category.localeCompare(right.category));
}

void publicObject;
