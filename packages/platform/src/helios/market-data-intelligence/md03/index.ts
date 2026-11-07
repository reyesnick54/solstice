export {
  HELIOS_MD03_FEED_INTERFACE_SCHEMA,
  HELIOS_MD03_FEED_INTERFACE_AUTHORITY,
  MD03_FEED_ROLES,
  MD03_FEED_MODES,
  MD03_RECOVERY_PHASES,
  MD03_SEQUENCE_OUTCOMES,
  type Md03FeedRole,
  type Md03FeedMode,
  type Md03RecoveryPhase,
  type Md03SequenceOutcome,
} from './taxonomy.ts';

export type {
  Md03FeedIdentity,
  Md03SequenceState,
  Md03IncrementalEnvelope,
  Md03RecoveryEnvelope,
  Md03DualFeedArbitration,
  Md03ApplyIncrementalResult,
  Md03RecoverySession,
  Md03FeedCoordinatorSnapshot,
  Md03FeedModeObservation,
} from './types.ts';

export { initialMd03SequenceState, applyMd03Incremental } from './incremental.ts';
export { DEFAULT_MD03_DUAL_FEED_ARBITRATION, selectMd03ActiveFeedRole, feedsAreConsistent } from './dual-feed.ts';
export {
  openMd03RecoverySession,
  advanceMd03RecoveryPhase,
  applyMd03RecoverySnapshot,
  resetSequenceAfterRecoveryFailure,
} from './recovery.ts';
export {
  createMd03FeedCoordinator,
  ingestMd03Incremental,
  ingestMd03Recovery,
  snapshotMd03FeedCoordinator,
  type Md03FeedCoordinator,
} from './coordinator.ts';
