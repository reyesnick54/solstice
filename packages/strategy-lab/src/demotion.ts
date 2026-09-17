import { createHash } from 'node:crypto';

import { ok, type Result } from '../../domain/src/result.ts';
import type { UtcInstant } from '../../domain/src/time.ts';
import { asPromotionDecisionId, type PromotionDecisionId } from './ids.ts';
import type { StrategyPromotionState } from './promotion-state.ts';

export const DEMOTION_TRIGGERS = [
  'EVALUATION_ASSUMPTIONS_INVALIDATED',
  'MODEL_VERSION_CHANGED',
  'DATA_CONTRACT_CHANGED',
  'TRANSACTION_COSTS_CHANGED',
  'INSTRUMENT_UNIVERSE_CHANGED',
  'VALIDITY_PERIOD_EXPIRED',
  'PERFORMANCE_LIMIT_BREACHED',
  'DATA_QUALITY_PROBLEM',
  'EVALUATION_DEFECT_DISCOVERED',
  'CAPSULE_VERSION_CHANGED',
] as const;

export type DemotionTrigger = (typeof DEMOTION_TRIGGERS)[number];

export type DemotionRecord = {
  readonly decisionId: PromotionDecisionId;
  readonly strategyId: string;
  readonly strategyVersion: string;
  readonly capsuleFingerprint: string;
  readonly fromState: StrategyPromotionState;
  readonly toState: 'PAUSED' | 'REVIEW_REQUIRED';
  readonly trigger: DemotionTrigger;
  readonly reason: string;
  readonly priorEvidencePreserved: true;
  readonly actorId: string;
  readonly decidedAt: UtcInstant;
  readonly policyId: string;
  readonly policyHash: string;
};

export function evaluateDemotionTrigger(input: {
  readonly currentState: StrategyPromotionState;
  readonly trigger: DemotionTrigger;
  readonly now: UtcInstant;
  readonly expiresAt: UtcInstant | null;
}): StrategyPromotionState | null {
  if (input.expiresAt !== null && input.now >= input.expiresAt) {
    return 'REVIEW_REQUIRED';
  }
  if (
    input.currentState === 'PAPER_ACTIVE' ||
    input.currentState === 'PAPER_ELIGIBLE' ||
    input.currentState === 'SHADOW_ACTIVE' ||
    input.currentState === 'SHADOW_ELIGIBLE'
  ) {
    if (
      input.trigger === 'VALIDITY_PERIOD_EXPIRED' ||
      input.trigger === 'PERFORMANCE_LIMIT_BREACHED' ||
      input.trigger === 'EVALUATION_DEFECT_DISCOVERED' ||
      input.trigger === 'DATA_QUALITY_PROBLEM'
    ) {
      return 'REVIEW_REQUIRED';
    }
    if (
      input.trigger === 'MODEL_VERSION_CHANGED' ||
      input.trigger === 'DATA_CONTRACT_CHANGED' ||
      input.trigger === 'TRANSACTION_COSTS_CHANGED' ||
      input.trigger === 'INSTRUMENT_UNIVERSE_CHANGED' ||
      input.trigger === 'CAPSULE_VERSION_CHANGED' ||
      input.trigger === 'EVALUATION_ASSUMPTIONS_INVALIDATED'
    ) {
      return 'REVIEW_REQUIRED';
    }
  }
  return null;
}

export function buildDemotionRecord(input: {
  readonly strategyId: string;
  readonly strategyVersion: string;
  readonly capsuleFingerprint: string;
  readonly fromState: StrategyPromotionState;
  readonly toState: 'PAUSED' | 'REVIEW_REQUIRED';
  readonly trigger: DemotionTrigger;
  readonly reason: string;
  readonly actorId: string;
  readonly decidedAt: UtcInstant;
  readonly policyId: string;
  readonly policyHash: string;
}): Result<DemotionRecord, never> {
  const material = `${input.strategyId}@${input.strategyVersion}:${input.trigger}:${input.decidedAt}`;
  return ok(
    Object.freeze({
      decisionId: asPromotionDecisionId(
        `pdec_${createHash('sha256').update(material).digest('hex').slice(0, 20)}`,
      ),
      strategyId: input.strategyId,
      strategyVersion: input.strategyVersion,
      capsuleFingerprint: input.capsuleFingerprint,
      fromState: input.fromState,
      toState: input.toState,
      trigger: input.trigger,
      reason: input.reason,
      priorEvidencePreserved: true,
      actorId: input.actorId,
      decidedAt: input.decidedAt,
      policyId: input.policyId,
      policyHash: input.policyHash,
    }),
  );
}

export function requiresRequalification(trigger: DemotionTrigger): boolean {
  return (
    trigger === 'CAPSULE_VERSION_CHANGED' ||
    trigger === 'MODEL_VERSION_CHANGED' ||
    trigger === 'DATA_CONTRACT_CHANGED' ||
    trigger === 'TRANSACTION_COSTS_CHANGED' ||
    trigger === 'INSTRUMENT_UNIVERSE_CHANGED' ||
    trigger === 'EVALUATION_ASSUMPTIONS_INVALIDATED'
  );
}
