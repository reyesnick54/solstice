import type { UtcInstant } from '@solstice/domain';
import type { EntitlementClass } from '../observation/types.ts';
import type { RevisionPolicy } from '../feature-fabric/temporal-types.ts';
import type { TemporalObservation } from '../feature-fabric/temporal-types.ts';
import type {
  AlternativeDataSignalFamily,
  AltDataProviderSurface,
  Alt01CanonicalFeatureId,
  HELIOS_ALT01_ALTERNATIVE_DATA_INTELLIGENCE_SCHEMA,
  AafCertifiedAltFeatureId,
  AlternativeDataSkepticAttackVector,
  AttentionToSalesInference,
  DigitalDemandAnomalyClass,
  DigitalDemandInputFamily,
  ProviderEstimateSemantics,
  SearchSeriesValueKind,
} from './taxonomy.ts';
import type { DigitalDemandTemporalEnvelope } from './temporal-envelope.ts';

export type AlternativeDataLicenseClass =
  | 'OPEN'
  | 'COMMERCIAL'
  | 'RESTRICTED'
  | 'GOVERNMENT_OFFICIAL'
  | 'UNKNOWN';

export type AlternativeDataQualityState =
  | 'VALID'
  | 'DEGRADED_STALE'
  | 'DEGRADED_LOW_CONFIDENCE'
  | 'DEGRADED_PARTIAL_COVERAGE'
  | 'UNAVAILABLE'
  | 'QUARANTINED';

export type AlternativeDataGeographicCoverage = {
  readonly regionCodes: readonly string[];
  readonly coverageKind: 'GLOBAL' | 'REGIONAL' | 'MARKET' | 'FACILITY' | 'UNKNOWN';
  readonly confidence: number | null;
};

export type AlternativeDataEntitlement = {
  readonly entitlementRef: string;
  readonly entitlementClass: EntitlementClass;
  readonly licenseClass: AlternativeDataLicenseClass;
  readonly commercialUseStatus: 'permitted' | 'restricted' | 'unknown';
};

export type AlternativeDataEntityLink = {
  readonly canonicalEntityId: string | null;
  readonly canonicalInstrumentId: string | null;
  readonly providerEntityRef: string | null;
  readonly entityLinkConfidence: number | null;
  readonly resolutionRef: string | null;
};

export type AlternativeDataRevision = {
  readonly revisionId: string;
  readonly revisionSequence: number;
  readonly supersedesRevisionId: string | null;
  readonly providerAvailableAt: UtcInstant;
  readonly sunreyArrivalTime: UtcInstant;
  readonly knowableAt: UtcInstant;
  readonly valueMinor: bigint | null;
  readonly valueText: string | null;
  readonly evidenceRef: string | null;
};

export type AlternativeDataCoverageState = {
  readonly signalFamily: AlternativeDataSignalFamily;
  readonly providerId: string;
  readonly geographicCoverage: AlternativeDataGeographicCoverage;
  readonly temporalCoverageStart: UtcInstant | null;
  readonly temporalCoverageEnd: UtcInstant | null;
  readonly observationCount: number;
  readonly degraded: boolean;
  readonly tensorDigest: string | null;
};

export type AlternativeDataSourceManifest = {
  readonly schema: typeof HELIOS_ALT01_ALTERNATIVE_DATA_INTELLIGENCE_SCHEMA;
  readonly manifestId: string;
  readonly providerId: string;
  readonly providerSurface: AltDataProviderSurface;
  readonly signalFamilies: readonly AlternativeDataSignalFamily[];
  readonly sourceRef: string;
  readonly catalogEntryRef: string | null;
  readonly entitlement: AlternativeDataEntitlement;
  readonly geographicCoverage: AlternativeDataGeographicCoverage;
  readonly grantsExecutionAuthority: false;
};

export type AlternativeDataSeries = {
  readonly seriesId: string;
  readonly signalFamily: AlternativeDataSignalFamily;
  readonly providerId: string;
  readonly manifestId: string;
  readonly entityLink: AlternativeDataEntityLink;
  readonly unit: string | null;
  readonly revisionChainId: string;
  readonly grantsExecutionAuthority: false;
};

export type AlternativeDataObservation = {
  readonly schema: typeof HELIOS_ALT01_ALTERNATIVE_DATA_INTELLIGENCE_SCHEMA;
  readonly observationId: string;
  readonly seriesId: string;
  readonly signalFamily: AlternativeDataSignalFamily;
  readonly eventTime: UtcInstant | null;
  readonly sourcePublishedAt: UtcInstant | null;
  readonly providerAvailableAt: UtcInstant;
  readonly sunreyArrivalTime: UtcInstant;
  readonly knowableAt: UtcInstant;
  readonly revisionId: string;
  readonly sourceRef: string;
  readonly providerId: string;
  readonly licenseClass: AlternativeDataLicenseClass;
  readonly entitlementRef: string;
  readonly entityLink: AlternativeDataEntityLink;
  readonly geographicCoverage: AlternativeDataGeographicCoverage;
  readonly qualityState: AlternativeDataQualityState;
  readonly valueMinor: bigint | null;
  readonly valueText: string | null;
  readonly grantsExecutionAuthority: false;
};

export type AlternativeDataFeature = {
  readonly featureId: Alt01CanonicalFeatureId;
  readonly formulaVersion: string;
  readonly signalFamily: AlternativeDataSignalFamily;
  readonly valueMinor: bigint | null;
  readonly valueText: string | null;
  readonly knowableAt: UtcInstant;
  readonly qualityState: AlternativeDataQualityState;
  readonly observationRefs: readonly string[];
  readonly entityLink: AlternativeDataEntityLink;
  readonly grantsExecutionAuthority: false;
};

export type AlternativeDataIntelligencePlane = {
  readonly evaluationTime: UtcInstant;
  readonly revisionPolicy: RevisionPolicy;
  readonly authorityClass: 'REFERENCE_AND_RESEARCH_ONLY';
  readonly observations: readonly AlternativeDataObservation[];
  readonly features: readonly AlternativeDataFeature[];
  readonly temporalObservations: readonly TemporalObservation[];
  readonly coverageStates: readonly AlternativeDataCoverageState[];
  readonly grantsExecutionAuthority: false;
};

export type AlternativeDataIntelligenceStoreSnapshot = {
  readonly manifests: readonly AlternativeDataSourceManifest[];
  readonly series: readonly AlternativeDataSeries[];
  readonly observations: readonly AlternativeDataObservation[];
};

export type AlternativeDataObservationInput = Omit<
  AlternativeDataObservation,
  'schema' | 'grantsExecutionAuthority'
>;

export type AafQualificationLabel = 'CERTIFIED' | 'BLOCKED' | 'DEGRADED' | 'RESEARCH_ONLY';

export type SignalFamilyState = {
  readonly familyId: string;
  readonly modality: string;
  readonly stateLabel: string;
  readonly uncertaintyBps: number;
  readonly coverageFractionBps: number;
  readonly knowableAt: UtcInstant;
  readonly blocked: boolean;
  readonly blockReason: string | null;
};

export type IncrementalInformationAssessment = {
  readonly inSampleLiftBps: number;
  readonly holdoutLiftBps: number;
  readonly incrementalOnHoldout: boolean;
  readonly rejectedForOverfit: boolean;
};

export type SourceContribution = {
  readonly providerId: string;
  readonly modality: string;
  readonly weightBps: number;
  readonly reliabilityBps: number;
  readonly licensed: boolean;
};

export type ContradictingSignal = {
  readonly signalId: string;
  readonly familyId: string;
  readonly summary: string;
  readonly severity: 'LOW' | 'MEDIUM' | 'HIGH';
};

export type SkepticFinding = {
  readonly vector: AlternativeDataSkepticAttackVector;
  readonly passed: boolean;
  readonly detail: string;
};

export type AltStrategyGenomeFeatureRow = {
  readonly featureId: AafCertifiedAltFeatureId;
  readonly stateLabel: string;
  readonly uncertaintyBps: number;
  readonly knowableAt: UtcInstant;
  readonly aafCertified: boolean;
  readonly rawProviderRecordExposed: false;
};

export type AlternativeDataResearchState = {
  readonly schema: 'sunrey.helios.alternative-data-research-state.v1';
  readonly entityId: string;
  readonly decisionTime: UtcInstant;
  readonly signalFamilyStates: readonly SignalFamilyState[];
  readonly incrementalInformation: IncrementalInformationAssessment;
  readonly signalUncertainty: number;
  readonly coverage: number;
  readonly providerReliability: number;
  readonly entityResolutionQuality: number;
  readonly AAFQualification: AafQualificationLabel;
  readonly evidenceRefs: readonly string[];
  readonly sourceContributions: readonly SourceContribution[];
  readonly contradictingSignals: readonly ContradictingSignal[];
  readonly confidence: number;
  readonly skepticFindings: readonly SkepticFinding[];
  readonly researchEvidenceOnly: true;
  readonly grantsExecutionAuthority: false;
};

export type AltResearchBuildInput = {
  readonly entityId: string;
  readonly decisionTime: UtcInstant;
  readonly entityResolutionQuality: number;
  readonly signalFamilies: readonly SignalFamilyState[];
  readonly sources: readonly SourceContribution[];
  readonly contradictions: readonly ContradictingSignal[];
  readonly skepticFindings: readonly SkepticFinding[];
  readonly incremental: IncrementalInformationAssessment;
  readonly evidenceRefs: readonly string[];
};

export type ProviderNumericEstimate = {
  readonly semantics: ProviderEstimateSemantics;
  /** Provider point estimate; not an exact user count unless semantics allow (never for ALT05 fixtures). */
  readonly point: number;
  readonly low: number | null;
  readonly high: number | null;
  readonly unitLabel: string;
  readonly isExactCount: false;
};

export type SearchAttentionFeatures = {
  readonly searchLevel: number;
  readonly searchMomentum: number;
  readonly searchAcceleration: number;
  readonly queryBreadth: number;
  readonly brandSearchShare: number;
  readonly productSearchShare: number;
  readonly categoryRelativeSearch: number;
};

export type WebDemandFeatures = {
  readonly visits: ProviderNumericEstimate;
  readonly uniqueAggregateVisitors: ProviderNumericEstimate;
  readonly visitGrowth: number;
  readonly engagementDurationAggregate: number;
  readonly referralMixAggregate: Readonly<Record<string, number>>;
};

export type AppDemandFeatures = {
  readonly ranking: number | null;
  readonly downloadEstimate: ProviderNumericEstimate | null;
  readonly activeUserEstimate: ProviderNumericEstimate | null;
  readonly usageGrowth: number;
  readonly reviewVelocity: ProviderNumericEstimate | null;
};

export type SearchAttentionObservation = {
  readonly observationId: string;
  readonly envelope: DigitalDemandTemporalEnvelope;
  readonly periodStart: UtcInstant;
  readonly periodEnd: UtcInstant;
  readonly features: SearchAttentionFeatures;
  readonly rawIndexSeries: readonly number[];
};

export type WebDemandObservation = {
  readonly observationId: string;
  readonly envelope: DigitalDemandTemporalEnvelope;
  readonly periodStart: UtcInstant;
  readonly periodEnd: UtcInstant;
  readonly features: WebDemandFeatures;
};

export type AppDemandObservation = {
  readonly observationId: string;
  readonly envelope: DigitalDemandTemporalEnvelope;
  readonly periodStart: UtcInstant;
  readonly periodEnd: UtcInstant;
  readonly features: AppDemandFeatures;
};

export type SearchSeriesVintagePoint = {
  readonly periodEnd: UtcInstant;
  readonly valueKind: SearchSeriesValueKind;
  readonly rawIndex: number | null;
  readonly normalizedIndex: number | null;
};

export type SearchSeriesVintage = {
  readonly vintageId: string;
  readonly capturedAt: UtcInstant;
  readonly revisionSequence: number;
  readonly points: readonly SearchSeriesVintagePoint[];
};

export type SearchSeriesReliability = {
  readonly entityId: string;
  readonly providerId: string;
  readonly vintages: readonly SearchSeriesVintage[];
  readonly revisionDriftBps: number;
  readonly zeroVsMissingDistinctionEnforced: boolean;
  readonly samplingNoiseEstimate: number;
  readonly rescalingChangeDetected: boolean;
  readonly rescalingChangeAt: UtcInstant | null;
  readonly robustNormalizationScale: number;
  readonly reliabilityScoreBps: number;
};

export type LatentDigitalDemand = {
  readonly level: number;
  readonly momentum: number;
  readonly uncertainty: number;
  readonly stateRef: string;
};

export type DigitalDemandAnomalyAssessment = {
  readonly anomalyClass: DigitalDemandAnomalyClass;
  readonly robustZ: number;
  readonly seasonalResidual: number;
  readonly changePointDetected: boolean;
  readonly changePointAt: UtcInstant | null;
  readonly attentionToSales: AttentionToSalesInference;
  readonly spikeNotTreatedAsSales: boolean;
};

export type DigitalDemandState = {
  readonly stateId: string;
  readonly entityId: string;
  readonly asOf: UtcInstant;
  readonly compiledAt: UtcInstant;
  readonly inputFamiliesPresent: readonly DigitalDemandInputFamily[];
  readonly search: SearchAttentionObservation | null;
  readonly web: WebDemandObservation | null;
  readonly app: AppDemandObservation | null;
  readonly searchReliability: SearchSeriesReliability | null;
  readonly latent: LatentDigitalDemand;
  readonly anomaly: DigitalDemandAnomalyAssessment;
};
