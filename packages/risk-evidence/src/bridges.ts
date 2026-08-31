/**
 * Product integration bridges — Money, Exchange, Agent, Action Center.
 */

import type { RiskEvidencePlane } from './plane.ts';
import type { BusinessIdentityEvidence, DigitalRiskEvidence, RiskPolicyDecision } from './models.ts';
import { securityReviewEvent, identityVerificationEvent, businessVerificationEvent, unusualAccessEvent } from './events.ts';

export type MoneyRiskGateInput = {
  readonly subjectRef: string;
  readonly amountMinor: bigint;
  readonly jurisdiction: string;
};

export type MoneyRiskGateResult = {
  readonly schema: 'sunrey.money.risk-gate.v1';
  readonly policyDecision: RiskPolicyDecision;
  readonly businessEvidence: readonly BusinessIdentityEvidence[];
  readonly digitalRiskEvidence: readonly DigitalRiskEvidence[];
  readonly grantsExecutionAuthority: false;
};

export type ExchangeRiskGateInput = {
  readonly accountId: string;
  readonly sessionId: string;
  readonly subjectRef: string;
};

export type ExchangeRiskGateResult = {
  readonly schema: 'sunrey.exchange.risk-gate.v1';
  readonly policyDecision: RiskPolicyDecision;
  readonly stepUpRequired: boolean;
  readonly grantsExecutionAuthority: false;
};

export type AgentRiskGateResult = {
  readonly schema: 'sunrey.agent.risk-gate.v1';
  readonly policyDecision: RiskPolicyDecision;
  readonly mustWaitForHuman: boolean;
  readonly grantsExecutionAuthority: false;
};

export type BffRiskSummary = {
  readonly schema: 'sunrey.bff.risk-summary.v1';
  readonly riskLevel: 'LOW' | 'ELEVATED' | 'HIGH';
  readonly stepUpRequired: boolean;
  readonly reviewRequired: boolean;
  readonly providerDetailsExposed: false;
};

export function evaluateMoneyRiskGate(
  plane: RiskEvidencePlane,
  input: MoneyRiskGateInput,
): MoneyRiskGateResult {
  const digital = plane.collectSessionRisk({
    sessionId: `money:${input.subjectRef}`,
    subjectRef: input.subjectRef,
  });
  const business = plane.kyb.searchBusiness({ jurisdiction: input.jurisdiction });
  const decision = plane.evaluatePolicy(business, digital);
  return Object.freeze({
    schema: 'sunrey.money.risk-gate.v1',
    policyDecision: decision,
    businessEvidence: business,
    digitalRiskEvidence: digital,
    grantsExecutionAuthority: false,
  });
}

export function evaluateExchangeRiskGate(
  plane: RiskEvidencePlane,
  input: ExchangeRiskGateInput,
): ExchangeRiskGateResult {
  const digital = plane.collectSessionRisk({
    sessionId: input.sessionId,
    subjectRef: input.subjectRef,
  });
  const decision = plane.evaluatePolicy([], digital);
  return Object.freeze({
    schema: 'sunrey.exchange.risk-gate.v1',
    policyDecision: decision,
    stepUpRequired: decision.stepUpRequired,
    grantsExecutionAuthority: false,
  });
}

export function evaluateAgentRiskGate(plane: RiskEvidencePlane, subjectRef: string): AgentRiskGateResult {
  const digital = plane.collectSessionRisk({
    sessionId: `agent:${subjectRef}`,
    subjectRef,
  });
  const decision = plane.evaluatePolicy([], digital);
  const mustWait =
    decision.outcome === 'STEP_UP_AUTH' ||
    decision.outcome === 'REVIEW' ||
    decision.outcome === 'HOLD' ||
    decision.outcome === 'REJECT';
  return Object.freeze({
    schema: 'sunrey.agent.risk-gate.v1',
    policyDecision: decision,
    mustWaitForHuman: mustWait,
    grantsExecutionAuthority: false,
  });
}

export function toBffRiskSummary(decision: RiskPolicyDecision): BffRiskSummary {
  const riskLevel =
    decision.outcome === 'REJECT' || decision.outcome === 'HOLD'
      ? 'HIGH'
      : decision.outcome === 'REVIEW' || decision.outcome === 'STEP_UP_AUTH'
        ? 'ELEVATED'
        : 'LOW';
  return Object.freeze({
    schema: 'sunrey.bff.risk-summary.v1',
    riskLevel,
    stepUpRequired: decision.stepUpRequired,
    reviewRequired: decision.outcome === 'REVIEW' || decision.outcome === 'HOLD',
    providerDetailsExposed: false,
  });
}

export function sampleSecurityActionCenterEvents(
  plane: RiskEvidencePlane,
  decision: RiskPolicyDecision,
): readonly ReturnType<typeof securityReviewEvent> {
  const events = [];
  if (decision.outcome === 'REVIEW' || decision.outcome === 'HOLD') {
    events.push(securityReviewEvent({ occurredAt: plane.adapterContext().nowUtc }));
  }
  if (decision.outcome === 'STEP_UP_AUTH') {
    events.push(identityVerificationEvent({ occurredAt: plane.adapterContext().nowUtc }));
  }
  if (decision.reasonCodes.includes('INACTIVE_BUSINESS_STATUS')) {
    events.push(businessVerificationEvent({ occurredAt: plane.adapterContext().nowUtc }));
  }
  if (
    decision.reasonCodes.some((c) =>
      ['VPN_SIGNAL', 'TOR_SIGNAL', 'PROXY_SIGNAL', 'LOCATION_ANOMALY'].includes(c),
    )
  ) {
    events.push(unusualAccessEvent({ occurredAt: plane.adapterContext().nowUtc }));
  }
  return Object.freeze(events);
}
