import { merkleRoot } from '../merkle.ts';
import { rightsDeltaCommitment } from './commitments.ts';
import { RIGHTS_ROOT_DOMAIN } from './taxonomy.ts';
import type { RightsDelta } from './types.ts';

export function rightsRootFromDeltas(deltas: readonly RightsDelta[]): string {
  const leaves = deltas.map((delta) => rightsDeltaCommitment(delta));
  return merkleRoot(RIGHTS_ROOT_DOMAIN, leaves);
}

export function rightsRootFromCommitments(commitments: readonly string[]): string {
  return merkleRoot(RIGHTS_ROOT_DOMAIN, [...commitments].sort());
}

export function appendRightsDelta(
  priorRoot: string,
  deltas: readonly RightsDelta[],
  nextDelta: RightsDelta,
): string {
  const nextRoot = rightsRootFromDeltas([...deltas, nextDelta]);
  if (priorRoot === nextRoot && deltas.length > 0) {
    return priorRoot;
  }
  return nextRoot;
}

export function rightsRootChanged(
  previousRoot: string,
  nextRoot: string,
  commitmentDigest: string,
  priorCommitmentDigest: string,
): boolean {
  if (commitmentDigest === priorCommitmentDigest) {
    return false;
  }
  return previousRoot !== nextRoot;
}
