export {
  HELIOS_MD05_SCHEMA,
  HELIOS_MD05_REDUNDANT_MARKET_TRUTH_QUALIFIED,
  HELIOS_MD05_REDUNDANT_MARKET_TRUTH_BLOCKED,
  FEED_REPLICA_ROLES,
  MD05_QUALITY_DIMENSIONS,
  MD05_QUALITY_BANDS,
  FAILOVER_SCOPES,
  CONSENSUS_OUTCOMES,
  FEED_REPLICA_HEALTH,
} from './taxonomy.ts';
export type {
  FeedReplicaRole,
  Md05QualityDimension,
  Md05QualityBand,
  FailoverScope,
  ConsensusOutcome,
  FeedReplicaHealth,
} from './taxonomy.ts';

export type {
  FeedReplica,
  ProviderQualityVector,
  ProviderTrustState,
  FeedArbitrationState,
  InboundMarketTick,
  MarketSourceAttribution,
  NormalizedMarketObservation,
  FeedDivergence,
  FeedDivergenceField,
  MarketObservationConsensus,
  FailoverDecision,
} from './types.ts';

export { deduplicateAbReplicas, dedupeKeyString, replicaDedupeKey } from './dedupe.ts';
export { economicallyEquivalent, listDivergenceFields } from './compatibility.ts';
export {
  createProviderTrustState,
  compositeTrustBand,
  compareProviderTrust,
  recordProviderTick,
  recordProviderFailure,
} from './trust.ts';
export { buildMarketObservationConsensus } from './consensus.ts';
export { decideReadOnlyFailover, applyFailoverDecision } from './failover.ts';
export {
  RedundantFeedArbitrationEngine,
  type RedundantFeedArbitrationEngineOptions,
  type ArbitrationIngestResult,
} from './engine.ts';
export {
  evaluateMd05Qualification,
  type Md05QualificationChecks,
  type Md05QualificationResult,
} from './qualification.ts';
export { MD05_FIXTURE_FEED_ID, MD05_FIXTURE_REPLICAS, fixtureTick } from './fixtures.ts';
