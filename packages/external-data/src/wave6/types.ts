/**
 * Wave 6 Prompt 23 — canonical opportunity intelligence models.
 *
 * Public opportunity data only. Does not apply for jobs, disclose user data,
 * or mutate financial state.
 */

import type { UtcInstant } from '../../../domain/src/time.ts';
import type { ProviderExecutionProvenance } from '../certification/types.ts';
import type { AuthorityClass } from '../../../provider-sdk/src/types.ts';

export const EMPLOYMENT_TYPES = Object.freeze([
  'FULL_TIME',
  'PART_TIME',
  'CONTRACT',
  'TEMPORARY',
  'INTERNSHIP',
  'FREELANCE',
  'OTHER',
  'UNKNOWN',
] as const);
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

export const REMOTE_STATUSES = Object.freeze(['ONSITE', 'REMOTE', 'HYBRID', 'UNKNOWN'] as const);
export type RemoteStatus = (typeof REMOTE_STATUSES)[number];

export const SALARY_PERIODS = Object.freeze(['HOURLY', 'DAILY', 'MONTHLY', 'ANNUAL', 'PROJECT'] as const);
export type SalaryPeriod = (typeof SALARY_PERIODS)[number];

export const JOB_FRESHNESS_STATUSES = Object.freeze(['ACTIVE', 'AGING', 'STALE', 'EXPIRED'] as const);
export type JobFreshnessStatus = (typeof JOB_FRESHNESS_STATUSES)[number];

export const INTELLIGENCE_AUTHORITY_CLASSES = Object.freeze([
  'authoritative_official',
  'reference_data',
  'community_data',
  'derived_data',
  'research_data',
] as const);

export type OpportunityProvenance = {
  readonly providerId: string;
  readonly providerJobId: string | null;
  readonly authorityClass: AuthorityClass;
  readonly sourceUrl: string | null;
  readonly rawPayloadHash: string;
  readonly observationId: string;
  readonly retrievedAt: UtcInstant;
};

export type SalaryRange = {
  readonly minimum: bigint | null;
  readonly maximum: bigint | null;
  readonly currency: string;
  readonly period: SalaryPeriod;
  readonly classification: 'EXPLICIT' | 'ESTIMATED' | 'UNKNOWN';
  readonly sourceAmountMin: string | null;
  readonly sourceAmountMax: string | null;
  readonly fxConvertedReference: {
    readonly amountMinor: bigint;
    readonly currency: string;
    readonly rate: string;
    readonly referenceOnly: true;
  } | null;
};

export type JobOpportunity = {
  readonly opportunityId: string;
  readonly providerJobId: string | null;
  readonly title: string;
  readonly employer: string | null;
  readonly location: string | null;
  readonly remoteStatus: RemoteStatus;
  readonly employmentType: EmploymentType;
  readonly providerNativeEmploymentType: string | null;
  readonly descriptionSummary: string | null;
  readonly salary: SalaryRange | null;
  readonly skills: readonly string[];
  readonly rawSkillLabels: readonly string[];
  readonly experienceLevel: string | null;
  readonly postedAt: UtcInstant | null;
  readonly expiresAt: UtcInstant | null;
  readonly applicationUrl: string | null;
  readonly applicationUrlSafe: boolean;
  readonly providerId: string;
  readonly freshness: JobFreshnessStatus;
  readonly provenance: OpportunityProvenance;
  readonly mergedSourceIds: readonly { readonly providerId: string; readonly providerJobId: string }[];
};

export type Skill = {
  readonly skillId: string;
  readonly canonicalName: string;
  readonly aliases: readonly string[];
  readonly category: string | null;
  readonly description: string | null;
  readonly providerNativeIds: readonly { readonly providerId: string; readonly nativeId: string }[];
  readonly relatedOccupations: readonly string[];
  readonly provenance: OpportunityProvenance | null;
};

export type Occupation = {
  readonly occupationId: string;
  readonly title: string;
  readonly category: string | null;
  readonly skills: readonly string[];
  readonly description: string | null;
  readonly salaryReference: SalaryRange | null;
  readonly marketDemand: string | null;
  readonly geography: string | null;
  readonly providerId: string;
  readonly provenance: OpportunityProvenance | null;
};

export type PublicIntelligenceObservation = {
  readonly observationId: string;
  readonly providerId: string;
  readonly title: string;
  readonly summary: string;
  readonly category: 'JOB_MARKET_NEWS' | 'HIRING_SIGNAL' | 'TECH_TREND' | 'ECONOMIC_CONTEXT';
  readonly authorityClass: AuthorityClass;
  readonly sourceUrl: string | null;
  readonly publishedAt: UtcInstant | null;
  readonly retrievedAt: UtcInstant;
  readonly verifiedFact: false;
};

export type OpportunityRelevanceExplanation = {
  readonly factor: string;
  readonly matched: boolean;
  readonly detail: string;
};

export type OpportunityRelevance = {
  readonly score: number;
  readonly explanations: readonly OpportunityRelevanceExplanation[];
};

export type JobSearchQuery = {
  readonly keywords?: string;
  readonly location?: string;
  readonly remotePreference?: RemoteStatus;
  readonly skills?: readonly string[];
  readonly employmentType?: EmploymentType;
  readonly limit?: number;
};

export type UserMatchContext = {
  readonly permittedSkills?: readonly string[];
  readonly careerInterests?: readonly string[];
  readonly locationPreference?: string;
  readonly remotePreference?: RemoteStatus;
  readonly salaryTargetMinor?: bigint;
  readonly salaryTargetCurrency?: string;
};

export type OpportunityServiceResult<T> = {
  readonly ok: true;
  readonly value: T;
  readonly fromCache: boolean;
  readonly providersUsed: readonly string[];
  readonly execution?: ProviderExecutionProvenance;
} | {
  readonly ok: false;
  readonly code: string;
  readonly message: string;
  readonly providerId: string | null;
  readonly execution?: ProviderExecutionProvenance;
};
