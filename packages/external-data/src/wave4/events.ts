/**
 * Wave 4 security and provider-risk events.
 * Uses existing event patterns — no separate event bus.
 */

export const WAVE4_SECURITY_EVENT_TYPES = Object.freeze([
  'PROVIDER_SECURITY_DEGRADED',
  'PROVIDER_QUARANTINED',
  'PROVIDER_RECOVERED',
  'PROVIDER_SCHEMA_ANOMALY',
  'PROVIDER_CREDENTIAL_FAILURE',
  'THREAT_INTELLIGENCE_MATCH',
  'SECURITY_ACTION_REQUIRED',
  'SUSPICIOUS_LOGIN_REVIEW',
  'SERVICE_DEGRADED',
  'IDENTITY_REVIEW_REQUIRED',
] as const);

export type Wave4SecurityEventType = (typeof WAVE4_SECURITY_EVENT_TYPES)[number];

export type Wave4SecurityEvent = {
  readonly type: Wave4SecurityEventType;
  readonly occurredAt: string;
  readonly providerId: string | null;
  readonly resourceId: string;
  readonly summary: string;
  readonly audience: 'internal' | 'user_safe';
  readonly autoNotify: false;
  readonly sensitiveDetail: string | null;
};

export function providerSecurityDegradedEvent(input: {
  readonly providerId: string;
  readonly reason: string;
  readonly occurredAt: string;
}): Wave4SecurityEvent {
  return Object.freeze({
    type: 'PROVIDER_SECURITY_DEGRADED',
    occurredAt: input.occurredAt,
    providerId: input.providerId,
    resourceId: input.providerId,
    summary: `Provider ${input.providerId} security posture degraded`,
    audience: 'internal',
    autoNotify: false,
    sensitiveDetail: input.reason,
  });
}

export function providerQuarantinedEvent(input: {
  readonly providerId: string;
  readonly reason: string;
  readonly occurredAt: string;
}): Wave4SecurityEvent {
  return Object.freeze({
    type: 'PROVIDER_QUARANTINED',
    occurredAt: input.occurredAt,
    providerId: input.providerId,
    resourceId: input.providerId,
    summary: `Provider ${input.providerId} quarantined`,
    audience: 'internal',
    autoNotify: false,
    sensitiveDetail: input.reason,
  });
}

export function providerRecoveredEvent(input: {
  readonly providerId: string;
  readonly occurredAt: string;
}): Wave4SecurityEvent {
  return Object.freeze({
    type: 'PROVIDER_RECOVERED',
    occurredAt: input.occurredAt,
    providerId: input.providerId,
    resourceId: input.providerId,
    summary: `Provider ${input.providerId} recovered after validation`,
    audience: 'internal',
    autoNotify: false,
    sensitiveDetail: null,
  });
}

export function threatIntelligenceMatchEvent(input: {
  readonly indicatorType: string;
  readonly occurredAt: string;
}): Wave4SecurityEvent {
  return Object.freeze({
    type: 'THREAT_INTELLIGENCE_MATCH',
    occurredAt: input.occurredAt,
    providerId: null,
    resourceId: `threat:${input.indicatorType}`,
    summary: 'Threat intelligence match detected',
    audience: 'internal',
    autoNotify: false,
    sensitiveDetail: `Indicator type: ${input.indicatorType}`,
  });
}

export function serviceDegradedUserEvent(input: {
  readonly serviceName: string;
  readonly occurredAt: string;
}): Wave4SecurityEvent {
  return Object.freeze({
    type: 'SERVICE_DEGRADED',
    occurredAt: input.occurredAt,
    providerId: null,
    resourceId: input.serviceName,
    summary: `${input.serviceName} may be experiencing issues`,
    audience: 'user_safe',
    autoNotify: false,
    sensitiveDetail: null,
  });
}

export function securityActionRequiredEvent(input: {
  readonly actionType: string;
  readonly occurredAt: string;
}): Wave4SecurityEvent {
  return Object.freeze({
    type: 'SECURITY_ACTION_REQUIRED',
    occurredAt: input.occurredAt,
    providerId: null,
    resourceId: input.actionType,
    summary: 'Security review required',
    audience: 'user_safe',
    autoNotify: false,
    sensitiveDetail: null,
  });
}
