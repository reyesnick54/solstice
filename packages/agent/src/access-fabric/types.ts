import type { UtcInstant } from '../../../domain/src/time.ts';
import type {
  AccessCategory,
  AccessConstraintKind,
  AccessDurationUnit,
  AccessExperienceLevel,
  AccessIntentKind,
  AccessRecurrence,
  AuthorizedGraphCategory,
} from './taxonomy.ts';

export type AccessIntentId = string & { readonly __brand: 'AccessIntentId' };

export function asAccessIntentId(value: string): AccessIntentId {
  if (value.length === 0 || !value.startsWith('axi_')) {
    throw new TypeError('AccessIntentId must start with axi_');
  }
  return value as AccessIntentId;
}

export function deterministicAccessIntentId(subjectId: string, sourceHash: string): AccessIntentId {
  return asAccessIntentId(`axi_${subjectId}_${sourceHash.slice(0, 16)}`);
}

export type AccessGeography = {
  readonly region: string;
  readonly country?: string;
  readonly city?: string;
};

export type AccessWindow = {
  readonly startAt?: UtcInstant;
  readonly endAt?: UtcInstant;
  readonly durationDays?: number;
  readonly durationWeeks?: number;
  readonly recurrence?: AccessRecurrence;
};

export type AccessTargetCriteria = {
  readonly productType: string;
  readonly attributes: readonly { readonly key: string; readonly value: string }[];
  readonly brandOrModel?: string;
};

export type AccessSubstitution = {
  readonly acceptable: boolean;
  readonly alternatives: readonly string[];
};

export type AccessConstraint = {
  readonly kind: AccessConstraintKind;
  readonly maxMinorUnits?: string;
  readonly currency?: string;
  readonly note?: string;
};

export type AccessIntent = {
  readonly intentId: AccessIntentId;
  readonly subjectId: string;
  readonly category: AccessCategory;
  readonly kind: AccessIntentKind;
  readonly experienceLevel: AccessExperienceLevel;
  readonly target: AccessTargetCriteria;
  readonly geography: AccessGeography;
  readonly window: AccessWindow;
  readonly duration?: { readonly value: number; readonly unit: AccessDurationUnit };
  readonly qualityPreferences: readonly string[];
  readonly substitutions: AccessSubstitution;
  readonly constraints: readonly AccessConstraint[];
  readonly mandateRef: string | null;
  readonly purpose: string;
  readonly consentRefs: readonly string[];
  readonly pegContextRefs: readonly string[];
  readonly sourceText: string;
  readonly explanation: string;
  readonly executable: false;
  readonly confirmsReservation: false;
  readonly createdAt: UtcInstant;
};

export type AccessIntentProposal = {
  readonly proposalId: string;
  readonly subjectId: string;
  readonly intent: AccessIntent;
  readonly state: 'PROPOSED';
  readonly humanApprovalRequired: true;
  readonly executable: false;
  readonly createdAt: UtcInstant;
};

export type AuthorizedGraphSlice = {
  readonly mandateId: string;
  readonly purpose: 'AGENT_ANALYSIS';
  readonly authorizedCategories: readonly AuthorizedGraphCategory[];
  readonly categoryLabels: Readonly<Partial<Record<AuthorizedGraphCategory, readonly string[]>>>;
  readonly consentRefs: readonly string[];
};

export type AccessIntentFailure = {
  readonly code:
    | 'EMPTY_REQUEST'
    | 'UNPARSEABLE_REQUEST'
    | 'MALFORMED_INTENT'
    | 'PROHIBITED_GRAPH_CONTEXT'
    | 'PROHIBITED_CONFIRMATION'
    | 'SELF_ISSUED_AUTHORITY'
    | 'ACTOR_CONTEXT_REQUIRED'
    | 'KERNEL_PATH_REQUIRED';
  readonly message: string;
};
