/**
 * Model / code constant alignment.
 *
 * Formal arithmetic must match the current implementation:
 *   exceeds_two_thirds(power, total) ⇔ power > ⌊2·total / 3⌋
 *   two_thirds_threshold(total) = ⌊2·total / 3⌋ + 1
 *   has_two_thirds_plus(signed, total) ⇔ signed·3 > total·2
 */

import { CRYPTO_MIGRATION_STATES } from '../../../security/src/crypto-migration.ts';
import { DEV_INTEROP_TEST_ASSET, PACKET_LIFECYCLES } from '../interop/types.ts';
import { FEE_DISPOSITION_SINKS } from '../fees/types.ts';
import { UPGRADE_STATUSES } from '../governance/types.ts';
import { twoThirdsPlus } from '../ops/topology.ts';
import { twoThirdsThreshold } from '../assurance/consensus.ts';

export const FORMAL_QUORUM_DENOMINATOR = 3n;

export function floorTwoThirds(total: bigint): bigint {
  return (total * 2n) / FORMAL_QUORUM_DENOMINATOR;
}

export function exceedsTwoThirds(power: bigint, total: bigint): boolean {
  if (total <= 0n) {
    return false;
  }
  return power > floorTwoThirds(total);
}

export function twoThirdsThresholdFormal(total: bigint): bigint {
  return floorTwoThirds(total) + 1n;
}

export function hasTwoThirdsPlus(signed: bigint, total: bigint): boolean {
  return signed * 3n > total * 2n;
}

export function exceedsOneThird(power: bigint, total: bigint): boolean {
  if (total <= 0n) {
    return false;
  }
  return power > total / 3n;
}

export function maxByzantinePower(total: bigint): bigint {
  if (total <= 0n) {
    return 0n;
  }
  return (total - 1n) / 3n;
}

export const IMPLEMENTATION_CONSTANT_SNAPSHOT = Object.freeze({
  quorum: {
    exceedsTwoThirds: 'power > floor(2 * total / 3)',
    twoThirdsThreshold: 'floor(2 * total / 3) + 1',
    hasTwoThirdsPlus: 'signed * 3 > total * 2',
    equalityIsNotQuorum: true,
  },
  cryptoMigrationStates: CRYPTO_MIGRATION_STATES,
  interopDevAsset: DEV_INTEROP_TEST_ASSET,
  packetLifecycles: PACKET_LIFECYCLES,
  feeDispositionSinks: FEE_DISPOSITION_SINKS,
  upgradeStatuses: UPGRADE_STATUSES,
  settlementAtomicity: 'all-or-nothing',
  interopSequence: 'per-channel monotonic sequence, at most once',
});

export function implementationQuorumAgrees(total: bigint): boolean {
  const threshold = twoThirdsThresholdFormal(total);
  return (
    threshold === twoThirdsPlus(total) &&
    threshold === twoThirdsThreshold(total) &&
    hasTwoThirdsPlus(threshold, total) &&
    !hasTwoThirdsPlus(threshold - 1n, total) &&
    exceedsTwoThirds(threshold, total) &&
    !exceedsTwoThirds(threshold - 1n, total)
  );
}

export const QUORUM_BOUNDARY_TOTALS = Object.freeze([1n, 2n, 3n, 4n, 6n, 7n, 9n, 12n, 300n]);
