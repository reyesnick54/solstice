/**
 * Wave 4 — provider and dataset lineage for source independence.
 *
 * Three websites copying EIA must not count as three independent sources.
 */

import type { ProviderId } from '../registry-types.ts';

export const LINEAGE_RELATIONSHIPS = [
  'ORIGINATES',
  'DERIVES_FROM',
  'REPUBLISHES',
  'AGGREGATES',
  'TRANSFORMS',
] as const;
export type LineageRelationship = (typeof LINEAGE_RELATIONSHIPS)[number];

export type DatasetLineageNode = {
  readonly datasetId: string;
  readonly providerId: ProviderId;
  readonly label: string;
};

export type ProviderLineageEdge = {
  readonly fromProviderId: ProviderId;
  readonly toProviderId: ProviderId;
  readonly relationship: LineageRelationship;
  readonly upstreamDatasetId: string | null;
  readonly notes: string | null;
};

export type ProviderLineageRecord = {
  readonly providerId: ProviderId;
  readonly sourceClassUpstream: string | null;
  readonly upstreamProviderId: ProviderId | null;
  readonly upstreamDatasetId: string | null;
  readonly relationship: LineageRelationship | null;
  readonly independenceGroupId: string;
};

export class ProviderLineageRegistry {
  readonly #edges: ProviderLineageEdge[] = [];
  readonly #records = new Map<ProviderId, ProviderLineageRecord>();

  registerOrigin(input: {
    readonly providerId: ProviderId;
    readonly datasetId: string;
    readonly independenceGroupId?: string;
  }): ProviderLineageRecord {
    const record: ProviderLineageRecord = Object.freeze({
      providerId: input.providerId,
      sourceClassUpstream: null,
      upstreamProviderId: null,
      upstreamDatasetId: input.datasetId,
      relationship: 'ORIGINATES',
      independenceGroupId: input.independenceGroupId ?? input.providerId,
    });
    this.#records.set(input.providerId, record);
    return record;
  }

  registerDerivation(input: {
    readonly providerId: ProviderId;
    readonly upstreamProviderId: ProviderId;
    readonly relationship: LineageRelationship;
    readonly upstreamDatasetId?: string | null;
    readonly notes?: string | null;
  }): ProviderLineageRecord {
    const upstream = this.#records.get(input.upstreamProviderId);
    const independenceGroupId = upstream?.independenceGroupId ?? input.upstreamProviderId;
    const record: ProviderLineageRecord = Object.freeze({
      providerId: input.providerId,
      sourceClassUpstream: input.upstreamProviderId,
      upstreamProviderId: input.upstreamProviderId,
      upstreamDatasetId: input.upstreamDatasetId ?? upstream?.upstreamDatasetId ?? null,
      relationship: input.relationship,
      independenceGroupId,
    });
    this.#records.set(input.providerId, record);
    this.#edges.push(
      Object.freeze({
        fromProviderId: input.providerId,
        toProviderId: input.upstreamProviderId,
        relationship: input.relationship,
        upstreamDatasetId: record.upstreamDatasetId,
        notes: input.notes ?? null,
      }),
    );
    return record;
  }

  get(providerId: ProviderId): ProviderLineageRecord | undefined {
    return this.#records.get(providerId);
  }

  listEdges(): readonly ProviderLineageEdge[] {
    return Object.freeze([...this.#edges]);
  }

  listRecords(): readonly ProviderLineageRecord[] {
    return Object.freeze([...this.#records.values()]);
  }

  /** Providers sharing the same independence group are not independent sources. */
  sharedUpstreamGroup(providerIds: readonly ProviderId[]): readonly ProviderId[] {
    const groups = new Map<string, ProviderId[]>();
    for (const id of providerIds) {
      const record = this.#records.get(id);
      const group = record?.independenceGroupId ?? id;
      const list = groups.get(group) ?? [];
      list.push(id);
      groups.set(group, list);
    }
    const shared = [...groups.values()].filter((g) => g.length > 1);
    return Object.freeze(shared.flat());
  }

  countIndependentSources(providerIds: readonly ProviderId[]): number {
    const groups = new Set<string>();
    for (const id of providerIds) {
      const record = this.#records.get(id);
      groups.add(record?.independenceGroupId ?? id);
    }
    return groups.size;
  }
}

export function createProviderLineageRegistry(): ProviderLineageRegistry {
  return new ProviderLineageRegistry();
}
