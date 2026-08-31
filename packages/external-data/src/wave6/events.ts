/**
 * Wave 6 — Action Center event types for opportunity intelligence.
 */

export const WAVE6_ACTION_CENTER_EVENT_TYPES = Object.freeze([
  'NEW_RELEVANT_JOB',
  'SKILL_GAP_IDENTIFIED',
  'CAREER_OPPORTUNITY',
  'INCOME_GROWTH_OPPORTUNITY',
] as const);

export type Wave6ActionCenterEventType = (typeof WAVE6_ACTION_CENTER_EVENT_TYPES)[number];

export type Wave6ActionCenterEvent = {
  readonly type: Wave6ActionCenterEventType;
  readonly occurredAt: string;
  readonly providerId: string;
  readonly resourceId: string;
  readonly summary: string;
  readonly evidenceRef: string | null;
  readonly autoNotify: false;
  readonly relevanceScore: number | null;
};

export function newRelevantJobEvent(input: {
  readonly opportunityId: string;
  readonly title: string;
  readonly providerId: string;
  readonly occurredAt: string;
  readonly relevanceScore: number;
}): Wave6ActionCenterEvent {
  return Object.freeze({
    type: 'NEW_RELEVANT_JOB',
    occurredAt: input.occurredAt,
    providerId: input.providerId,
    resourceId: input.opportunityId,
    summary: `Relevant job: ${input.title}`,
    evidenceRef: `opportunity:${input.opportunityId}`,
    autoNotify: false,
    relevanceScore: input.relevanceScore,
  });
}

export function skillGapIdentifiedEvent(input: {
  readonly skillName: string;
  readonly occurredAt: string;
  readonly providerId: string;
}): Wave6ActionCenterEvent {
  return Object.freeze({
    type: 'SKILL_GAP_IDENTIFIED',
    occurredAt: input.occurredAt,
    providerId: input.providerId,
    resourceId: `skill:${input.skillName}`,
    summary: `Skill gap identified: ${input.skillName}`,
    evidenceRef: `skill:${input.skillName}`,
    autoNotify: false,
    relevanceScore: null,
  });
}

export function careerOpportunityEvent(input: {
  readonly opportunityId: string;
  readonly title: string;
  readonly providerId: string;
  readonly occurredAt: string;
}): Wave6ActionCenterEvent {
  return Object.freeze({
    type: 'CAREER_OPPORTUNITY',
    occurredAt: input.occurredAt,
    providerId: input.providerId,
    resourceId: input.opportunityId,
    summary: `Career opportunity: ${input.title}`,
    evidenceRef: `opportunity:${input.opportunityId}`,
    autoNotify: false,
    relevanceScore: null,
  });
}

export function incomeGrowthOpportunityEvent(input: {
  readonly summary: string;
  readonly occurredAt: string;
  readonly providerId: string;
  readonly resourceId: string;
}): Wave6ActionCenterEvent {
  return Object.freeze({
    type: 'INCOME_GROWTH_OPPORTUNITY',
    occurredAt: input.occurredAt,
    providerId: input.providerId,
    resourceId: input.resourceId,
    summary: input.summary,
    evidenceRef: `income-growth:${input.resourceId}`,
    autoNotify: false,
    relevanceScore: null,
  });
}
