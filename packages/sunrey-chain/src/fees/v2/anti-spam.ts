/**
 * Combined economic and technical anti-spam controls.
 *
 * Transaction fees are not the only DoS bound. Malformed protocol
 * traffic is rejected before any balance debit.
 */

import { MAX_TX_EXECUTION_UNITS } from '../types.ts';
import type { FeePolicyV2 } from './types.ts';

export type AntiSpamControls = {
  readonly minimumValidFee: bigint;
  readonly maxTxBytes: bigint;
  readonly maxTxExecutionUnits: bigint;
  readonly nonceReplayProtection: true;
  readonly rpcLimits: { readonly maxInflight: number; readonly maxBytes: number };
  readonly p2pLimits: { readonly maxInbound: number; readonly maxPerIp: number };
  readonly mempoolLimits: {
    readonly maxCount: number;
    readonly maxBytes: number;
    readonly maxPerActor: number;
  };
  readonly perConnectionProtections: true;
  readonly feesAreNotSoleDosControl: true;
  readonly rejectMalformedBeforeDebit: true;
};

export function developmentAntiSpamControls(policy: FeePolicyV2): AntiSpamControls {
  return Object.freeze({
    minimumValidFee: policy.minimumFee,
    maxTxBytes: 16_384n,
    maxTxExecutionUnits: MAX_TX_EXECUTION_UNITS,
    nonceReplayProtection: true,
    rpcLimits: Object.freeze({ maxInflight: 32, maxBytes: 1_048_576 }),
    p2pLimits: Object.freeze({ maxInbound: 16, maxPerIp: 3 }),
    mempoolLimits: Object.freeze({ maxCount: 1_024, maxBytes: 2_097_152, maxPerActor: 16 }),
    perConnectionProtections: true,
    feesAreNotSoleDosControl: true,
    rejectMalformedBeforeDebit: true,
  });
}

export function mempoolAdmissionBounded(
  currentCount: number,
  currentBytes: number,
  actorCount: number,
  txBytes: number,
  controls: AntiSpamControls,
): boolean {
  if (currentCount + 1 > controls.mempoolLimits.maxCount) {
    return false;
  }
  if (currentBytes + txBytes > controls.mempoolLimits.maxBytes) {
    return false;
  }
  if (actorCount + 1 > controls.mempoolLimits.maxPerActor) {
    return false;
  }
  if (BigInt(txBytes) > controls.maxTxBytes) {
    return false;
  }
  return true;
}
