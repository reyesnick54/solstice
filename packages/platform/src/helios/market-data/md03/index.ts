export {
  FEED_RECOVERY_PHASES,
  BOOK_AUTHORITY_CLASSES,
  SEQUENCE_ANOMALY_KINDS,
  RECOVERY_ADAPTER_KINDS,
  RECOVERY_REQUEST_STATUSES,
  HELIOS_MD03,
  type FeedRecoveryPhase,
  type BookAuthorityClass,
  type SequenceAnomalyKind,
  type RecoveryAdapterKind,
  type RecoveryRequestStatus,
} from './taxonomy.ts';

export type {
  SequenceGap,
  RecoveryRequest,
  RecoveryState,
  FeedSessionState,
  MarketFeedIncrementalUpdate,
  MarketFeedSnapshot,
  BufferedIncremental,
  SequenceAnomalyEvent,
  MarketFeedSequenceState,
  RecoveryAdapterProfile,
  MarketFeedRecoveryPolicy,
} from './types.ts';

export {
  detectSequenceAnomalies,
  detectSnapshotAnomalies,
  sequenceGapFromMissing,
  isRecoverableAnomaly,
  forcesFailedSafe,
  type SequenceDetectionContext,
  type SequenceObservation,
} from './detection.ts';

export {
  DEFAULT_RECOVERY_ADAPTER_PROFILES,
  recoveryProfileFor,
  listRecoveryAdapterKinds,
  selectRecoveryStrategy,
  buildRecoveryRequest,
  adapterLabel,
  type RecoveryStrategy,
} from './recovery-adapters.ts';

export {
  createMarketFeedSequenceState,
  ingestMarketFeedIncremental,
  applyMarketFeedSnapshot,
  completeRecoveryRetransmission,
  isMarketBookAuthoritative,
  assertFeedSafeForDownstream,
  type IngestIncrementalResult,
  type ApplySnapshotResult,
} from './recovery-machine.ts';

export {
  HELIOS_MD03_SEQUENCE_RECOVERY_QUALIFIED,
  HELIOS_MD03_SEQUENCE_RECOVERY_BLOCKED,
  evaluateMd03SequenceRecoveryQualification,
  md03EngineeringTaxonomySelfCheck,
  adapterTaxonomyMatchesRegistry,
  type Md03QualificationChecks,
  type Md03QualificationResult,
} from './qualification.ts';
