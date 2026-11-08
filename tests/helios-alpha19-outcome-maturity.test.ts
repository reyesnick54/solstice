/**
 * HELIOS FORWARD ALPHA — ALPHA19 outcome maturity and delayed label engine.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';
import {
  HELIOS_ALPHA19_OUTCOME_MATURITY_QUALIFIED,
  HELIOS_ALPHA19_OUTCOME_MATURITY_SCHEMA,
  attemptMaturePendingOutcome,
  alpha19DecisionBindingFixture,
  alpha19ObservationStream,
  alpha19ScheduleFixture,
  createOutcomeMaturityQueueStore,
  enqueuePendingOutcomesForDecision,
  evaluateAlpha19OutcomeMaturityQualification,
  processDueOutcomeMaturityJobs,
  sealOutcomeMaturitySchedule,
} from '../packages/platform/src/helios/forward-alpha/index.ts';

describe('HELIOS FORWARD ALPHA ALPHA19 outcome maturity', () => {
  it('architecture guard: forward-alpha stays inside helios boundary', () => {
    const findings = lintHeliosBoundary(process.cwd());
    const scoped = findings.filter((f) => f.file.includes('helios/forward-alpha'));
    assert.deepEqual(scoped, []);
  });

  it('requires OutcomeMaturitySchedule before campaign start', () => {
    const bad = sealOutcomeMaturitySchedule({
      scheduleId: 'sched_late',
      campaignId: 'camp',
      campaignStartsAt: asUtcInstant('2026-04-01T14:00:00.000Z'),
      sealedAt: asUtcInstant('2026-04-01T14:01:00.000Z'),
      requiredHorizonIds: ['1h'],
    });
    assert.equal(bad.ok, false);
    if (!bad.ok) {
      assert.equal(bad.error.code, 'SCHEDULE_NOT_BEFORE_CAMPAIGN');
    }
  });

  it('forbids early labeling before maturity horizon', () => {
    const schedule = alpha19ScheduleFixture();
    const store = createOutcomeMaturityQueueStore(schedule);
    const binding = alpha19DecisionBindingFixture();
    const pending = enqueuePendingOutcomesForDecision({
      store,
      binding,
      enqueuedAt: binding.decisionTime,
    });
    const fiveM = pending.find((row) => row.horizonId === '5m');
    assert.ok(fiveM);
    const early = attemptMaturePendingOutcome({
      store,
      pendingId: fiveM!.pendingId,
      now: asUtcInstant('2026-04-01T14:17:00.000Z'),
      observations: alpha19ObservationStream(),
    });
    assert.equal(early.ok, false);
    if (!early.ok) {
      assert.equal(early.error.code, 'EARLY_LABEL_FORBIDDEN');
    }
  });

  it('matures multiple horizons immutably and triggers evidence updates', () => {
    const schedule = alpha19ScheduleFixture();
    const store = createOutcomeMaturityQueueStore(schedule);
    const binding = alpha19DecisionBindingFixture();
    enqueuePendingOutcomesForDecision({
      store,
      binding,
      enqueuedAt: binding.decisionTime,
    });
    const observations = alpha19ObservationStream();
    const at5m = processDueOutcomeMaturityJobs({
      store,
      now: asUtcInstant('2026-04-01T14:25:00.000Z'),
      observations,
    });
    assert.ok(at5m.length >= 1);
    const matured5 = at5m.find((row) => row.pending.horizonId === '5m' && row.matured);
    assert.ok(matured5?.outcome);
    assert.equal(matured5.outcome!.immutable, true);
    assert.ok(matured5.evidenceUpdate);

    const at1h = processDueOutcomeMaturityJobs({
      store,
      now: asUtcInstant('2026-04-01T15:20:00.000Z'),
      observations,
    });
    const matured1h = at1h.find((row) => row.pending.horizonId === '1h' && row.matured);
    assert.ok(matured1h?.outcome);

    const multi = store.listMaturedForDecision(binding.decisionId);
    assert.equal(multi.length, 2);
    assert.notEqual(multi[0]!.maturedOutcomeId, multi[1]!.maturedOutcomeId);
  });

  it('classifies OUTCOME_DATA_INCOMPLETE without neutral inference', () => {
    const schedule = alpha19ScheduleFixture();
    const store = createOutcomeMaturityQueueStore(schedule);
    const binding = alpha19DecisionBindingFixture();
    enqueuePendingOutcomesForDecision({
      store,
      binding,
      enqueuedAt: binding.decisionTime,
    });
    const fiveM = store.listPending().find((row) => row.horizonId === '5m');
    assert.ok(fiveM);
    const attempt = attemptMaturePendingOutcome({
      store,
      pendingId: fiveM!.pendingId,
      now: asUtcInstant('2026-04-01T14:25:00.000Z'),
      observations: [],
    });
    assert.equal(attempt.ok, true);
    assert.equal(attempt.value.pending.status, 'OUTCOME_DATA_INCOMPLETE');
    assert.equal(attempt.value.outcome, null);
  });

  it('emits HELIOS_ALPHA19_OUTCOME_MATURITY_QUALIFIED when engineering checks pass', () => {
    const schedule = alpha19ScheduleFixture();
    const store = createOutcomeMaturityQueueStore(schedule);
    const binding = alpha19DecisionBindingFixture();
    enqueuePendingOutcomesForDecision({
      store,
      binding,
      enqueuedAt: binding.decisionTime,
    });
    processDueOutcomeMaturityJobs({
      store,
      now: asUtcInstant('2026-04-01T15:20:00.000Z'),
      observations: alpha19ObservationStream(),
    });
    const state = store.getState();
    assert.equal(state.schema, HELIOS_ALPHA19_OUTCOME_MATURITY_SCHEMA);
    const result = evaluateAlpha19OutcomeMaturityQualification(
      {
        scheduleBeforeCampaignStart: true,
        multiHorizonSupported: state.schedule.requiredHorizonIds.length > 1,
        noEarlyLabeling: true,
        noNeutralInferenceOnMissingData: true,
        immutableMaturedOutcomes: state.matured.every((row) => row.immutable),
        evidenceUpdateOnMaturity: state.evidenceUpdates.length >= 1,
        noExecutionAuthority: state.grantsExecutionAuthority === false,
        sealedBindingImmutable: true,
      },
      state,
    );
    assert.equal(
      result.marker,
      HELIOS_ALPHA19_OUTCOME_MATURITY_QUALIFIED,
      result.blockers.join('; '),
    );
  });
});
