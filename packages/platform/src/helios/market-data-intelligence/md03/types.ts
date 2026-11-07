import type { UtcInstant } from '@solstice/domain';
import type {
  HELIOS_MD03_FEED_INTERFACE_AUTHORITY,
  HELIOS_MD03_FEED_INTERFACE_SCHEMA,
  Md03FeedMode,
  Md03FeedRole,
  Md03RecoveryPhase,
  Md03SequenceOutcome,
} from './taxonomy.ts';

export type Md03FeedIdentity = {
  readonly schema: typeof HELIOS_MD03_FEED_INTERFACE_SCHEMA;
  readonly feedId: string;
  readonly venueId: string;
  readonly role: Md03FeedRole;
  readonly channel: string;
};

export type Md03SequenceState = {
  readonly lastSequence: bigint;
  readonly lastAppliedAt: UtcInstant | null;
  readonly gapCount: number;
  readonly duplicateCount: number;
};

export type Md03IncrementalEnvelope<TPayload> = {
  readonly schema: typeof HELIOS_MD03_FEED_INTERFACE_SCHEMA;
  readonly authority: typeof HELIOS_MD03_FEED_INTERFACE_AUTHORITY;
  readonly mode: 'INCREMENTAL';
  readonly feed: Md03FeedIdentity;
  readonly instrumentId: string;
  readonly sequence: bigint;
  readonly sourceTimestamp: UtcInstant;
  readonly knowableAt: UtcInstant;
  readonly payload: TPayload;
  readonly grantsExecutionAuthority: false;
};

export type Md03RecoveryEnvelope<TPayload> = {
  readonly schema: typeof HELIOS_MD03_FEED_INTERFACE_SCHEMA;
  readonly authority: typeof HELIOS_MD03_FEED_INTERFACE_AUTHORITY;
  readonly mode: 'RECOVERY';
  readonly feed: Md03FeedIdentity;
  readonly instrumentId: string;
  readonly recoveryToken: string;
  readonly snapshotSequence: bigint;
  readonly sourceTimestamp: UtcInstant;
  readonly knowableAt: UtcInstant;
  readonly payload: TPayload;
  readonly grantsExecutionAuthority: false;
};

export type Md03DualFeedArbitration = {
  readonly preferredRole: Md03FeedRole;
  readonly secondaryUsableWhenPrimaryStale: true;
  readonly maxSkewMs: number;
};

export type Md03ApplyIncrementalResult<TState> = {
  readonly outcome: Md03SequenceOutcome;
  readonly state: TState;
  readonly sequence: Md03SequenceState;
};

export type Md03RecoverySession = {
  readonly instrumentId: string;
  readonly phase: Md03RecoveryPhase;
  readonly requestedAt: UtcInstant;
  readonly recoveredAt: UtcInstant | null;
  readonly fromSequence: bigint | null;
  readonly toSequence: bigint | null;
};

export type Md03FeedCoordinatorSnapshot<TState> = {
  readonly instrumentId: string;
  readonly activeFeedRole: Md03FeedRole;
  readonly primary: Md03SequenceState;
  readonly secondary: Md03SequenceState;
  readonly recovery: Md03RecoverySession | null;
  readonly state: TState;
  readonly evaluatedAt: UtcInstant;
};

export type Md03FeedModeObservation = {
  readonly mode: Md03FeedMode;
  readonly observedAt: UtcInstant;
};
