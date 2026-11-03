import type { UtcInstant } from '../../../../../domain/src/time.ts';
import type { EntitlementClass } from '../../observation/types.ts';
import type { RevisionPolicy } from '../temporal-types.ts';
import type { TemporalObservation } from '../temporal-types.ts';
import type {
  Aaf10FeatureId,
  Aaf10MacroReleaseType,
  Aaf10UsMacroSeries,
  HELIOS_AAF10_MACRO_INTELLIGENCE_SCHEMA,
} from './taxonomy.ts';

export type MacroSeriesProviderRef = {
  readonly providerId: string;
  readonly seriesId: string;
  readonly capability: string;
};

export type MacroEntitlementSnapshot = {
  readonly entitlementClass: EntitlementClass;
  readonly sourceProvider: string;
  readonly commercialUseStatus: 'permitted' | 'restricted' | 'unknown';
};

export type MacroValueRevision = {
  readonly revisionSequence: number;
  readonly valueMinor: bigint;
  readonly knowableAt: UtcInstant;
  readonly providerAvailabilityTime: UtcInstant;
  readonly sunreyArrivalTime: UtcInstant;
  readonly evidenceRef: string | null;
};

export type MacroOfficialReleaseEvent = {
  readonly schema: typeof HELIOS_AAF10_MACRO_INTELLIGENCE_SCHEMA;
  readonly eventId: string;
  readonly releaseType: Aaf10MacroReleaseType;
  readonly seriesKey: Aaf10UsMacroSeries;
  readonly periodRepresented: string;
  readonly scheduledReleaseTime: UtcInstant | null;
  readonly actualPublicationTime: UtcInstant | null;
  readonly providerAvailabilityTime: UtcInstant;
  readonly sunreyArrivalTime: UtcInstant;
  readonly knowableAt: UtcInstant;
  readonly initialReportedValue: MacroValueRevision;
  readonly revisions: readonly MacroValueRevision[];
  readonly revisionChainId: string;
  readonly evidenceRefs: readonly string[];
  readonly source: MacroSeriesProviderRef;
  readonly entitlement: MacroEntitlementSnapshot;
  readonly grantsExecutionAuthority: false;
};

export type MacroSeriesReadingInput = {
  readonly seriesKey: Aaf10UsMacroSeries;
  readonly periodEnd: UtcInstant;
  readonly valueMinor: bigint;
  readonly scheduledReleaseTime?: UtcInstant | null;
  readonly actualPublicationTime?: UtcInstant | null;
  readonly providerAvailabilityTime: UtcInstant;
  readonly sunreyArrivalTime: UtcInstant;
  readonly knowableAt: UtcInstant;
  readonly revisionSequence: number;
  readonly revisionChainId: string;
  readonly observationRef: string;
  readonly evidenceRef?: string | null;
  readonly source: MacroSeriesProviderRef;
  readonly entitlement: MacroEntitlementSnapshot;
  readonly releaseType?: Aaf10MacroReleaseType;
};

export type CertifiedExpectationInput = {
  readonly metricId: string;
  readonly valueMinor: bigint;
  readonly knowableAt: UtcInstant;
  readonly sourceId: string;
  readonly certifiedProviderId: string;
};

export type Aaf10ComputedFeature = {
  readonly featureId: Aaf10FeatureId;
  readonly formulaVersion: string;
  readonly valueMinor: bigint | null;
  readonly valueText: string | null;
  readonly knowableAt: UtcInstant;
  readonly quality: 'VALID' | 'DEGRADED_STALE' | 'DEGRADED_MISSING_INPUT' | 'UNAVAILABLE';
  readonly observationRefs: readonly string[];
  readonly grantsExecutionAuthority: false;
};

export type Aaf10MacroFeaturePlane = {
  readonly evaluationTime: UtcInstant;
  readonly revisionPolicy: RevisionPolicy;
  readonly features: readonly Aaf10ComputedFeature[];
  readonly observations: readonly TemporalObservation[];
  readonly releaseEvents: readonly MacroOfficialReleaseEvent[];
  readonly grantsExecutionAuthority: false;
};

export type M13MacroRegimeInputBundle = {
  readonly evaluationTime: UtcInstant;
  readonly inflationTrendBps: bigint | null;
  readonly unemploymentTrendBps: bigint | null;
  readonly yieldCurveSlopeBps: bigint | null;
  readonly realRateProxyBps: bigint | null;
  readonly rateChangeState: string | null;
  readonly highImpactReleaseActive: boolean;
  readonly evidenceRefs: readonly string[];
  readonly grantsExecutionAuthority: false;
};

export type MacroIntelligenceStoreSnapshot = {
  readonly observations: readonly TemporalObservation[];
  readonly releaseEvents: readonly MacroOfficialReleaseEvent[];
};
