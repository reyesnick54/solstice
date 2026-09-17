import type { Clock } from '../../config/src/clock.ts';
import { err, ok, type Result } from '../../domain/src/result.ts';
import type { UtcInstant } from '../../domain/src/time.ts';
import type { EvidenceVault } from '../../evidence/src/vault.ts';
import type { BacktestRun } from './backtest.ts';
import type { SimulationPlan } from './compiler.ts';
import {
  freezePromotionCapsule,
  type PromotionCapsule,
  type PromotionCapsuleEvidenceRef,
} from './promotion-capsule.ts';
import type { MarketDataset } from './dataset.ts';
import { buildDemotionRecord, evaluateDemotionTrigger, requiresRequalification, type DemotionTrigger } from './demotion.ts';
import { evaluateQualification } from './evaluation-qualification.ts';
import {
  attachForwardShadowOutcome,
  recordForwardShadowDecision,
  startForwardShadowRun,
  summarizeForwardShadowEvidence,
  type ForwardShadowDecision,
  type ForwardShadowOutcome,
  type ForwardShadowRun,
} from './forward-shadow.ts';
import {
  assertAuthoritativePromotion,
  canEmitPromotionDecision,
  classifyPromotionActor,
  recordPromotionRecommendation,
} from './promotion-authority.ts';
import { sealPromotionEvidence, type PromotionEvidenceRecord } from './promotion-evidence.ts';
import { gateEvaluationToShadow, gateResearchToEvaluation, gateShadowToPaper } from './promotion-gates.ts';
import { StrategyPromotionStore, type StrategyPromotionRecord } from './promotion-store.ts';
import {
  transitionPromotionState,
  type PromotionDecisionKind,
  type StrategyPromotionState,
} from './promotion-state.ts';
import { DEFAULT_QUALIFICATION_POLICY, type QualificationPolicy } from './qualification-policy.ts';
import type { StrategySpecification } from './specification.ts';
import type { StrategyFailure } from './types.ts';
import type { StrategyValidationReport } from './validation.ts';
import type { ForwardShadowEvidenceSummary } from './forward-shadow.ts';
import type { GateResult } from './promotion-gates.ts';
import type { EvaluationQualificationResult } from './evaluation-qualification.ts';

function addDays(instant: UtcInstant, days: number): UtcInstant {
  const date = new Date(instant);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString() as UtcInstant;
}

export class StrategyPromotionService {
  readonly store: StrategyPromotionStore;
  private readonly clock: Clock;
  private readonly evidence: EvidenceVault | undefined;
  private policy: QualificationPolicy;

  constructor(input?: {
    readonly clock: Clock;
    readonly store?: StrategyPromotionStore;
    readonly evidence?: EvidenceVault;
    readonly policy?: QualificationPolicy;
  }) {
    if (!input?.clock) {
      throw new Error('StrategyPromotionService requires a clock');
    }
    this.clock = input.clock;
    this.store = input.store ?? new StrategyPromotionStore();
    this.evidence = input.evidence;
    this.policy = input.policy ?? DEFAULT_QUALIFICATION_POLICY;
    this.store.putPolicy(this.policy);
  }

  setPolicy(policy: QualificationPolicy): void {
    this.policy = policy;
    this.store.putPolicy(policy);
  }

  registerCapsule(input: {
    readonly specification: StrategySpecification;
    readonly plan?: SimulationPlan | null;
    readonly evidenceRefs?: readonly PromotionCapsuleEvidenceRef[];
    readonly subjectId: string;
  }): Result<PromotionCapsule, StrategyFailure> {
    const capsule = freezePromotionCapsule({
      specification: input.specification,
      plan: input.plan ?? null,
      ...(input.evidenceRefs !== undefined ? { evidenceRefs: input.evidenceRefs } : {}),
      subjectId: input.subjectId,
      frozenAt: this.clock.now(),
    });
    if (!capsule.ok) {
      return capsule;
    }
    this.store.putCapsule(capsule.value);
    this.store.putPromotion({
      strategyId: capsule.value.strategyId,
      strategyVersion: capsule.value.version,
      subjectId: input.subjectId,
      capsuleId: capsule.value.capsuleId,
      capsuleFingerprint: capsule.value.fingerprint,
      promotionState: 'RESEARCH',
      policyId: this.policy.policyId,
      policyVersion: this.policy.version,
      policyHash: this.policy.policyHash,
      expiresAt: null,
      updatedAt: this.clock.now(),
    });
    return capsule;
  }

  assessEvaluationEligibility(strategyId: string, version: string): Result<StrategyPromotionRecord, StrategyFailure> {
    const capsule = this.store.getCapsule(strategyId, version);
    const current = this.store.getPromotion(strategyId, version);
    if (!capsule || !current) {
      return err({ code: 'UNVERSIONED_STRATEGY', message: 'Strategy Capsule is missing' });
    }
    const gate = gateResearchToEvaluation({ capsule, policy: this.policy });
    if (!gate.ok) {
      return gate;
    }
    if (!gate.value.passed) {
      return err({
        code: 'PROMOTION_GATE_FAILED',
        message: `Gate 1 failed: ${gate.value.missing.join(', ')}`,
      });
    }
    return this.transition({
      strategyId,
      version,
      to: 'EVALUATION_ELIGIBLE',
      kind: 'GATE_PASSED',
      gate: gate.value,
      actorId: 'qlsvc_promotion',
      actorKind: 'QUALIFICATION_SERVICE',
    });
  }

  recordEvaluationQualification(input: {
    readonly strategyId: string;
    readonly version: string;
    readonly validation: StrategyValidationReport;
    readonly outOfSample?: BacktestRun | null;
    readonly reproducibilityHash?: string | null;
    readonly priorReproducibilityHash?: string | null;
    readonly limitationsAccepted?: boolean;
  }): Result<StrategyPromotionRecord, StrategyFailure> {
    const capsule = this.store.getCapsule(input.strategyId, input.version);
    const current = this.store.getPromotion(input.strategyId, input.version);
    if (!capsule || !current) {
      return err({ code: 'UNVERSIONED_STRATEGY', message: 'Strategy Capsule is missing' });
    }
    const qualification = evaluateQualification({
      capsule,
      policy: this.policy,
      validation: input.validation,
      ...(input.outOfSample !== undefined ? { outOfSample: input.outOfSample } : {}),
      ...(input.reproducibilityHash !== undefined ? { reproducibilityHash: input.reproducibilityHash } : {}),
      ...(input.priorReproducibilityHash !== undefined
        ? { priorReproducibilityHash: input.priorReproducibilityHash }
        : {}),
      ...(input.limitationsAccepted !== undefined ? { limitationsAccepted: input.limitationsAccepted } : {}),
      generatedAt: this.clock.now(),
    });
    if (!qualification.ok) {
      return qualification;
    }
    this.store.putQualification(qualification.value);
    if (current.promotionState === 'RESEARCH') {
      const eligible = this.assessEvaluationEligibility(input.strategyId, input.version);
      if (!eligible.ok) {
        return eligible;
      }
    }
    const to: StrategyPromotionState = qualification.value.passed ? 'EVALUATED' : 'REVIEW_REQUIRED';
    return this.transition({
      strategyId: input.strategyId,
      version: input.version,
      to,
      kind: qualification.value.passed ? 'GATE_PASSED' : 'GATE_FAILED',
      qualification: qualification.value,
      actorId: 'qlsvc_promotion',
      actorKind: 'QUALIFICATION_SERVICE',
    });
  }

  promoteToShadowEligible(input: {
    readonly actor: unknown;
    readonly strategyId: string;
    readonly version: string;
    readonly reason: string;
  }): Result<StrategyPromotionRecord, StrategyFailure> {
    const auth = assertAuthoritativePromotion({
      actor: input.actor,
      decisionKind: 'PROMOTED_TO_SHADOW',
      reason: input.reason,
    });
    if (!auth.ok) {
      return auth;
    }
    const qualification = this.store.getLatestQualification(input.strategyId, input.version);
    if (!qualification) {
      return err({ code: 'PROMOTION_GATE_FAILED', message: 'evaluation qualification is required' });
    }
    const gate = gateEvaluationToShadow({ qualification, policy: this.policy });
    if (!gate.ok) {
      return gate;
    }
    if (!gate.value.passed) {
      return err({
        code: 'PROMOTION_GATE_FAILED',
        message: `Gate 2 failed: ${gate.value.missing.join(', ')}`,
      });
    }
    return this.transition({
      strategyId: input.strategyId,
      version: input.version,
      to: 'SHADOW_ELIGIBLE',
      kind: 'PROMOTED_TO_SHADOW',
      gate: gate.value,
      qualification,
      actorId: auth.value.actorId,
      actorKind: auth.value.actorKind,
      humanApproved: auth.value.actorKind === 'HUMAN_GOVERNANCE',
    });
  }

  startForwardShadow(input: {
    readonly strategyId: string;
    readonly version: string;
    readonly observationRef: string;
    readonly modelVersions?: readonly string[];
  }): Result<ForwardShadowRun, StrategyFailure> {
    const capsule = this.store.getCapsule(input.strategyId, input.version);
    const current = this.store.getPromotion(input.strategyId, input.version);
    if (!capsule || !current) {
      return err({ code: 'UNVERSIONED_STRATEGY', message: 'Strategy Capsule is missing' });
    }
    if (current.promotionState !== 'SHADOW_ELIGIBLE' && current.promotionState !== 'SHADOW_ACTIVE') {
      return err({ code: 'INVALID_TRANSITION', message: 'forward shadow requires SHADOW_ELIGIBLE' });
    }
    const run = startForwardShadowRun({
      capsule,
      observationRef: input.observationRef,
      startedAt: this.clock.now(),
      ...(input.modelVersions !== undefined ? { modelVersions: input.modelVersions } : {}),
    });
    this.store.putForwardShadowRun(run);
    if (current.promotionState === 'SHADOW_ELIGIBLE') {
      const moved = this.transition({
        strategyId: input.strategyId,
        version: input.version,
        to: 'SHADOW_ACTIVE',
        kind: 'GATE_PASSED',
        actorId: 'qlsvc_promotion',
        actorKind: 'QUALIFICATION_SERVICE',
      });
      if (!moved.ok) {
        return moved;
      }
    }
    return ok(run);
  }

  recordForwardDecision(input: {
    readonly run: ForwardShadowRun;
    readonly specification: StrategySpecification;
    readonly dataset: MarketDataset;
    readonly at: UtcInstant;
    readonly estimatedCostsMinor?: bigint;
  }): Result<ForwardShadowDecision, StrategyFailure> {
    const decision = recordForwardShadowDecision(input);
    this.store.putForwardShadowDecision(decision);
    return ok(decision);
  }

  observeForwardOutcome(input: {
    readonly decision: ForwardShadowDecision;
    readonly outcome: ForwardShadowOutcome;
  }): Result<ForwardShadowDecision, StrategyFailure> {
    const updated = attachForwardShadowOutcome({
      decision: input.decision,
      outcome: input.outcome,
      recordedAt: this.clock.now(),
    });
    if (!updated.ok) {
      return updated;
    }
    this.store.putForwardShadowDecision(updated.value);
    return updated;
  }

  completeForwardShadow(input: {
    readonly run: ForwardShadowRun;
    readonly costSensitivityPassed?: boolean;
  }): Result<ForwardShadowEvidenceSummary, StrategyFailure> {
    const completed = Object.freeze({
      ...input.run,
      completedAt: this.clock.now(),
    });
    this.store.updateForwardShadowRun(completed);
    const decisions = this.store.listForwardShadowDecisions(input.run.runId);
    return ok(
      summarizeForwardShadowEvidence({
        run: completed,
        decisions,
        completedAt: this.clock.now(),
        ...(input.costSensitivityPassed !== undefined
          ? { costSensitivityPassed: input.costSensitivityPassed }
          : {}),
      }),
    );
  }

  promoteToPaperEligible(input: {
    readonly actor: unknown;
    readonly strategyId: string;
    readonly version: string;
    readonly shadow: ReturnType<typeof summarizeForwardShadowEvidence>;
    readonly reason: string;
  }): Result<StrategyPromotionRecord, StrategyFailure> {
    const auth = assertAuthoritativePromotion({
      actor: input.actor,
      decisionKind: 'PROMOTED_TO_PAPER',
      reason: input.reason,
    });
    if (!auth.ok) {
      return auth;
    }
    const gate = gateShadowToPaper({ shadow: input.shadow, policy: this.policy });
    if (!gate.ok) {
      return gate;
    }
    if (!gate.value.passed) {
      return err({
        code: 'PROMOTION_GATE_FAILED',
        message: `Gate 3 failed: ${gate.value.missing.join(', ')}`,
      });
    }
    const expiresAt = addDays(this.clock.now(), this.policy.paperEligibilityExpiryDays);
    const moved = this.transition({
      strategyId: input.strategyId,
      version: input.version,
      to: 'PAPER_ELIGIBLE',
      kind: 'PROMOTED_TO_PAPER',
      gate: gate.value,
      shadow: input.shadow,
      actorId: auth.value.actorId,
      actorKind: auth.value.actorKind,
      humanApproved: auth.value.actorKind === 'HUMAN_GOVERNANCE',
      expiresAt,
    });
    return moved;
  }

  recommendPromotion(input: {
    readonly actorId: string;
    readonly strategyId: string;
    readonly version: string;
    readonly target: 'SHADOW' | 'PAPER';
    readonly reason: string;
  }): Result<PromotionEvidenceRecord, StrategyFailure> {
    const allowed = canEmitPromotionDecision({
      actorId: input.actorId,
      decisionKind: 'PROMOTION_RECOMMENDED',
    });
    if (!allowed.ok) {
      return allowed;
    }
    const rec = recordPromotionRecommendation({
      actorId: input.actorId,
      target: input.target,
      reason: input.reason,
    });
    if (!rec.ok) {
      return rec;
    }
    const capsule = this.store.getCapsule(input.strategyId, input.version);
    const current = this.store.getPromotion(input.strategyId, input.version);
    if (!capsule || !current) {
      return err({ code: 'UNVERSIONED_STRATEGY', message: 'Strategy Capsule is missing' });
    }
    const evidence = sealPromotionEvidence({
      kind: 'PROMOTION_RECOMMENDED',
      capsule,
      fromState: current.promotionState,
      toState: current.promotionState,
      policy: this.policy,
      actorId: input.actorId,
      actorKind: classifyPromotionActor(input.actorId),
      decidedAt: this.clock.now(),
    });
    this.store.putEvidence(evidence);
    this.seal('PROMOTION_RECOMMENDED', evidence);
    return ok(evidence);
  }

  demote(input: {
    readonly actor: unknown;
    readonly strategyId: string;
    readonly version: string;
    readonly trigger: DemotionTrigger;
    readonly reason: string;
  }): Result<StrategyPromotionRecord, StrategyFailure> {
    const auth = assertAuthoritativePromotion({
      actor: input.actor,
      decisionKind: 'DEMOTED',
      reason: input.reason,
    });
    if (!auth.ok) {
      return auth;
    }
    const current = this.store.getPromotion(input.strategyId, input.version);
    const capsule = this.store.getCapsule(input.strategyId, input.version);
    if (!current || !capsule) {
      return err({ code: 'UNVERSIONED_STRATEGY', message: 'Strategy Capsule is missing' });
    }
    const toState =
      evaluateDemotionTrigger({
        currentState: current.promotionState,
        trigger: input.trigger,
        now: this.clock.now(),
        expiresAt: current.expiresAt as UtcInstant | null,
      }) ?? 'PAUSED';
    const demotion = buildDemotionRecord({
      strategyId: input.strategyId,
      strategyVersion: input.version,
      capsuleFingerprint: capsule.fingerprint,
      fromState: current.promotionState,
      toState: toState === 'PAUSED' ? 'PAUSED' : 'REVIEW_REQUIRED',
      trigger: input.trigger,
      reason: input.reason,
      actorId: auth.value.actorId,
      decidedAt: this.clock.now(),
      policyId: this.policy.policyId,
      policyHash: this.policy.policyHash,
    });
    this.store.putDemotion(demotion);
    const nextState: StrategyPromotionState =
      toState === 'PAUSED' ? 'PAUSED' : 'REVIEW_REQUIRED';
    if (requiresRequalification(input.trigger)) {
      const requalifyTarget: StrategyPromotionState =
        current.promotionState === 'REVIEW_REQUIRED' || current.promotionState === 'PAUSED'
          ? 'RESEARCH'
          : 'REVIEW_REQUIRED';
      return this.transition({
        strategyId: input.strategyId,
        version: input.version,
        to: requalifyTarget,
        kind: 'REQUALIFICATION_REQUIRED',
        actorId: auth.value.actorId,
        actorKind: auth.value.actorKind,
      });
    }
    return this.transition({
      strategyId: input.strategyId,
      version: input.version,
      to: nextState,
      kind: 'DEMOTED',
      actorId: auth.value.actorId,
      actorKind: auth.value.actorKind,
    });
  }

  checkExpiration(strategyId: string, version: string): Result<StrategyPromotionRecord | null, StrategyFailure> {
    const current = this.store.getPromotion(strategyId, version);
    if (!current?.expiresAt) {
      return ok(null);
    }
    if (this.clock.now() < (current.expiresAt as UtcInstant)) {
      return ok(current);
    }
    const capsule = this.store.getCapsule(strategyId, version);
    if (!capsule) {
      return err({ code: 'UNVERSIONED_STRATEGY', message: 'Strategy Capsule is missing' });
    }
    const demotion = buildDemotionRecord({
      strategyId,
      strategyVersion: version,
      capsuleFingerprint: capsule.fingerprint,
      fromState: current.promotionState as StrategyPromotionState,
      toState: 'REVIEW_REQUIRED',
      trigger: 'VALIDITY_PERIOD_EXPIRED',
      reason: 'paper eligibility expired per qualification policy',
      actorId: 'qlsvc_promotion',
      decidedAt: this.clock.now(),
      policyId: this.policy.policyId,
      policyHash: this.policy.policyHash,
    });
    this.store.putDemotion(demotion);
    return this.transition({
      strategyId,
      version,
      to: 'REVIEW_REQUIRED',
      kind: 'DEMOTED',
      actorId: 'qlsvc_promotion',
      actorKind: 'QUALIFICATION_SERVICE',
    });
  }

  getQualificationStatus(strategyId: string, version: string): StrategyPromotionRecord | undefined {
    return this.store.getPromotion(strategyId, version);
  }

  private transition(input: {
    readonly strategyId: string;
    readonly version: string;
    readonly to: StrategyPromotionState;
    readonly kind: PromotionDecisionKind;
    readonly gate?: GateResult | null;
    readonly qualification?: EvaluationQualificationResult | null;
    readonly shadow?: ForwardShadowEvidenceSummary | null;
    readonly actorId: string;
    readonly actorKind: string;
    readonly humanApproved?: boolean;
    readonly expiresAt?: UtcInstant | null;
  }): Result<StrategyPromotionRecord, StrategyFailure> {
    const current = this.store.getPromotion(input.strategyId, input.version);
    const capsule = this.store.getCapsule(input.strategyId, input.version);
    if (!current || !capsule) {
      return err({ code: 'UNVERSIONED_STRATEGY', message: 'Strategy Capsule is missing' });
    }
    const nextState = transitionPromotionState(current.promotionState as StrategyPromotionState, input.to);
    if (!nextState.ok) {
      return nextState;
    }
    const record: StrategyPromotionRecord = Object.freeze({
      ...current,
      promotionState: nextState.value,
      policyId: this.policy.policyId,
      policyVersion: this.policy.version,
      policyHash: this.policy.policyHash,
      expiresAt: input.expiresAt ?? current.expiresAt,
      updatedAt: this.clock.now(),
    });
    this.store.putPromotion(record);
    const evidence = sealPromotionEvidence({
      kind: input.kind,
      capsule,
      fromState: current.promotionState as StrategyPromotionState,
      toState: nextState.value,
      policy: this.policy,
      ...(input.gate !== undefined ? { gate: input.gate } : {}),
      ...(input.qualification !== undefined ? { qualification: input.qualification } : {}),
      ...(input.shadow !== undefined ? { shadow: input.shadow } : {}),
      actorId: input.actorId,
      actorKind: input.actorKind,
      ...(input.humanApproved !== undefined ? { humanApproved: input.humanApproved } : {}),
      decidedAt: this.clock.now(),
    });
    this.store.putEvidence(evidence);
    this.seal(input.kind, evidence);
    return ok(record);
  }

  private seal(kind: string, payload: Record<string, unknown>): void {
    this.evidence?.seal(kind, payload);
  }
}
