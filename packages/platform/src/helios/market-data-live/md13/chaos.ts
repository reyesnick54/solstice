/**
 * MD13 chaos injection — simulation-only fault catalog.
 */

import { MD13_CHAOS_SCENARIOS, type Md13ChaosScenarioId } from './taxonomy.ts';
import type { Md13ChaosScenarioExpectation, Md13RawIngressPacket } from './types.ts';

export function listMd13ChaosScenarios(): readonly Md13ChaosScenarioId[] {
  return MD13_CHAOS_SCENARIOS;
}

export function chaosExpectation(scenarioId: Md13ChaosScenarioId): Md13ChaosScenarioExpectation {
  const base = {
    scenarioId,
    rawPreservationRequired: true,
    expectGapRecovery: false,
    expectSnapshotRecovery: false,
    circuitMayDegrade: false,
    circuitMayUntrust: false,
  };

  switch (scenarioId) {
    case 'packet_loss':
    case 'duplicate_packets':
    case 'reordering':
    case 'slow_consumer':
    case 'backpressure':
    case 'persistence_slowdown':
      return Object.freeze({ ...base, circuitMayDegrade: true, expectGapRecovery: scenarioId !== 'duplicate_packets' });
    case 'websocket_disconnect':
    case 'tcp_disconnect':
    case 'provider_429':
    case 'provider_500':
    case 'dns_failure':
    case 'heartbeat_loss':
    case 'feed_a_failure':
    case 'feed_b_failure':
      return Object.freeze({ ...base, circuitMayDegrade: true });
    case 'sequence_jump':
    case 'checksum_mismatch':
    case 'stale_snapshot':
    case 'both_feeds_fail':
      return Object.freeze({
        ...base,
        circuitMayDegrade: true,
        circuitMayUntrust: true,
        expectSnapshotRecovery: scenarioId === 'stale_snapshot',
      });
    case 'clock_drift':
    case 'clock_jump':
      return Object.freeze({ ...base, circuitMayDegrade: true, circuitMayUntrust: scenarioId === 'clock_jump' });
    case 'process_restart':
      return Object.freeze({
        ...base,
        circuitMayDegrade: true,
        expectSnapshotRecovery: true,
        expectGapRecovery: true,
      });
    default: {
      const _exhaustive: never = scenarioId;
      throw new Error(`unknown chaos scenario ${_exhaustive}`);
    }
  }
}

export function applyChaosToIngress(
  scenarioId: Md13ChaosScenarioId,
  packets: readonly Md13RawIngressPacket[],
): {
  readonly delivered: readonly Md13RawIngressPacket[];
  readonly duplicates: number;
  readonly dropped: number;
  readonly reordered: boolean;
  readonly feedADown: boolean;
  readonly feedBDown: boolean;
  readonly checksumValid: boolean;
  readonly heartbeatFresh: boolean;
  readonly snapshotValid: boolean;
  readonly sequenceContiguous: boolean;
  readonly clockSane: boolean;
  readonly providerError: 'none' | '429' | '500' | 'dns';
  readonly transportDisconnected: 'none' | 'websocket' | 'tcp';
  readonly consumerLagMs: number;
  readonly persistenceLagMs: number;
  readonly processRestarted: boolean;
} {
  let delivered = [...packets];
  let duplicates = 0;
  let dropped = 0;
  let reordered = false;
  let feedADown = false;
  let feedBDown = false;
  let checksumValid = true;
  let heartbeatFresh = true;
  let snapshotValid = true;
  let sequenceContiguous = true;
  let clockSane = true;
  let providerError: 'none' | '429' | '500' | 'dns' = 'none';
  let transportDisconnected: 'none' | 'websocket' | 'tcp' = 'none';
  let consumerLagMs = 50;
  let persistenceLagMs = 80;
  let processRestarted = false;

  switch (scenarioId) {
    case 'packet_loss':
      dropped = Math.max(1, Math.floor(delivered.length / 10));
      delivered = delivered.slice(dropped);
      break;
    case 'duplicate_packets':
      if (delivered.length > 0) {
        delivered = [...delivered, delivered[0]!];
        duplicates = 1;
      }
      break;
    case 'reordering':
      if (delivered.length > 2) {
        delivered = [delivered[1]!, delivered[0]!, ...delivered.slice(2)];
        reordered = true;
      }
      break;
    case 'websocket_disconnect':
      transportDisconnected = 'websocket';
      feedADown = true;
      break;
    case 'tcp_disconnect':
      transportDisconnected = 'tcp';
      feedBDown = true;
      break;
    case 'provider_429':
      providerError = '429';
      feedBDown = true;
      break;
    case 'provider_500':
      providerError = '500';
      feedADown = true;
      feedBDown = true;
      break;
    case 'dns_failure':
      providerError = 'dns';
      feedADown = true;
      feedBDown = true;
      break;
    case 'heartbeat_loss':
      heartbeatFresh = false;
      break;
    case 'sequence_jump':
      sequenceContiguous = false;
      break;
    case 'checksum_mismatch':
      checksumValid = false;
      break;
    case 'stale_snapshot':
      snapshotValid = false;
      break;
    case 'clock_drift':
      clockSane = true;
      break;
    case 'clock_jump':
      clockSane = false;
      break;
    case 'feed_a_failure':
      feedADown = true;
      break;
    case 'feed_b_failure':
      feedBDown = true;
      break;
    case 'both_feeds_fail':
      feedADown = true;
      feedBDown = true;
      break;
    case 'slow_consumer':
      consumerLagMs = 2_000;
      break;
    case 'backpressure':
      consumerLagMs = 900;
      persistenceLagMs = 5_000;
      break;
    case 'persistence_slowdown':
      persistenceLagMs = 12_000;
      break;
    case 'process_restart':
      processRestarted = true;
      snapshotValid = false;
      break;
    default: {
      const _exhaustive: never = scenarioId;
      throw new Error(`unknown chaos scenario ${_exhaustive}`);
    }
  }

  return Object.freeze({
    delivered: Object.freeze(delivered),
    duplicates,
    dropped,
    reordered,
    feedADown,
    feedBDown,
    checksumValid,
    heartbeatFresh,
    snapshotValid,
    sequenceContiguous,
    clockSane,
    providerError,
    transportDisconnected,
    consumerLagMs,
    persistenceLagMs,
    processRestarted,
  });
}
