/**
 * HELIOS Market Data MD05 — redundant feed arbitration and provider trust types.
 */

import type { UtcInstant } from '@solstice/domain';
import type { MarketSessionStatus } from '../../market-observation/types.ts';
import type {
  ConsensusOutcome,
  FailoverScope,
  FeedReplicaHealth,
  FeedReplicaRole,
  Md05QualityBand,
  Md05QualityDimension,
} from './taxonomy.ts';
import { HELIOS_MD05_SCHEMA } from './taxonomy.ts';

export type FeedReplica = {
  readonly schema: typeof HELIOS_MD05_SCHEMA;
  readonly replicaId: string;
  readonly feedId: string;
  readonly role: FeedReplicaRole;
  readonly providerId: string;
  readonly venueId: string;
  readonly nativeFeedKey: string;
  readonly health: FeedReplicaHealth;
  readonly active: boolean;
};

export type ProviderQualityVector = Readonly<Record<Md05QualityDimension, Md05QualityBand>>;

export type ProviderTrustState = {
  readonly schema: typeof HELIOS_MD05_SCHEMA;
  readonly providerId: string;
  readonly updatedAt: UtcInstant;
  readonly quality: ProviderQualityVector;
  readonly compositeBand: Md05QualityBand;
  readonly consecutiveFailures: number;
  readonly failoverEligible: boolean;
};

export type FeedArbitrationState = {
  readonly schema: typeof HELIOS_MD05_SCHEMA;
  readonly symbol: string;
  readonly venueId: string;
  readonly activeReadReplicaId: string | null;
  readonly activeReadRole: FeedReplicaRole | null;
  readonly replicas: readonly FeedReplica[];
  readonly providerTrust: Readonly<Record<string, ProviderTrustState>>;
  readonly lastFailoverAt: UtcInstant | null;
  readonly dedupeKeysSeen: readonly string[];
};

export type InboundMarketTick = {
  readonly replicaId: string;
  readonly role: FeedReplicaRole;
  readonly providerId: string;
  readonly symbol: string;
  readonly venueId: string;
  readonly currency: string;
  readonly sourceTimestamp: UtcInstant;
  readonly arrivalTimestamp: UtcInstant;
  readonly priceMinorUnits: bigint;
  readonly sizeMinorUnits: bigint;
  readonly marketStatus: MarketSessionStatus;
  readonly nativeSequence: string;
  readonly nativeMessageId: string;
};

export type MarketSourceAttribution = {
  readonly providerId: string;
  readonly replicaId: string;
  readonly role: FeedReplicaRole;
  readonly nativeSequence: string;
  readonly nativeMessageId: string;
  readonly arrivalTimestamp: UtcInstant;
};

export type NormalizedMarketObservation = {
  readonly schema: typeof HELIOS_MD05_SCHEMA;
  readonly observationKey: string;
  readonly symbol: string;
  readonly venueId: string;
  readonly currency: string;
  readonly sourceTimestamp: UtcInstant;
  readonly arrivalTimestamp: UtcInstant;
  readonly priceMinorUnits: bigint;
  readonly sizeMinorUnits: bigint;
  readonly marketStatus: MarketSessionStatus;
  readonly contributingSources: readonly MarketSourceAttribution[];
  readonly selectedReplicaId: string;
  readonly selectedRole: FeedReplicaRole;
  readonly consensusOutcome: ConsensusOutcome;
  readonly readOnly: true;
};

export type FeedDivergenceField =
  | 'symbol'
  | 'venue'
  | 'currency'
  | 'timestamp'
  | 'price'
  | 'size'
  | 'marketStatus';

export type FeedDivergence = {
  readonly schema: typeof HELIOS_MD05_SCHEMA;
  readonly symbol: string;
  readonly venueId: string;
  readonly detectedAt: UtcInstant;
  readonly fields: readonly FeedDivergenceField[];
  readonly leftReplicaId: string;
  readonly rightReplicaId: string;
  readonly incompatible: boolean;
  readonly message: string;
};

export type MarketObservationConsensus = {
  readonly schema: typeof HELIOS_MD05_SCHEMA;
  readonly symbol: string;
  readonly venueId: string;
  readonly outcome: ConsensusOutcome;
  readonly observation: NormalizedMarketObservation | null;
  readonly divergences: readonly FeedDivergence[];
  readonly sourceCount: number;
  readonly averaged: false;
};

export type FailoverDecision = {
  readonly schema: typeof HELIOS_MD05_SCHEMA;
  readonly scope: FailoverScope;
  readonly fromReplicaId: string | null;
  readonly toReplicaId: string;
  readonly toRole: FeedReplicaRole;
  readonly decidedAt: UtcInstant;
  readonly reason: string;
  readonly executionAuthorityImplicated: false;
};
