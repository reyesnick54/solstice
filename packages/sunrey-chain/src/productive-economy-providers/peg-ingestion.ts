/**
 * Productive Economic Graph ingestion for energy/resource observations.
 *
 * Time-series observations are not converted to permanent graph nodes.
 * Only stable geographic and resource-class nodes are projected.
 */

import type { ExternalObservation } from '../../../provider-sdk/src/index.ts';
import type { EnergyObservation, ResourceObservation } from './types.ts';

export type PegNodeKind =
  | 'COUNTRY'
  | 'REGION'
  | 'RESOURCE'
  | 'ENERGY_SOURCE'
  | 'GRID'
  | 'COMMODITY'
  | 'PRODUCTION_SECTOR';

export type PegEdgeKind =
  | 'PRODUCES'
  | 'CONSUMES'
  | 'EXPORTS'
  | 'IMPORTS'
  | 'DEPENDS_ON'
  | 'POWERS'
  | 'SUPPLIES'
  | 'LOCATED_IN';

export type PegProjectionNode = {
  readonly id: string;
  readonly kind: PegNodeKind;
  readonly label: string;
};

export type PegProjectionEdge = {
  readonly from: string;
  readonly to: string;
  readonly kind: PegEdgeKind;
  readonly observationRef: string | null;
};

export type PegIngestionResult = {
  readonly nodes: readonly PegProjectionNode[];
  readonly edges: readonly PegProjectionEdge[];
  readonly observationCount: number;
  readonly timeSeriesStoredSeparately: true;
};

export function ingestEnergyObservationsToPeg(
  observations: readonly ExternalObservation<EnergyObservation>[],
): PegIngestionResult {
  const nodes = new Map<string, PegProjectionNode>();
  const edges: PegProjectionEdge[] = [];

  const addNode = (id: string, kind: PegNodeKind, label: string) => {
    if (!nodes.has(id)) {
      nodes.set(id, Object.freeze({ id, kind, label }));
    }
  };

  for (const obs of observations) {
    const data = obs.data;
    const countryId = `country:${data.geography.country}`;
    const gridId = data.geography.gridZone ? `grid:${data.geography.gridZone}` : countryId;

    addNode(countryId, 'COUNTRY', data.geography.country);
    addNode(gridId, 'GRID', data.geography.gridZone ?? data.geography.country);

    if (data.energySource) {
      const sourceId = `energy-source:${data.energySource}`;
      addNode(sourceId, 'ENERGY_SOURCE', data.energySource);
      if (data.measurementKind === 'GENERATION' || data.measurementKind === 'GENERATION_MIX') {
        edges.push(
          Object.freeze({
            from: sourceId,
            to: gridId,
            kind: 'POWERS',
            observationRef: data.observationId,
          }),
        );
      }
    }

    if (data.measurementKind === 'DEMAND' || data.measurementKind === 'CONSUMPTION') {
      edges.push(
        Object.freeze({
          from: gridId,
          to: countryId,
          kind: 'CONSUMES',
          observationRef: data.observationId,
        }),
      );
    }

    edges.push(
      Object.freeze({
        from: gridId,
        to: countryId,
        kind: 'LOCATED_IN',
        observationRef: null,
      }),
    );
  }

  return Object.freeze({
    nodes: Object.freeze([...nodes.values()]),
    edges: Object.freeze(edges),
    observationCount: observations.length,
    timeSeriesStoredSeparately: true,
  });
}

export function ingestResourceObservationsToPeg(
  observations: readonly ExternalObservation<ResourceObservation>[],
): PegIngestionResult {
  const nodes = new Map<string, PegProjectionNode>();
  const edges: PegProjectionEdge[] = [];

  const addNode = (id: string, kind: PegNodeKind, label: string) => {
    if (!nodes.has(id)) {
      nodes.set(id, Object.freeze({ id, kind, label }));
    }
  };

  for (const obs of observations) {
    const data = obs.data;
    const countryId = `country:${data.geography.country}`;
    const resourceId = `resource:${data.resourceType}`;
    const commodityId = `commodity:${data.resourceType}`;

    addNode(countryId, 'COUNTRY', data.geography.country);
    addNode(resourceId, 'RESOURCE', data.resourceType);
    addNode(commodityId, 'COMMODITY', data.resourceType);

    if (data.geography.region) {
      const regionId = `region:${data.geography.country}:${data.geography.region}`;
      addNode(regionId, 'REGION', data.geography.region);
      edges.push(
        Object.freeze({
          from: commodityId,
          to: regionId,
          kind: 'LOCATED_IN',
          observationRef: data.observationId,
        }),
      );
    }

    if (data.measurementType === 'PRICE' || data.measurementType === 'PRODUCTION') {
      edges.push(
        Object.freeze({
          from: countryId,
          to: commodityId,
          kind: data.measurementType === 'PRODUCTION' ? 'PRODUCES' : 'SUPPLIES',
          observationRef: data.observationId,
        }),
      );
    }
  }

  return Object.freeze({
    nodes: Object.freeze([...nodes.values()]),
    edges: Object.freeze(edges),
    observationCount: observations.length,
    timeSeriesStoredSeparately: true,
  });
}
