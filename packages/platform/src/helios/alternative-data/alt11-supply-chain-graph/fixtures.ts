/**
 * Reference fixture — port congestion propagating to focal company production risk.
 */

import { asUtcInstant } from '@solstice/domain';
import { createTemporalEntityGraphStore, type TemporalEntityGraphStore } from '../../feature-fabric/entity-resolution/graph-store.ts';
import { createHeliosSupplyChainGraphFabric, type HeliosSupplyChainGraphFabric } from './fabric.ts';

const T = (iso: string) => asUtcInstant(iso);

export type Alt11FixtureHandles = {
  readonly entityGraph: TemporalEntityGraphStore;
  readonly fabric: HeliosSupplyChainGraphFabric;
  readonly portNodeId: string;
  readonly supplierNodeId: string;
  readonly componentNodeId: string;
  readonly companyNodeId: string;
  readonly asOf: ReturnType<typeof T>;
  readonly knowableCutoff: ReturnType<typeof T>;
};

const edgeTemporal = {
  source: 'fixture:alt11:supply_chain_registry',
  confidenceState: 'CONFIRMED' as const,
  ambiguityState: 'UNAMBIGUOUS' as const,
  confidenceScoreMilli: 900,
  effectiveFrom: T('2020-01-01T00:00:00.000Z'),
  effectiveTo: null,
  observedAt: T('2020-01-02T00:00:00.000Z'),
  knowableAt: T('2020-01-03T00:00:00.000Z'),
  jurisdiction: 'US',
};

export function seedAlt11ReferenceSupplyChainGraph(): Alt11FixtureHandles {
  const entityGraph = createTemporalEntityGraphStore();
  const fabric = createHeliosSupplyChainGraphFabric({ entityGraph });

  const port = fabric.registerNode({
    kind: 'PORT',
    displayName: 'Port X',
    jurisdiction: 'US',
    payload: Object.freeze({ unlocode: 'PORTX', congestionIndexMilli: 820 }),
  });
  const supplier = fabric.registerNode({
    kind: 'SUPPLIER',
    displayName: 'Supplier Y',
    jurisdiction: 'TW',
    payload: Object.freeze({ tier: '1' }),
  });
  const component = fabric.registerNode({
    kind: 'PRODUCT',
    displayName: 'Component Z',
    jurisdiction: null,
    payload: Object.freeze({ sku: 'CMP-Z' }),
  });
  const company = fabric.registerNode({
    kind: 'COMPANY',
    displayName: 'Company A',
    jurisdiction: 'US',
    payload: Object.freeze({ ticker: 'CMPA' }),
  });

  fabric.appendEdge({
    ...edgeTemporal,
    edgeType: 'SHIPS_THROUGH',
    fromNodeId: port.nodeId,
    toNodeId: supplier.nodeId,
    evidenceRefs: Object.freeze(['evidence:alt11:port_throughput:port_x']),
    edgeWeightMilli: 800,
  });
  fabric.appendEdge({
    ...edgeTemporal,
    edgeType: 'SUPPLIES',
    fromNodeId: supplier.nodeId,
    toNodeId: component.nodeId,
    evidenceRefs: Object.freeze(['evidence:alt11:supplier_bill_of_materials:y_z']),
    edgeWeightMilli: 900,
  });
  fabric.appendEdge({
    ...edgeTemporal,
    edgeType: 'SUPPLIES',
    fromNodeId: component.nodeId,
    toNodeId: company.nodeId,
    evidenceRefs: Object.freeze(['evidence:alt11:10k:component_z_exposure']),
    edgeWeightMilli: 850,
  });

  const asOf = T('2025-06-01T12:00:00.000Z');
  const knowableCutoff = asOf;

  return Object.freeze({
    entityGraph,
    fabric,
    portNodeId: port.nodeId,
    supplierNodeId: supplier.nodeId,
    componentNodeId: component.nodeId,
    companyNodeId: company.nodeId,
    asOf,
    knowableCutoff,
  });
}
