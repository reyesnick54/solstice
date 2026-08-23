import { err, ok, type Result } from '../../domain/src/result.ts';
import type { UtcInstant } from '../../domain/src/time.ts';
import type { AuthenticationAssurance } from '../../identity/src/assurance.ts';
import type { GrowDataCategory } from './taxonomy.ts';

export const GROW_PURPOSES = ['GROW_PROFILE', 'AGENT_ANALYSIS', 'REGULATED_OPERATION'] as const;
export type GrowPurpose = (typeof GROW_PURPOSES)[number];

export const RETENTION_CLASSES = ['REGULATED_OPERATIONAL', 'OPTIONAL_PERSONALIZATION'] as const;
export type RetentionClass = (typeof RETENTION_CLASSES)[number];

export type RetentionPolicy = {
  readonly regulatedOperationalDays: number;
  readonly optionalPersonalizationDays: number;
};

export const DEFAULT_RETENTION_POLICY: RetentionPolicy = Object.freeze({
  regulatedOperationalDays: 2555,
  optionalPersonalizationDays: 180,
});

export const CATEGORY_RETENTION: Readonly<Record<GrowDataCategory, RetentionClass>> = {
  CASH_POSITION: 'REGULATED_OPERATIONAL',
  INVESTMENT_POSITION: 'REGULATED_OPERATIONAL',
  DECLARED_ASSET: 'OPTIONAL_PERSONALIZATION',
  DECLARED_LIABILITY: 'OPTIONAL_PERSONALIZATION',
  INCOME: 'OPTIONAL_PERSONALIZATION',
  EXPENSE: 'OPTIONAL_PERSONALIZATION',
  GOAL: 'OPTIONAL_PERSONALIZATION',
  RISK_PROFILE: 'OPTIONAL_PERSONALIZATION',
  PREFERENCE: 'OPTIONAL_PERSONALIZATION',
  INSIGHT: 'OPTIONAL_PERSONALIZATION',
  CASH_FLOW: 'OPTIONAL_PERSONALIZATION',
  TAX_CONTEXT: 'OPTIONAL_PERSONALIZATION',
};

export type GrowAccessMandate = {
  readonly mandateId: string;
  readonly subjectId: string;
  readonly allowedCategories: readonly GrowDataCategory[];
  readonly purpose: GrowPurpose;
  readonly expiresAt: UtcInstant | null;
};

export type AccessEvidence = {
  readonly evidenceId: string;
  readonly graphId: string;
  readonly actorId: string;
  readonly subjectId: string;
  readonly purpose: GrowPurpose;
  readonly categories: readonly GrowDataCategory[];
  readonly decision: 'ALLOW' | 'DENY';
  readonly reason: string;
  readonly at: UtcInstant;
};

export type PrivacyGateFailure = {
  readonly code: 'CONSENT_DENIED' | 'MANDATE_REQUIRED' | 'CATEGORY_DENIED' | 'PURPOSE_DENIED';
  readonly message: string;
};

export const AGENT_DEFAULT_CATEGORIES: readonly GrowDataCategory[] = Object.freeze([]);

export function categoriesForPurpose(purpose: GrowPurpose): readonly GrowDataCategory[] {
  if (purpose === 'REGULATED_OPERATION') {
    return Object.freeze(['CASH_POSITION', 'INVESTMENT_POSITION']);
  }
  if (purpose === 'AGENT_ANALYSIS') {
    return Object.freeze(['GOAL', 'INSIGHT', 'CASH_FLOW', 'RISK_PROFILE']);
  }
  return Object.freeze([...Object.keys(CATEGORY_RETENTION)] as GrowDataCategory[]);
}

export function filterCategories(
  requested: readonly GrowDataCategory[],
  allowed: readonly GrowDataCategory[],
): readonly GrowDataCategory[] {
  const permit = new Set(allowed);
  return Object.freeze(requested.filter((category) => permit.has(category)));
}

export function authorizeAgentCategories(
  mandate: GrowAccessMandate | null,
  requested: readonly GrowDataCategory[],
  now: UtcInstant,
): Result<readonly GrowDataCategory[], PrivacyGateFailure> {
  if (!mandate) {
    return err({
      code: 'MANDATE_REQUIRED',
      message: 'an Agent does not automatically receive PEG categories',
    });
  }
  if (mandate.expiresAt && mandate.expiresAt <= now) {
    return err({ code: 'MANDATE_REQUIRED', message: 'agent grow mandate has expired' });
  }
  if (mandate.purpose !== 'AGENT_ANALYSIS') {
    return err({ code: 'PURPOSE_DENIED', message: 'agent mandate purpose is not AGENT_ANALYSIS' });
  }
  if (mandate.allowedCategories.length === 0) {
    return err({
      code: 'CATEGORY_DENIED',
      message: 'agent mandate grants no personal data categories',
    });
  }
  const allowed = filterCategories(requested, mandate.allowedCategories);
  if (allowed.length === 0) {
    return err({ code: 'CATEGORY_DENIED', message: 'requested categories are outside the agent mandate' });
  }
  return ok(allowed);
}

export type GrowConsentFirewall = {
  evaluate(
    request: {
      readonly subjectId: string;
      readonly actorSubjectId: string;
      readonly actorAssurance: AuthenticationAssurance;
      readonly recipient: unknown;
      readonly purpose: unknown;
      readonly resourceId: string;
      readonly category: null;
      readonly fields: readonly string[];
      readonly windowFrom: null;
      readonly windowTo: null;
      readonly operation: 'READ';
      readonly derivationType: 'DERIVED_ONLY';
      readonly onwardSharing: false;
      readonly requestedRetentionDays: null;
      readonly sensitivity: 'SENSITIVE';
      readonly now: UtcInstant;
    },
    consents: readonly unknown[],
  ): { readonly decision: string; readonly reason: string };
};

export function evaluateGrowConsent(input: {
  readonly firewall: GrowConsentFirewall;
  readonly subjectId: string;
  readonly actorSubjectId: string;
  readonly actorAssurance: AuthenticationAssurance;
  readonly recipient: unknown;
  readonly purpose: unknown;
  readonly consents: readonly unknown[];
  readonly now: UtcInstant;
}): Result<void, PrivacyGateFailure> {
  const decision = input.firewall.evaluate(
    {
      subjectId: input.subjectId,
      actorSubjectId: input.actorSubjectId,
      actorAssurance: input.actorAssurance,
      recipient: input.recipient,
      purpose: input.purpose,
      resourceId: input.subjectId,
      category: null,
      fields: Object.freeze([]),
      windowFrom: null,
      windowTo: null,
      operation: 'READ',
      derivationType: 'DERIVED_ONLY',
      onwardSharing: false,
      requestedRetentionDays: null,
      sensitivity: 'SENSITIVE',
      now: input.now,
    },
    input.consents,
  );
  if (decision.decision !== 'ALLOW') {
    return err({
      code: 'CONSENT_DENIED',
      message: decision.reason,
    });
  }
  return ok(undefined);
}
