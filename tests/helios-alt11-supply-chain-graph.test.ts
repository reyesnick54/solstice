/**
 * HELIOS ALT11 — dynamic supply-chain knowledge graph and risk propagation.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  HELIOS_ALT11,
  HELIOS_ALT11_SUPPLY_CHAIN_GRAPH_QUALIFIED,
  HELIOS_SUPPLY_CHAIN_GRAPH_AUTHORITY,
  HELIOS_SUPPLY_CHAIN_GRAPH_SCHEMA,
  SUPPLY_CHAIN_EDGE_TYPES,
  SUPPLY_CHAIN_NODE_KINDS,
  assertSupplyChainEdgeEvidence,
  createHeliosSupplyChainGraphFabric,
  evaluateResearchModelPromotion,
  formatExplainablePathSummary,
  runAlt11QualificationHarness,
  seedAlt11ReferenceSupplyChainGraph,
} from '../packages/platform/src/helios/alternative-data/index.ts';
import { createTemporalEntityGraphStore } from '../packages/platform/src/helios/feature-fabric/entity-resolution/graph-store.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

describe('HELIOS ALT11 supply-chain knowledge graph', () => {
  it('exports schema, chunk marker, and reference-only authority', () => {
    assert.equal(HELIOS_ALT11, 'HELIOS_ALT11');
    assert.equal(HELIOS_SUPPLY_CHAIN_GRAPH_SCHEMA, 'sunrey.helios.supply-chain-graph.v1');
    assert.equal(HELIOS_SUPPLY_CHAIN_GRAPH_AUTHORITY, 'REFERENCE_ONLY');
    assert.equal(SUPPLY_CHAIN_NODE_KINDS.length, 13);
    assert.equal(SUPPLY_CHAIN_EDGE_TYPES.length, 11);
  });

  it('rejects edges without evidence', () => {
    const check = assertSupplyChainEdgeEvidence({
      edgeType: 'SUPPLIES',
      fromNodeId: 'a',
      toNodeId: 'b',
      evidenceRefs: Object.freeze([]),
      source: 'test',
      confidenceState: 'CONFIRMED',
      ambiguityState: 'UNAMBIGUOUS',
      confidenceScoreMilli: 500,
      effectiveFrom: asUtcInstant('2020-01-01T00:00:00.000Z'),
      effectiveTo: null,
      observedAt: asUtcInstant('2020-01-01T00:00:00.000Z'),
      knowableAt: asUtcInstant('2020-01-01T00:00:00.000Z'),
      jurisdiction: 'US',
    });
    assert.equal(check.ok, false);
  });

  it('propagates port congestion to focal company with explainable multi-hop path', () => {
    const fixture = seedAlt11ReferenceSupplyChainGraph();
    const paths = fixture.fabric.propagateRisk({
      originNodeId: fixture.portNodeId,
      focalNodeId: fixture.companyNodeId,
      disruptionKind: 'port_congestion',
      asOf: fixture.asOf,
      knowableCutoff: fixture.knowableCutoff,
    });
    assert.ok(paths.length >= 1);
    const summary = formatExplainablePathSummary(paths[0]!);
    assert.match(summary, /Port X/);
    assert.match(summary, /Supplier Y/);
    assert.match(summary, /Component Z/);
    assert.match(summary, /Company A/);
    assert.equal(paths[0]!.grantsExecutionAuthority, false);
  });

  it('does not promote ML graph output without beating baselines', () => {
    const evaluation = evaluateResearchModelPromotion({
      modelKind: 'DIRECTION_SENSITIVE_GNN',
      baselineMethod: 'WEIGHTED_PATH_PROPAGATION',
      baselineScoreMilli: 400,
      modelScoreMilli: 399,
    });
    assert.equal(evaluation.promoted, false);
  });

  it('anchors company nodes on temporal entity graph', () => {
    const graph = createTemporalEntityGraphStore();
    const fabric = createHeliosSupplyChainGraphFabric({ entityGraph: graph });
    const company = fabric.registerNode({
      kind: 'COMPANY',
      displayName: 'Anchor Co',
      jurisdiction: 'US',
      payload: Object.freeze({ ticker: 'ANCH' }),
    });
    assert.ok(company.temporalAnchorNodeId);
    assert.ok(graph.getNode(company.temporalAnchorNodeId!));
  });

  it('qualifies HELIOS_ALT11_SUPPLY_CHAIN_GRAPH_QUALIFIED harness', () => {
    const result = runAlt11QualificationHarness();
    assert.equal(result.marker, HELIOS_ALT11_SUPPLY_CHAIN_GRAPH_QUALIFIED);
    assert.equal(result.qualified, true);
    assert.deepEqual(result.blockers, []);
  });

  it('passes HELIOS boundary lint', () => {
    assert.deepEqual(lintHeliosBoundary(process.cwd()), []);
  });
});
