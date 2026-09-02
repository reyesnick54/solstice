/**
 * Wave 6 — repository-level human economic intelligence integration tests.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { EconomicKnowledgeGraphService } from '../packages/economic-asset-registry/src/knowledge-graph/service.ts';
import { HUMAN_EVENT_TEMPLATES } from '../packages/economic-asset-registry/src/knowledge-graph/ontology.ts';
import {
  WAVE6_DOMAIN_FIXTURES,
  buildHumanEconomicClaimBundle,
  projectHumanContributionToGraph,
  validateHumanContributionEventMaterial,
  refuseAttributeAsContribution,
  refuseProfileAsContribution,
  HUMAN_ATTRIBUTE_LOCATION,
  PROFILE_NOT_CONTRIBUTION,
} from '../packages/sunrey-chain/src/human/ontology/index.ts';
import { HUMAN_ONTOLOGY_INVARIANTS } from '../packages/sunrey-chain/src/human/ontology/constants.ts';
import { PRODUCTIVE_ONTOLOGY_INVARIANTS } from '../packages/sunrey-chain/src/productive/ontology/constants.ts';
import { evaluateOracleSafety } from '../packages/sunrey-chain/src/native-assets/issuance-pipelines.ts';

describe('Wave 6 human economic intelligence integration', () => {
  it('integrates ontology with knowledge graph without monetary authority', () => {
    const graph = new EconomicKnowledgeGraphService({ nowUtc: '2026-09-02T12:00:00.000Z' });
    const event = WAVE6_DOMAIN_FIXTURES[0]!;
    const projection = projectHumanContributionToGraph({
      event,
      claimId: 'cec_integration_work',
      createdAt: '2026-09-02T12:00:00.000Z',
    });
    graph.registerNode({
      nodeClass: projection.actorNode.nodeClass,
      domain: projection.actorNode.domain,
      label: projection.actorNode.label,
      externalRef: projection.actorNode.externalRef,
      payload: projection.actorNode.payload,
      createdAt: projection.actorNode.createdAt,
    });
    graph.registerNode({
      nodeClass: projection.contributionNode.nodeClass,
      domain: projection.contributionNode.domain,
      label: projection.contributionNode.label,
      externalRef: projection.contributionNode.externalRef,
      payload: projection.contributionNode.payload,
      createdAt: projection.contributionNode.createdAt,
    });
    const edge = graph.registerEdge({
      kind: projection.actorToContributionEdge.kind,
      fromNodeId: projection.actorToContributionEdge.fromNodeId,
      toNodeId: projection.actorToContributionEdge.toNodeId,
      domain: projection.actorToContributionEdge.domain,
      provenanceRef: projection.actorToContributionEdge.provenanceRef,
      createdAt: projection.actorToContributionEdge.createdAt,
    });
    assert.equal(edge.ok, true);
    assert.equal(HUMAN_ONTOLOGY_INVARIANTS.CLAIM_IS_NOT_SUNREY, true);
    assert.ok(HUMAN_EVENT_TEMPLATES.length >= 10);
  });

  it('validates all six domain fixtures end-to-end', () => {
    assert.equal(WAVE6_DOMAIN_FIXTURES.length, 6);
    for (const event of WAVE6_DOMAIN_FIXTURES) {
      assert.equal(validateHumanContributionEventMaterial(event).ok, true);
      const claim = buildHumanEconomicClaimBundle({
        economicClaimId: `cec_${event.eventType}`,
        canonicalEntityId: event.humanActorId,
        canonicalEventId: event.eventRef,
        event,
        supportingFactIds: ['vef_fixture'],
      });
      assert.equal(claim.ok, true);
      if (claim.ok) {
        assert.equal(claim.bundle.claim.authority.mintsNativeAsset, false);
        assert.equal(claim.bundle.claim.claimType, 'HUMAN_CONTRIBUTION');
      }
    }
  });

  it('proves human attribute and profile are not contributions', () => {
    assert.equal(refuseAttributeAsContribution(HUMAN_ATTRIBUTE_LOCATION).ok, false);
    assert.equal(refuseProfileAsContribution(PROFILE_NOT_CONTRIBUTION).ok, false);
  });

  it('does not change MoonRey issuance behavior', () => {
    assert.equal(PRODUCTIVE_ONTOLOGY_INVARIANTS.ORACLE_CANNOT_MINT, true);
    const oracleSafety = evaluateOracleSafety({
      observations: [{ sourceCount: 1, quality: 'VERIFIED', stale: false, disputed: false }],
    });
    assert.equal(oracleSafety.ok, false);
    assert.equal(HUMAN_ONTOLOGY_INVARIANTS.CLAIM_IS_NOT_SUNREY, true);
  });
});
