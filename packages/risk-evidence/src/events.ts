/**
 * Action Center security events — no provider details exposed to users.
 */

export const WAVE4_SECURITY_EVENT_TYPES = Object.freeze([
  'SECURITY_REVIEW_REQUIRED',
  'IDENTITY_VERIFICATION_REQUIRED',
  'BUSINESS_VERIFICATION_REQUIRED',
  'UNUSUAL_ACCESS_DETECTED',
] as const);

export type Wave4SecurityEventType = (typeof WAVE4_SECURITY_EVENT_TYPES)[number];

export type Wave4SecurityEvent = {
  readonly type: Wave4SecurityEventType;
  readonly occurredAt: string;
  readonly summary: string;
  readonly autoNotify: false;
  readonly providerIdExposed: false;
};

export function securityReviewEvent(input: { readonly occurredAt: string }): Wave4SecurityEvent {
  return Object.freeze({
    type: 'SECURITY_REVIEW_REQUIRED',
    occurredAt: input.occurredAt,
    summary: 'A security review is required before this action can continue.',
    autoNotify: false,
    providerIdExposed: false,
  });
}

export function identityVerificationEvent(input: { readonly occurredAt: string }): Wave4SecurityEvent {
  return Object.freeze({
    type: 'IDENTITY_VERIFICATION_REQUIRED',
    occurredAt: input.occurredAt,
    summary: 'Additional identity verification is required.',
    autoNotify: false,
    providerIdExposed: false,
  });
}

export function businessVerificationEvent(input: { readonly occurredAt: string }): Wave4SecurityEvent {
  return Object.freeze({
    type: 'BUSINESS_VERIFICATION_REQUIRED',
    occurredAt: input.occurredAt,
    summary: 'Business verification is required to continue.',
    autoNotify: false,
    providerIdExposed: false,
  });
}

export function unusualAccessEvent(input: { readonly occurredAt: string }): Wave4SecurityEvent {
  return Object.freeze({
    type: 'UNUSUAL_ACCESS_DETECTED',
    occurredAt: input.occurredAt,
    summary: 'Unusual account access was detected. Please verify your identity.',
    autoNotify: false,
    providerIdExposed: false,
  });
}
