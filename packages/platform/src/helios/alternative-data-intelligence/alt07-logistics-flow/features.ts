/**
 * Supply / demand research features from logistics flow states.
 */

import type { UtcInstant } from '@solstice/domain';
import { buildCargoAttribution } from './cargo-presentation.ts';
import type { Wave5Alt07BridgeResult } from './wave5-bridge.ts';
import type {
  CommodityFlowEstimate,
  LogisticsDisruptionState,
  SupplyDemandFeatureRow,
} from './types.ts';

function avg(nums: readonly number[]): number | null {
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function buildCommodityFlowEstimates(
  bridge: Wave5Alt07BridgeResult,
): readonly CommodityFlowEstimate[] {
  const byCommodity = new Map<string, { readonly flows: number[]; readonly evidence: string[] }>();
  for (const flow of bridge.shipmentFlows) {
    const code = flow.cargo.commodityCode;
    if (!code) continue;
    const existing = byCommodity.get(code) ?? { flows: [], evidence: [] };
    byCommodity.set(code, {
      flows: [...existing.flows, flow.vesselCount ?? 0],
      evidence: [...existing.evidence, flow.stateId],
    });
  }

  return Object.freeze(
    [...byCommodity.entries()].map(([commodityCode, bucket]) => {
      const index = avg(bucket.flows);
      const cargo = buildCargoAttribution({
        evidenceClass: 'INFERRED_CARGO',
        commodityCode,
        sourceObservationIds: bucket.evidence,
      });
      const knowableAt = bridge.shipmentFlows[0]?.knowableAt ?? ('1970-01-01T00:00:00.000Z' as UtcInstant);
      return Object.freeze({
        estimateId: `commodity-flow:${commodityCode}`,
        commodityCode,
        cargo,
        importFlowIndex: index,
        exportFlowIndex: index !== null ? index * 0.9 : null,
        inventoryProxyIndex: index !== null ? index * 0.15 : null,
        effectiveAt: knowableAt,
        knowableAt,
        grantsExecutionAuthority: false,
      });
    }),
  );
}

export function buildSupplyDemandFeatures(input: {
  readonly bridge: Wave5Alt07BridgeResult;
  readonly commodityFlows: readonly CommodityFlowEstimate[];
  readonly disruptions: readonly LogisticsDisruptionState[];
}): readonly SupplyDemandFeatureRow[] {
  const knowableAt = input.bridge.routes[0]?.knowableAt ?? ('1970-01-01T00:00:00.000Z' as UtcInstant);
  const throughput = avg(input.bridge.portCongestion.map((p) => p.congestionScore));
  const routeDisruption = avg(input.disruptions.map((d) => d.routeDisruptionIndex));
  const freightStress = avg(input.disruptions.map((d) => d.freightStressIndex));
  const importFlow = avg(input.commodityFlows.map((c) => c.importFlowIndex ?? 0));

  const rows: SupplyDemandFeatureRow[] = [
    Object.freeze({
      featureKey: 'importFlow',
      value: importFlow,
      unit: 'index',
      geographyOrScope: 'global-trade-lanes',
      knowableAt,
      evidenceRefs: Object.freeze(input.commodityFlows.map((c) => c.estimateId)),
    }),
    Object.freeze({
      featureKey: 'exportFlow',
      value: avg(input.commodityFlows.map((c) => c.exportFlowIndex ?? 0)),
      unit: 'index',
      geographyOrScope: 'global-trade-lanes',
      knowableAt,
      evidenceRefs: Object.freeze(input.commodityFlows.map((c) => c.estimateId)),
    }),
    Object.freeze({
      featureKey: 'inventoryProxy',
      value: avg(input.commodityFlows.map((c) => c.inventoryProxyIndex ?? 0)),
      unit: 'index',
      geographyOrScope: 'port-storage-proxy',
      knowableAt,
      evidenceRefs: Object.freeze(input.commodityFlows.map((c) => c.estimateId)),
    }),
    Object.freeze({
      featureKey: 'portThroughput',
      value: throughput,
      unit: 'congestion-index',
      geographyOrScope: 'monitored-ports',
      knowableAt,
      evidenceRefs: Object.freeze(input.bridge.portCongestion.map((p) => p.stateId)),
    }),
    Object.freeze({
      featureKey: 'routeDisruption',
      value: routeDisruption,
      unit: 'index',
      geographyOrScope: 'trade-routes',
      knowableAt,
      evidenceRefs: Object.freeze(input.disruptions.map((d) => d.stateId)),
    }),
    Object.freeze({
      featureKey: 'freightStress',
      value: freightStress,
      unit: 'index',
      geographyOrScope: 'freight-network',
      knowableAt,
      evidenceRefs: Object.freeze(input.disruptions.map((d) => d.stateId)),
    }),
  ];
  return Object.freeze(rows);
}

export function buildLogisticsDisruptionStates(input: {
  readonly bridge: Wave5Alt07BridgeResult;
}): readonly LogisticsDisruptionState[] {
  const weatherInformed = input.bridge.weatherObservationIds.length > 0;
  const states: LogisticsDisruptionState[] = [];

  for (const port of input.bridge.portCongestion) {
    if (port.congestionScore < 0.5) continue;
    states.push(
      Object.freeze({
        stateId: `disruption:port:${port.portId}`,
        scope: 'PORT',
        scopeRef: port.portId,
        severity: port.congestionScore > 0.75 ? 'SEVERE' : 'ELEVATED',
        weatherInformed,
        routeDisruptionIndex: port.congestionScore * 0.6,
        freightStressIndex: port.congestionScore * 0.8,
        evidenceRefs: Object.freeze([port.stateId, ...input.bridge.weatherObservationIds]),
        effectiveAt: port.effectiveAt,
        knowableAt: port.knowableAt,
        grantsExecutionAuthority: false,
      }),
    );
  }

  for (const route of input.bridge.routes) {
    const congestion = typeof route.ais.features.congestion === 'number' ? route.ais.features.congestion : 0;
    if (congestion < 0.5 && !weatherInformed) continue;
    states.push(
      Object.freeze({
        stateId: `disruption:route:${route.routeId}`,
        scope: 'ROUTE',
        scopeRef: route.routeId,
        severity: congestion > 0.6 || weatherInformed ? 'ELEVATED' : 'LOW',
        weatherInformed,
        routeDisruptionIndex: Math.max(congestion, weatherInformed ? 0.55 : 0),
        freightStressIndex: Math.max(congestion * 0.9, weatherInformed ? 0.5 : 0),
        evidenceRefs: Object.freeze([route.observationId, ...input.bridge.weatherObservationIds]),
        effectiveAt: route.observedAt,
        knowableAt: route.knowableAt,
        grantsExecutionAuthority: false,
      }),
    );
  }

  return Object.freeze(states);
}
