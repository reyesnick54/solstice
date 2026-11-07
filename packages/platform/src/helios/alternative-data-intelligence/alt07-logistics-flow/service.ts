/**
 * ALT07 logistics flow intelligence compile service.
 */

import { createHash } from 'node:crypto';

import type { ExternalDataPlane } from '@solstice/external-data';
import type { UtcInstant } from '@solstice/domain';
import { cargoPresentationPolicySatisfied } from './cargo-presentation.ts';
import { ingestWave5LogisticsFlow } from './wave5-bridge.ts';
import { compileFirmLogisticsExposures } from './firm-exposure.ts';
import { buildDeterministicLogisticsGraph } from './graph-baseline.ts';
import {
  buildCommodityFlowEstimates,
  buildLogisticsDisruptionStates,
  buildSupplyDemandFeatures,
} from './features.ts';
import { runResearchGraphAdapter } from './research-adapter.ts';
import type { Alt07LogisticsFlowSnapshot } from './types.ts';
import { HELIOS_ALT07_LOGISTICS_FLOW_SCHEMA } from './taxonomy.ts';
import type { ResearchGraphAdapterKind } from './taxonomy.ts';

export type CompileAlt07LogisticsFlowInput = {
  readonly plane: ExternalDataPlane;
  readonly decisionTimeUtc: UtcInstant;
  readonly researchAdapter?: ResearchGraphAdapterKind | null;
};

export function compileAlt07LogisticsFlowSnapshot(
  input: CompileAlt07LogisticsFlowInput,
): Alt07LogisticsFlowSnapshot {
  const bridge = ingestWave5LogisticsFlow(input.plane, input.decisionTimeUtc);
  const firmExposures = compileFirmLogisticsExposures({
    bridge,
    knowableAt: input.decisionTimeUtc,
  });
  const graph = buildDeterministicLogisticsGraph({
    bridge,
    firmExposures,
    knowableAt: input.decisionTimeUtc,
  });
  const commodityFlows = buildCommodityFlowEstimates(bridge);
  const disruptions = buildLogisticsDisruptionStates({ bridge });
  const supplyDemandFeatures = buildSupplyDemandFeatures({ bridge, commodityFlows, disruptions });

  for (const cargoRow of [
    ...bridge.vessels.map((v) => v.cargo),
    ...bridge.routes.map((r) => r.cargo),
    ...commodityFlows.map((c) => c.cargo),
  ]) {
    if (!cargoPresentationPolicySatisfied(cargoRow)) {
      throw new Error(`ALT07 cargo presentation policy violated for ${cargoRow.commodityCode ?? 'unknown'}`);
    }
  }

  const researchForecasts =
    input.researchAdapter !== null && input.researchAdapter !== undefined
      ? runResearchGraphAdapter({
          graph,
          disruptions,
          decisionTimeUtc: input.decisionTimeUtc,
          adapter: input.researchAdapter,
        })
      : Object.freeze([]);

  const snapshotId = `alt07_${createHash('sha256')
    .update(`${input.decisionTimeUtc}:${graph.nodes.length}:${graph.edges.length}`)
    .digest('hex')
    .slice(0, 20)}`;

  return Object.freeze({
    schema: HELIOS_ALT07_LOGISTICS_FLOW_SCHEMA,
    snapshotId,
    compiledAt: input.decisionTimeUtc,
    decisionTimeUtc: input.decisionTimeUtc,
    vessels: bridge.vessels,
    ports: bridge.ports,
    routes: bridge.routes,
    shipmentFlows: bridge.shipmentFlows,
    portCongestion: bridge.portCongestion,
    chokepoints: bridge.chokepoints,
    commodityFlows,
    disruptions,
    firmExposures,
    supplyDemandFeatures,
    graph,
    researchForecasts,
    grantsExecutionAuthority: false,
  });
}
