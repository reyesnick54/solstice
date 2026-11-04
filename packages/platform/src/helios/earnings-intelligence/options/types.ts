import type { UtcInstant } from '@solstice/domain';
import type {
  HELIOS_EARN07_OPTIONS_INTELLIGENCE_AUTHORITY,
  HELIOS_EARN07_OPTIONS_INTELLIGENCE_SCHEMA,
  OptionRightType,
  OptionsDataQualityState,
  OptionsExecutionMode,
} from './taxonomy.ts';

export type OptionProviderRef = {
  readonly providerId: string;
  readonly capability: string;
  readonly observationRef: string;
};

export type AafChainCertification = {
  readonly certified: true;
  readonly providerId: string;
  readonly certifiedAt: UtcInstant;
  readonly evidenceRef: string;
  readonly aafProgram: 'AAF07_EXTERNAL_MARKET_DATA' | 'AAF08_EXTERNAL_EQUITIES';
};

export type OptionGreeksObservation = {
  readonly deltaBps: number | null;
  readonly gammaBps: number | null;
  readonly vegaBps: number | null;
  readonly thetaBps: number | null;
  readonly vannaBps: number | null;
  readonly volgaBps: number | null;
  readonly charmBps: number | null;
};

export type OptionQuoteObservation = {
  readonly schema: typeof HELIOS_EARN07_OPTIONS_INTELLIGENCE_SCHEMA;
  readonly observationRef: string;
  readonly contractSymbol: string;
  readonly bidMinor: bigint | null;
  readonly askMinor: bigint | null;
  readonly midMinor: bigint | null;
  readonly quoteTime: UtcInstant;
  readonly knowableAt: UtcInstant;
  readonly source: OptionProviderRef;
  readonly grantsExecutionAuthority: false;
};

export type OptionVolumeObservation = {
  readonly schema: typeof HELIOS_EARN07_OPTIONS_INTELLIGENCE_SCHEMA;
  readonly observationRef: string;
  readonly contractSymbol: string;
  readonly volumeContracts: bigint;
  readonly sessionDate: string;
  readonly asOf: UtcInstant;
  readonly knowableAt: UtcInstant;
  readonly source: OptionProviderRef;
  readonly grantsExecutionAuthority: false;
};

export type OptionOpenInterestObservation = {
  readonly schema: typeof HELIOS_EARN07_OPTIONS_INTELLIGENCE_SCHEMA;
  readonly observationRef: string;
  readonly contractSymbol: string;
  readonly openInterestContracts: bigint;
  readonly asOf: UtcInstant;
  readonly knowableAt: UtcInstant;
  readonly source: OptionProviderRef;
  readonly grantsExecutionAuthority: false;
};

export type OptionImpliedVolatilityObservation = {
  readonly schema: typeof HELIOS_EARN07_OPTIONS_INTELLIGENCE_SCHEMA;
  readonly observationRef: string;
  readonly contractSymbol: string;
  readonly impliedVolBps: number;
  readonly asOf: UtcInstant;
  readonly knowableAt: UtcInstant;
  readonly source: OptionProviderRef;
  readonly grantsExecutionAuthority: false;
};

export type OptionContractObservation = {
  readonly schema: typeof HELIOS_EARN07_OPTIONS_INTELLIGENCE_SCHEMA;
  readonly contractSymbol: string;
  readonly underlyingInstrumentId: string;
  readonly right: OptionRightType;
  readonly strikeMinor: bigint;
  readonly expirationDate: string;
  readonly quote: OptionQuoteObservation | null;
  readonly volume: OptionVolumeObservation | null;
  readonly openInterest: OptionOpenInterestObservation | null;
  readonly impliedVolatility: OptionImpliedVolatilityObservation | null;
  readonly greeks: OptionGreeksObservation | null;
  readonly grantsExecutionAuthority: false;
};

export type OptionChainSnapshot = {
  readonly schema: typeof HELIOS_EARN07_OPTIONS_INTELLIGENCE_SCHEMA;
  readonly authority: typeof HELIOS_EARN07_OPTIONS_INTELLIGENCE_AUTHORITY;
  readonly snapshotId: string;
  readonly underlyingInstrumentId: string;
  readonly underlyingSpotMinor: bigint;
  readonly chainTimestamp: UtcInstant;
  readonly knowableAt: UtcInstant;
  readonly earningsEventId: string;
  readonly eventScheduledAt: UtcInstant;
  readonly contracts: readonly OptionContractObservation[];
  readonly aafCertification: AafChainCertification;
  readonly grantsExecutionAuthority: false;
};

export type DealerGammaProxyAssumptions = {
  readonly treatsOpenInterestAsDealerShort: false;
  readonly signConvention: 'CALL_POSITIVE_PUT_NEGATIVE';
  readonly notDealerPositionInference: true;
  readonly documentation: string;
};

export type DealerGammaProxy = {
  readonly label: 'DealerGammaProxy';
  readonly proxyGammaNotionalBps: number | null;
  readonly assumptions: DealerGammaProxyAssumptions;
  readonly grantsExecutionAuthority: false;
};

export type OptionsPreEventMetrics = {
  readonly evaluationTime: UtcInstant;
  readonly ATMStraddleImpliedMoveBps: number | null;
  readonly IVExpectedMoveBps: number | null;
  readonly NearTermIVBps: number | null;
  readonly PostEventIVProxyBps: number | null;
  readonly IVTermStructureBps: number | null;
  readonly IVEventPremiumBps: number | null;
  readonly IVRankBps: number | null;
  readonly IVPercentileBps: number | null;
  readonly CallSkewBps: number | null;
  readonly PutSkewBps: number | null;
  readonly PutCallVolumeRatioScaled: number | null;
  readonly PutCallOpenInterestRatioScaled: number | null;
  readonly DirectionalCallVolume: bigint;
  readonly DirectionalPutVolume: bigint;
  readonly VolumeToOpenInterestScaled: number | null;
  readonly AbnormalOptionsVolumeScaled: number | null;
  readonly CallPutDemandImbalanceScaled: number | null;
  readonly dealerGammaProxy: DealerGammaProxy | null;
  readonly grantsExecutionAuthority: false;
};

export type ImpliedMoveDistributionState = {
  readonly centralMoveBps: number | null;
  readonly straddleImpliedMoveBps: number | null;
  readonly ivExpectedMoveBps: number | null;
  readonly confidenceBandBps: number | null;
};

export type DirectionalDemandState = {
  readonly callPutVolumeImbalanceScaled: number | null;
  readonly directionalCallVolume: bigint;
  readonly directionalPutVolume: bigint;
  readonly putCallVolumeRatioScaled: number | null;
  readonly narrativeHint: string | null;
};

export type VolatilityRiskState = {
  readonly nearTermIVBps: number | null;
  readonly postEventIVProxyBps: number | null;
  readonly ivTermStructureBps: number | null;
  readonly ivEventPremiumBps: number | null;
  readonly ivRankBps: number | null;
  readonly ivPercentileBps: number | null;
};

export type SkewState = {
  readonly callSkewBps: number | null;
  readonly putSkewBps: number | null;
};

export type OptionsEarningsLiquidityState = {
  readonly volumeToOpenInterestScaled: number | null;
  readonly abnormalOptionsVolumeScaled: number | null;
};

export type OptionsDataQualityReport = {
  readonly state: OptionsDataQualityState;
  readonly missingFields: readonly string[];
  readonly chainObservationCount: number;
};

export type OptionsEarningsExpectationState = {
  readonly schema: typeof HELIOS_EARN07_OPTIONS_INTELLIGENCE_SCHEMA;
  readonly authority: typeof HELIOS_EARN07_OPTIONS_INTELLIGENCE_AUTHORITY;
  readonly executionMode: OptionsExecutionMode;
  readonly earningsEventId: string;
  readonly underlyingInstrumentId: string;
  readonly evaluationTime: UtcInstant;
  readonly snapshotId: string;
  readonly impliedMoveDistribution: ImpliedMoveDistributionState;
  readonly directionalDemandState: DirectionalDemandState;
  readonly volatilityRiskState: VolatilityRiskState;
  readonly skewState: SkewState;
  readonly liquidityState: OptionsEarningsLiquidityState;
  readonly dataQuality: OptionsDataQualityReport;
  readonly preEventMetrics: OptionsPreEventMetrics;
  readonly grantsExecutionAuthority: false;
};

export type OptionsEarningsRealizedComparison = {
  readonly schema: typeof HELIOS_EARN07_OPTIONS_INTELLIGENCE_SCHEMA;
  readonly earningsEventId: string;
  readonly realizedAt: UtcInstant;
  readonly preEventEvaluationTime: UtcInstant;
  readonly realizedMoveBps: number;
  readonly impliedMoveErrorBps: number | null;
  readonly volatilityCrushBps: number | null;
  readonly directionalDemandAccuracyScaled: number | null;
  readonly grantsExecutionAuthority: false;
};

export type OptionsEarningsResearchBrief = {
  readonly agentId: 'OptionsEarningsResearchAgent';
  readonly earningsEventId: string;
  readonly evaluationTime: UtcInstant;
  readonly summary: string;
  readonly impliedMoveNarrative: string;
  readonly demandNarrative: string;
  readonly volatilityNarrative: string;
  readonly caveats: readonly string[];
  readonly optionsExecutionEnabled: false;
  readonly grantsExecutionAuthority: false;
};

export type HistoricalIvSample = {
  readonly asOf: UtcInstant;
  readonly atmIvBps: number;
};

export type OptionsVolumeBaseline = {
  readonly medianDailyVolume: bigint;
  readonly sampleDays: number;
};
