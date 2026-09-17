import { createHash } from 'node:crypto';

import type { UtcInstant } from '../../domain/src/time.ts';
import type { PromotionCapsule } from './promotion-capsule.ts';
import type { EvaluationQualificationResult } from './evaluation-qualification.ts';
import type { ForwardShadowEvidenceSummary } from './forward-shadow.ts';
import { asPromotionDecisionId, type PromotionDecisionId } from './ids.ts';
import type { GateResult } from './promotion-gates.ts';
import type { PromotionDecisionKind, StrategyPromotionState } from './promotion-state.ts';
import type { QualificationPolicy } from './qualification-policy.ts';

export type PromotionEvidenceRecord = {
  readonly decisionId: PromotionDecisionId;
  readonly kind: PromotionDecisionKind;
  readonly strategyId: string;
  readonly strategyVersion: string;
  readonly capsuleId: string;
  readonly capsuleFingerprint: string;
  readonly capsuleHash: string;
  readonly fromState: StrategyPromotionState;
  readonly toState: StrategyPromotionState;
  readonly policyId: string;
  readonly policyVersion: string;
  readonly policyHash: string;
  readonly gate: GateResult | null;
  readonly evaluationQualificationId: string | null;
  readonly shadowRunId: string | null;
  readonly metricValues: Readonly<Record<string, string | number | boolean>>;
  readonly passCriteria: readonly string[];
  readonly failCriteria: readonly string[];
  readonly actorId: string;
  readonly actorKind: string;
  readonly humanApprovalRequired: boolean;
  readonly humanApproved: boolean;
  readonly decidedAt: UtcInstant;
  readonly liveEligible: false;
};

function capsuleHash(capsule: PromotionCapsule): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        fingerprint: capsule.fingerprint,
        version: capsule.version,
        compiledHash: capsule.compiledHash,
      }),
    )
    .digest('hex');
}

export function sealPromotionEvidence(input: {
  readonly kind: PromotionDecisionKind;
  readonly capsule: PromotionCapsule;
  readonly fromState: StrategyPromotionState;
  readonly toState: StrategyPromotionState;
  readonly policy: QualificationPolicy;
  readonly gate?: GateResult | null;
  readonly qualification?: EvaluationQualificationResult | null;
  readonly shadow?: ForwardShadowEvidenceSummary | null;
  readonly actorId: string;
  readonly actorKind: string;
  readonly humanApproved?: boolean;
  readonly decidedAt: UtcInstant;
}): PromotionEvidenceRecord {
  const material = `${input.kind}:${input.capsule.capsuleId}:${input.fromState}:${input.toState}:${input.decidedAt}`;
  const metricValues: Record<string, string | number | boolean> = {};
  if (input.qualification) {
    metricValues.evaluationDays = input.qualification.metrics.evaluationDays;
    metricValues.opportunityCount = input.qualification.metrics.opportunityCount;
    metricValues.maxDrawdownBps = input.qualification.metrics.maxDrawdownBps;
    metricValues.passed = input.qualification.passed;
  }
  if (input.shadow) {
    metricValues.shadowDurationDays = input.shadow.durationDays;
    metricValues.shadowDecisionCount = input.shadow.decisionCount;
    metricValues.shadowNoActionCount = input.shadow.noActionCount;
    metricValues.shadowMaxDrawdownProxyBps = input.shadow.maxDrawdownProxyBps;
  }
  return Object.freeze({
    decisionId: asPromotionDecisionId(
      `pdec_${createHash('sha256').update(material).digest('hex').slice(0, 20)}`,
    ),
    kind: input.kind,
    strategyId: input.capsule.strategyId,
    strategyVersion: input.capsule.version,
    capsuleId: input.capsule.capsuleId,
    capsuleFingerprint: input.capsule.fingerprint,
    capsuleHash: capsuleHash(input.capsule),
    fromState: input.fromState,
    toState: input.toState,
    policyId: input.policy.policyId,
    policyVersion: input.policy.version,
    policyHash: input.policy.policyHash,
    gate: input.gate ?? null,
    evaluationQualificationId: input.qualification?.qualificationId ?? null,
    shadowRunId: input.shadow?.runId ?? null,
    metricValues: Object.freeze(metricValues),
    passCriteria: Object.freeze([...(input.qualification?.passCriteria ?? input.gate?.passed ? ['gate_passed'] : [])]),
    failCriteria: Object.freeze([...(input.qualification?.failCriteria ?? input.gate?.missing ?? [])]),
    actorId: input.actorId,
    actorKind: input.actorKind,
    humanApprovalRequired: input.policy.authorityRequired === 'HUMAN_GOVERNANCE',
    humanApproved: input.humanApproved ?? false,
    decidedAt: input.decidedAt,
    liveEligible: false,
  });
}
