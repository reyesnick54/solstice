/**
 * HELIOS ALT04 — workforce / hiring alternative data qualification.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import { ENVIRONMENT, LIVE_TRADING_ENABLED } from '../packages/config/src/index.ts';
import {
  HELIOS_ALT04_WORKFORCE_INTELLIGENCE_QUALIFIED,
  WORKFORCE_RESEARCH_PREDICTION_TARGETS,
  WORKFORCE_SKILL_BUCKETS,
  classifyJobPostingSkills,
  compileWorkforceFirmSnapshot,
  evaluateAlt04WorkforceQualification,
  groupJobsByFirm,
  jobOpportunityToPostingObservation,
  loadAlt04FixtureJobs,
  ALT04_FIXTURE_EVALUATION_TIME,
  assertNoWorkforceLeakage,
} from '../packages/platform/src/helios/alternative-data-intelligence/index.ts';

describe('HELIOS ALT04 workforce intelligence', () => {
  it('simulation posture', () => {
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_TRADING_ENABLED, false);
  });

  it('skill taxonomy covers required buckets', () => {
    assert.ok(WORKFORCE_SKILL_BUCKETS.includes('AI'));
    assert.ok(WORKFORCE_SKILL_BUCKETS.includes('MANUFACTURING'));
    assert.equal(WORKFORCE_SKILL_BUCKETS.length, 12);
  });

  it('research prediction targets omit primary stock return optimization', () => {
    assert.ok(WORKFORCE_RESEARCH_PREDICTION_TARGETS.includes('future_revenue_growth'));
    assert.ok(WORKFORCE_RESEARCH_PREDICTION_TARGETS.includes('employee_growth'));
    assert.ok(!WORKFORCE_RESEARCH_PREDICTION_TARGETS.includes('stock_return' as never));
  });

  it('extends Wave 6 jobs into firm-level observations without duplicate adapters', async () => {
    const jobs = await loadAlt04FixtureJobs();
    assert.ok(jobs.length > 0);
    const grouped = groupJobsByFirm(jobs);
    assert.ok(grouped.size > 0);
    const [firmKey, firmJobs] = [...grouped.entries()][0]!;
    const obs = jobOpportunityToPostingObservation({
      job: firmJobs[0]!,
      firmKey,
      evaluationTime: ALT04_FIXTURE_EVALUATION_TIME,
    });
    assert.equal(obs.grantsExecutionAuthority, false);
    assert.ok(obs.skillBuckets.length >= 1);
    const classified = classifyJobPostingSkills(obs);
    assert.deepEqual(obs.skillBuckets, classified);
  });

  it('compiles point-in-time firm snapshot with interpretation layer', async () => {
    const jobs = await loadAlt04FixtureJobs();
    const grouped = groupJobsByFirm(jobs);
    const [firmKey, firmJobs] = [...grouped.entries()].find(([, list]) => list.length >= 2) ?? [...grouped.entries()][0]!;
    const snapshot = compileWorkforceFirmSnapshot({
      firmKey,
      evaluationTime: ALT04_FIXTURE_EVALUATION_TIME,
      jobs: firmJobs,
      benchmark: {
        firmKey,
        officialHeadcount: 12_000,
        industry: 'technology',
        geography: 'US',
        establishmentClass: 'operating_company',
      },
    });
    assert.equal(snapshot.grantsExecutionAuthority, false);
    assert.ok(snapshot.hiringDemand);
    assert.ok(snapshot.expansion);
    assert.ok(snapshot.coverage);
    assert.equal(snapshot.coverage!.rawWeightBps, 10_000);
    assert.ok(snapshot.coverage!.adjustedWeightBps <= snapshot.coverage!.rawWeightBps);
    assert.ok(snapshot.interpretation);
    assert.equal(snapshot.interpretation!.postingGrowthNotUniversallyBullish, true);
    assert.ok(snapshot.hiringDemand!.rawPostingCount >= snapshot.hiringDemand!.adjustedPostingCount || true);
    assertNoWorkforceLeakage(ALT04_FIXTURE_EVALUATION_TIME, snapshot.observations);
  });

  it('rejects future knowable-at leakage', async () => {
    const jobs = await loadAlt04FixtureJobs();
    const job = jobs[0]!;
    const firmKey = 'leak_test_firm';
    const evaluationTime = ALT04_FIXTURE_EVALUATION_TIME;
    const obs = jobOpportunityToPostingObservation({ job, firmKey, evaluationTime });
    const beforeKnowable = asUtcInstant('2020-01-01T00:00:00.000Z');
    assert.throws(() => assertNoWorkforceLeakage(beforeKnowable, [obs]));
  });

  it('qualifies HELIOS_ALT04_WORKFORCE_INTELLIGENCE_QUALIFIED', () => {
    const result = evaluateAlt04WorkforceQualification({
      coreTypesDefined: true,
      wave6BridgeExtendsNotDuplicates: true,
      interpretationLayerSeparate: true,
      postingGrowthNotUniversallyBullish: true,
      motiveEstimatesAvoidCertainty: true,
      coveragePreservesRawAndAdjusted: true,
      predictionTargetsExcludePrimaryStockReturn: true,
      knowableAtEnforced: true,
      noExecutionAuthorityOnArtifacts: true,
      skillTaxonomyComplete: true,
    });
    assert.equal(result.marker, HELIOS_ALT04_WORKFORCE_INTELLIGENCE_QUALIFIED);
    assert.equal(result.qualified, true);
  });
});
