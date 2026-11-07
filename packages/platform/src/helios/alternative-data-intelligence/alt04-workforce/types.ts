/**
 * HELIOS ALT04 — canonical workforce / job-posting intelligence types.
 */

import type { UtcInstant } from '@solstice/domain';
import type { JobOpportunity, RemoteStatus } from '@solstice/external-data/wave6';
import type {
  HELIOS_ALT04_WORKFORCE_AUTHORITY,
  HELIOS_ALT04_WORKFORCE_SCHEMA,
  CoverageReweightDimension,
  HiringDemandBand,
  HiringMotiveEstimate,
  HiringQualityBand,
  WorkforceExpansionBand,
  WorkforceOperationalStance,
  WorkforceResearchPredictionTarget,
  WorkforceSkillBucket,
} from './taxonomy.ts';

/** Growth / rate fields as integer basis points (10000 = 100.00%). Null when undefined. */
export type BasisPoints = number;

export type WorkforceTemporalEnvelope = {
  readonly firmKey: string;
  readonly canonicalEntityId: string | null;
  readonly observationTime: UtcInstant;
  readonly knowableAt: UtcInstant;
  readonly providerIds: readonly string[];
  readonly grantsExecutionAuthority: false;
};

export type JobPostingObservation = WorkforceTemporalEnvelope & {
  readonly schema: typeof HELIOS_ALT04_WORKFORCE_SCHEMA;
  readonly authority: typeof HELIOS_ALT04_WORKFORCE_AUTHORITY;
  readonly observationId: string;
  readonly sourceJob: Pick<
    JobOpportunity,
    | 'opportunityId'
    | 'title'
    | 'employer'
    | 'location'
    | 'remoteStatus'
    | 'employmentType'
    | 'skills'
    | 'experienceLevel'
    | 'salary'
    | 'postedAt'
    | 'expiresAt'
    | 'freshness'
    | 'providerId'
  >;
  readonly skillBuckets: readonly WorkforceSkillBucket[];
  readonly seniorityLabel: string | null;
  readonly subsidiaryLabel: string | null;
  readonly durationDays: number | null;
  readonly isRepost: boolean;
};

export type JobPostingFeatureBundle = {
  readonly postingCount: number;
  readonly newPostingCount: number;
  readonly closedPostingCount: number;
  readonly postingGrowthWoWBps: BasisPoints | null;
  readonly postingGrowthMoMBps: BasisPoints | null;
  readonly postingGrowthYoYBps: BasisPoints | null;
  readonly postingDurationDaysMedian: number | null;
  readonly postingVelocityPerWeek: number | null;
  readonly repostRateBps: BasisPoints | null;
  readonly roleBreadth: number;
  readonly locationBreadth: number;
  readonly seniorityMix: Readonly<Record<string, number>>;
  readonly salaryTrendBps: BasisPoints | null;
  readonly salaryTrendSupported: boolean;
};

export type HiringDemandState = WorkforceTemporalEnvelope & {
  readonly stateId: string;
  readonly band: HiringDemandBand;
  readonly features: JobPostingFeatureBundle;
  readonly rawPostingCount: number;
  readonly adjustedPostingCount: number;
  readonly interpretationNote: string;
};

export type WorkforceExpansionState = WorkforceTemporalEnvelope & {
  readonly stateId: string;
  readonly band: WorkforceExpansionBand;
  readonly estimatedMotive: HiringMotiveEstimate;
  readonly motiveConfidenceBps: BasisPoints;
  readonly motiveRationale: readonly string[];
  readonly features: JobPostingFeatureBundle;
};

export type SkillDemandState = WorkforceTemporalEnvelope & {
  readonly stateId: string;
  readonly mix: Readonly<Partial<Record<WorkforceSkillBucket, number>>>;
  readonly dominantBucket: WorkforceSkillBucket | null;
};

export type SkillMixShift = {
  readonly firmKey: string;
  readonly fromWindowStart: UtcInstant;
  readonly toWindowEnd: UtcInstant;
  readonly deltaByBucket: Readonly<Partial<Record<WorkforceSkillBucket, number>>>;
  readonly knowableAt: UtcInstant;
};

export type InnovationHiringIntensity = {
  readonly firmKey: string;
  readonly intensityScore: number;
  readonly aiShareBps: BasisPoints;
  readonly dataShareBps: BasisPoints;
  readonly rAndDShareBps: BasisPoints;
  readonly knowableAt: UtcInstant;
};

export type SalesHiringIntensity = {
  readonly firmKey: string;
  readonly intensityScore: number;
  readonly salesShareBps: BasisPoints;
  readonly knowableAt: UtcInstant;
};

export type ManufacturingHiringIntensity = {
  readonly firmKey: string;
  readonly intensityScore: number;
  readonly manufacturingShareBps: BasisPoints;
  readonly knowableAt: UtcInstant;
};

export type GeographicHiringState = WorkforceTemporalEnvelope & {
  readonly stateId: string;
  readonly geographyCounts: Readonly<Record<string, number>>;
  readonly remoteShareBps: BasisPoints;
  readonly hybridShareBps: BasisPoints;
  readonly onsiteShareBps: BasisPoints;
  readonly expandingGeographies: readonly string[];
};

export type SubsidiaryHiringState = WorkforceTemporalEnvelope & {
  readonly stateId: string;
  readonly subsidiaryCounts: Readonly<Record<string, number>>;
  readonly parentConcentrationBps: BasisPoints;
};

export type HiringQualityState = WorkforceTemporalEnvelope & {
  readonly stateId: string;
  readonly band: HiringQualityBand;
  readonly providerCoverageScoreBps: BasisPoints;
  readonly representativenessScoreBps: BasisPoints;
  readonly duplicateRateBps: BasisPoints;
};

export type JobPostingCoverageModel = {
  readonly modelId: string;
  readonly firmKey: string;
  readonly evaluationTime: UtcInstant;
  readonly providerSharesBps: Readonly<Record<string, BasisPoints>>;
  readonly benchmarkAvailable: boolean;
  readonly reweightFactors: Readonly<Partial<Record<CoverageReweightDimension, BasisPoints>>>;
  readonly rawWeightBps: BasisPoints;
  readonly adjustedWeightBps: BasisPoints;
  readonly knowableAt: UtcInstant;
};

export type WorkforceResearchInterpretation = {
  readonly interpretationId: string;
  readonly firmKey: string;
  readonly evaluationTime: UtcInstant;
  readonly operationalStance: WorkforceOperationalStance;
  readonly postingGrowthNotUniversallyBullish: true;
  readonly linkedPredictionTargets: readonly WorkforceResearchPredictionTarget[];
  readonly narrative: string;
  readonly cautions: readonly string[];
  readonly grantsExecutionAuthority: false;
  readonly knowableAt: UtcInstant;
};

export type WorkforceIntelligenceFirmSnapshot = {
  readonly firmKey: string;
  readonly evaluationTime: UtcInstant;
  readonly observations: readonly JobPostingObservation[];
  readonly hiringDemand: HiringDemandState | null;
  readonly expansion: WorkforceExpansionState | null;
  readonly skillDemand: SkillDemandState | null;
  readonly skillMixShift: SkillMixShift | null;
  readonly innovationIntensity: InnovationHiringIntensity | null;
  readonly salesIntensity: SalesHiringIntensity | null;
  readonly manufacturingIntensity: ManufacturingHiringIntensity | null;
  readonly geographic: GeographicHiringState | null;
  readonly subsidiary: SubsidiaryHiringState | null;
  readonly quality: HiringQualityState | null;
  readonly coverage: JobPostingCoverageModel | null;
  readonly interpretation: WorkforceResearchInterpretation | null;
  readonly grantsExecutionAuthority: false;
};

export type WorkforceProviderHistoryWindow = {
  readonly firmKey: string;
  readonly windowEnd: UtcInstant;
  readonly priorWeekCount: number;
  readonly priorMonthCount: number;
  readonly priorYearCount: number | null;
  readonly industryHiringCycleIndexBps: BasisPoints | null;
};

export type RemoteStatusTally = Readonly<Record<RemoteStatus, number>>;
