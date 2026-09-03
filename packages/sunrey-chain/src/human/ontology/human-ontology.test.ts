/**
 * Wave 6 — SunRey Human Economy ontology tests.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  HUMAN_ONTOLOGY_INVARIANTS,
  HUMAN_GOVERNANCE_CATEGORY_ONTOLOGY,
  governanceCategoryRecord,
  listGovernanceCategories,
  listEventTypes,
  createHumanEconomicActor,
  validateHumanContributionEventMaterial,
  refuseAttributeAsContribution,
  refuseProfileAsContribution,
  refuseConsentAsContribution,
  refuseEvidenceAsContribution,
  refuseClaimAsSunRey,
  refuseMarketPriceAsContributionValue,
  refuseCredentialExistenceAsEarned,
  refuseEmploymentRelationshipAsWork,
  refusePaperExistenceAsContribution,
  refuseAttentionAsContribution,
  refuseAppUsageAsContribution,
  refuseLocationAsContribution,
  buildHumanEconomicClaimBundle,
  humanClaimLacksSupplyAuthority,
  projectHumanContributionToGraph,
  WAVE6_DOMAIN_FIXTURES,
  PROFILE_NOT_CONTRIBUTION,
  HUMAN_ATTRIBUTE_LOCATION,
  CREDENTIAL_EXISTS_NOT_EARNED,
  EMPLOYMENT_WITHOUT_WORK,
  PAPER_WITHOUT_CONTRIBUTION,
  EMPLOYMENT_WORK_EVENT,
} from './index.ts';

describe('Wave 6 human ontology invariants', () => {
  it('preserves non-monetary authority boundaries', () => {
    assert.equal(HUMAN_ONTOLOGY_INVARIANTS.RAW_HUMAN_DATA_CANNOT_MINT, true);
    assert.equal(HUMAN_ONTOLOGY_INVARIANTS.CLAIM_IS_NOT_SUNREY, true);
    assert.equal(HUMAN_ONTOLOGY_INVARIANTS.VALUATION_DOES_NOT_EQUAL_HUMAN_WORTH, true);
    assert.equal(HUMAN_ONTOLOGY_INVARIANTS.AI_CANNOT_APPROVE_ISSUANCE, true);
  });
});

describe('Wave 6 human governance categories', () => {
  it('defines twelve governance categories mapped to Chunk 104 classes', () => {
    assert.equal(Object.keys(HUMAN_GOVERNANCE_CATEGORY_ONTOLOGY).length, 12);
    const work = governanceCategoryRecord('WORK_CONTRIBUTION');
    assert.ok(work.contributionClasses.includes('PROFESSIONAL_EXPERTISE'));
    assert.equal(work.monetizableByDefault, false);
    assert.equal(work.humanWorthMeasure, false);
  });

  it('lists event types per governance category', () => {
    const researchEvents = listEventTypes('RESEARCH_CONTRIBUTION');
    assert.ok(researchEvents.some((row) => row.eventType === 'ResearchContributionVerified'));
    assert.equal(listGovernanceCategories().length, 12);
  });
});

describe('Wave 6 human actor model', () => {
  it('creates pseudonymous actors without raw legal identity', () => {
    const actor = createHumanEconomicActor({
      humanActorId: 'hea_test',
      pseudonymousId: 'hin:subject:test',
      identityAssuranceLevel: 'INSTITUTIONALLY_ATTESTED',
      jurisdiction: 'GB',
      credentialRefs: ['cred:ref:digest'],
      rightsControllerRefs: ['rights:controller:hin'],
      createdAtUtc: '2026-09-02T12:00:00.000Z',
    });
    assert.equal(actor.ok, true);
    if (actor.ok) {
      assert.equal(actor.value.containsRawLegalIdentity, false);
      assert.equal(actor.value.humanWorthScore, false);
    }
  });

  it('rejects forbidden identity metadata', () => {
    const actor = createHumanEconomicActor({
      humanActorId: 'hea_bad',
      pseudonymousId: 'hin:subject:bad',
      identityAssuranceLevel: 'PSEUDONYMOUS_ONLY',
      jurisdiction: 'GB',
      createdAtUtc: '2026-09-02T12:00:00.000Z',
      metadata: { legalName: 'Jane Doe' },
    });
    assert.equal(actor.ok, false);
  });
});

describe('Wave 6 attribute and profile separation', () => {
  it('rejects human attributes as contributions', () => {
    const attribute = refuseAttributeAsContribution(HUMAN_ATTRIBUTE_LOCATION);
    assert.equal(attribute.ok, false);
    if (!attribute.ok) {
      assert.equal(attribute.code, 'ATTRIBUTE_IS_NOT_CONTRIBUTION');
    }
    const location = refuseLocationAsContribution();
    assert.equal(location.ok, false);
    const attention = refuseAttentionAsContribution();
    assert.equal(attention.ok, false);
    const appUsage = refuseAppUsageAsContribution();
    assert.equal(appUsage.ok, false);
  });

  it('rejects profile data as contribution', () => {
    const profile = refuseProfileAsContribution(PROFILE_NOT_CONTRIBUTION);
    assert.equal(profile.ok, false);
    if (!profile.ok) {
      assert.equal(profile.code, 'PROFILE_IS_NOT_CONTRIBUTION');
    }
  });

  it('rejects consent and evidence alone', () => {
    assert.equal(refuseConsentAsContribution().ok, false);
    assert.equal(refuseEvidenceAsContribution().ok, false);
  });
});

describe('Wave 6 achievement vs activity', () => {
  it('rejects credential existence without earned proof', () => {
    const result = refuseCredentialExistenceAsEarned(CREDENTIAL_EXISTS_NOT_EARNED);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, 'CREDENTIAL_EXISTENCE_IS_NOT_EARNED');
    }
  });

  it('rejects employment relationship without work performed proof', () => {
    const result = refuseEmploymentRelationshipAsWork(EMPLOYMENT_WITHOUT_WORK);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, 'EMPLOYMENT_RELATIONSHIP_IS_NOT_WORK');
    }
  });

  it('rejects paper existence without contribution proof', () => {
    const result = refusePaperExistenceAsContribution(PAPER_WITHOUT_CONTRIBUTION);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, 'PAPER_EXISTENCE_IS_NOT_CONTRIBUTION');
    }
  });
});

describe('Wave 6 contribution claim boundaries', () => {
  it('validates all six domain fixtures', () => {
    assert.equal(WAVE6_DOMAIN_FIXTURES.length, 6);
    for (const event of WAVE6_DOMAIN_FIXTURES) {
      const validated = validateHumanContributionEventMaterial(event);
      assert.equal(validated.ok, true, `expected ${event.eventType} to validate`);
    }
  });

  it('builds human economic claims without supply authority', () => {
    for (const event of WAVE6_DOMAIN_FIXTURES) {
      const bundle = buildHumanEconomicClaimBundle({
        economicClaimId: `hec_${event.eventType}`,
        canonicalEntityId: event.humanActorId,
        canonicalEventId: event.eventRef,
        event,
        supportingFactIds: ['vef_wave6_fixture'],
        informationConsensusReceiptRef: 'ic:human:wave6',
      });
      assert.equal(bundle.ok, true, `expected claim bundle for ${event.eventType}`);
      if (bundle.ok) {
        assert.equal(bundle.bundle.claim.economicDomain, 'HUMAN_ECONOMIC');
        assert.equal(bundle.bundle.claim.authority.mintsNativeAsset, false);
        assert.equal(humanClaimLacksSupplyAuthority(bundle.bundle), true);
      }
    }
  });

  it('separates contribution, valuation, and SunRey issuance concepts', () => {
    assert.equal(refuseClaimAsSunRey().ok, false);
    assert.equal(refuseMarketPriceAsContributionValue().ok, false);
    const bundle = buildHumanEconomicClaimBundle({
      economicClaimId: 'hec_boundary',
      canonicalEntityId: EMPLOYMENT_WORK_EVENT.humanActorId,
      canonicalEventId: EMPLOYMENT_WORK_EVENT.eventRef,
      event: EMPLOYMENT_WORK_EVENT,
      supportingFactIds: ['vef_boundary'],
    });
    assert.equal(bundle.ok, true);
    if (bundle.ok) {
      assert.equal(bundle.bundle.extension.invariants.PEVE_DOES_NOT_AUTOMATICALLY_EQUAL_SUNREY_QUANTITY, true);
      assert.equal(bundle.bundle.extension.invariants.CONSENT_DOES_NOT_EQUAL_VALUATION, true);
    }
  });
});

describe('Wave 6 human contribution graph', () => {
  it('projects human economy relationships into knowledge graph shape', () => {
    const projection = projectHumanContributionToGraph({
      event: EMPLOYMENT_WORK_EVENT,
      claimId: 'cec_wave6_work',
      createdAt: '2026-09-02T12:00:00.000Z' as import('../../../../domain/src/time.ts').UtcInstant,
    });
    assert.equal(projection.actorNode.nodeClass, 'PSEUDONYMOUS_PERSON');
    assert.equal(projection.actorNode.domain, 'HUMAN_ECONOMY');
    assert.equal(projection.actorToContributionEdge.kind, 'PERFORMED');
    assert.ok(projection.evidenceEdges.length > 0);
    assert.ok(projection.attestationEdges.length > 0);
    assert.ok(projection.claimEdge);
    assert.equal(projection.claimEdge?.kind, 'RESOLVES_TO');
  });
});
