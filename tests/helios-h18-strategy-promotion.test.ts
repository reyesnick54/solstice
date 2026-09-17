import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../packages/config/src/clock.ts';
import { asCustomerId } from '../packages/domain/src/customer.ts';
import { asJurisdiction } from '../packages/domain/src/jurisdiction.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import { DomainEventLog } from '../packages/events/src/events.ts';
import { EvidenceVault } from '../packages/evidence/src/vault.ts';
import { SimulatedIdentityAdapter } from '../packages/identity/src/simulation.ts';
import { ModelRegistry, seedCanonicalRiskModel } from '../packages/model-registry/src/registry.ts';
import { persistStrategyPromotionState } from '../packages/persistence/src/strategy-lab/pg-strategy-promotion-store.ts';
import {
  closePersistencePools,
  createPersistencePools,
} from '../packages/persistence/src/postgres/pools.ts';
import { defaultSimulationBudget, RiskEngine } from '../packages/risk/src/engine.ts';
import { createSimulationKeyProvider } from '../packages/security/src/simulation.ts';
import { lintStrategyPromotionAuthority } from '../packages/strategy-lab/src/architecture-guards.ts';
import {
  buildH14ReferenceCapsule,
  createQualificationPolicy,
  DEFAULT_PARAMETER_SET,
  equalWeightSpec,
  HELIOS_H14_STRATEGY_CAPSULE_ID,
  HELIOS_H14_STRATEGY_CAPSULE_VERSION,
  observeH14CapsuleQualification,
  StrategyLab,
  StrategyPromotionService,
  syntheticTwoEtfDataset,
} from '../packages/strategy-lab/src/index.ts';
import { persistenceAvailable, preparePersistence } from './persistence/helpers.ts';

const NOW = asUtcInstant('2026-09-17T08:00:00.000Z');

type Harness = {
  readonly clock: FrozenClock;
  readonly lab: StrategyLab;
  readonly promotion: StrategyPromotionService;
  readonly actor: { readonly actorId: string; readonly subjectId: string; readonly sessionId: string };
  readonly qlsvc: { readonly actorId: string; readonly subjectId: string; readonly sessionId: string };
  readonly budget: ReturnType<typeof defaultSimulationBudget>;
  readonly evidence: EvidenceVault;
};

function harness(subjectId = 'cust_h18_a'): Harness {
  const clock = new FrozenClock(NOW);
  const keys = createSimulationKeyProvider({ clock: { now: () => clock.now() } });
  const events = new DomainEventLog();
  const evidence = new EvidenceVault(clock);
  const identity = new SimulatedIdentityAdapter({ clock, keys, events });
  assert.equal(
    identity.provisionSimulatedActor({
      actorId: 'operator_h18',
      jurisdiction: asJurisdiction('US'),
      identityId: 'id_h18_op',
      customerId: asCustomerId(subjectId),
      capabilities: ['VIEW_ACCOUNT', 'INVESTMENT_OPERATE_REQUEST'],
    }).ok,
    true,
  );
  const actorResult = identity.service.resolveActorContext('operator_h18');
  if (!actorResult.ok) throw new Error('actor');
  const registry = new ModelRegistry();
  assert.equal(seedCanonicalRiskModel(registry, actorResult.value, NOW).ok, true);
  const risk = new RiskEngine({ clock, registry, events, evidence });
  const lab = new StrategyLab({ clock, risk, registry, events, evidence });
  const policy = createQualificationPolicy({
    minimumEvaluationDays: 7,
    minimumOpportunityCount: 1,
    shadowMinimumDurationDays: 3,
    shadowMinimumDecisions: 3,
    shadowMinimumNoActionDecisions: 1,
    paperEligibilityExpiryDays: 30,
  });
  const promotion = new StrategyPromotionService({ clock, evidence, policy });
  const budget = defaultSimulationBudget({ subjectId, portfolioId: 'inv_h18', reviewBy: NOW });
  risk.putBudget(budget);
  return {
    clock,
    lab,
    promotion,
    actor: actorResult.value,
    qlsvc: { actorId: 'qlsvc_promotion', subjectId, sessionId: 'sess_qlsvc' },
    budget,
    evidence,
  };
}

function registerCapsuleWithLab(ctx: Harness, subjectId = 'cust_h18_a') {
  const dataset = syntheticTwoEtfDataset();
  assert.equal(ctx.lab.registerDataset(dataset).ok, true);
  assert.equal(ctx.lab.createDraft({ specification: equalWeightSpec() }).ok, true);
  const compiled = ctx.lab.compile('str_two_etf_cash', 'v1', ctx.budget);
  assert.equal(compiled.ok, true);
  const spec = ctx.lab.store.getSpecification('str_two_etf_cash', 'v1');
  if (!spec || !compiled.ok) throw new Error('spec');
  return ctx.promotion.registerCapsule({
    specification: spec,
    plan: compiled.value,
    evidenceRefs: [{ evidenceKind: 'VALIDATION', refId: 'pending', hash: 'pending' }],
    subjectId,
  });
}

function runEvaluation(ctx: Harness) {
  const dataset = syntheticTwoEtfDataset();
  const train = ctx.lab.backtest({
    strategyId: 'str_two_etf_cash',
    version: 'v1',
    datasetId: dataset.datasetId,
    datasetVersion: dataset.version,
    parameterSet: DEFAULT_PARAMETER_SET,
    startingCapitalMinor: 100_000n,
    period: { start: dataset.timeRange.start, end: asUtcInstant('2026-01-10T00:00:00.000Z') },
    partition: 'TRAIN',
  });
  const oos = ctx.lab.backtest({
    strategyId: 'str_two_etf_cash',
    version: 'v1',
    datasetId: dataset.datasetId,
    datasetVersion: dataset.version,
    parameterSet: DEFAULT_PARAMETER_SET,
    startingCapitalMinor: 100_000n,
    period: { start: asUtcInstant('2026-01-18T00:00:00.000Z'), end: dataset.timeRange.end },
    partition: 'OUT_OF_SAMPLE_TEST',
  });
  assert.equal(train.ok && oos.ok, true);
  if (!train.ok || !oos.ok) throw new Error('backtest');
  const report = ctx.lab.validate({
    strategyId: 'str_two_etf_cash',
    version: 'v1',
    train: train.value,
    outOfSample: oos.value,
    snapshot: ctx.lab.emptySnapshot('inv_h18', 'cust_h18_a', 100_000n),
    rdtState: 'SIMULATION_READY',
  });
  assert.equal(report.ok, true);
  if (!report.ok) throw new Error('validate');
  return ctx.promotion.recordEvaluationQualification({
    strategyId: 'str_two_etf_cash',
    version: 'v1',
    validation: report.value,
    outOfSample: oos.value,
    reproducibilityHash: oos.value.outputHash,
    priorReproducibilityHash: oos.value.outputHash,
    limitationsAccepted: true,
  });
}

describe('HELIOS H18 strategy promotion pipeline', () => {
  it('1. draft cannot self-promote', () => {
    const ctx = harness();
    assert.equal(registerCapsuleWithLab(ctx).ok, true);
    const blocked = ctx.promotion.promoteToShadowEligible({
      actor: { actorId: 'draft_self', subjectId: 'cust_h18_a', sessionId: 'sess_draft' },
      strategyId: 'str_two_etf_cash',
      version: 'v1',
      reason: 'draft self promotion attempt',
    });
    assert.equal(blocked.ok, false);
    if (!blocked.ok) {
      assert.ok(
        blocked.error.code === 'SELF_PROMOTION_FORBIDDEN' ||
          blocked.error.code === 'HUMAN_OPERATOR_REQUIRED',
      );
    }
  });

  it('2. model cannot promote itself', () => {
    const ctx = harness();
    assert.equal(registerCapsuleWithLab(ctx).ok, true);
    const blocked = ctx.promotion.promoteToPaperEligible({
      actor: { actorId: 'mdl_s3m', subjectId: 'cust_h18_a', sessionId: 'sess_mdl' },
      strategyId: 'str_two_etf_cash',
      version: 'v1',
      shadow: {
        runId: 'fshd_test' as never,
        durationDays: 10,
        decisionCount: 10,
        noActionCount: 2,
        tradeCount: 8,
        maxDrawdownProxyBps: 100,
        costSensitivityPassed: true,
        benchmarkComparisonPassed: true,
        calibrationPassed: true,
        financialEffectCreated: false,
        outcomesRecorded: 10,
      },
      reason: 'model self promotion',
    });
    assert.equal(blocked.ok, false);
    if (!blocked.ok) {
      assert.ok(
        blocked.error.code === 'SELF_PROMOTION_FORBIDDEN' ||
          blocked.error.code === 'HUMAN_OPERATOR_REQUIRED',
      );
    }
  });

  it('3. failed evaluation blocks shadow', () => {
    const ctx = harness();
    const policy = createQualificationPolicy({ minimumOpportunityCount: 999 });
    ctx.promotion.setPolicy(policy);
    assert.equal(registerCapsuleWithLab(ctx).ok, true);
    assert.equal(ctx.promotion.assessEvaluationEligibility('str_two_etf_cash', 'v1').ok, true);
    const evaluated = runEvaluation(ctx);
    assert.equal(evaluated.ok, true);
    if (evaluated.ok) {
      assert.equal(evaluated.value.promotionState, 'REVIEW_REQUIRED');
    }
    const shadow = ctx.promotion.promoteToShadowEligible({
      actor: ctx.actor,
      strategyId: 'str_two_etf_cash',
      version: 'v1',
      reason: 'should fail gate 2',
    });
    assert.equal(shadow.ok, false);
  });

  it('4. passing declared evaluation permits shadow', () => {
    const ctx = harness();
    assert.equal(registerCapsuleWithLab(ctx).ok, true);
    assert.equal(ctx.promotion.assessEvaluationEligibility('str_two_etf_cash', 'v1').ok, true);
    const evaluated = runEvaluation(ctx);
    assert.equal(evaluated.ok, true);
    const shadow = ctx.promotion.promoteToShadowEligible({
      actor: ctx.actor,
      strategyId: 'str_two_etf_cash',
      version: 'v1',
      reason: 'evaluation passed human shadow approval',
    });
    assert.equal(shadow.ok, true);
    if (shadow.ok) {
      assert.equal(shadow.value.promotionState, 'SHADOW_ELIGIBLE');
    }
  });

  it('5. shadow produces no financial effect', () => {
    const ctx = harness();
    assert.equal(registerCapsuleWithLab(ctx).ok, true);
    assert.equal(ctx.promotion.assessEvaluationEligibility('str_two_etf_cash', 'v1').ok, true);
    assert.equal(runEvaluation(ctx).ok, true);
    assert.equal(
      ctx.promotion.promoteToShadowEligible({
        actor: ctx.actor,
        strategyId: 'str_two_etf_cash',
        version: 'v1',
        reason: 'shadow eligible',
      }).ok,
      true,
    );
    const run = ctx.promotion.startForwardShadow({
      strategyId: 'str_two_etf_cash',
      version: 'v1',
      observationRef: 'obs_forward_fixture',
    });
    assert.equal(run.ok, true);
    if (run.ok) {
      assert.equal(run.value.sendsOrders, false);
      assert.equal(run.value.financialEffectCreated, false);
      assert.equal(run.value.changesInvestmentState, false);
    }
  });

  it('6. shadow decisions immutable after outcome', () => {
    const ctx = harness();
    const dataset = syntheticTwoEtfDataset();
    assert.equal(registerCapsuleWithLab(ctx).ok, true);
    assert.equal(ctx.promotion.assessEvaluationEligibility('str_two_etf_cash', 'v1').ok, true);
    assert.equal(runEvaluation(ctx).ok, true);
    assert.equal(
      ctx.promotion.promoteToShadowEligible({
        actor: ctx.actor,
        strategyId: 'str_two_etf_cash',
        version: 'v1',
        reason: 'shadow',
      }).ok,
      true,
    );
    const run = ctx.promotion.startForwardShadow({
      strategyId: 'str_two_etf_cash',
      version: 'v1',
      observationRef: 'obs_forward_fixture',
    });
    if (!run.ok) throw new Error('run');
    const spec = ctx.lab.store.getSpecification('str_two_etf_cash', 'v1');
    if (!spec) throw new Error('spec');
    const decision = ctx.promotion.recordForwardDecision({
      run: run.value,
      specification: spec,
      dataset,
      at: dataset.timeRange.start,
    });
    assert.equal(decision.ok, true);
    if (!decision.ok) throw new Error('decision');
    const withOutcome = ctx.promotion.observeForwardOutcome({
      decision: decision.value,
      outcome: {
        observedAt: asUtcInstant('2026-01-02T00:00:00.000Z'),
        marketTerms: { 'SIM-ETF-1': '10020' },
        outcomeKind: 'NEUTRAL',
        notes: 'subsequent market observation recorded',
      },
    });
    assert.equal(withOutcome.ok, true);
    const blocked = ctx.promotion.observeForwardOutcome({
      decision: withOutcome.ok ? withOutcome.value : decision.value,
      outcome: {
        observedAt: asUtcInstant('2026-01-03T00:00:00.000Z'),
        marketTerms: { 'SIM-ETF-1': '10050' },
        outcomeKind: 'FAVORABLE',
        notes: 'retroactive edit attempt',
      },
    });
    assert.equal(blocked.ok, false);
  });

  it('7. insufficient forward evidence blocks paper', () => {
    const ctx = harness();
    assert.equal(registerCapsuleWithLab(ctx).ok, true);
    assert.equal(ctx.promotion.assessEvaluationEligibility('str_two_etf_cash', 'v1').ok, true);
    assert.equal(runEvaluation(ctx).ok, true);
    assert.equal(
      ctx.promotion.promoteToShadowEligible({
        actor: ctx.actor,
        strategyId: 'str_two_etf_cash',
        version: 'v1',
        reason: 'shadow',
      }).ok,
      true,
    );
    const run = ctx.promotion.startForwardShadow({
      strategyId: 'str_two_etf_cash',
      version: 'v1',
      observationRef: 'obs_forward_fixture',
    });
    if (!run.ok) throw new Error('run');
    const summary = ctx.promotion.completeForwardShadow({ run: run.value });
    assert.equal(summary.ok, true);
    if (!summary.ok) throw new Error('summary');
    const paper = ctx.promotion.promoteToPaperEligible({
      actor: ctx.actor,
      strategyId: 'str_two_etf_cash',
      version: 'v1',
      shadow: summary.value,
      reason: 'insufficient forward evidence',
    });
    assert.equal(paper.ok, false);
  });

  it('8. qualified forward evidence permits PAPER_ELIGIBLE', () => {
    const ctx = harness();
    const dataset = syntheticTwoEtfDataset();
    assert.equal(registerCapsuleWithLab(ctx).ok, true);
    assert.equal(ctx.promotion.assessEvaluationEligibility('str_two_etf_cash', 'v1').ok, true);
    assert.equal(runEvaluation(ctx).ok, true);
    assert.equal(
      ctx.promotion.promoteToShadowEligible({
        actor: ctx.actor,
        strategyId: 'str_two_etf_cash',
        version: 'v1',
        reason: 'shadow',
      }).ok,
      true,
    );
    const run = ctx.promotion.startForwardShadow({
      strategyId: 'str_two_etf_cash',
      version: 'v1',
      observationRef: 'obs_forward_fixture',
    });
    if (!run.ok) throw new Error('run');
    const spec = ctx.lab.store.getSpecification('str_two_etf_cash', 'v1');
    if (!spec) throw new Error('spec');
    const timestamps = [
      dataset.timeRange.start,
      asUtcInstant('2026-01-02T00:00:00.000Z'),
      asUtcInstant('2026-01-03T00:00:00.000Z'),
      asUtcInstant('2026-01-04T00:00:00.000Z'),
      asUtcInstant('2026-01-05T00:00:00.000Z'),
    ];
    for (const at of timestamps) {
      const decision = ctx.promotion.recordForwardDecision({
        run: run.value,
        specification: spec,
        dataset,
        at,
        estimatedCostsMinor: 10n,
      });
      assert.equal(decision.ok, true);
      if (decision.ok && decision.value.subsequentOutcome === null) {
        assert.equal(
          ctx.promotion.observeForwardOutcome({
            decision: decision.value,
            outcome: {
              observedAt: at,
              marketTerms: { 'SIM-ETF-1': '10000' },
              outcomeKind: 'NEUTRAL',
              notes: 'forward outcome',
            },
          }).ok,
          true,
        );
      }
    }
    ctx.clock.advanceMs(4n * 24n * 60n * 60n * 1000n);
    const summary = ctx.promotion.completeForwardShadow({ run: run.value });
    assert.equal(summary.ok, true);
    if (!summary.ok) throw new Error('summary');
    const paper = ctx.promotion.promoteToPaperEligible({
      actor: ctx.actor,
      strategyId: 'str_two_etf_cash',
      version: 'v1',
      shadow: summary.value,
      reason: 'forward shadow evidence sufficient',
    });
    assert.equal(paper.ok, true);
    if (paper.ok) {
      assert.equal(paper.value.promotionState, 'PAPER_ELIGIBLE');
      assert.ok(paper.value.expiresAt);
    }
  });

  it('9. strategy change requires new version/requalification', () => {
    const ctx = harness();
    assert.equal(registerCapsuleWithLab(ctx).ok, true);
    assert.equal(ctx.promotion.assessEvaluationEligibility('str_two_etf_cash', 'v1').ok, true);
    assert.equal(runEvaluation(ctx).ok, true);
    assert.equal(
      ctx.promotion.promoteToShadowEligible({
        actor: ctx.actor,
        strategyId: 'str_two_etf_cash',
        version: 'v1',
        reason: 'shadow',
      }).ok,
      true,
    );
    const v2spec = { ...equalWeightSpec(), version: 'v2' as never, cashAllocationBps: 1500 };
    assert.equal(ctx.lab.createDraft({ specification: v2spec }).ok, true);
    const compiled = ctx.lab.compile('str_two_etf_cash', 'v2', ctx.budget);
    assert.equal(compiled.ok, true);
    const spec = ctx.lab.store.getSpecification('str_two_etf_cash', 'v2');
    if (!spec || !compiled.ok) throw new Error('v2');
    const v2 = ctx.promotion.registerCapsule({
      specification: spec,
      plan: compiled.value,
      evidenceRefs: [{ evidenceKind: 'VALIDATION', refId: 'v2', hash: 'v2' }],
      subjectId: 'cust_h18_a',
    });
    assert.equal(v2.ok, true);
    if (v2.ok) {
      assert.equal(v2.value.fingerprint !== ctx.promotion.store.getCapsule('str_two_etf_cash', 'v1')?.fingerprint, true);
      assert.equal(ctx.promotion.getQualificationStatus('str_two_etf_cash', 'v2')?.promotionState, 'RESEARCH');
    }
  });

  it('10. model-version change invalidates eligibility as policy requires', () => {
    const ctx = harness();
    assert.equal(registerCapsuleWithLab(ctx).ok, true);
    assert.equal(ctx.promotion.assessEvaluationEligibility('str_two_etf_cash', 'v1').ok, true);
    assert.equal(runEvaluation(ctx).ok, true);
    assert.equal(
      ctx.promotion.promoteToShadowEligible({
        actor: ctx.actor,
        strategyId: 'str_two_etf_cash',
        version: 'v1',
        reason: 'shadow',
      }).ok,
      true,
    );
    const demoted = ctx.promotion.demote({
      actor: ctx.actor,
      strategyId: 'str_two_etf_cash',
      version: 'v1',
      trigger: 'MODEL_VERSION_CHANGED',
      reason: 'model version changed after shadow eligibility',
    });
    assert.equal(demoted.ok, true);
    if (demoted.ok) {
      assert.equal(demoted.value.promotionState, 'REVIEW_REQUIRED');
    }
  });

  it('11. expired strategy blocks activation', () => {
    const clock = new FrozenClock(asUtcInstant('2026-09-17T08:00:00.000Z'));
    const keys = createSimulationKeyProvider({ clock: { now: () => clock.now() } });
    const events = new DomainEventLog();
    const evidence = new EvidenceVault(clock);
    const identity = new SimulatedIdentityAdapter({ clock, keys, events });
    identity.provisionSimulatedActor({
      actorId: 'operator_h18_exp',
      jurisdiction: asJurisdiction('US'),
      identityId: 'id_h18_exp',
      customerId: asCustomerId('cust_h18_exp'),
      capabilities: ['VIEW_ACCOUNT'],
    });
    const actor = identity.service.resolveActorContext('operator_h18_exp');
    if (!actor.ok) throw new Error('actor');
    const registry = new ModelRegistry();
    seedCanonicalRiskModel(registry, actor.value, NOW);
    const risk = new RiskEngine({ clock, registry, events, evidence });
    const lab = new StrategyLab({ clock, risk, registry, events, evidence });
    const policy = createQualificationPolicy({ paperEligibilityExpiryDays: 1 });
    const promotion = new StrategyPromotionService({ clock, evidence, policy });
    const budget = defaultSimulationBudget({ subjectId: 'cust_h18_exp', portfolioId: 'inv_exp', reviewBy: NOW });
    risk.putBudget(budget);
    const ctx = {
      clock,
      lab,
      promotion,
      actor: actor.value,
      qlsvc: { actorId: 'qlsvc_promotion', subjectId: 'cust_h18_exp', sessionId: 'sess' },
      budget,
      evidence,
    };
    assert.equal(registerCapsuleWithLab(ctx, 'cust_h18_exp').ok, true);
    const status = ctx.promotion.getQualificationStatus('str_two_etf_cash', 'v1');
    assert.ok(status);
    ctx.promotion.store.putPromotion({
      ...status!,
      promotionState: 'PAPER_ELIGIBLE',
      expiresAt: asUtcInstant('2026-09-18T08:00:00.000Z'),
      updatedAt: NOW,
    });
    clock.advanceMs(2n * 24n * 60n * 60n * 1000n);
    const expired = ctx.promotion.checkExpiration('str_two_etf_cash', 'v1');
    assert.equal(expired.ok, true);
    if (expired.ok && expired.value) {
      assert.equal(expired.value.promotionState, 'REVIEW_REQUIRED');
    }
  });

  it('12. demotion preserves history', () => {
    const ctx = harness();
    assert.equal(registerCapsuleWithLab(ctx).ok, true);
    assert.equal(runEvaluation(ctx).ok, true);
    const before = ctx.promotion.store.listEvidence('str_two_etf_cash', 'v1').length;
    assert.equal(
      ctx.promotion.promoteToShadowEligible({
        actor: ctx.actor,
        strategyId: 'str_two_etf_cash',
        version: 'v1',
        reason: 'shadow',
      }).ok,
      true,
    );
    assert.equal(
      ctx.promotion.demote({
        actor: ctx.actor,
        strategyId: 'str_two_etf_cash',
        version: 'v1',
        trigger: 'PERFORMANCE_LIMIT_BREACHED',
        reason: 'performance limit breached in shadow',
      }).ok,
      true,
    );
    const after = ctx.promotion.store.listEvidence('str_two_etf_cash', 'v1');
    assert.ok(after.length >= before);
    assert.ok(ctx.promotion.store.snapshot().demotions.length >= 1);
    assert.ok(ctx.promotion.store.snapshot().qualifications.length >= 1);
  });

  it('13. exact qualification-policy version persisted', () => {
    const ctx = harness();
    const policy = createQualificationPolicy({ minimumEvaluationDays: 10 });
    ctx.promotion.setPolicy(policy);
    assert.equal(registerCapsuleWithLab(ctx).ok, true);
    assert.equal(ctx.promotion.assessEvaluationEligibility('str_two_etf_cash', 'v1').ok, true);
    const status = ctx.promotion.getQualificationStatus('str_two_etf_cash', 'v1');
    assert.ok(status);
    assert.equal(status!.policyHash, policy.policyHash);
    assert.equal(status!.policyVersion, policy.version);
    const evidence = ctx.promotion.store.listEvidence('str_two_etf_cash', 'v1');
    assert.ok(evidence.some((row) => row.policyHash === policy.policyHash));
  });

  it('14. paper eligibility does not mean live eligibility', () => {
    const ctx = harness();
    assert.equal(registerCapsuleWithLab(ctx).ok, true);
    ctx.promotion.store.putPromotion({
      strategyId: 'str_two_etf_cash',
      strategyVersion: 'v1',
      subjectId: 'cust_h18_a',
      capsuleId: 'scap_test',
      capsuleFingerprint: 'fp_test',
      promotionState: 'PAPER_ELIGIBLE',
      policyId: ctx.promotion.store.snapshot().policies[0]!.policyId,
      policyVersion: 'qual-policy-v1',
      policyHash: ctx.promotion.store.snapshot().policies[0]!.policyHash,
      expiresAt: null,
      updatedAt: NOW,
    });
    const capsule = ctx.promotion.store.getCapsule('str_two_etf_cash', 'v1');
    const observation = observeH14CapsuleQualification({
      promotion: ctx.promotion.getQualificationStatus('str_two_etf_cash', 'v1') ?? null,
      capsule: capsule ?? null,
      observedAt: NOW,
    });
    assert.equal(observation.paperEligible, true);
    assert.equal(observation.liveEligible, false);
  });

  it('15. restart persistence', async (t) => {
    if (!persistenceAvailable()) {
      t.skip('SUNREY_PERSISTENCE_TEST is not set');
      return;
    }
    const ctx = harness('cust_h18_pg');
    assert.equal(registerCapsuleWithLab(ctx, 'cust_h18_pg').ok, true);
    assert.equal(ctx.promotion.assessEvaluationEligibility('str_two_etf_cash', 'v1').ok, true);
    const env = await preparePersistence();
    const pools = createPersistencePools(env);
    await persistStrategyPromotionState(pools.customer, ctx.promotion.store.snapshot());
    const rows = await pools.customer.query(
      'SELECT promotion_state, policy_hash FROM strategy_lab.promotion_record WHERE strategy_id = $1',
      ['str_two_etf_cash'],
    );
    assert.equal(rows.rowCount, 1);
    assert.equal(rows.rows[0]?.promotion_state, 'EVALUATION_ELIGIBLE');
    assert.ok(rows.rows[0]?.policy_hash);
    await closePersistencePools(pools);
  });

  it('16. customer isolation for customer-private strategies', () => {
    const ctxA = harness('cust_h18_a');
    const ctxB = harness('cust_h18_b');
    assert.equal(registerCapsuleWithLab(ctxA, 'cust_h18_a').ok, true);
    assert.equal(registerCapsuleWithLab(ctxB, 'cust_h18_b').ok, true);
    const statusA = ctxA.promotion.getQualificationStatus('str_two_etf_cash', 'v1');
    const statusB = ctxB.promotion.getQualificationStatus('str_two_etf_cash', 'v1');
    assert.ok(statusA);
    assert.ok(statusB);
    assert.equal(statusA!.subjectId, 'cust_h18_a');
    assert.equal(statusB!.subjectId, 'cust_h18_b');
    assert.equal(ctxA.promotion.store.getPromotion('str_two_etf_cash', 'v1')?.subjectId, 'cust_h18_a');
    assert.equal(ctxB.promotion.store.getPromotion('str_two_etf_cash', 'v1')?.subjectId, 'cust_h18_b');
  });

  it('architecture guard blocks unauthorized authoritative promotion emitters', () => {
    const findings = lintStrategyPromotionAuthority('/workspace');
    assert.equal(findings.length, 0);
  });

  it('observes first H14 Strategy Capsule qualification status', () => {
    const ctx = harness();
    const unregistered = observeH14CapsuleQualification({ observedAt: NOW });
    assert.equal(unregistered.promotionState, 'UNREGISTERED');
    assert.equal(unregistered.liveEligible, false);
    registerCapsuleWithLab(ctx);
    const compiled = ctx.lab.compile('str_two_etf_cash', 'v1', ctx.budget);
    const h14Observation = observeH14CapsuleQualification({
      promotion: ctx.promotion.getQualificationStatus('str_two_etf_cash', 'v1') ?? null,
      capsule: ctx.promotion.store.getCapsule('str_two_etf_cash', 'v1') ?? null,
      observedAt: NOW,
    });
    assert.equal(h14Observation.strategyId, HELIOS_H14_STRATEGY_CAPSULE_ID);
    assert.equal(h14Observation.version, HELIOS_H14_STRATEGY_CAPSULE_VERSION);
    assert.equal(h14Observation.promotionState, 'RESEARCH');
    assert.equal(compiled.ok, true);
  });

  it('mesh may recommend but not promote', () => {
    const ctx = harness();
    assert.equal(registerCapsuleWithLab(ctx).ok, true);
    const rec = ctx.promotion.recommendPromotion({
      actorId: 'mesh_research_bot',
      strategyId: 'str_two_etf_cash',
      version: 'v1',
      target: 'SHADOW',
      reason: 'evaluation metrics look acceptable for human review',
    });
    assert.equal(rec.ok, true);
    const blocked = ctx.promotion.promoteToShadowEligible({
      actor: { actorId: 'mesh_research_bot', subjectId: 'cust_h18_a', sessionId: 'sess_mesh' },
      strategyId: 'str_two_etf_cash',
      version: 'v1',
      reason: 'mesh attempted promotion',
    });
    assert.equal(blocked.ok, false);
  });
});
