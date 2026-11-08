/**
 * HELIOS FORWARD ALPHA — ALPHA03 prequential real-time evaluation engine.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';
import {
  HELIOS_ALPHA03_PREQUENTIAL_ENGINE_QUALIFIED,
  SIMULATION_FORWARD_HARNESS,
  advancePrequentialTick,
  alpha03CampaignFixture,
  alpha03ChronologicalFixtureStream,
  alpha03FutureLeakObservation,
  createPrequentialCampaignStore,
  resumePrequentialCampaign,
  runAlpha03PrequentialHarness,
  sealPrequentialDecision,
  validatePrequentialDecisionInvariants,
  verifyPrequentialPointInTimeIsolation,
} from '../packages/platform/src/helios/forward-alpha/alpha03/index.ts';

describe('HELIOS ALPHA03 — prequential engine', () => {
  it('architecture guard: forward-alpha stays inside helios boundary', () => {
    const findings = lintHeliosBoundary(process.cwd());
    const scoped = findings.filter((f) => f.file.includes('helios/forward-alpha'));
    assert.deepEqual(scoped, []);
  });

  it('sealed decisions reject retroactive mutation', () => {
    const t0 = asUtcInstant('2026-04-01T14:15:00.000Z');
    const sealed = sealPrequentialDecision({
      decisionId: 'pdec_test_immutable',
      campaignId: 'camp',
      decisionTime: t0,
      predictedLabel: 'UP',
      predictedReferenceMidMinor: '1000100',
      instrumentId: 'helios:equity:AAPL:USD',
      contextDigest: 'ctx_digest',
      observationEventIdsAtDecision: Object.freeze(['e1']),
      outcomeHorizonMs: 3_600_000,
      modelVersion: 'm0',
      sealedAt: t0,
    });
    assert.deepEqual(validatePrequentialDecisionInvariants(sealed), []);
    const store = createPrequentialCampaignStore(
      alpha03CampaignFixture({ campaignId: 'immutable_camp' }),
    );
    store.putDecision(sealed);
    assert.throws(() => {
      store.putDecision({
        ...sealed,
        predictedLabel: 'DOWN',
        seal: { ...sealed.seal, contentHash: 'tampered' },
      });
    }, /PREQUENTIAL_REPLAY_SEALED_DECISION/);
  });

  it('runs predict → seal → observe → score loop on fixture stream', () => {
    const observations = alpha03ChronologicalFixtureStream();
    const config = alpha03CampaignFixture();
    const store = createPrequentialCampaignStore(config);
    assert.equal(config.dataSource, SIMULATION_FORWARD_HARNESS);
    assert.equal(config.forwardAlphaEvidenceEligible, false);

    const decisionTime = asUtcInstant('2026-04-01T14:15:00.000Z');
    const tick1 = advancePrequentialTick({
      store,
      decisionTime,
      now: decisionTime,
      observations,
      outcomeHorizonMs: 3_600_000,
    });
    assert.equal(tick1.ok, true);
    assert.ok(tick1.value.phases.includes('PREDICT'));
    assert.ok(tick1.value.phases.includes('SEAL'));
    assert.equal(tick1.value.decision?.outcome, null);

    const tick2 = advancePrequentialTick({
      store,
      decisionTime,
      now: asUtcInstant('2026-04-01T15:45:00.000Z'),
      observations,
      outcomeHorizonMs: 3_600_000,
    });
    assert.equal(tick2.ok, true);
    assert.ok(tick2.value.phases.includes('OBSERVE'));
    assert.ok(tick2.value.phases.includes('SCORE'));
    assert.notEqual(tick2.value.decision?.score, null);
    assert.equal(tick2.value.decision?.seal.contentHash, tick1.value.decision?.seal.contentHash);
  });

  it('ignores not-yet-knowable observations at decision time', () => {
    const decisionTime = asUtcInstant('2026-04-01T14:15:00.000Z');
    const baseline = alpha03ChronologicalFixtureStream();
    const isolated = verifyPrequentialPointInTimeIsolation({
      campaignId: 'leak',
      instrumentId: 'helios:equity:AAPL:USD',
      decisionTime,
      baseline,
      withFutureProbe: [...baseline, alpha03FutureLeakObservation(decisionTime)],
      outcomeHorizonMs: 3_600_000,
      modelVersion: 'm0',
    });
    assert.equal(isolated, true);
  });

  it('survives restart without re-predicting sealed decisions', () => {
    const observations = alpha03ChronologicalFixtureStream();
    const store = createPrequentialCampaignStore(alpha03CampaignFixture());
    const decisionTime = asUtcInstant('2026-04-01T14:15:00.000Z');
    advancePrequentialTick({
      store,
      decisionTime,
      now: decisionTime,
      observations,
      outcomeHorizonMs: 3_600_000,
    });
    const snap = store.getState();
    const restarted = resumePrequentialCampaign(snap);
    const again = advancePrequentialTick({
      store: restarted,
      decisionTime,
      now: asUtcInstant('2026-04-01T15:45:00.000Z'),
      observations,
      outcomeHorizonMs: 3_600_000,
    });
    assert.equal(again.ok, true);
    assert.ok(!again.value.phases.includes('PREDICT'));
  });

  it('emits HELIOS_ALPHA03_PREQUENTIAL_ENGINE_QUALIFIED', () => {
    const result = runAlpha03PrequentialHarness();
    assert.equal(result.marker, HELIOS_ALPHA03_PREQUENTIAL_ENGINE_QUALIFIED, result.blockers.join('; '));
    assert.equal(result.qualified, true);
  });
});
