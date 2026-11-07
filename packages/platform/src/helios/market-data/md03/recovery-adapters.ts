/**
 * HELIOS MD03 — adapter-specific recovery strategy selection (fixture/simulation only).
 */

import type { UtcInstant } from '@solstice/domain';
import { RECOVERY_ADAPTER_KINDS, type RecoveryAdapterKind } from './taxonomy.ts';
import type { RecoveryAdapterProfile, RecoveryRequest, SequenceGap } from './types.ts';

export const DEFAULT_RECOVERY_ADAPTER_PROFILES: Readonly<Record<RecoveryAdapterKind, RecoveryAdapterProfile>> =
  Object.freeze({
    NASDAQ_SNAPSHOT_RETRANSMISSION: Object.freeze({
      adapterKind: 'NASDAQ_SNAPSHOT_RETRANSMISSION',
      supportsRetransmission: true,
      supportsSnapshotRecovery: true,
      supportsRecoveryFeed: false,
      requiresChecksum: false,
    }),
    CBOE_GAP_REQUEST: Object.freeze({
      adapterKind: 'CBOE_GAP_REQUEST',
      supportsRetransmission: true,
      supportsSnapshotRecovery: false,
      supportsRecoveryFeed: false,
      requiresChecksum: false,
    }),
    CME_RECOVERY_FEED: Object.freeze({
      adapterKind: 'CME_RECOVERY_FEED',
      supportsRetransmission: false,
      supportsSnapshotRecovery: true,
      supportsRecoveryFeed: true,
      requiresChecksum: false,
    }),
    WEBSOCKET_SNAPSHOT_DELTA: Object.freeze({
      adapterKind: 'WEBSOCKET_SNAPSHOT_DELTA',
      supportsRetransmission: false,
      supportsSnapshotRecovery: true,
      supportsRecoveryFeed: false,
      requiresChecksum: false,
    }),
    CHECKSUM_CRYPTO_RECOVERY: Object.freeze({
      adapterKind: 'CHECKSUM_CRYPTO_RECOVERY',
      supportsRetransmission: true,
      supportsSnapshotRecovery: true,
      supportsRecoveryFeed: false,
      requiresChecksum: true,
    }),
  });

export function recoveryProfileFor(kind: RecoveryAdapterKind): RecoveryAdapterProfile {
  return DEFAULT_RECOVERY_ADAPTER_PROFILES[kind];
}

export function listRecoveryAdapterKinds(): readonly RecoveryAdapterKind[] {
  return RECOVERY_ADAPTER_KINDS;
}

export type RecoveryStrategy = 'RETRANSMISSION' | 'SNAPSHOT' | 'RECOVERY_FEED' | 'FAILED';

export function selectRecoveryStrategy(
  gap: SequenceGap,
  profile: RecoveryAdapterProfile,
): RecoveryStrategy {
  if (profile.supportsRetransmission && gap.anomaly === 'MISSING_SEQUENCE') {
    return 'RETRANSMISSION';
  }
  if (profile.supportsRecoveryFeed && (gap.anomaly === 'MISSING_SEQUENCE' || gap.anomaly === 'OUT_OF_ORDER_SEQUENCE')) {
    return 'RECOVERY_FEED';
  }
  if (profile.supportsSnapshotRecovery) {
    return 'SNAPSHOT';
  }
  return 'FAILED';
}

export function buildRecoveryRequest(input: {
  readonly requestId: string;
  readonly gap: SequenceGap;
  readonly adapterKind: RecoveryAdapterKind;
  readonly strategy: RecoveryStrategy;
  readonly requestedAt: UtcInstant;
}): RecoveryRequest | null {
  if (input.strategy === 'FAILED') {
    return null;
  }
  const profile = recoveryProfileFor(input.adapterKind);
  return Object.freeze({
    requestId: input.requestId,
    feedId: input.gap.feedId,
    adapterKind: input.adapterKind,
    fromSequence: input.gap.fromSequence,
    toSequence: input.gap.toSequence,
    requestedAt: input.requestedAt,
    status: 'PENDING',
    supportsRetransmission: profile.supportsRetransmission && input.strategy === 'RETRANSMISSION',
  });
}

export function adapterLabel(kind: RecoveryAdapterKind): string {
  switch (kind) {
    case 'NASDAQ_SNAPSHOT_RETRANSMISSION':
      return 'Nasdaq-style snapshot/retransmission';
    case 'CBOE_GAP_REQUEST':
      return 'Cboe-style gap request';
    case 'CME_RECOVERY_FEED':
      return 'CME-style recovery feed';
    case 'WEBSOCKET_SNAPSHOT_DELTA':
      return 'WebSocket snapshot+delta';
    case 'CHECKSUM_CRYPTO_RECOVERY':
      return 'Checksum-based crypto recovery';
    default:
      return kind;
  }
}
