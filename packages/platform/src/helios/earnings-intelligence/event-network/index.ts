export {
  HELIOS_EARNINGS_EVENT_NETWORK_SCHEMA,
  HELIOS_EARNINGS_EVENT_NETWORK_AUTHORITY,
  EARNINGS_PEER_RELATIONSHIP_TYPES,
  EVIDENCE_REQUIRED_PEER_RELATIONSHIPS,
  EARNINGS_SURPRISE_STATES,
  EARNINGS_GUIDANCE_DIRECTIONS,
  EARNINGS_SIGNAL_DIRECTIONS,
  MARKET_CAP_BUCKETS,
  LIQUIDITY_BUCKETS,
  MARKET_REGIME_LABELS,
  PEAD_RESEARCH_HORIZON_DAYS,
  HELIOS_EARN08,
  HELIOS_EARN08_EVENT_NETWORK_QUALIFIED,
  HELIOS_EARN08_EVENT_NETWORK_BLOCKED,
  type EarningsPeerRelationshipType,
  type EarningsSurpriseState,
  type EarningsGuidanceDirection,
  type EarningsSignalDirection,
  type MarketCapBucket,
  type LiquidityBucket,
  type MarketRegimeLabel,
  type PeaDResearchHorizonDays,
} from './taxonomy.ts';

export type {
  EarningsRelationshipEvidence,
  EarningsPeerRelationshipEdge,
  EarningsEventRecord,
  PeerReadThroughSnapshot,
  EarningsAttentionState,
  PeaDDriftObservation,
  PEADConditionalState,
  ExpectedReturnDecomposition,
  FactorReturnObservation,
  OrthogonalizedResearchFeatureSet,
  EarningsEventNetworkSnapshot,
} from './types.ts';

export {
  assertEarningsRelationshipEvidence,
  createEarningsEventNetworkStore,
  type EarningsEventNetworkStore,
  type RegisterEarningsPeerRelationshipInput,
} from './relationship-store.ts';

export { computePeerReadThrough, selectInformingPeerEvents, type PeerReadThroughInput } from './peer-read-through.ts';
export { computeEarningsAttentionState, type EarningsAttentionStateInput } from './attention-state.ts';
export {
  buildPEADConditionalState,
  isNaivePeadTradeRule,
  type BuildPEADConditionalStateInput,
  type HistoricalDriftSample,
} from './pead-diagnostic.ts';
export {
  decomposeExpectedReturn,
  buildOrthogonalizedResearchFeatures,
  type ReturnDecompositionInput,
  type OrthogonalizeResearchFeaturesInput,
} from './return-decomposition.ts';

export {
  createHeliosEarningsEventNetworkFabric,
  type HeliosEarningsEventNetworkFabric,
  type HeliosEarningsEventNetworkFabricOptions,
} from './fabric.ts';

export { seedEarn08ReferenceEventNetwork, type Earn08FixtureHandles } from './fixtures.ts';

export {
  evaluateEarn08EventNetworkQualification,
  runEarn08QualificationHarness,
  type Earn08QualificationChecks,
  type Earn08QualificationResult,
} from './qualification.ts';
