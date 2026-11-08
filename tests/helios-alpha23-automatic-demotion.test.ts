import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  AlphaDecayMonitor,
  alpha11PreferAlpha23FailSafeKill,
} from '../packages/platform/src/helios/forward-alpha/alpha11/index.ts';
import {
  FORBIDDEN_AUTOMATIC_RESEARCH_ACTIONS,
  HELIOS_ALPHA23_AUTOMATIC_DEMOTION_QUALIFIED,
  assertNoForbiddenAutomaticAction,
  alpha23AutomaticKillEligible,
  alpha23PrimaryDemotionTrigger,
  buildAlpha23HealthInputFromAlpha11,
  defaultForwardDemotionPolicy,
  evaluateAlpha23AutomaticDemotion,
  evaluateAlpha23Qualification,
  evaluateResearchReactivationEligibility,
  forwardResearchPostureFromPromotion,
  promotionTargetForResearchKill,
  researchKillHaltsPaperExecution,
  researchKillPaperHaltReason,
} from '../packages/platform/src/helios/forward-alpha/alpha23/index.ts';
import { FrozenClock } from '../packages/config/src/clock.ts';
import {
  buildH14ReferenceCapsule,
  createQualificationPolicy,
  StrategyPromotionService,
  transitionPromotionState,
} from '../packages/strategy-lab/src/index.ts';
import { StrategyPromotionStore } from '../packages/strategy-lab/src/promotion-store.ts';

const NOW = asUtcInstant('2026-07-01T12:00:00.000Z');

describe('HELIOS Forward Alpha ALPHA23 — automatic demotion', () => {
  it('qualifies with HELIOS_ALPHA23_AUTOMATIC_DEMOTION_QUALIFIED', () => {
    const q = evaluateAlpha23Qualification();
    assert.equal(q.marker, HELIOS_ALPHA23_AUTOMATIC_DEMOTION_QUALIFIED, q.blockers.join('; '));
    assert.equal(q.grantsFinancialAuthority, false);
    assert.equal(q.permitsRiskIncrease, false);
  });

  it('blocks forbidden automatic recovery actions', () => {
    const policy = defaultForwardDemotionPolicy();
    for (const action of FORBIDDEN_AUTOMATIC_RESEARCH_ACTIONS) {
      const verdict = assertNoForbiddenAutomaticAction(policy, action);
      assert.equal(verdict.ok, false);
    }
    assert.equal(assertNoForbiddenAutomaticAction(policy, 'INCREASE_RISK_LIMITS').ok, false);
  });

  it('demotes PAPER to SHADOW on drawdown breach without permitting risk increase', () => {
    const result = evaluateAlpha23AutomaticDemotion({
      strategyId: 'str_paper_dd',
      evaluatedAt: NOW,
      posture: 'PAPER',
      drawdownBps: 2_200,
      alphaConfidenceBps: 6_000,
    });
    assert.equal(result.decision.killRequired, true);
    assert.equal(result.decision.transition, 'PAPER_TO_SHADOW');
    assert.equal(result.decision.permitsRiskIncrease, false);
    assert.equal(result.decision.failedEvidenceRetained, true);
    assert.ok(alpha23AutomaticKillEligible(result.decision));
  });

  it('pauses SHADOW on benchmark underperformance', () => {
    const result = evaluateAlpha23AutomaticDemotion({
      strategyId: 'str_shadow_bench',
      evaluatedAt: NOW,
      posture: 'SHADOW',
      benchmarkUnderperformanceBps: 900,
    });
    assert.equal(result.decision.transition, 'SHADOW_TO_PAUSED');
    assert.equal(result.decision.toPosture, 'PAUSED');
  });

  it('fail-safe kills research on operational anomaly from any posture', () => {
    const result = evaluateAlpha23AutomaticDemotion({
      strategyId: 'str_fail',
      evaluatedAt: NOW,
      posture: 'RESEARCH',
      operationalAnomaly: true,
    });
    assert.equal(result.decision.transition, 'ANY_TO_FAILED_SAFE');
    assert.equal(result.decision.toPosture, 'FAILED_SAFE');
  });

  it('maps promotion targets including PAPER to SHADOW transition', () => {
    const paper = evaluateAlpha23AutomaticDemotion({
      strategyId: 'str_map',
      evaluatedAt: NOW,
      posture: 'PAPER',
      drawdownBps: 5_000,
    }).decision;
    assert.equal(promotionTargetForResearchKill('PAPER_ACTIVE', paper), 'SHADOW_ACTIVE');
    assert.equal(transitionPromotionState('PAPER_ACTIVE', 'SHADOW_ACTIVE').ok, true);
  });

  it('halts paper runtime and requires reactivation evidence after kill', () => {
    const decision = evaluateAlpha23AutomaticDemotion({
      strategyId: 'str_halt',
      evaluatedAt: NOW,
      posture: 'PAPER',
      executionCostBps: 200,
    }).decision;
    assert.equal(researchKillHaltsPaperExecution(decision), true);
    assert.equal(researchKillPaperHaltReason(decision), 'POLICY_CHANGE');
    const reactivation = evaluateResearchReactivationEligibility(decision, {
      hasNewEvidence: false,
      hasExplicitGovernancePolicy: false,
      hasNewVersionOrCampaign: false,
    });
    assert.equal(reactivation.eligible, false);
    const allowed = evaluateResearchReactivationEligibility(decision, {
      hasNewEvidence: true,
      hasExplicitGovernancePolicy: false,
      hasNewVersionOrCampaign: false,
    });
    assert.equal(allowed.eligible, true);
    assert.ok(allowed.satisfied.includes('NEW_EVIDENCE'));
  });

  it('integrates ALPHA11 decay into ALPHA23 health and Strategy Lab promotion', () => {
    const monitor = new AlphaDecayMonitor();
    const T0 = asUtcInstant('2026-06-01T12:00:00.000Z');
    const step = (h: number): (typeof NOW) => {
      const ms = Date.parse(T0) + h * 3_600_000;
      return asUtcInstant(new Date(ms).toISOString());
    };
    const series = (
      metric:
        | 'ACTIVE_RETURN_BPS'
        | 'HIT_RATE_BPS'
        | 'DRAWDOWN_BPS'
        | 'FORECAST_CALIBRATION_BPS',
      values: readonly number[],
    ) => values.map((value, index) => Object.freeze({ observedAt: step(index), metric, value }));
    const alpha11 = monitor.evaluate({
      strategyId: 'str_alpha_bridge',
      evaluatedAt: NOW,
      observations: [
        ...series('ACTIVE_RETURN_BPS', [115, 114, 113, 30, 28, 25, 22, 20]),
        ...series('HIT_RATE_BPS', [5_200, 5_180, 5_150, 4_700, 4_600, 4_500, 4_400, 4_300]),
        ...series('DRAWDOWN_BPS', [800, 820, 850, 1_800, 2_000, 2_200, 2_400, 2_600]),
        ...series('FORECAST_CALIBRATION_BPS', [9_500, 9_480, 9_450, 8_000, 7_800, 7_600, 7_400, 7_200]),
      ],
      baselines: [
        Object.freeze({ metric: 'ACTIVE_RETURN_BPS', mean: 110, stdDev: 12, sampleCount: 200 }),
        Object.freeze({ metric: 'HIT_RATE_BPS', mean: 5_200, stdDev: 150, sampleCount: 200 }),
        Object.freeze({ metric: 'DRAWDOWN_BPS', mean: 800, stdDev: 100, sampleCount: 200 }),
        Object.freeze({ metric: 'EXECUTION_COST_BPS', mean: 25, stdDev: 5, sampleCount: 200 }),
        Object.freeze({ metric: 'SLIPPAGE_BPS', mean: 15, stdDev: 4, sampleCount: 200 }),
        Object.freeze({ metric: 'SIGNAL_FREQUENCY', mean: 12, stdDev: 2, sampleCount: 200 }),
        Object.freeze({ metric: 'FEATURE_DISTRIBUTION_SHIFT', mean: 100, stdDev: 10, sampleCount: 200 }),
        Object.freeze({ metric: 'REGIME_MIX_SHIFT', mean: 50, stdDev: 8, sampleCount: 200 }),
        Object.freeze({ metric: 'FORECAST_CALIBRATION_BPS', mean: 9_500, stdDev: 200, sampleCount: 200 }),
      ],
      minimumObservationsPerMetric: 8,
    });
    assert.ok(alpha11.health === 'DEGRADED' || alpha11.health === 'BROKEN');
    assert.equal(alpha11PreferAlpha23FailSafeKill(alpha11), true);

    const healthInput = buildAlpha23HealthInputFromAlpha11({
      strategyId: 'str_alpha_bridge',
      evaluatedAt: NOW,
      promotionState: 'PAPER_ACTIVE',
      alpha11State: alpha11,
      drawdownBps: 2_600,
    });
    assert.equal(forwardResearchPostureFromPromotion('PAPER_ACTIVE'), 'PAPER');

    const alpha23 = evaluateAlpha23AutomaticDemotion(healthInput);
    assert.equal(alpha23.decision.killRequired, true);
    const trigger = alpha23PrimaryDemotionTrigger(alpha23.decision);
    assert.ok(trigger.length > 0);

    const clock = new FrozenClock(NOW);
    const store = new StrategyPromotionStore();
    const policy = createQualificationPolicy({});
    const promotion = new StrategyPromotionService({ clock, store, policy });
    const frozenCapsule = buildH14ReferenceCapsule({ subjectId: 'cust_alpha23', frozenAt: NOW });
    assert.equal(frozenCapsule.ok, true);
    if (!frozenCapsule.ok) throw new Error('capsule');
    const capsule = frozenCapsule.value;
    store.putCapsule(capsule);
    store.putPromotion({
      strategyId: capsule.strategyId,
      strategyVersion: capsule.version,
      subjectId: capsule.subjectId,
      capsuleId: capsule.capsuleId,
      capsuleFingerprint: capsule.fingerprint,
      promotionState: 'PAPER_ACTIVE',
      policyId: policy.policyId,
      policyVersion: policy.version,
      policyHash: policy.policyHash,
      expiresAt: null,
      updatedAt: NOW,
    });
    const target = promotionTargetForResearchKill('PAPER_ACTIVE', alpha23.decision);
    assert.ok(target);
    const applied = promotion.recordAlpha23ResearchKill({
      strategyId: capsule.strategyId,
      version: capsule.version,
      killRequired: true,
      promotionTarget: target,
      trigger,
      reason: alpha23.decision.reason,
      alpha23DecisionId: alpha23.decision.decisionId,
    });
    assert.equal(applied.ok, true);
    if (applied.ok) {
      assert.equal(applied.value.promotionState, 'SHADOW_ACTIVE');
    }
    assert.ok(store.snapshot().demotions.length >= 1);
  });
});
