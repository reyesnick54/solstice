/**
 * HELIOS EARN08 — earnings event network types.
 */

import type { UtcInstant } from '../../../../../domain/src/time.ts';
import type {
  EarningsGuidanceDirection,
  EarningsPeerRelationshipType,
  EarningsSignalDirection,
  EarningsSurpriseState,
  HELIOS_EARNINGS_EVENT_NETWORK_AUTHORITY,
  HELIOS_EARNINGS_EVENT_NETWORK_SCHEMA,
  LiquidityBucket,
  MarketCapBucket,
  MarketRegimeLabel,
  PeaDResearchHorizonDays,
} from './taxonomy.ts';

export type EarningsRelationshipEvidence = {
  readonly evidenceRefs: readonly string[];
  readonly source: string;
  readonly effectiveFrom: UtcInstant;
  readonly effectiveTo: UtcInstant | null;
  readonly observedAt: UtcInstant;
  readonly knowableAt: UtcInstant;
  readonly jurisdiction: string | null;
};

export type EarningsPeerRelationshipEdge = EarningsRelationshipEvidence & {
  readonly edgeId: string;
  readonly relationshipType: EarningsPeerRelationshipType;
  readonly fromSecurityNodeId: string;
  readonly toSecurityNodeId: string;
  readonly grantsExecutionAuthority: false;
};

export type EarningsEventRecord = {
  readonly schema: typeof HELIOS_EARNINGS_EVENT_NETWORK_SCHEMA;
  readonly authority: typeof HELIOS_EARNINGS_EVENT_NETWORK_AUTHORITY;
  readonly eventId: string;
  readonly securityNodeId: string;
  readonly fiscalPeriod: string;
  readonly industryCode: string | null;
  readonly subIndustryCode: string | null;
  readonly announcementInstant: UtcInstant;
  readonly knowableAt: UtcInstant;
  readonly surpriseState: EarningsSurpriseState;
  readonly surpriseMagnitudeBps: number | null;
  readonly announcementReturnBps: number | null;
  readonly guidanceDirection: EarningsGuidanceDirection;
  readonly marginSignal: EarningsSignalDirection;
  readonly demandSignal: EarningsSignalDirection;
  readonly analystRevisionSpeedHours: number | null;
  readonly optionsImpliedMoveBps: number | null;
  readonly transcriptSentimentScoreMilli: number | null;
  readonly grantsExecutionAuthority: false;
};

export type PeerReadThroughSnapshot = {
  readonly asOfDecisionInstant: UtcInstant;
  readonly knowableCutoff: UtcInstant;
  readonly informingPeerEventIds: readonly string[];
  readonly peerSurpriseState: EarningsSurpriseState;
  readonly peerAnnouncementReturnBps: number | null;
  readonly peerGuidanceDirection: EarningsGuidanceDirection;
  readonly peerMarginSignal: EarningsSignalDirection;
  readonly peerDemandSignal: EarningsSignalDirection;
  readonly industryEarningsBreadth: number | null;
  readonly industryRevisionBreadth: number | null;
  readonly grantsExecutionAuthority: false;
};

export type EarningsAttentionState = {
  readonly asOfInstant: UtcInstant;
  readonly numberOfConcurrentEarningsEvents: number;
  readonly marketAbsoluteReturnBps: number | null;
  readonly sectorAbsoluteReturnBps: number | null;
  readonly analystCoverage: number | null;
  readonly marketCapBucket: MarketCapBucket;
  readonly liquidityBucket: LiquidityBucket;
  readonly newsIntensity: number | null;
  readonly preEventVolumeAnomaly: number | null;
  readonly grantsExecutionAuthority: false;
};

export type PeaDDriftObservation = {
  readonly horizonDays: PeaDResearchHorizonDays;
  readonly cumulativeDriftBps: number | null;
  readonly sampleCount: number;
};

export type PEADConditionalState = {
  readonly eventId: string;
  readonly securityNodeId: string;
  readonly surpriseMagnitudeBps: number | null;
  readonly firmSizeBucket: MarketCapBucket;
  readonly liquidityBucket: LiquidityBucket;
  readonly analystCoverage: number | null;
  readonly analystRevisionSpeedHours: number | null;
  readonly attentionState: EarningsAttentionState;
  readonly optionsImpliedMoveBps: number | null;
  readonly transcriptSentimentScoreMilli: number | null;
  readonly sectorCode: string | null;
  readonly marketRegime: MarketRegimeLabel;
  readonly historicalDriftByHorizon: readonly PeaDDriftObservation[];
  /** Research conditioning only — not a trade signal or Execution Authority. */
  readonly researchOnly: true;
  readonly grantsExecutionAuthority: false;
};

export type ExpectedReturnDecomposition = {
  readonly horizonDays: number;
  readonly rawReturnBps: number | null;
  readonly marketAdjustedReturnBps: number | null;
  readonly sectorAdjustedReturnBps: number | null;
  readonly factorAdjustedReturnBps: number | null;
  readonly residualReturnBps: number | null;
  readonly factorLoadingsUsed: readonly string[];
  readonly grantsExecutionAuthority: false;
};

export type FactorReturnObservation = {
  readonly factorId: string;
  readonly returnBps: number;
};

export type OrthogonalizedResearchFeatureSet = {
  readonly targetResidualReturnBps: number | null;
  readonly orthogonalizedCovariates: Readonly<Record<string, number | null>>;
  readonly nuisancePartialledOut: readonly string[];
  readonly method: 'residualize_on_available_factors';
  readonly grantsExecutionAuthority: false;
};

export type EarningsEventNetworkSnapshot = {
  readonly schemaVersion: typeof HELIOS_EARNINGS_EVENT_NETWORK_SCHEMA;
  readonly sealedAt: UtcInstant;
  readonly events: readonly EarningsEventRecord[];
  readonly relationships: readonly EarningsPeerRelationshipEdge[];
  readonly contentDigest: string;
};
