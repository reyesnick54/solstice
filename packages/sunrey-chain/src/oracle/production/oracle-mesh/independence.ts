/**
 * Source independence analysis for productive oracle mesh.
 *
 * If website B copies government A and aggregator C copies website B,
 * A/B/C must not count as three independent productive witnesses.
 */

import type { ProviderLineage } from './types.ts';

export type IndependenceWitness = {
  readonly providerId: string;
  readonly lineage: ProviderLineage;
  readonly ultimateOriginId: string;
  readonly independenceKey: string;
};

export type IndependenceAnalysis = {
  readonly rawSourceCount: number;
  readonly independentSourceCount: number;
  readonly collapsedCopies: number;
  readonly witnesses: readonly IndependenceWitness[];
  readonly copiedProviderIds: readonly string[];
  readonly endpointCountIsNotIndependence: true;
};

/**
 * Resolve the ultimate dataset origin by walking copy/derivation chain.
 */
export function resolveUltimateOrigin(lineage: ProviderLineage): string {
  if (lineage.derivedFromDatasetId) {
    return lineage.derivedFromDatasetId;
  }
  return lineage.datasetOriginId;
}

function syndicatedOriginIds(lineages: readonly ProviderLineage[]): ReadonlySet<string> {
  const syndicated = new Set<string>();
  for (const lineage of lineages) {
    if (lineage.copiedFromProviderId !== null || lineage.derivedFromDatasetId !== null) {
      syndicated.add(resolveUltimateOrigin(lineage));
    }
  }
  return syndicated;
}

export function independenceKeyFor(
  lineage: ProviderLineage,
  syndicatedOrigins: ReadonlySet<string> = new Set(),
): string {
  const origin = resolveUltimateOrigin(lineage);
  const isSyndicated =
    lineage.copiedFromProviderId !== null ||
    lineage.derivedFromDatasetId !== null ||
    syndicatedOrigins.has(origin);
  if (isSyndicated) {
    return `syndicated:${origin}`;
  }
  return `independent:${lineage.controllerId}:${origin}`;
}

export function analyzeProductiveIndependence(
  lineages: readonly ProviderLineage[],
): IndependenceAnalysis {
  const syndicatedOrigins = syndicatedOriginIds(lineages);
  const witnesses: IndependenceWitness[] = [];
  const copied: string[] = [];
  const seenKeys = new Set<string>();

  for (const lineage of lineages) {
    const ultimateOriginId = resolveUltimateOrigin(lineage);
    const independenceKey = independenceKeyFor(lineage, syndicatedOrigins);
    if (lineage.copiedFromProviderId) {
      copied.push(lineage.providerId);
    }
    witnesses.push(
      Object.freeze({
        providerId: lineage.providerId,
        lineage,
        ultimateOriginId,
        independenceKey,
      }),
    );
    seenKeys.add(independenceKey);
  }

  return Object.freeze({
    rawSourceCount: lineages.length,
    independentSourceCount: seenKeys.size,
    collapsedCopies: lineages.filter((row) => row.copiedFromProviderId !== null).length,
    witnesses: Object.freeze(witnesses),
    copiedProviderIds: Object.freeze([...new Set(copied)].sort()),
    endpointCountIsNotIndependence: true,
  });
}

export function copiedSourcesDoNotCountIndependently(
  left: ProviderLineage,
  right: ProviderLineage,
): boolean {
  const syndicated = syndicatedOriginIds([left, right]);
  return independenceKeyFor(left, syndicated) === independenceKeyFor(right, syndicated);
}

export function providerLineageFromRecord(input: {
  readonly providerId: string;
  readonly controllerId: string;
  readonly upstreamOrganizationId: string;
  readonly datasetOriginId: string;
  readonly copiedFromProviderId: string | null;
  readonly derivedFromDatasetId: string | null;
  readonly sourceClass: ProviderLineage['sourceClass'];
}): ProviderLineage {
  return Object.freeze({
    providerId: input.providerId,
    controllerId: input.controllerId,
    upstreamOrganizationId: input.upstreamOrganizationId,
    datasetOriginId: input.datasetOriginId,
    copiedFromProviderId: input.copiedFromProviderId,
    derivedFromDatasetId: input.derivedFromDatasetId,
    sourceClass: input.sourceClass,
  });
}
