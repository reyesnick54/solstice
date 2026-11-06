import type { UtcInstant } from '@solstice/domain';

import type {
  ComparableMultipleKind,
  PeerExclusionReason,
  PeerSelectionMethod,
  PeerSimilarityDimension,
} from './taxonomy.ts';

export type AccountingRegime = 'US_GAAP' | 'IFRS' | 'LOCAL_GAAP' | 'OTHER';

export type PeerFundamentalsSnapshot = {
  readonly revenue: number;
  readonly netIncome?: number;
  readonly ebit?: number;
  readonly ebitda?: number;
  readonly fcf?: number;
  readonly bookEquity?: number;
  readonly investedCapital?: number;
  readonly forwardEps?: number;
  readonly sharesOutstanding: number;
  readonly grossMargin?: number;
  readonly operatingMargin?: number;
  readonly ebitdaMargin?: number;
  readonly fcfMargin?: number;
  readonly roic?: number;
  readonly revenueGrowth?: number;
  readonly capitalIntensity?: number;
  readonly leverage?: number;
  readonly assetIntensity?: number;
  readonly customerConcentration?: number;
  readonly revenueRecurrence?: number;
  readonly cyclicality?: number;
};

export type PeerClassificationSnapshot = {
  readonly sector?: string;
  readonly industry?: string;
  readonly subindustry?: string;
  readonly businessModel?: string;
  readonly geography?: string;
  readonly currency: string;
};

export type PeerMarketSnapshot = {
  readonly marketCap: number;
  readonly enterpriseValue?: number;
  readonly price?: number;
  readonly beta?: number;
  readonly factorExposures?: Readonly<Record<string, number>>;
};

export type PeerCandidate = {
  readonly peerId: string;
  readonly label: string;
  readonly knowableAt: UtcInstant;
  readonly listingActiveAt: UtcInstant;
  readonly classification: PeerClassificationSnapshot;
  readonly market: PeerMarketSnapshot;
  readonly fundamentals: PeerFundamentalsSnapshot;
  readonly accountingRegime: AccountingRegime;
  readonly countryCode: string;
  readonly countryRiskPremiumBps?: number;
  readonly taxStructureLabel?: string;
};

export type SimilarityDimensionValue =
  | { readonly kind: 'categorical'; readonly value: string }
  | { readonly kind: 'numeric'; readonly value: number; readonly scale: 'linear' | 'log' };

export type PeerSimilarityVector = {
  readonly peerId: string;
  readonly dimensions: Readonly<Partial<Record<PeerSimilarityDimension, SimilarityDimensionValue>>>;
  readonly populatedDimensions: readonly PeerSimilarityDimension[];
  readonly dataQualityScore: number;
};

export type PeerSelectionMethodScore = {
  readonly method: PeerSelectionMethod;
  readonly peerId: string;
  readonly distance: number;
  readonly rank: number;
  readonly weight: number;
};

export type PeerSelectionState = {
  readonly valuationTimeUtc: UtcInstant;
  readonly targetPeerId: string;
  readonly methodScores: readonly PeerSelectionMethodScore[];
  readonly blendedWeights: Readonly<Record<string, number>>;
  readonly selectedPeerIds: readonly string[];
  readonly excludedPeers: readonly PeerExclusionRecord[];
  readonly algorithmsUsed: readonly PeerSelectionMethod[];
};

export type PeerExclusionRecord = {
  readonly peerId: string;
  readonly reason: PeerExclusionReason;
  readonly detail?: string;
};

export type ComparableMultipleObservation = {
  readonly observationId: string;
  readonly peerId: string;
  readonly multipleKind: ComparableMultipleKind;
  readonly rawMultiple: number;
  readonly justifiedMultiple: number | null;
  readonly impliedEquityValue: number;
  readonly impliedEnterpriseValue: number | null;
  readonly observationTimeUtc: UtcInstant;
  readonly knowableAt: UtcInstant;
  readonly similarityWeight: number;
  readonly dataQualityWeight: number;
  readonly recencyWeight: number;
  readonly regimeRelevanceWeight: number;
  readonly compositeWeight: number;
  readonly outlier: OutlierEvidence | null;
  readonly crossBorderAdjustmentBps: number;
  readonly excludedFromPrimaryDistribution: boolean;
};

export type OutlierEvidence = {
  readonly madScore: number;
  readonly robustZ: number;
  readonly winsorizedMultiple: number;
  readonly winsorizeApplied: boolean;
  readonly preserved: true;
};

export type JustifiedMultipleState = {
  readonly multipleKind: ComparableMultipleKind;
  readonly rawPeerMedian: number;
  readonly growthAdjustment: number;
  readonly marginAdjustment: number;
  readonly roicAdjustment: number;
  readonly riskAdjustment: number;
  readonly costOfCapitalAdjustment: number;
  readonly capitalIntensityAdjustment: number;
  readonly justifiedMultiple: number;
  readonly economicInterpretation: 'CHEAP_WEAKER_ECONOMICS' | 'CHEAP_RELATIVE_TO_COMPARABLE_ECONOMICS' | 'NEUTRAL' | 'RICH_RELATIVE_TO_COMPARABLE_ECONOMICS';
};

export type ComparableValuationDistribution = {
  readonly p05: number;
  readonly p10: number;
  readonly p25: number;
  readonly median: number;
  readonly p75: number;
  readonly p90: number;
  readonly p95: number;
  readonly sampleCount: number;
  readonly effectiveSampleWeight: number;
};

export type PeerQualityAssessment = {
  readonly peerId: string;
  readonly similarityScore: number;
  readonly fundamentalsCoverage: number;
  readonly marketDataCoverage: number;
  readonly recencyDays: number;
  readonly regimeRelevance: number;
  readonly overallQuality: number;
  readonly flags: readonly string[];
};

export type PeerPanelManifest = {
  readonly manifestId: string;
  readonly valuationTimeUtc: UtcInstant;
  readonly targetEntityLabel: string;
  readonly targetPeerId: string;
  readonly universeSize: number;
  readonly eligibleCount: number;
  readonly selectedCount: number;
  readonly excludedCount: number;
  readonly selectionState: PeerSelectionState;
  readonly qualityByPeer: readonly PeerQualityAssessment[];
  readonly multipleKindsUsed: readonly ComparableMultipleKind[];
  readonly crossBorderAdjustmentsApplied: boolean;
  readonly outlierPolicy: string;
};

export type PeerValuationDispersion = {
  readonly coefficientOfVariation: number;
  readonly interquartileRange: number;
  readonly weightedStdDev: number;
  readonly peerCount: number;
};

export type PeerConsensusStrength = {
  readonly score: number;
  readonly dominantClusterShare: number;
  readonly methodAgreement: number;
};

export type PeerPanelFragility = {
  readonly score: number;
  readonly topPeerWeightShare: number;
  readonly exclusionSensitivity: number;
  readonly drivers: readonly string[];
};

export type ProbabilisticComparablesInput = {
  readonly valuationId: string;
  readonly entityLabel: string;
  readonly valuationTimeUtc: UtcInstant;
  readonly target: PeerCandidate;
  readonly universe: readonly PeerCandidate[];
  readonly multipleKinds?: readonly ComparableMultipleKind[];
  readonly maxPeers?: number;
  readonly seed?: number;
  readonly regimeLabel?: string;
  readonly enableCopula?: boolean;
  readonly userPeerConstraints?: Readonly<{
    readonly requireSameAccounting?: boolean;
    readonly requireSameCurrency?: boolean;
    readonly maxCountryRiskGapBps?: number;
  }>;
};

export type ProbabilisticComparablesResult = {
  readonly schema: typeof import('./taxonomy.ts').VAL08_PROBABILISTIC_COMPARABLES_SCHEMA;
  readonly valuationId: string;
  readonly entityLabel: string;
  readonly grantsExecutionAuthority: false;
  readonly researchOnly: true;
  readonly seed: number;
  readonly panelManifest: PeerPanelManifest;
  readonly observations: readonly ComparableMultipleObservation[];
  readonly justifiedMultiples: readonly JustifiedMultipleState[];
  readonly equityValueDistribution: ComparableValuationDistribution;
  readonly enterpriseValueDistribution: ComparableValuationDistribution | null;
  readonly dispersion: PeerValuationDispersion;
  readonly consensus: PeerConsensusStrength;
  readonly fragility: PeerPanelFragility;
  readonly qualificationMarker: typeof import('./taxonomy.ts').HELIOS_VAL08_PROBABILISTIC_COMPARABLES_QUALIFIED;
};
