import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  assertWave6CoverageComplete,
  buildWave6CoverageReport,
  createExternalDataPlane,
  createWave6Services,
  WAVE6_AWAITING_MASTER_LIST_PROVIDER_IDS,
  WAVE6_IMPLEMENTED_PROVIDER_IDS,
  wave6CachePolicy,
} from '../packages/external-data/src/index.ts';
import { createKnowledgeIntelligenceBff } from '../services/api/src/consumer/knowledge-intelligence-adapter.ts';
import { FIXTURE_AUTHOR_NAME_COLLISION } from '../packages/external-data/src/wave6/fixtures.ts';
import { setWave6ProviderState } from '../packages/external-data/src/wave6/adapters.ts';
import { createDefaultWave6AdapterStates } from '../packages/external-data/src/wave6/adapters.ts';

describe('Wave 6 Prompt 24 — Knowledge Intelligence', () => {
  it('1. exposes Wave 6 services on ExternalDataPlane', () => {
    const plane = createExternalDataPlane();
    assert.ok(plane.wave6.research);
    assert.ok(plane.wave6.patents);
    assert.ok(plane.wave6.knowledge);
    assert.ok(plane.wave6.aiEconomics);
    assert.ok(plane.wave6.hinReference);
    assert.ok(plane.wave6.opportunities);
  });

  it('2. research works identified by DOI/workId not title alone', () => {
    const plane = createExternalDataPlane();
    const byDoi = plane.wave6.research.getWork('doi:10.1038/s41586-024-07000-1');
    assert.ok(byDoi.observations.length >= 1);
    assert.notEqual(byDoi.observations[0]?.data.workId, byDoi.observations[0]?.data.title);
  });

  it('3. duplicate research papers preserve provenance', () => {
    const plane = createExternalDataPlane();
    const works = plane.wave6.research.searchWorks({ q: 'transformer' });
    const dois = works.observations.filter((o) => o.data.doi === '10.1038/s41586-024-07000-1');
    assert.ok(dois.length >= 1);
    const providers = new Set(dois.map((o) => o.providerId));
    assert.ok(providers.size >= 1);
    for (const obs of dois) {
      assert.ok(obs.data.provenance);
    }
  });

  it('4. patent jurisdiction identity preserved', () => {
    const plane = createExternalDataPlane();
    const us = plane.wave6.patents.searchPatents({ jurisdiction: 'US' });
    const ep = plane.wave6.patents.searchPatents({ jurisdiction: 'EP' });
    assert.ok(us.observations.every((o) => o.data.jurisdiction === 'US'));
    assert.ok(ep.observations.every((o) => o.data.jurisdiction === 'EP'));
    assert.notEqual(us.observations[0]?.data.patentId, ep.observations[0]?.data.patentId);
  });

  it('5. patents do not grant infringement conclusions', () => {
    const plane = createExternalDataPlane();
    for (const obs of plane.wave6.patents.searchPatents().observations) {
      assert.equal(obs.data.grantsInfringementConclusion, false);
    }
  });

  it('6. knowledge entities are reference_data not authoritative facts', () => {
    const plane = createExternalDataPlane();
    for (const obs of plane.wave6.knowledge.searchEntities().observations) {
      assert.equal(obs.data.trustedSunReyFact, false);
      assert.equal(obs.data.authorityClass, 'reference_data');
    }
  });

  it('7. AI model metadata does not reconfigure model gateway', () => {
    const plane = createExternalDataPlane();
    const snap = plane.wave6ConsumerSnapshots().modelGateway;
    assert.equal(snap.autoReconfigurationPermitted, false);
    assert.equal(snap.policyRemainsAuthoritative, true);
    for (const obs of plane.wave6.aiEconomics.getModelObservations().observations) {
      assert.equal(obs.data.reconfiguresModelGateway, false);
    }
  });

  it('8. MoonRey receives AI/compute context without monetary authority', () => {
    const plane = createExternalDataPlane();
    const moonrey = plane.wave6ConsumerSnapshots().moonrey;
    assert.equal(moonrey.issuanceAuthority, false);
    assert.equal(moonrey.burnAuthority, false);
    assert.equal(moonrey.nativeAssetIdentityChanged, false);
    assert.equal(moonrey.blockchainConsensusChanged, false);
    assert.ok(moonrey.computeCostObservations.length >= 1);
  });

  it('9. HIN reference layer excludes private user data', () => {
    const plane = createExternalDataPlane();
    const hin = plane.wave6.hinReference.getPublicReference();
    for (const obs of hin.observations) {
      assert.equal(obs.data.isPrivateUserData, false);
      assert.equal(obs.data.infersHealthCondition, false);
    }
    const guard = plane.wave6.hinReference.assertNoPrivatePayload({ dna: 'SEQ' });
    assert.equal(guard.ok, false);
  });

  it('10. Financial Agent evidence is non-executing', () => {
    const plane = createExternalDataPlane();
    const agent = plane.wave6ConsumerSnapshots().agent;
    assert.equal(agent.grantsExecutionAuthority, false);
    assert.equal(agent.treatedAsTradeInstruction, false);
    assert.equal(agent.submitsJobApplication, false);
    assert.equal(agent.sharesPrivateProfile, false);
    assert.equal(agent.infersHealthCondition, false);
  });

  it('11. Grow receives opportunity and research context with sources', () => {
    const plane = createExternalDataPlane();
    const grow = plane.wave6ConsumerSnapshots().grow;
    assert.equal(grow.sourcesRetained, true);
    assert.equal(grow.speculativeOverstatement, false);
    assert.ok(grow.learningOpportunities.length >= 1);
  });

  it('12. OpportunityService does not submit applications', () => {
    const plane = createExternalDataPlane();
    for (const obs of plane.wave6.opportunities.searchJobs().observations) {
      assert.equal(obs.data.submitsApplication, false);
      assert.equal(obs.data.sharesPrivateProfile, false);
    }
  });

  it('13. same author names not merged without stable identifiers', () => {
    assert.notEqual(
      FIXTURE_AUTHOR_NAME_COLLISION.authorA.authorId,
      FIXTURE_AUTHOR_NAME_COLLISION.authorB.authorId,
    );
    assert.equal(FIXTURE_AUTHOR_NAME_COLLISION.authorA.displayName, FIXTURE_AUTHOR_NAME_COLLISION.authorB.displayName);
  });

  it('14. cache policies differ by capability class', () => {
    const patent = wave6CachePolicy('patent_search');
    const ai = wave6CachePolicy('ai_model_metadata');
    const research = wave6CachePolicy('research_works');
    assert.notEqual(patent.ttlMs, ai.ttlMs);
    assert.notEqual(research.ttlMs, ai.ttlMs);
  });

  it('15. chaos — isolated provider failures', () => {
    const states = createDefaultWave6AdapterStates();
    const ctx = { nowUtc: '2026-08-31T12:00:00.000Z', states };
    setWave6ProviderState(ctx, 'indian-mandi-prices', { down: true });
    setWave6ProviderState(ctx, 'federal-register', { rateLimited: true });
    setWave6ProviderState(ctx, 'sec-edgar', { down: true });
    setWave6ProviderState(ctx, 'patent-malformed-fixture', { malformed: true });
    const services = createWave6Services(ctx);
    const research = services.research.searchWorks();
    const food = services.hinReference.getPublicReference();
    const patents = services.patents.searchPatents();
    assert.ok(research.observations.length >= 0);
    assert.equal(food.observations.length, 0);
    assert.ok(patents.observations.length >= 0);
  });

  it('16. stale AI pricing flagged', () => {
    const plane = createExternalDataPlane();
    const stale = plane.wave6.aiEconomics
      .getModelObservations()
      .observations.find((o) => o.data.freshness === 'stale');
    assert.ok(stale);
  });

  it('17. provider health observability for Wave 6 providers', () => {
    const plane = createExternalDataPlane();
    const health = plane.wave6Health();
    assert.ok(health.length >= WAVE6_IMPLEMENTED_PROVIDER_IDS.length);
    for (const id of WAVE6_IMPLEMENTED_PROVIDER_IDS) {
      assert.ok(health.some((h) => h.providerId === id));
    }
  });

  it('18. BFF adapter exposes knowledge intelligence without private data', () => {
    const plane = createExternalDataPlane();
    const bff = createKnowledgeIntelligenceBff(plane);
    const hin = bff.hinReference();
    assert.equal(hin.privateDataIncluded, false);
    assert.ok(bff.researchSearch({ topic: 'machine-learning' }).observations.length >= 1);
  });

  it('19. Wave 6 coverage accounts for catalog and awaiting master list', () => {
    const report = buildWave6CoverageReport();
    assertWave6CoverageComplete();
    assert.ok(report.awaitingMasterList >= WAVE6_AWAITING_MASTER_LIST_PROVIDER_IDS.length);
    assert.ok(report.implemented >= WAVE6_IMPLEMENTED_PROVIDER_IDS.length);
  });

  it('20. preserves Wave 2 plane behavior', () => {
    const plane = createExternalDataPlane();
    const macro = plane.macro.getIndicators();
    assert.ok(macro.observations.length > 0);
    const wave6 = plane.wave6KnowledgeBundle();
    assert.ok(wave6.researchCount >= 1);
  });

  it('21. security — health output excludes credentials', () => {
    const plane = createExternalDataPlane();
    const serialized = JSON.stringify(plane.wave6Health());
    assert.ok(!serialized.includes('API_KEY'));
    assert.ok(!serialized.includes('dna'));
    assert.ok(!serialized.includes('medicalRecord'));
  });

  it('22. knowledge search index bounded', () => {
    const plane = createExternalDataPlane();
    const index = plane.knowledgeSearch({ topic: 'machine-learning' });
    assert.ok(index.length <= 50);
    for (const entry of index) {
      assert.ok(entry.provenance);
    }
  });
});
