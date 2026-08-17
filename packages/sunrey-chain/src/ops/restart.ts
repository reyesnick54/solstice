import type { SignerSafetyState } from '../validators/index.ts';
import { compareSafetyWatermark } from './signer-safety.ts';
import { opsErr, opsOk, type OpsResult } from './types.ts';

export type RestartState = {
  readonly walHeight: bigint;
  readonly finalizedHeight: bigint;
  readonly safety: SignerSafetyState;
};

export function safeRestart(before: RestartState, after: RestartState): OpsResult<true> {
  if (after.walHeight < before.walHeight) {
    return opsErr('SIGNER_ROLLBACK', 'restart lost consensus WAL');
  }
  if (after.finalizedHeight < before.finalizedHeight) {
    return opsErr('SIGNER_ROLLBACK', 'restart lost finalized state');
  }
  if (compareSafetyWatermark(after.safety, before.safety) < 0) {
    return opsErr('SIGNER_ROLLBACK', 'restart must not roll signer safety backwards');
  }
  return opsOk(true);
}

export function restartDoesNotDuplicateVote(before: RestartState, after: RestartState): boolean {
  return compareSafetyWatermark(after.safety, before.safety) >= 0;
}
