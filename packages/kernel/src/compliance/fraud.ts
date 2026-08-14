import { randomUUID } from 'node:crypto';

import type { UtcInstant } from '../../../domain/src/time.ts';
import type { AuthenticationAssurance } from '../../../identity/src/assurance.ts';
import { assuranceAtLeast } from '../../../identity/src/assurance.ts';
import type { FraudOutcome } from './types.ts';

export type FraudEvaluationInput = {
  readonly subjectRef: string;
  readonly actorId: string;
  readonly sessionAssurance: AuthenticationAssurance | null;
  readonly deviceTrust: 'KNOWN' | 'TRUSTED' | 'REVIEW_REQUIRED' | 'BLOCKED' | null;
  readonly recentAuthChange: boolean;
  readonly accountAgeDays: number;
  readonly beneficiaryAgeDays: number | null;
  readonly amountMinor: bigint | null;
  readonly destinationRisk: 'LOW' | 'STANDARD' | 'HIGH';
  readonly identityUsable: boolean;
  readonly velocityTriggered: boolean;
  readonly now: UtcInstant;
};

export type FraudEvaluation = {
  readonly evaluationId: string;
  readonly subjectRef: string;
  readonly outcome: FraudOutcome;
  readonly reasonCodes: readonly string[];
  readonly requiredAssurance: AuthenticationAssurance | null;
  readonly evaluatedAt: UtcInstant;
  readonly policyVersionId: string | null;
};

/**
 * Deterministic fraud evaluation. Cannot issue Execution Authority.
 * STEP_UP means the caller must submit a new ActionIntent after stronger auth.
 */
export function evaluateFraud(input: FraudEvaluationInput): FraudEvaluation {
  const reasons: string[] = [];
  let outcome: FraudOutcome = 'ALLOW';
  let requiredAssurance: AuthenticationAssurance | null = null;

  if (!input.identityUsable) {
    outcome = 'BLOCK';
    reasons.push('IDENTITY_NOT_USABLE');
  } else if (input.deviceTrust === 'BLOCKED') {
    outcome = 'BLOCK';
    reasons.push('DEVICE_BLOCKED');
  } else if (input.destinationRisk === 'HIGH' && (input.amountMinor ?? 0n) > 5_000_000n) {
    outcome = 'BLOCK';
    reasons.push('HIGH_RISK_DESTINATION_AMOUNT');
  } else if (input.velocityTriggered && (input.amountMinor ?? 0n) > 1_000_000n) {
    outcome = 'HOLD';
    reasons.push('VELOCITY_AND_AMOUNT');
  } else if (input.recentAuthChange || input.deviceTrust === 'REVIEW_REQUIRED') {
    outcome = 'REVIEW';
    reasons.push(input.recentAuthChange ? 'RECENT_AUTH_CHANGE' : 'DEVICE_REVIEW');
  } else if (
    (input.amountMinor ?? 0n) > 2_000_000n ||
    input.accountAgeDays < 1 ||
    (input.beneficiaryAgeDays !== null && input.beneficiaryAgeDays < 1)
  ) {
    outcome = 'STEP_UP';
    requiredAssurance = 'HIGH_ASSURANCE';
    reasons.push('STEP_UP_REQUIRED');
    if (input.sessionAssurance && assuranceAtLeast(input.sessionAssurance, 'HIGH_ASSURANCE')) {
      outcome = 'ALLOW';
      requiredAssurance = null;
      reasons.push('STEP_UP_SATISFIED');
    }
  } else if (input.subjectRef.toLowerCase().includes('sim_fraud_block')) {
    outcome = 'BLOCK';
    reasons.push('SIMULATED_FRAUD_BLOCK');
  } else if (input.subjectRef.toLowerCase().includes('sim_step_up')) {
    outcome = 'STEP_UP';
    requiredAssurance = 'HIGH_ASSURANCE';
    reasons.push('STEP_UP_REQUIRED');
    if (input.sessionAssurance && assuranceAtLeast(input.sessionAssurance, 'HIGH_ASSURANCE')) {
      outcome = 'ALLOW';
      requiredAssurance = null;
      reasons.push('STEP_UP_SATISFIED');
    }
  } else {
    reasons.push('FRAUD_ALLOW');
  }

  return Object.freeze({
    evaluationId: randomUUID(),
    subjectRef: input.subjectRef,
    outcome,
    reasonCodes: Object.freeze(reasons),
    requiredAssurance,
    evaluatedAt: input.now,
    policyVersionId: null,
  });
}
