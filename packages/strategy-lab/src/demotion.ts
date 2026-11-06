import { createHash } from 'node:crypto';

import type { UtcInstant } from '@solstice/domain';
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
  /** HELIOS EVOL11 — automatic champion / challenger decay (research track only). */
  'CHAMPION_PERFORMANCE_DECAY',
  'CHAMPION_FEATURE_DECAY',
  'REGIME_DRIFT_DETECTED',
  'CHAMPION_COST_DETERIORATION',
  'CHAMPION_CAPACITY_DETERIORATION',
  /** Governance-initiated removal from a champion role (research designation only). */
  'FORMAL_DEMOTION',
] as const;

export type DemotionTrigger = (typeof DEMOTION_TRIGGERS)[number];

export type DemotionToState = Extract<
  StrategyPromotionState,
  'PAUSED' | 'REVIEW_REQUIRED' | 'DEGRADED' | 'DEMOTED'
>;

export type DemotionRecord = {
  readonly decisionId: PromotionDecisionId;
  readonly strategyId: string;
  readonly strategyVersion: string;
  readonly capsuleFingerprint: string;
  readonly fromState: StrategyPromotionState;
  readonly toState: DemotionToState;
  readonly trigger: DemotionTrigger;
  readonly reason: string;
  readonly priorEvidencePreserved: true;
  readonly actorId: string;
  readonly decidedAt: UtcInstant;
  readonly policyId: string;
  readonly policyHash: string;
};

const RESEARCH_EXPOSURE_STATES: ReadonlySet<StrategyPromotionState> = new Set([
  'SHADOW_ELIGIBLE',
  'SHADOW_ACTIVE',
  'SHADOW_CHALLENGER',
  'PAPER_ELIGIBLE',
  'PAPER_ACTIVE',
  'PAPER_CHALLENGER',
]);

const CHAMPION_STATES: ReadonlySet<StrategyPromotionState> = new Set([
  'NICHE_CHAMPION',
  'GLOBAL_RESEARCH_CHAMPION',
]);

export function evaluateDemotionTrigger(input: {
  readonly currentState: StrategyPromotionState;
  readonly trigger: DemotionTrigger;
  readonly now: UtcInstant;
  readonly expiresAt: UtcInstant | null;
}): DemotionToState | null {
  if (input.expiresAt !== null && input.now >= input.expiresAt) {
    return 'REVIEW_REQUIRED';
  }

  if (CHAMPION_STATES.has(input.currentState)) {
    if (input.trigger === 'FORMAL_DEMOTION') {
      return 'DEMOTED';
    }
    if (
      input.trigger === 'CHAMPION_PERFORMANCE_DECAY' ||
      input.trigger === 'CHAMPION_FEATURE_DECAY' ||
      input.trigger === 'REGIME_DRIFT_DETECTED' ||
      input.trigger === 'CHAMPION_COST_DETERIORATION' ||
      input.trigger === 'CHAMPION_CAPACITY_DETERIORATION'
    ) {
      return 'DEGRADED';
    }
    if (
      input.trigger === 'VALIDITY_PERIOD_EXPIRED' ||
      input.trigger === 'PERFORMANCE_LIMIT_BREACHED' ||
      input.trigger === 'EVALUATION_DEFECT_DISCOVERED' ||
      input.trigger === 'DATA_QUALITY_PROBLEM' ||
      input.trigger === 'MODEL_VERSION_CHANGED' ||
      input.trigger === 'DATA_CONTRACT_CHANGED' ||
      input.trigger === 'TRANSACTION_COSTS_CHANGED' ||
      input.trigger === 'INSTRUMENT_UNIVERSE_CHANGED' ||
      input.trigger === 'CAPSULE_VERSION_CHANGED' ||
      input.trigger === 'EVALUATION_ASSUMPTIONS_INVALIDATED'
    ) {
      return 'DEGRADED';
    }
  }

  if (RESEARCH_EXPOSURE_STATES.has(input.currentState)) {
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
  readonly toState: DemotionToState;
  readonly trigger: DemotionTrigger;
  readonly reason: string;
  readonly actorId: string;
  readonly decidedAt: UtcInstant;
  readonly policyId: string;
  readonly policyHash: string;
}): DemotionRecord {
  const material = `${input.strategyId}@${input.strategyVersion}:${input.trigger}:${input.decidedAt}`;
  return Object.freeze({
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
  });
}

export function requiresRequalification(trigger: DemotionTrigger): boolean {
  return (
    trigger === 'CAPSULE_VERSION_CHANGED' ||
    trigger === 'MODEL_VERSION_CHANGED' ||
    trigger === 'DATA_CONTRACT_CHANGED' ||
    trigger === 'TRANSACTION_COSTS_CHANGED' ||
    trigger === 'INSTRUMENT_UNIVERSE_CHANGED' ||
    trigger === 'EVALUATION_ASSUMPTIONS_INVALIDATED' ||
    trigger === 'REGIME_DRIFT_DETECTED' ||
    trigger === 'CHAMPION_FEATURE_DECAY'
  );
}
