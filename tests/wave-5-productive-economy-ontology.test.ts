/**
 * Wave 5 — repository-level productive economy ontology integration tests.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { EconomicKnowledgeGraphService } from '../packages/economic-asset-registry/src/knowledge-graph/service.ts';
import {
  WAVE5_DOMAIN_FIXTURES,
  buildProductiveEconomicClaimBundle,
  projectProductiveEventToGraph,
  validateProductiveEventMaterial,
} from '../packages/sunrey-chain/src/productive/ontology/index.ts';
import { PRODUCTIVE_ONTOLOGY_INVARIANTS } from '../packages/sunrey-chain/src/productive/ontology/constants.ts';

describe('Wave 5 productive economy integration', () => {
  it('integrates ontology with knowledge graph without monetary authority', () => {
    const graph = new EconomicKnowledgeGraphService({ nowUtc: '2026-09-02T12:00:00.000Z' });
    const event = WAVE5_DOMAIN_FIXTURES[0]!;
    const projection = projectProductiveEventToGraph({
      event,
      entityLabel: 'North Ridge Solar',
      eventLabel: 'Solar generation',
      sourceRefs: ['provider:fixture-a'],
      claimId: 'cec_integration_solar',
      createdAt: '2026-09-02T12:00:00.000Z',
    });
    graph.registerNode({
      nodeClass: projection.entityNode.nodeClass,
      domain: projection.entityNode.domain,
      label: projection.entityNode.label,
      externalRef: projection.entityNode.externalRef,
      payload: projection.entityNode.payload,
      createdAt: projection.entityNode.createdAt,
    });
    graph.registerNode({
      nodeClass: projection.eventNode.nodeClass,
      domain: projection.eventNode.domain,
      label: projection.eventNode.label,
      externalRef: projection.eventNode.externalRef,
      payload: projection.eventNode.payload,
      createdAt: projection.eventNode.createdAt,
    });
    const edge = graph.registerEdge({
      kind: projection.assetToEventEdge.kind,
      fromNodeId: projection.assetToEventEdge.fromNodeId,
      toNodeId: projection.assetToEventEdge.toNodeId,
      domain: projection.assetToEventEdge.domain,
      provenanceRef: projection.assetToEventEdge.provenanceRef,
      createdAt: projection.assetToEventEdge.createdAt,
    });
    assert.equal(edge.ok, true);
    assert.equal(PRODUCTIVE_ONTOLOGY_INVARIANTS.OBSERVATION_CANNOT_MINT, true);
  });

  it('validates all eight domain fixtures end-to-end', () => {
    assert.equal(WAVE5_DOMAIN_FIXTURES.length, 8);
    for (const event of WAVE5_DOMAIN_FIXTURES) {
      assert.equal(validateProductiveEventMaterial(event).ok, true);
      const claim = buildProductiveEconomicClaimBundle({
        economicClaimId: `cec_${event.eventType}`,
        canonicalEntityId: event.entityRef,
        canonicalEventId: `event:${event.eventType}:fixture`,
        event,
        supportingFactIds: ['vef_fixture'],
        evidenceRefs: ['evd_fixture'],
      });
      assert.equal(claim.ok, true);
      if (claim.ok) {
        assert.equal(claim.bundle.claim.authority.mintsNativeAsset, false);
      }
    }
  });
});
