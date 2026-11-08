import type { ForwardAlphaEvidenceLane } from './taxonomy.ts';
import {
  FORWARD_ALPHA_EVIDENCE_LANES,
  FORWARD_ALPHA_FORWARD_ONLY_LANES,
} from './taxonomy.ts';

export type EvidenceLaneMergeViolation = {
  readonly leftLane: ForwardAlphaEvidenceLane;
  readonly rightLane: ForwardAlphaEvidenceLane;
  readonly reason: 'MERGE_FORBIDDEN' | 'RELABEL_FORBIDDEN';
};

const HISTORICAL_LANES: ReadonlySet<ForwardAlphaEvidenceLane> = new Set([
  'HISTORICAL_BACKTEST',
  'SEALED_HOLDOUT',
  'WALK_FORWARD',
]);

const FORWARD_LANES: ReadonlySet<ForwardAlphaEvidenceLane> = new Set(FORWARD_ALPHA_FORWARD_ONLY_LANES);

export function isForwardAlphaEvidenceLane(value: string): value is ForwardAlphaEvidenceLane {
  return (FORWARD_ALPHA_EVIDENCE_LANES as readonly string[]).includes(value);
}

export function assertEvidenceLanesDisjoint(lanes: readonly ForwardAlphaEvidenceLane[]): readonly EvidenceLaneMergeViolation[] {
  const violations: EvidenceLaneMergeViolation[] = [];
  const seen = new Set<ForwardAlphaEvidenceLane>();
  for (const lane of lanes) {
    if (seen.has(lane)) {
      violations.push(Object.freeze({ leftLane: lane, rightLane: lane, reason: 'MERGE_FORBIDDEN' }));
      continue;
    }
    seen.add(lane);
    for (const prior of seen) {
      if (prior === lane) continue;
      if (HISTORICAL_LANES.has(prior) && FORWARD_LANES.has(lane)) {
        violations.push(Object.freeze({ leftLane: prior, rightLane: lane, reason: 'MERGE_FORBIDDEN' }));
      }
      if (HISTORICAL_LANES.has(lane) && FORWARD_LANES.has(prior)) {
        violations.push(Object.freeze({ leftLane: lane, rightLane: prior, reason: 'MERGE_FORBIDDEN' }));
      }
    }
  }
  return Object.freeze(violations);
}

export function assertCannotRelabelBacktestAsForward(input: {
  readonly fromLane: ForwardAlphaEvidenceLane;
  readonly toLane: ForwardAlphaEvidenceLane;
}): boolean {
  if (HISTORICAL_LANES.has(input.fromLane) && FORWARD_LANES.has(input.toLane)) {
    return false;
  }
  return true;
}

export function assertCannotRelabelHistoricalReplayAsForward(syntheticHistoricalReplay: boolean): boolean {
  return !syntheticHistoricalReplay;
}

export function lanePermitsForwardDecision(lane: ForwardAlphaEvidenceLane): boolean {
  return FORWARD_LANES.has(lane);
}
