import { DECISION_RANK, type DecisionStatus } from '../../../permissions/src/decision.ts';
import type { AmlCategory, FraudOutcome, OutagePosture, ScreeningOutcome } from './types.ts';
import { outageToDecision } from './types.ts';

/**
 * Opaque compliance facts for the existing Compliance and Risk proofs.
 * Hashes and codes only — no raw PII, no vendor payloads.
 */
export type ComplianceFacts = {
  readonly sanctionsOutcome: ScreeningOutcome | null;
  readonly pepOutcome: ScreeningOutcome | null;
  readonly adverseMediaOutcome: ScreeningOutcome | null;
  readonly sanctionsFresh: boolean;
  readonly pepFresh: boolean;
  readonly adverseMediaFresh: boolean;
  readonly requiredScreeningMissing: boolean;
  readonly providerAvailable: boolean;
  readonly outagePosture: OutagePosture | null;
  readonly amlCategory: AmlCategory | null;
  readonly fraudOutcome: FraudOutcome | null;
  readonly velocityTriggered: boolean;
  readonly hardBlock: boolean;
  readonly stepUpRequired: boolean;
  readonly latestScreeningId: string | null;
  readonly latestCaseId: string | null;
  readonly policyVersionId: string | null;
};

export type Escalation = {
  readonly status: DecisionStatus;
  readonly reason: string;
};

function escalate(current: DecisionStatus, next: DecisionStatus): DecisionStatus {
  return DECISION_RANK[next] > DECISION_RANK[current] ? next : current;
}

export function escalateFromComplianceFacts(
  current: DecisionStatus,
  facts: ComplianceFacts,
): Escalation {
  let status = current;
  const reasons: string[] = [];
  if (facts.hardBlock || facts.sanctionsOutcome === 'BLOCK' || facts.amlCategory === 'PROHIBITED') {
    status = escalate(status, 'BLOCK');
    reasons.push('COMPLIANCE_HARD_BLOCK');
  }
  if (facts.requiredScreeningMissing) {
    status = escalate(status, 'DEFER');
    reasons.push('REQUIRED_SCREENING_MISSING');
  }
  if (!facts.providerAvailable && facts.outagePosture) {
    status = escalate(status, outageToDecision(facts.outagePosture));
    reasons.push('PROVIDER_UNAVAILABLE_FAIL_CLOSED');
  }
  if (facts.sanctionsOutcome === 'UNAVAILABLE' && facts.outagePosture) {
    status = escalate(status, outageToDecision(facts.outagePosture));
    reasons.push('SANCTIONS_PROVIDER_UNAVAILABLE');
  }
  if (facts.sanctionsOutcome === 'HOLD') {
    status = escalate(status, 'DEFER');
    reasons.push('SANCTIONS_HOLD');
  }
  if (facts.sanctionsOutcome === 'REVIEW' || facts.pepOutcome === 'REVIEW') {
    status = escalate(status, 'REQUIRE_MANUAL_REVIEW');
    reasons.push(facts.sanctionsOutcome === 'REVIEW' ? 'SANCTIONS_REVIEW' : 'PEP_REVIEW');
  }
  if (facts.adverseMediaOutcome === 'REVIEW' || facts.adverseMediaOutcome === 'HOLD') {
    status = escalate(status, 'REQUIRE_MANUAL_REVIEW');
    reasons.push('ADVERSE_MEDIA_REVIEW');
  }
  if (!facts.sanctionsFresh || !facts.pepFresh || !facts.adverseMediaFresh) {
    status = escalate(status, 'DEFER');
    reasons.push('SCREENING_STALE');
  }
  if (facts.amlCategory === 'HIGH') {
    status = escalate(status, 'REQUIRE_MANUAL_REVIEW');
    reasons.push('AML_HIGH');
  }
  return { status, reason: reasons.join(',') };
}

export function escalateFromFraudFacts(
  current: DecisionStatus,
  facts: ComplianceFacts,
): Escalation {
  let status = current;
  const reasons: string[] = [];
  if (facts.fraudOutcome === 'BLOCK') {
    status = escalate(status, 'BLOCK');
    reasons.push('FRAUD_BLOCK');
  }
  if (facts.fraudOutcome === 'HOLD') {
    status = escalate(status, 'DEFER');
    reasons.push('FRAUD_HOLD');
  }
  if (facts.fraudOutcome === 'REVIEW') {
    status = escalate(status, 'REQUIRE_MANUAL_REVIEW');
    reasons.push('FRAUD_REVIEW');
  }
  if (facts.fraudOutcome === 'STEP_UP' || facts.stepUpRequired) {
    status = escalate(status, 'DEFER');
    reasons.push('STEP_UP_REQUIRED');
  }
  if (facts.velocityTriggered) {
    status = escalate(status, 'REQUIRE_MANUAL_REVIEW');
    reasons.push('VELOCITY_TRIGGERED');
  }
  return { status, reason: reasons.join(',') };
}
