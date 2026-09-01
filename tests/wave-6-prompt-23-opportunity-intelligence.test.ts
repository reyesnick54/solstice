import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildCatalogIndex } from '../packages/provider-sdk/src/catalog/loader.ts';
import { createFixtureCatalog } from '../packages/provider-sdk/src/test-fixtures/catalog.ts';
import {
  OPPORTUNITY_CATALOG_ENTRIES,
  OPPORTUNITY_CATALOG_PROVIDER_IDS,
  createOpportunityService,
  createAllOpportunityAdapters,
  defaultOpportunityNow,
  normalizeEmploymentType,
  normalizeRemoteStatus,
  normalizeSalaryPeriod,
  normalizeSkillLabel,
  assessJobFreshness,
  detectDuplicateJobs,
  validateApplicationUrl,
  explainJobRelevance,
  matchJobsToUser,
  assertNoSensitiveDataInQuery,
  buildWorldOpportunitySnapshot,
  buildGrowOpportunityContext,
  buildAgentOpportunityEvidence,
  buildPegOpportunityContext,
  opportunityCachePolicy,
  OPPORTUNITY_CACHE_CAPABILITIES,
  WAVE6_ACTION_CENTER_EVENT_TYPES,
  newRelevantJobEvent,
  buildOpportunityCoverageReport,
} from '../packages/external-data/src/wave6/index.ts';
import { setAdapterScenario } from '../packages/external-data/src/wave6/adapters/base.ts';
import { createOpportunityAdapter } from '../packages/external-data/src/wave6/adapters/index.ts';
import { createOpportunityIntelligenceBff } from '../services/api/src/consumer/opportunity-adapter.ts';

const NOW = defaultOpportunityNow();

describe('Wave 6 Prompt 23 — opportunity intelligence', () => {
  it('1. all selected provider adapters register from catalog', () => {
    const index = buildCatalogIndex(createFixtureCatalog([...OPPORTUNITY_CATALOG_ENTRIES] as never[]));
    assert.equal(OPPORTUNITY_CATALOG_PROVIDER_IDS.length, 11);
    const adapters = createAllOpportunityAdapters();
    assert.equal(adapters.length, 11);
    assert.ok(index.byId.size >= 11);
  });

  it('2. every job provider adapter returns normalized jobs', async () => {
    const jobProviders = ['arbeitnow', 'ai-dev-jobs', 'artificial-intelligence-jobs', 'freehire', 'graphql-jobs'] as const;
    for (const id of jobProviders) {
      const adapter = createOpportunityAdapter(id);
      const result = await adapter.searchJobs({}, NOW);
      assert.equal(result.ok, true, `${id} should return jobs`);
      if (!result.ok) continue;
      assert.ok(result.value.length > 0, `${id} should have at least one job`);
      assert.ok(result.value.every((j) => j.opportunityId.startsWith(`${id}:`)));
    }
  });

  it('3. employment type normalization', () => {
    assert.equal(normalizeEmploymentType('full-time').normalized, 'FULL_TIME');
    assert.equal(normalizeEmploymentType('contract').normalized, 'CONTRACT');
    assert.equal(normalizeEmploymentType('freelance').normalized, 'FREELANCE');
    assert.equal(normalizeEmploymentType('internship').normalized, 'INTERNSHIP');
    assert.equal(normalizeEmploymentType('weird-type').normalized, 'OTHER');
    assert.equal(normalizeEmploymentType(null).normalized, 'UNKNOWN');
    assert.equal(normalizeEmploymentType('full-time').providerNative, 'full-time');
  });

  it('4. remote status normalization', () => {
    assert.equal(normalizeRemoteStatus('remote'), 'REMOTE');
    assert.equal(normalizeRemoteStatus('hybrid'), 'HYBRID');
    assert.equal(normalizeRemoteStatus('onsite'), 'ONSITE');
    assert.equal(normalizeRemoteStatus(null), 'UNKNOWN');
    assert.equal(normalizeRemoteStatus(null, true), 'REMOTE');
    assert.equal(normalizeRemoteStatus(null, false), 'ONSITE');
  });

  it('5. salary range normalization', async () => {
    const service = createOpportunityService();
    const result = await service.searchJobs({}, NOW);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const withSalary = result.value.find((j) => j.salary != null);
    assert.ok(withSalary, 'at least one job should have salary');
    assert.ok(withSalary!.salary!.currency);
    assert.ok(withSalary!.salary!.period);
    assert.ok(withSalary!.salary!.sourceAmountMin || withSalary!.salary!.sourceAmountMax);
  });

  it('6. salary period normalization', () => {
    assert.equal(normalizeSalaryPeriod('hourly'), 'HOURLY');
    assert.equal(normalizeSalaryPeriod('annual'), 'ANNUAL');
    assert.equal(normalizeSalaryPeriod('monthly'), 'MONTHLY');
    assert.equal(normalizeSalaryPeriod('project'), 'PROJECT');
  });

  it('7. FX-converted reference salary field exists but null in simulation', async () => {
    const service = createOpportunityService();
    const result = await service.searchJobs({}, NOW);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const withSalary = result.value.find((j) => j.salary != null);
    assert.ok(withSalary);
    assert.equal(withSalary!.salary!.fxConvertedReference, null);
  });

  it('8. skill normalization', () => {
    assert.equal(normalizeSkillLabel('JS').canonical, 'JavaScript');
    assert.equal(normalizeSkillLabel('JavaScript').canonical, 'JavaScript');
    assert.equal(normalizeSkillLabel('Go').canonical, 'Go');
    assert.equal(normalizeSkillLabel('AI').canonical, 'Artificial Intelligence');
    assert.equal(normalizeSkillLabel('ambiguous term xyz').canonical, null);
  });

  it('9. occupation normalization', async () => {
    const service = createOpportunityService();
    const result = await service.searchOccupations('', NOW);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.ok(result.value.length >= 2);
    assert.ok(result.value.every((o) => o.occupationId.startsWith('techrole-index:')));
    assert.ok(result.value[0]!.skills.length > 0);
  });

  it('10. duplicate job detection', async () => {
    const service = createOpportunityService();
    const result = await service.searchJobs({}, NOW);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const dup = detectDuplicateJobs([
      result.value[0]!,
      { ...result.value[0]!, providerId: 'other', opportunityId: 'other:1' },
    ]);
    assert.equal(dup.length, 1);
    assert.equal(dup[0]!.mergedSourceIds.length, 2);
  });

  it('11. stale/expired job handling', () => {
    const expired = assessJobFreshness({
      postedAt: '2026-01-01T00:00:00.000Z' as never,
      expiresAt: '2026-08-01T00:00:00.000Z' as never,
      retrievedAt: NOW,
      nowUtc: NOW,
    });
    assert.equal(expired, 'EXPIRED');

    const active = assessJobFreshness({
      postedAt: '2026-08-30T00:00:00.000Z' as never,
      expiresAt: null,
      retrievedAt: NOW,
      nowUtc: NOW,
    });
    assert.equal(active, 'ACTIVE');
  });

  it('12. unsafe application URL rejected', () => {
    const safe = validateApplicationUrl('https://example.com/apply');
    assert.equal(safe.safe, true);
    assert.ok(safe.url);

    const unsafe = validateApplicationUrl('javascript:alert(1)');
    assert.equal(unsafe.safe, false);
    assert.equal(unsafe.url, null);

    const malformed = validateApplicationUrl('not-a-url');
    assert.equal(malformed.safe, false);
  });

  it('13. provider outage handled gracefully', async () => {
    setAdapterScenario('unavailable');
    const adapter = createOpportunityAdapter('arbeitnow');
    const result = await adapter.searchJobs({}, NOW);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, 'UNAVAILABLE');
    setAdapterScenario('normal');
  });

  it('14. cache policy defined', () => {
    const jobCache = opportunityCachePolicy(OPPORTUNITY_CACHE_CAPABILITIES.jobSearch);
    assert.ok(jobCache.ttlMs > 0);
    const skillCache = opportunityCachePolicy(OPPORTUNITY_CACHE_CAPABILITIES.skillSearch);
    assert.ok(skillCache.ttlMs > jobCache.ttlMs);
  });

  it('15. 429 rate limit handled', async () => {
    setAdapterScenario('rate_limited');
    const adapter = createOpportunityAdapter('arbeitnow');
    const result = await adapter.searchJobs({}, NOW);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, 'RATE_LIMITED');
    setAdapterScenario('normal');
  });

  it('16. relevance explanation', async () => {
    const service = createOpportunityService();
    const jobs = await service.searchJobs({}, NOW);
    assert.equal(jobs.ok, true);
    if (!jobs.ok) return;
    const relevance = explainJobRelevance(jobs.value[0]!, {
      permittedSkills: ['Python', 'Go'],
      remotePreference: 'REMOTE',
    });
    assert.ok(relevance.explanations.length > 0);
    assert.ok(relevance.explanations.every((e) => typeof e.detail === 'string'));
  });

  it('17. user matching respects permissions', async () => {
    const service = createOpportunityService();
    const jobs = await service.searchJobs({}, NOW);
    assert.equal(jobs.ok, true);
    if (!jobs.ok) return;
    const matched = matchJobsToUser(jobs.value, {
      permittedSkills: ['Python'],
      careerInterests: ['Engineer'],
    });
    assert.equal(matched.sensitiveDataSent, false);
    assert.ok(matched.attributesUsed.includes('permittedSkills'));
  });

  it('18. no sensitive HIN data used in queries', () => {
    assert.throws(
      () => assertNoSensitiveDataInQuery({ medical_history: 'data' }),
      /Sensitive attribute/,
    );
  });

  it('19. Financial Agent can recommend income opportunity', async () => {
    const service = createOpportunityService();
    const evidence = await buildAgentOpportunityEvidence(
      service,
      { permittedSkills: ['Python', 'Machine Learning'] },
      { name: 'Emergency Fund', gapMinor: 500000n, currency: 'USD' },
      NOW,
    );
    assert.equal(evidence.grantsExecutionAuthority, false);
    assert.equal(evidence.autoApply, false);
    assert.ok(evidence.recommendations.length > 0);
    assert.ok(evidence.recommendations.every((r) => r.requiresHumanAuthorization));
  });

  it('20. Agent cannot auto-apply', async () => {
    const service = createOpportunityService();
    const evidence = await buildAgentOpportunityEvidence(service, {}, undefined, NOW);
    assert.equal(evidence.autoApply, false);
    assert.equal(evidence.contactEmployer, false);
    assert.equal(evidence.discloseUserIdentity, false);
    assert.equal(evidence.discloseFinancialPosition, false);
  });

  it('21. Action Center receives canonical events', () => {
    assert.equal(WAVE6_ACTION_CENTER_EVENT_TYPES.length, 4);
    const event = newRelevantJobEvent({
      opportunityId: 'arbeitnow:test',
      title: 'Test Job',
      providerId: 'arbeitnow',
      occurredAt: NOW,
      relevanceScore: 25,
    });
    assert.equal(event.type, 'NEW_RELEVANT_JOB');
    assert.equal(event.autoNotify, false);
  });

  it('22. World coverage remains transparent', async () => {
    const service = createOpportunityService();
    const snapshot = await buildWorldOpportunitySnapshot(service, NOW);
    assert.equal(snapshot.representsEntireLaborMarket, false);
    assert.ok(snapshot.coverageNote.length > 0);
    assert.ok(snapshot.limitations.length > 0);
    assert.ok(snapshot.geographicCoverage.length > 0);
  });

  it('23. BFF exposes no provider secrets', () => {
    const bff = createOpportunityIntelligenceBff();
    const coverage = bff.coverage();
    assert.equal(coverage.totalProviders, 11);
    assert.equal(coverage.productionEnabled, 0);
    const serialized = JSON.stringify(bff);
    assert.ok(!serialized.includes('API_KEY'));
    assert.ok(!serialized.includes('secret'));
  });

  it('24. skills provider adapters work', async () => {
    const adapter = createOpportunityAdapter('open-skills');
    const result = await adapter.searchSkills!('Java', NOW);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.ok(result.value.length > 0);
    assert.ok(result.value.some((s) => s.canonicalName === 'JavaScript'));
  });

  it('25. public intelligence providers work', async () => {
    const service = createOpportunityService();
    const result = await service.getPublicIntelligence(NOW);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.ok(result.value.length >= 4);
    assert.ok(result.value.every((o) => o.verifiedFact === false));
  });

  it('26. Grow integration provides opportunity context', async () => {
    const service = createOpportunityService();
    const context = await buildGrowOpportunityContext(
      service,
      { permittedSkills: ['Python', 'Go'] },
      NOW,
    );
    assert.equal(context.autoApply, false);
    assert.equal(context.referenceOnly, true);
    assert.ok(context.relevantJobs.length > 0 || context.careerOptions.length > 0);
  });

  it('27. PEG integration preserves permission boundaries', async () => {
    const service = createOpportunityService();
    const peg = await buildPegOpportunityContext(service, { permittedSkills: ['Python'] }, NOW);
    assert.equal(peg.publicOpportunityData, true);
    assert.equal(peg.personalLinksRequirePermission, true);
    assert.ok(peg.permittedUserLinks.every((l) => l.permissionRequired));
    assert.ok(peg.structuralLinks.every((l) => l.inferred === false));
  });

  it('28. coverage report counts providers', () => {
    const report = buildOpportunityCoverageReport();
    assert.equal(report.totalProviders, 11);
    assert.equal(report.jobProviders, 5);
    assert.equal(report.skillsProviders, 2);
    assert.equal(report.intelligenceProviders, 4);
  });
});
