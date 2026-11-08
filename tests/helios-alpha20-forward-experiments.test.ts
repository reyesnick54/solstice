/**
 * HELIOS Forward Alpha ALPHA20 — forward strategy cohort and control experiments.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  COHORT_MEMBER_ROLES,
  HELIOS_ALPHA20_FORWARD_EXPERIMENTS_QUALIFIED,
  HELIOS_ALPHA20_FORWARD_EXPERIMENTS_BLOCKED,
  acceptEvolChallengerNomination,
  alpha20FixtureMemberOutcomes,
  alpha20QualifiedForwardCohort,
  assertCustomerCapitalNeverRandomized,
  buildCohortAllocationPolicy,
  createChronologicalOpportunitySet,
  createForwardControlStrategy,
  createForwardCohort,
  createForwardTreatmentStrategy,
  deterministicOpportunityPermutation,
  rejectCampaignRewriteAfterStart,
  rejectUnequalOpportunitySets,
  runForwardCohortExperimentPipeline,
  sealForwardExperimentPreregistration,
  sharedOpportunityIdsForCohort,
  startForwardCohortExperiment,
} from '../packages/platform/src/helios/forward-alpha/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const T0 = asUtcInstant('2026-11-08T12:00:00.000Z');
const T1 = asUtcInstant('2026-11-08T16:00:00.000Z');

describe('HELIOS Forward Alpha ALPHA20 forward cohort experiments', () => {
  it('passes HELIOS boundary lint for alpha20 module', () => {
    const scoped = lintHeliosBoundary(process.cwd()).filter((f) => f.file.includes('forward-alpha/alpha20'));
    assert.deepEqual(scoped, []);
  });

  it('exports all cohort member roles', () => {
    assert.deepEqual(COHORT_MEMBER_ROLES, [
      'INCUMBENT_CHAMPION',
      'CHALLENGER',
      'NAIVE_BASELINE',
      'CASH',
      'MARKET_BENCHMARK',
      'SIMPLE_FACTOR',
    ]);
  });

  it('rejects comparing strategies on different opportunity calendars', () => {
    assert.throws(() => {
      rejectUnequalOpportunitySets('a', 'b', ['opp_1', 'opp_2'], ['opp_1', 'opp_3']);
    }, /different days/);
  });

  it('blocks customer capital randomization', () => {
    const cohort = alpha20QualifiedForwardCohort();
    assertCustomerCapitalNeverRandomized(cohort.allocationPolicy);
    assert.equal(cohort.allocationPolicy.customerCapitalRandomized, false);
  });

  it('deterministic seeded permutation is reproducible', () => {
    const ids = ['a', 'b', 'c', 'd', 'e'];
    const p1 = deterministicOpportunityPermutation(ids, 42);
    const p2 = deterministicOpportunityPermutation(ids, 42);
    assert.deepEqual(p1, p2);
    assert.notDeepEqual(p1, ids);
  });

  it('EVOL may nominate challengers before start but not rewrite campaign after', () => {
    let cohort = alpha20QualifiedForwardCohort();
    const shared = sharedOpportunityIdsForCohort(cohort.opportunitySet);
    const { nomination } = acceptEvolChallengerNomination(cohort, {
      nominationId: 'evol_nom_extra',
      genomeId: 'genome_x',
      parameterVectorFingerprint: 'fp_x',
      nominatedAt: T0,
      trialFamilyId: 'fam_x',
      memberId: 'mbr_evol_extra',
      strategyId: 'strat_evol_extra',
      strategyVersion: '0.1.0',
      shadowCapitalRegistrationId: 'reg_evol_extra',
      assignedOpportunityIds: shared,
    });
    assert.equal(nomination.genomeId, 'genome_x');

    cohort = startForwardCohortExperiment(cohort, T1);
    assert.throws(() => {
      rejectCampaignRewriteAfterStart(cohort, 'tampered_fingerprint');
    }, /rewrite forbidden/);
  });

  it('qualifies fixture cohort with aligned opportunities and shadow capital', () => {
    const cohort = alpha20QualifiedForwardCohort();
    const { qualification, evidence } = runForwardCohortExperimentPipeline({
      cohort,
      comparedAt: T1,
      memberOutcomes: alpha20FixtureMemberOutcomes(),
      shadowRegisteredAt: T0,
    });
    assert.equal(qualification.qualified, true);
    assert.equal(qualification.marker, HELIOS_ALPHA20_FORWARD_EXPERIMENTS_QUALIFIED);
    assert.equal(evidence.comparison.calendarAlignmentVerified, true);
    assert.ok(evidence.comparison.treatmentVsControlActiveReturnDeltaBps > 0);
    assert.equal(evidence.cohort.grantsExecutionAuthority, false);
  });

  it('blocks qualification when opportunity calendars diverge at cohort build', () => {
    const base = alpha20QualifiedForwardCohort();
    const misaligned = createForwardTreatmentStrategy({
      memberId: 'mbr_bad',
      strategyId: 'strat_bad',
      strategyVersion: '1',
      role: 'CHALLENGER',
      shadowCapitalRegistrationId: 'reg_bad',
      assignedOpportunityIds: ['wrong_opp'],
    });
    assert.throws(() => {
      createForwardCohort({
        experimentId: base.experimentId,
        cohortId: 'bad_cohort',
        preregistration: base.preregistration,
        sealedAt: T0,
        opportunitySet: base.opportunitySet,
        allocationPolicy: buildCohortAllocationPolicy({
          policyId: 'alloc_bad',
          experimentId: base.experimentId,
          memberIds: [...base.controlStrategies.map((s) => s.memberId), misaligned.memberId],
          sharedPortfolioCapitalMinor: '100000000',
          opportunityAssignmentMode: 'CHRONOLOGICAL_IDENTICAL',
        }),
        controlStrategies: base.controlStrategies,
        treatmentStrategies: [misaligned],
      });
    }, /calendar arbitrage|misalignment/);
  });

  it('blocks qualification when sample requirement is not met', () => {
    const preregistration = sealForwardExperimentPreregistration({
      preregistrationId: 'prereg_short',
      primaryOutcomeMetricId: 'active_return_bps',
      secondaryOutcomeMetricIds: [],
      benchmarkId: 'SIM_EQ',
      minimumSampleOpportunities: 10,
      stoppingPolicyKind: 'FIXED_HORIZON',
      fixedHorizonOpportunities: 10,
      sealedAt: T0,
    });
    const cohort = createForwardCohort({
      ...alpha20QualifiedForwardCohort(),
      preregistration,
    });
    const { qualification } = runForwardCohortExperimentPipeline({
      cohort,
      comparedAt: T1,
      memberOutcomes: alpha20FixtureMemberOutcomes(),
      shadowRegisteredAt: T0,
    });
    assert.equal(qualification.qualified, false);
    assert.equal(qualification.marker, HELIOS_ALPHA20_FORWARD_EXPERIMENTS_BLOCKED);
    assert.ok(qualification.blockers.includes('SAMPLE_REQUIREMENT_NOT_MET'));
  });

  it('includes simple factor control strategy in taxonomy', () => {
    const set = createChronologicalOpportunitySet({
      opportunitySetId: 'opp_factor',
      opportunities: [
        {
          opportunityId: 'o0',
          chronologicalIndex: 0,
          decisionAt: T0,
          instrumentId: 'EQ:SIM:X',
          knowableAt: T0,
        },
      ],
    });
    const ids = sharedOpportunityIdsForCohort(set);
    const factor = createForwardControlStrategy({
      memberId: 'mbr_factor',
      strategyId: 'strat_factor',
      strategyVersion: '1',
      role: 'SIMPLE_FACTOR',
      shadowCapitalRegistrationId: 'reg_factor',
      assignedOpportunityIds: ids,
    });
    assert.equal(factor.role, 'SIMPLE_FACTOR');
    assert.equal(factor.lane, 'CONTROL');
  });
});
