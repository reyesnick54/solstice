/**
 * Deterministic risk policy — external scores are features, not decisions.
 */

import { randomUUID } from 'node:crypto';

import { asUtcInstant } from '../../domain/src/time.ts';
import type {
  BusinessIdentityEvidence,
  DigitalRiskEvidence,
  RiskPolicyDecision,
  RiskPolicyFeature,
  RiskPolicyInput,
  RiskPolicyOutcome,
} from './models.ts';
import { sessionEvidenceExpired } from './retention.ts';

const POLICY_VERSION = 'sunrey-risk-policy/v1';

export function extractRiskFeatures(
  businessEvidence: readonly BusinessIdentityEvidence[],
  digitalRiskEvidence: readonly DigitalRiskEvidence[],
): readonly RiskPolicyFeature[] {
  const features: RiskPolicyFeature[] = [];

  for (const biz of businessEvidence) {
    if (biz.status === 'DISSOLVED' || biz.status === 'SUSPENDED') {
      features.push({ code: 'BUSINESS_INACTIVE', weight: 1, source: biz.providerId });
    }
    if (biz.freshness === 'STALE' || biz.freshness === 'EXPIRED') {
      features.push({ code: 'KYB_EVIDENCE_STALE', weight: 1, source: biz.providerId });
    }
  }

  for (const dr of digitalRiskEvidence) {
    if (dr.freshness === 'EXPIRED') {
      features.push({ code: 'DIGITAL_RISK_EXPIRED', weight: 1, source: dr.providerId });
      continue;
    }
    if (dr.riskType === 'VPN') {
      features.push({ code: 'VPN_SIGNAL', weight: 1, source: dr.providerId });
    }
    if (dr.riskType === 'TOR') {
      features.push({ code: 'TOR_SIGNAL', weight: 1, source: dr.providerId });
    }
    if (dr.riskType === 'PROXY') {
      features.push({ code: 'PROXY_SIGNAL', weight: 1, source: dr.providerId });
    }
    if (dr.riskType === 'IP_REPUTATION' && (dr.riskScore ?? 0) > 70) {
      features.push({ code: 'HIGH_IP_RISK_SCORE', weight: 1, source: dr.providerId });
    }
    if (dr.riskType === 'EMAIL_REPUTATION' && dr.emailReputation?.suspicious) {
      features.push({ code: 'SUSPICIOUS_EMAIL', weight: 1, source: dr.providerId });
    }
    if (dr.riskType === 'LOCATION_ANOMALY') {
      features.push({ code: 'LOCATION_ANOMALY', weight: 1, source: dr.providerId });
    }
    if (dr.riskType === 'ABUSE_HISTORY' || dr.riskType === 'NETWORK_RISK') {
      features.push({ code: 'NETWORK_RISK_SIGNAL', weight: 1, source: dr.providerId });
    }
  }

  return Object.freeze(features);
}

export function evaluateRiskPolicy(input: RiskPolicyInput, nowUtc: string): RiskPolicyDecision {
  const reasons: string[] = [];
  let outcome: RiskPolicyOutcome = 'NORMAL';
  let stepUpRequired = false;

  const featureCodes = new Set(input.features.map((f) => f.code));

  if (featureCodes.has('BUSINESS_INACTIVE')) {
    outcome = escalate(outcome, 'REVIEW');
    reasons.push('INACTIVE_BUSINESS_STATUS');
  }

  const hasVpn = featureCodes.has('VPN_SIGNAL');
  const hasTor = featureCodes.has('TOR_SIGNAL');
  const hasProxy = featureCodes.has('PROXY_SIGNAL');
  const hasLocationAnomaly = featureCodes.has('LOCATION_ANOMALY');
  const hasSuspiciousEmail = featureCodes.has('SUSPICIOUS_EMAIL');
  const hasHighIpRisk = featureCodes.has('HIGH_IP_RISK_SCORE');

  if (hasTor && hasLocationAnomaly) {
    outcome = escalate(outcome, 'HOLD');
    reasons.push('TOR_AND_LOCATION_ANOMALY');
  } else if (hasTor || hasLocationAnomaly) {
    outcome = escalate(outcome, 'STEP_UP_AUTH');
    stepUpRequired = true;
    reasons.push(hasTor ? 'TOR_SIGNAL' : 'LOCATION_ANOMALY');
  }

  if (hasVpn || hasProxy) {
    if (outcome === 'NORMAL') {
      outcome = 'STEP_UP_AUTH';
      stepUpRequired = true;
    }
    reasons.push(hasVpn ? 'VPN_SIGNAL' : 'PROXY_SIGNAL');
  }

  if (hasSuspiciousEmail) {
    outcome = escalate(outcome, 'STEP_UP_AUTH');
    stepUpRequired = true;
    reasons.push('SUSPICIOUS_EMAIL');
  }

  if (hasHighIpRisk) {
    outcome = escalate(outcome, 'REVIEW');
    reasons.push('HIGH_IP_RISK');
  }

  if (featureCodes.has('KYB_EVIDENCE_STALE') || featureCodes.has('DIGITAL_RISK_EXPIRED')) {
    outcome = escalate(outcome, 'REVIEW');
    reasons.push('STALE_EVIDENCE');
  }

  const staleSession = input.digitalRiskEvidence.some((e) =>
    sessionEvidenceExpired(e.retrievedAt, nowUtc),
  );
  if (staleSession && outcome === 'NORMAL') {
    outcome = 'REVIEW';
    reasons.push('SESSION_EVIDENCE_EXPIRED');
  }

  if (reasons.length === 0) {
    reasons.push('RISK_NORMAL');
  }

  return Object.freeze({
    outcome,
    reasonCodes: Object.freeze(reasons),
    stepUpRequired,
    providerScoreUsed: false,
    policyVersionId: POLICY_VERSION,
    evaluatedAt: asUtcInstant(nowUtc),
  });
}

export function buildRiskPolicyInput(
  businessEvidence: readonly BusinessIdentityEvidence[],
  digitalRiskEvidence: readonly DigitalRiskEvidence[],
): RiskPolicyInput {
  return Object.freeze({
    businessEvidence,
    digitalRiskEvidence,
    features: extractRiskFeatures(businessEvidence, digitalRiskEvidence),
  });
}

export function evaluateFromEvidence(
  businessEvidence: readonly BusinessIdentityEvidence[],
  digitalRiskEvidence: readonly DigitalRiskEvidence[],
  nowUtc: string,
): RiskPolicyDecision {
  return evaluateRiskPolicy(buildRiskPolicyInput(businessEvidence, digitalRiskEvidence), nowUtc);
}

function escalate(current: RiskPolicyOutcome, next: RiskPolicyOutcome): RiskPolicyOutcome {
  const rank: Record<RiskPolicyOutcome, number> = {
    NORMAL: 0,
    STEP_UP_AUTH: 1,
    REVIEW: 2,
    HOLD: 3,
    REJECT: 4,
  };
  return rank[next] > rank[current] ? next : current;
}

export function policyDecisionId(): string {
  return `rpd_${randomUUID()}`;
}
