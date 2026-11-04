import type { UtcInstant } from '@solstice/domain';
import type {
  BeatQualityDriver,
  EarningsExpectationSource,
  EarningsSurpriseDimension,
  EarningsSurpriseMethod,
  HELIOS_EARN03_SURPRISE_TENSOR_SCHEMA,
  PeerNormalizationScope,
} from './taxonomy.ts';

/** Fixed-point standardized surprise (four decimal places × 10_000). */
export type ScaledSurprise = number;

export const EARNINGS_SURPRISE_QUALITY_STATES = [
  'VALID',
  'DEGRADED_MISSING_INPUT',
  'DEGRADED_STALE_EXPECTATION',
  'UNAVAILABLE',
  'SOURCE_MIXING_REJECTED',
] as const;

export type EarningsSurpriseQualityState = (typeof EARNINGS_SURPRISE_QUALITY_STATES)[number];

export type EarningsSurpriseQuality = {
  readonly state: EarningsSurpriseQualityState;
  readonly expectationSource: EarningsExpectationSource;
  readonly expectationSnapshotId: string;
  readonly knowableAt: UtcInstant;
  readonly notes: readonly string[];
};

export type ExpectationPointInput = {
  readonly dimension: EarningsSurpriseDimension;
  readonly segmentId: string | null;
  readonly fiscalPeriod: string;
  readonly valueMinor: bigint | null;
  readonly valueScaled: number | null;
  readonly knowableAt: UtcInstant;
  readonly observationRef: string;
  readonly source: EarningsExpectationSource;
};

export type ExpectationDispersionInput = {
  readonly dimension: EarningsSurpriseDimension;
  readonly segmentId: string | null;
  readonly fiscalPeriod: string;
  /** Street dispersion (e.g. std dev or high-low) in same units as valueMinor / valueScaled. */
  readonly dispersionMinor: bigint | null;
  readonly dispersionScaled: number | null;
  readonly medianMinor: bigint | null;
  readonly medianScaled: number | null;
  readonly knowableAt: UtcInstant;
  readonly source: EarningsExpectationSource;
};

export type PreReleaseExpectationSnapshot = {
  readonly snapshotId: string;
  readonly canonicalEntityId: string;
  readonly fiscalPeriod: string;
  readonly cutoffUtc: UtcInstant;
  readonly knowableAt: UtcInstant;
  readonly points: readonly ExpectationPointInput[];
  readonly dispersions: readonly ExpectationDispersionInput[];
  readonly grantsExecutionAuthority: false;
};

export type EarningsActualInput = {
  readonly dimension: EarningsSurpriseDimension;
  readonly segmentId: string | null;
  readonly fiscalPeriod: string;
  readonly valueMinor: bigint | null;
  readonly valueScaled: number | null;
  readonly knowableAt: UtcInstant;
  readonly observationRef: string;
};

export type SeasonalHistoryInput = {
  readonly dimension: EarningsSurpriseDimension;
  readonly segmentId: string | null;
  readonly quarterlyDeltasMinor: readonly bigint[];
  readonly quarterlyDeltasScaled: readonly number[];
};

export type EarningsSurpriseCellKey = {
  readonly dimension: EarningsSurpriseDimension;
  readonly segmentId: string | null;
  readonly method: EarningsSurpriseMethod;
  readonly expectationSource: EarningsExpectationSource;
};

export type EarningsSurpriseDecomposition = {
  readonly key: EarningsSurpriseCellKey;
  readonly rawDeltaMinor: bigint | null;
  readonly rawDeltaScaled: number | null;
  readonly standardizedScaled: ScaledSurprise | null;
  readonly calculable: boolean;
  readonly quality: EarningsSurpriseQuality;
  readonly grantsExecutionAuthority: false;
};

export type BeatQualityLine = {
  readonly driver: BeatQualityDriver;
  readonly epsImpactMinor: bigint;
  readonly evidenceRef: string | null;
};

export type BeatQualityDecomposition = {
  readonly schema: typeof HELIOS_EARN03_SURPRISE_TENSOR_SCHEMA;
  readonly fiscalPeriod: string;
  readonly reportedEpsBeatMinor: bigint;
  readonly attributedEpsMinor: bigint;
  readonly unattributedEpsMinor: bigint;
  readonly lines: readonly BeatQualityLine[];
  readonly dominantDriver: BeatQualityDriver;
  readonly operatingQualityScoreScaled: ScaledSurprise;
  readonly grantsExecutionAuthority: false;
};

export type PeerSurpriseNormalization = {
  readonly scope: PeerNormalizationScope;
  readonly peerGroupId: string;
  readonly dimension: EarningsSurpriseDimension;
  readonly method: EarningsSurpriseMethod;
  readonly expectationSource: EarningsExpectationSource;
  readonly entityStandardizedScaled: ScaledSurprise | null;
  readonly peerMedianScaled: ScaledSurprise | null;
  readonly peerRelativeScaled: ScaledSurprise | null;
  readonly grantsExecutionAuthority: false;
};

export type EarningsSurpriseTensor = {
  readonly schema: typeof HELIOS_EARN03_SURPRISE_TENSOR_SCHEMA;
  readonly formulaVersion: string;
  readonly canonicalEntityId: string;
  readonly fiscalPeriod: string;
  readonly evaluationTimeUtc: UtcInstant;
  readonly preEventPriceMinor: bigint | null;
  readonly expectationSnapshot: PreReleaseExpectationSnapshot;
  readonly cells: readonly EarningsSurpriseDecomposition[];
  readonly beatQuality: BeatQualityDecomposition | null;
  readonly peerNormalizations: readonly PeerSurpriseNormalization[];
  readonly grantsExecutionAuthority: false;
};

export type EarningsSurpriseVectorSlot = {
  readonly cellKey: EarningsSurpriseCellKey;
  readonly decomposition: EarningsSurpriseDecomposition;
};

/** Composite surprise vector — no universal bullish/bearish scalar. */
export type EarningsSurpriseVector = {
  readonly schema: typeof HELIOS_EARN03_SURPRISE_TENSOR_SCHEMA;
  readonly vectorId: string;
  readonly tensorRef: string;
  readonly evaluationTimeUtc: UtcInstant;
  readonly orderedSlots: readonly EarningsSurpriseVectorSlot[];
  readonly grantsExecutionAuthority: false;
};

export type BuildSurpriseTensorInput = {
  readonly canonicalEntityId: string;
  readonly fiscalPeriod: string;
  readonly evaluationTimeUtc: UtcInstant;
  readonly expectationSnapshot: PreReleaseExpectationSnapshot;
  readonly actuals: readonly EarningsActualInput[];
  readonly preEventPriceMinor: bigint | null;
  readonly seasonalHistory?: readonly SeasonalHistoryInput[];
  readonly beatQualityLines?: readonly BeatQualityLine[];
  readonly reportedEpsBeatMinor?: bigint | null;
  readonly peerGroups?: Readonly<
    Partial<
      Record<
        PeerNormalizationScope,
        {
          readonly groupId: string;
          readonly peerStandardizedByKey: Readonly<Record<string, ScaledSurprise>>;
        }
      >
    >
  >;
};
