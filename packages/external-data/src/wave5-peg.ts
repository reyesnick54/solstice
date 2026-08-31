/**
 * Productive Economic Graph integration for Wave 5 physical-economy observations.
 */

import type { ExternalDataPlane } from './plane.ts';
import type { PegEdge, PegNode, ProductiveEconomicGraphSnapshot } from './wave5-models.ts';

export function buildProductiveEconomicGraph(plane: ExternalDataPlane): ProductiveEconomicGraphSnapshot {
  const w5 = plane.wave5;
  const nodes: PegNode[] = [];
  const edges: PegEdge[] = [];
  let observationCount = 0;

  for (const obs of w5.geospatial.getCountries().observations) {
    const country = obs.data;
    const nodeId = `country:${country.countryCode}`;
    nodes.push({
      nodeId,
      nodeType: 'COUNTRY',
      label: country.name,
      geography: null,
      sourceObservationId: obs.observationId,
    });
    observationCount += 1;
  }

  for (const obs of w5.geospatial.geocode('London').observations) {
    const geo = obs.data.geography;
    const nodeId = `city:${geo.locationId}`;
    nodes.push({
      nodeId,
      nodeType: 'CITY',
      label: geo.city ?? geo.locationId,
      geography: geo,
      sourceObservationId: obs.observationId,
    });
    const countryNodeId = `country:${geo.countryCode}`;
    if (nodes.some((n) => n.nodeId === countryNodeId)) {
      edges.push({
        edgeId: `edge:${nodeId}->${countryNodeId}`,
        edgeType: 'LOCATED_IN',
        fromNodeId: nodeId,
        toNodeId: countryNodeId,
        evidenceRef: obs.observationId,
      });
    }
    observationCount += 1;
  }

  for (const obs of w5.maritime.getShippingFlow().observations) {
    const flow = obs.data;
    const nodeId = `corridor:${flow.corridor.replace(/\s+/g, '-').toLowerCase()}`;
    nodes.push({
      nodeId,
      nodeType: 'SHIPPING_CORRIDOR',
      label: flow.corridor,
      geography: null,
      sourceObservationId: obs.observationId,
    });
    observationCount += 1;
  }

  for (const obs of w5.energy.getObservations().observations) {
    const energy = obs.data;
    const nodeId = `grid:${energy.geography}`;
    if (!nodes.some((n) => n.nodeId === nodeId)) {
      nodes.push({
        nodeId,
        nodeType: 'ENERGY_GRID',
        label: `Energy Grid ${energy.geography}`,
        geography: null,
        sourceObservationId: obs.observationId,
      });
    }
    observationCount += 1;
  }

  for (const obs of w5.resources.getObservations().observations) {
    const resource = obs.data;
    const nodeId = `resource-region:${resource.geography}:${resource.category}`;
    if (!nodes.some((n) => n.nodeId === nodeId)) {
      nodes.push({
        nodeId,
        nodeType: 'RESOURCE_REGION',
        label: `${resource.category} — ${resource.geography}`,
        geography: null,
        sourceObservationId: obs.observationId,
      });
    }
    observationCount += 1;
  }

  for (const obs of w5.travel.getTransitRoutes().observations) {
    const transit = obs.data;
    const nodeId = `transport:${transit.routeId}`;
    nodes.push({
      nodeId,
      nodeType: 'TRANSPORT_NETWORK',
      label: transit.routeName,
      geography: null,
      sourceObservationId: obs.observationId,
    });
    observationCount += 1;
  }

  return Object.freeze({
    schema: 'sunrey.productive-economic-graph.v1',
    nodes: Object.freeze(nodes),
    edges: Object.freeze(edges),
    observationCount,
    grantsIssuanceAuthority: false,
  });
}
