/**
 * Wave 6 canonical knowledge intelligence models.
 *
 * Observations and reference data only — no execution authority, legal conclusions,
 * medical diagnosis, or private HIN/Vault data exfiltration.
 */

import type { ExternalObservation } from '../../../provider-sdk/src/index.ts';

export type FreshnessStatus = 'fresh' | 'aging' | 'stale' | 'expired' | 'unknown';
export type AuthorityClass =
  | 'authoritative_official'
  | 'regulated_provider'
  | 'reference_data'
  | 'research_data'
  | 'community_data'
  | 'derived_data';

export type ResearchWorkType =
  | 'PEER_REVIEWED'
  | 'PREPRINT'
  | 'GOVERNMENT_REPORT'
  | 'REGULATORY_DOCUMENT'
  | 'CORPORATE_FILING'
  | 'ENCYCLOPEDIC_REFERENCE'
  | 'COMMUNITY_DATA'
  | 'OTHER';

export type ResearchAuthor = {
  readonly authorId: string;
  readonly displayName: string;
  readonly orcid: string | null;
  readonly providerNativeId: string | null;
  readonly providerId: string;
};

export type ResearchInstitution = {
  readonly institutionId: string;
  readonly name: string;
  readonly country: string | null;
  readonly providerNativeId: string | null;
  readonly providerId: string;
};

export type ResearchWork = {
  readonly workId: string;
  readonly title: string;
  readonly abstract: string | null;
  readonly authors: readonly ResearchAuthor[];
  readonly institutions: readonly ResearchInstitution[];
  readonly publicationDate: string | null;
  readonly venue: string | null;
  readonly workType: ResearchWorkType;
  readonly doi: string | null;
  readonly externalIds: Readonly<Record<string, string>>;
  readonly topics: readonly string[];
  readonly citationsCount: number | null;
  readonly openAccessStatus: string | null;
  readonly sourceUrl: string | null;
  readonly providerId: string;
  readonly freshness: FreshnessStatus;
  readonly authorityClass: AuthorityClass;
  readonly provenance: string;
  readonly grantsLegalConclusion: false;
};

export type PatentStatus = 'PENDING' | 'PUBLISHED' | 'GRANTED' | 'EXPIRED' | 'WITHDRAWN' | 'UNKNOWN';

export type PatentObservation = {
  readonly patentId: string;
  readonly applicationNumber: string | null;
  readonly publicationNumber: string | null;
  readonly title: string;
  readonly abstract: string | null;
  readonly inventors: readonly string[];
  readonly assignee: string | null;
  readonly filingDate: string | null;
  readonly publicationDate: string | null;
  readonly grantDate: string | null;
  readonly status: PatentStatus;
  readonly jurisdiction: string;
  readonly classificationCodes: readonly string[];
  readonly citations: readonly string[];
  readonly sourceUrl: string | null;
  readonly providerId: string;
  readonly freshness: FreshnessStatus;
  readonly provenance: string;
  readonly grantsInfringementConclusion: false;
};

export type KnowledgeEntity = {
  readonly entityId: string;
  readonly name: string;
  readonly description: string | null;
  readonly entityType: string;
  readonly aliases: readonly string[];
  readonly properties: Readonly<Record<string, string>>;
  readonly relationships: readonly { readonly relation: string; readonly targetId: string }[];
  readonly provider: string;
  readonly authorityClass: AuthorityClass;
  readonly provenance: string;
  readonly trustedSunReyFact: false;
};

export type AIModelObservation = {
  readonly modelId: string;
  readonly providerName: string;
  readonly modelName: string;
  readonly modelFamily: string | null;
  readonly contextWindow: number | null;
  readonly inputPricingMinor: bigint | null;
  readonly outputPricingMinor: bigint | null;
  readonly currency: string | null;
  readonly pricingUnit: string | null;
  readonly availability: 'AVAILABLE' | 'PREVIEW' | 'DEPRECATED' | 'UNKNOWN';
  readonly capabilities: readonly string[];
  readonly observedAt: string;
  readonly providerId: string;
  readonly freshness: FreshnessStatus;
  readonly provenance: string;
  readonly reconfiguresModelGateway: false;
};

export type AIEconomicObservation = {
  readonly observationId: string;
  readonly metricType:
    | 'TOKEN_COST'
    | 'COMPUTE_COST'
    | 'ENERGY_USE'
    | 'MODEL_PRICING'
    | 'AGENT_ECONOMICS'
    | 'PRODUCTIVITY';
  readonly value: number;
  readonly unit: string;
  readonly currency: string | null;
  readonly modelId: string | null;
  readonly observedAt: string;
  readonly providerId: string;
  readonly freshness: FreshnessStatus;
  readonly provenance: string;
  readonly mintsMoonRey: false;
};

export type HinReferenceObservation = {
  readonly referenceId: string;
  readonly category: 'FOOD' | 'NUTRITION' | 'PUBLIC_HEALTH_REFERENCE' | 'CLINICAL_TRIAL_METADATA';
  readonly label: string;
  readonly value: string | null;
  readonly unit: string | null;
  readonly jurisdiction: string | null;
  readonly dataset: string;
  readonly sourceAgency: string | null;
  readonly retrievedAt: string;
  readonly sourceTimestamp: string | null;
  readonly licensing: string;
  readonly providerId: string;
  readonly provenance: string;
  readonly isPrivateUserData: false;
  readonly infersHealthCondition: false;
};

export type OpportunityObservation = {
  readonly opportunityId: string;
  readonly kind: 'JOB' | 'SKILL' | 'LEARNING' | 'RESEARCH_OPPORTUNITY';
  readonly title: string;
  readonly description: string | null;
  readonly location: string | null;
  readonly skills: readonly string[];
  readonly sourceUrl: string | null;
  readonly providerId: string;
  readonly retrievedAt: string;
  readonly provenance: string;
  readonly submitsApplication: false;
  readonly sharesPrivateProfile: false;
};

export type Wave6ServiceResult<T> = {
  readonly observations: readonly ExternalObservation<T>[];
  readonly degraded: boolean;
  readonly stale: boolean;
  readonly providersUsed: readonly string[];
  readonly grantsExecution: false;
  readonly grantsDecision: false;
};

export type Wave6CoverageStatus =
  | 'IMPLEMENTED'
  | 'BLOCKED'
  | 'DEPRECATED'
  | 'UNAVAILABLE'
  | 'NOT_IN_CATALOG'
  | 'NOT_WAVE_6'
  | 'AWAITING_MASTER_LIST';

export type Wave6ProviderCoverage = {
  readonly providerId: string;
  readonly category: string;
  readonly status: Wave6CoverageStatus;
  readonly notes: string;
};

export type Wave6CoverageReport = {
  readonly totalWave6Eligible: number;
  readonly implemented: number;
  readonly blocked: number;
  readonly deprecated: number;
  readonly unavailable: number;
  readonly notInCatalog: number;
  readonly awaitingMasterList: number;
  readonly providers: readonly Wave6ProviderCoverage[];
};

export type KnowledgeSearchEntity = {
  readonly entityKind: 'RESEARCH_WORK' | 'PATENT' | 'KNOWLEDGE_ENTITY' | 'AI_MODEL';
  readonly entityId: string;
  readonly title: string;
  readonly providerId: string;
  readonly topics: readonly string[];
};
