/**
 * Backend event readiness for Action Center — no automatic user notifications.
 */

export const WAVE2_ACTION_CENTER_EVENT_TYPES = Object.freeze([
  'major_company_filing_available',
  'macro_indicator_updated',
  'important_fiscal_release',
]);

export type Wave2ActionCenterEventType = (typeof WAVE2_ACTION_CENTER_EVENT_TYPES)[number];

export type Wave2ActionCenterEvent = {
  readonly type: Wave2ActionCenterEventType;
  readonly occurredAt: string;
  readonly providerId: string;
  readonly resourceId: string;
  readonly summary: string;
  readonly evidenceRef: string | null;
  readonly autoNotify: false;
};

export function filingAvailableEvent(input: {
  readonly accessionNumber: string;
  readonly companyName: string;
  readonly formType: string;
  readonly occurredAt: string;
}): Wave2ActionCenterEvent {
  return Object.freeze({
    type: 'major_company_filing_available',
    occurredAt: input.occurredAt,
    providerId: 'sec-edgar',
    resourceId: input.accessionNumber,
    summary: `${input.companyName} published ${input.formType}`,
    evidenceRef: `sec-edgar:${input.accessionNumber}`,
    autoNotify: false,
  });
}

export function macroUpdatedEvent(input: {
  readonly seriesId: string;
  readonly occurredAt: string;
}): Wave2ActionCenterEvent {
  return Object.freeze({
    type: 'macro_indicator_updated',
    occurredAt: input.occurredAt,
    providerId: 'fred',
    resourceId: input.seriesId,
    summary: `Macro indicator ${input.seriesId} updated`,
    evidenceRef: `fred:${input.seriesId}`,
    autoNotify: false,
  });
}

export function fiscalReleaseEvent(input: {
  readonly period: string;
  readonly occurredAt: string;
}): Wave2ActionCenterEvent {
  return Object.freeze({
    type: 'important_fiscal_release',
    occurredAt: input.occurredAt,
    providerId: 'us-treasury-fiscal',
    resourceId: input.period,
    summary: `Fiscal release for ${input.period}`,
    evidenceRef: `us-treasury-fiscal:${input.period}`,
    autoNotify: false,
  });
}
