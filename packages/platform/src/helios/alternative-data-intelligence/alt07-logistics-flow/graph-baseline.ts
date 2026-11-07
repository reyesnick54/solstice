/**
 * Deterministic spatiotemporal logistics graph baseline (no learned model).
 */

import type { UtcInstant } from '@solstice/domain';
import type { Wave5Alt07BridgeResult } from './wave5-bridge.ts';
import type { Alt07GraphEdge, Alt07GraphNode, Alt07SpatiotemporalGraphSnapshot } from './types.ts';
import type { FirmLogisticsExposure } from './types.ts';
import { HELIOS_ALT07_LOGISTICS_FLOW_SCHEMA } from './taxonomy.ts';

export function buildDeterministicLogisticsGraph(input: {
  readonly bridge: Wave5Alt07BridgeResult;
  readonly firmExposures: readonly FirmLogisticsExposure[];
  readonly graphVersion?: number;
  readonly knowableAt: UtcInstant;
}): Alt07SpatiotemporalGraphSnapshot {
  const nodes = new Map<string, Alt07GraphNode>();
  const edges: Alt07GraphEdge[] = [];

  function addNode(nodeId: string, kind: Alt07GraphNode['kind'], label: string, evidenceRef: string | null): void {
    if (nodes.has(nodeId)) return;
    nodes.set(
      nodeId,
      Object.freeze({
        nodeId,
        kind,
        label,
        knowableAt: input.knowableAt,
        evidenceRef,
        grantsExecutionAuthority: false,
      }),
    );
  }

  for (const vessel of input.bridge.vessels) {
    const nodeId = `vessel:${vessel.vesselRef}`;
    addNode(nodeId, 'VESSEL', vessel.vesselRef, vessel.observationId);
    if (vessel.cargo.commodityCode) {
      const commodityId = `commodity:${vessel.cargo.commodityCode}`;
      addNode(commodityId, 'COMMODITY', vessel.cargo.commodityCode, vessel.observationId);
      edges.push(
        Object.freeze({
          edgeId: `${nodeId}:LOADED_WITH:${commodityId}`,
          kind: 'LOADED_WITH',
          fromNodeId: nodeId,
          toNodeId: commodityId,
          knowableAt: vessel.knowableAt,
          evidenceRef: vessel.observationId,
          grantsExecutionAuthority: false,
        }),
      );
    }
  }

  for (const route of input.bridge.routes) {
    addNode(route.routeId, 'ROUTE', route.corridorLabel, route.observationId);
    if (route.cargo.commodityCode) {
      const commodityId = `commodity:${route.cargo.commodityCode}`;
      addNode(commodityId, 'COMMODITY', route.cargo.commodityCode, route.observationId);
      edges.push(
        Object.freeze({
          edgeId: `${route.routeId}:FLOWS_TO:${commodityId}`,
          kind: 'FLOWS_TO',
          fromNodeId: route.routeId,
          toNodeId: commodityId,
          knowableAt: route.knowableAt,
          evidenceRef: route.observationId,
          grantsExecutionAuthority: false,
        }),
      );
    }
  }

  for (const port of input.bridge.ports) {
    addNode(port.portId, 'PORT', port.portName, port.observationId);
  }

  for (const choke of input.bridge.chokepoints) {
    addNode(choke.chokepointId, 'CHOKEPOINT', choke.label, choke.stateId);
    const routeNode = choke.chokepointId.startsWith('route:') ? choke.chokepointId : null;
    if (routeNode && nodes.has(routeNode)) {
      edges.push(
        Object.freeze({
          edgeId: `${routeNode}:ROUTES_THROUGH:${choke.chokepointId}`,
          kind: 'ROUTES_THROUGH',
          fromNodeId: routeNode,
          toNodeId: choke.chokepointId,
          knowableAt: choke.knowableAt,
          evidenceRef: choke.stateId,
          grantsExecutionAuthority: false,
        }),
      );
    }
  }

  for (const exposure of input.firmExposures) {
    const companyId = `company:${exposure.companyId}`;
    addNode(companyId, 'COMPANY', exposure.companyId, exposure.exposureId);
    if (exposure.facilityId) {
      const facilityId = `facility:${exposure.facilityId}`;
      addNode(facilityId, 'FACILITY', exposure.facilityId, exposure.exposureId);
      edges.push(
        Object.freeze({
          edgeId: `${companyId}:OPERATES:${facilityId}`,
          kind: 'OPERATES',
          fromNodeId: companyId,
          toNodeId: facilityId,
          knowableAt: exposure.knowableAt,
          evidenceRef: exposure.exposureId,
          grantsExecutionAuthority: false,
        }),
      );
    }
    if (exposure.portId) {
      const portNode = exposure.portId.startsWith('port:') ? exposure.portId : `port:${exposure.portId}`;
      addNode(portNode, 'PORT', exposure.portId, exposure.exposureId);
      edges.push(
        Object.freeze({
          edgeId: `${companyId}:EXPOSED_AT:${portNode}`,
          kind: 'EXPOSED_AT',
          fromNodeId: companyId,
          toNodeId: portNode,
          knowableAt: exposure.knowableAt,
          evidenceRef: exposure.exposureId,
          grantsExecutionAuthority: false,
        }),
      );
    }
    if (exposure.routeId) {
      const routeNode = exposure.routeId.startsWith('route:') ? exposure.routeId : `route:${exposure.routeId}`;
      addNode(routeNode, 'ROUTE', exposure.routeId, exposure.exposureId);
      edges.push(
        Object.freeze({
          edgeId: `${companyId}:ROUTES_THROUGH:${routeNode}`,
          kind: 'ROUTES_THROUGH',
          fromNodeId: companyId,
          toNodeId: routeNode,
          knowableAt: exposure.knowableAt,
          evidenceRef: exposure.exposureId,
          grantsExecutionAuthority: false,
        }),
      );
    }
    if (exposure.commodityCode) {
      const commodityId = `commodity:${exposure.commodityCode}`;
      addNode(commodityId, 'COMMODITY', exposure.commodityCode, exposure.exposureId);
      edges.push(
        Object.freeze({
          edgeId: `${companyId}:LOADED_WITH:${commodityId}`,
          kind: 'LOADED_WITH',
          fromNodeId: companyId,
          toNodeId: commodityId,
          knowableAt: exposure.knowableAt,
          evidenceRef: exposure.exposureId,
          grantsExecutionAuthority: false,
        }),
      );
    }
  }

  if (input.bridge.weatherObservationIds.length > 0) {
    const weatherId = 'weather:disruption-zone';
    addNode(weatherId, 'WEATHER_ZONE', 'Weather disruption overlay', input.bridge.weatherObservationIds[0] ?? null);
    for (const route of input.bridge.routes) {
      edges.push(
        Object.freeze({
          edgeId: `${route.routeId}:DISRUPTED_BY:${weatherId}`,
          kind: 'DISRUPTED_BY',
          fromNodeId: route.routeId,
          toNodeId: weatherId,
          knowableAt: route.knowableAt,
          evidenceRef: input.bridge.weatherObservationIds[0] ?? null,
          grantsExecutionAuthority: false,
        }),
      );
    }
  }

  return Object.freeze({
    schema: HELIOS_ALT07_LOGISTICS_FLOW_SCHEMA,
    graphVersion: input.graphVersion ?? 1,
    nodes: Object.freeze([...nodes.values()]),
    edges: Object.freeze(edges),
    grantsExecutionAuthority: false,
  });
}
