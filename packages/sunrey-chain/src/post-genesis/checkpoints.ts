/**
 * Deterministic protocol checkpoints based on height, epoch, and
 * finalized state. UI timers are not a substitute for these coordinates.
 */

import { commitPostGenesis } from './hash.ts';
import type { PostGenesisCheckpoint, PostGenesisPhase, PostGenesisPolicy, ProtocolCoordinate } from './types.ts';

export function protocolCoordinate(height: number, epoch: number, finalizedStateRoot: string): ProtocolCoordinate {
  if (!Number.isInteger(height) || height < 0) {
    throw new TypeError('checkpoint height must be a non-negative integer');
  }
  if (!Number.isInteger(epoch) || epoch < 0) {
    throw new TypeError('checkpoint epoch must be a non-negative integer');
  }
  if (!/^[0-9a-f]{8,}$/i.test(finalizedStateRoot)) {
    throw new TypeError('finalized state root must be a hex digest');
  }
  return Object.freeze({ height, epoch, finalizedStateRoot: finalizedStateRoot.toLowerCase() });
}

export function isConfiguredCheckpoint(policy: PostGenesisPolicy, coordinate: ProtocolCoordinate): boolean {
  return policy.checkpointHeights.includes(coordinate.height) || policy.checkpointEpochs.includes(coordinate.epoch);
}

export function captureCheckpoint(
  policy: PostGenesisPolicy,
  phase: PostGenesisPhase,
  coordinate: ProtocolCoordinate,
  capturedAtUtc = '2026-08-18T00:00:00.000Z',
): PostGenesisCheckpoint {
  const checkpointId = commitPostGenesis({
    kind: 'checkpoint',
    networkId: policy.networkId,
    chainId: policy.chainId,
    coordinate,
    phase,
  });
  return Object.freeze({
    checkpointId,
    coordinate,
    phase,
    capturedAtUtc,
  });
}

export function checkpointIdFor(policy: PostGenesisPolicy, phase: PostGenesisPhase, coordinate: ProtocolCoordinate): string {
  return captureCheckpoint(policy, phase, coordinate).checkpointId;
}
