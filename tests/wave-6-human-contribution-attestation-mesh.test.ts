/**
 * Wave 6 — Human Contribution Attestation Mesh integration tests.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  HumanContributionAttestationMesh,
  attestationMeshCreatesMoney,
  buildAttestationMeshIcPromotion,
  buildHumanEconomicClaimPromotion,
  fixtureMeshInput,
  fixtureResearchPublisherAttestation,
  fixtureResearchRegistryAttestation,
} from '../packages/human-economic-contribution/src/attestation-mesh/index.ts';
import {
  createInformationVerifiedEconomicFact,
  informationConsensusCreatesMoney,
  HUMAN_CONTRIBUTION_CANDIDATE,
  HUMAN_CONTRIBUTION_METHODOLOGY,
} from '@solstice/sunrey-chain/economic-awareness-fabric';
import { buildHumanEconomicClaim } from '@solstice/sunrey-chain/economic-proof';

describe('Wave 6 — Attestation Mesh ↔ Information Consensus integration', () => {
  it('verified attestation mesh receipt can produce VerifiedEconomicFact without mint authority', () => {
    const mesh = new HumanContributionAttestationMesh();
    const evaluation = mesh.verify(
      fixtureMeshInput('RESEARCH_PARTICIPATION', [
        fixtureResearchPublisherAttestation(),
        fixtureResearchRegistryAttestation(),
      ]),
    );
    assert.equal(evaluation.receipt.result, 'VERIFIED');

    const promotion = buildAttestationMeshIcPromotion(evaluation.receipt);
    assert.equal(promotion.eligibleForVerifiedFact, true);
    assert.equal(promotion.grantsMonetaryAuthority, false);
    assert.equal(attestationMeshCreatesMoney(), false);
    assert.equal(informationConsensusCreatesMoney(), false);
    assert.ok(promotion.independentLineageRootIds.length >= 1);

    const fact = createInformationVerifiedEconomicFact({
      candidate: HUMAN_CONTRIBUTION_CANDIDATE,
      observations: [],
      independentLineageRootIds: promotion.independentLineageRootIds,
      methodology: HUMAN_CONTRIBUTION_METHODOLOGY.methodology,
      receiptId: evaluation.receipt.receiptId,
      verifiedAt: evaluation.receipt.freshness.evaluatedAt,
      validUntil: evaluation.receipt.freshness.evaluatedAt,
      selectedNumericValue: null,
      selectedCategoricalValue: evaluation.receipt.contributionClass,
    });

    assert.equal(fact.grantsMonetaryAuthority, false);
    assert.equal(fact.grantsExecutionAuthority, false);
    assert.ok(fact.independentLineageRootIds.length >= 1);

    const claimPromotion = buildHumanEconomicClaimPromotion(evaluation.receipt, fact.factId);
    assert.ok(claimPromotion);

    const claim = buildHumanEconomicClaim({
      economicClaimId: claimPromotion!.economicClaimId,
      canonicalEntityId: claimPromotion!.canonicalEntityId,
      canonicalEventId: claimPromotion!.canonicalEventId,
      subjectRef: claimPromotion!.subjectRef,
      supportingFactIds: claimPromotion!.supportingFactIds,
      evidenceRefs: claimPromotion!.evidenceRefs,
      temporalBounds: claimPromotion!.temporalBounds,
    });

    assert.equal(claim.claimType, 'HUMAN_CONTRIBUTION');
    assert.equal(claim.authority.mintsNativeAsset, false);
    assert.equal(claim.authority.issuesExecutionAuthority, false);
    assert.equal(claimPromotion!.createsPeve, false);
    assert.equal(claimPromotion!.authorizesSunReyIssuance, false);
  });
});
