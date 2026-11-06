import type { UtcInstant } from '@solstice/domain';

import { asBehaviorPolicySnapshotId, type BehaviorPolicySnapshotId } from './ids.ts';
import { normalizeRational, sumRationals } from './rational.ts';
import type { ProbabilityRational } from './types.ts';
import { HELIOS_COUNTERFACTUAL_LEARNING_SCHEMA_VERSION, type StochasticPolicyEnvironment } from './taxonomy.ts';
import type {
  ActionPropensityMass,
  BehaviorPolicySnapshot,
  DeterministicBehaviorPolicySnapshot,
  StochasticBehaviorPolicySnapshot,
} from './types.ts';

export function buildDeterministicBehaviorPolicySnapshot(input: {
  readonly snapshotId: BehaviorPolicySnapshotId | string;
  readonly decisionAtUtc: UtcInstant;
  readonly contextRef: string;
  readonly candidateActionIds: readonly string[];
  readonly chosenActionId: string;
}): DeterministicBehaviorPolicySnapshot {
  validateCandidateSet(input.candidateActionIds, input.chosenActionId);
  return Object.freeze({
    schemaVersion: HELIOS_COUNTERFACTUAL_LEARNING_SCHEMA_VERSION,
    snapshotId: typeof input.snapshotId === 'string' ? asBehaviorPolicySnapshotId(input.snapshotId) : input.snapshotId,
    decisionAtUtc: input.decisionAtUtc,
    contextRef: input.contextRef,
    candidateActionIds: Object.freeze([...input.candidateActionIds]),
    chosenActionId: input.chosenActionId,
    policyKind: 'DETERMINISTIC_POLICY',
    propensityMasses: null,
    recordNote: 'DETERMINISTIC_POLICY',
    support: 'SUPPORT_LIMITED',
  });
}

export function buildStochasticBehaviorPolicySnapshot(input: {
  readonly snapshotId: BehaviorPolicySnapshotId | string;
  readonly decisionAtUtc: UtcInstant;
  readonly contextRef: string;
  readonly candidateActionIds: readonly string[];
  readonly chosenActionId: string;
  readonly evaluationEnvironment: StochasticPolicyEnvironment;
  /** One mass per candidate action; must use a common denominator and sum to 1. */
  readonly propensityMasses: readonly ActionPropensityMass[];
}): StochasticBehaviorPolicySnapshot {
  validateCandidateSet(input.candidateActionIds, input.chosenActionId);
  const ids = new Set(input.candidateActionIds);
  if (input.propensityMasses.length !== input.candidateActionIds.length) {
    throw new Error('propensityMasses must list every candidate action exactly once');
  }
  const seen = new Set<string>();
  let commonDenom: string | null = null;
  const normalizedMasses: ActionPropensityMass[] = [];
  for (const row of input.propensityMasses) {
    if (!ids.has(row.actionId)) {
      throw new Error(`unknown actionId in propensityMasses: ${row.actionId}`);
    }
    if (seen.has(row.actionId)) {
      throw new Error(`duplicate propensity row for action ${row.actionId}`);
    }
    seen.add(row.actionId);
    const d = row.probabilityMass.denominator;
    if (commonDenom === null) {
      commonDenom = d;
    } else if (d !== commonDenom) {
      throw new Error('CF03 stochastic snapshots require a common denominator across propensity masses');
    }
    const mass = normalizeRational(row.probabilityMass);
    if (mass.numerator === '0') {
      throw new Error('stochastic propensity mass must be strictly positive');
    }
    normalizedMasses.push({ actionId: row.actionId, probabilityMass: mass });
  }
  if (seen.size !== ids.size) {
    throw new Error('propensityMasses must cover every candidate action');
  }
  const sum = sumRationals(normalizedMasses.map((m) => m.probabilityMass));
  if (sum.numerator !== sum.denominator) {
    throw new Error('propensity masses must sum to 1');
  }

  return Object.freeze({
    schemaVersion: HELIOS_COUNTERFACTUAL_LEARNING_SCHEMA_VERSION,
    snapshotId: typeof input.snapshotId === 'string' ? asBehaviorPolicySnapshotId(input.snapshotId) : input.snapshotId,
    decisionAtUtc: input.decisionAtUtc,
    contextRef: input.contextRef,
    candidateActionIds: Object.freeze([...input.candidateActionIds]),
    chosenActionId: input.chosenActionId,
    policyKind: 'STOCHASTIC_POLICY',
    evaluationEnvironment: input.evaluationEnvironment,
    propensityMasses: Object.freeze(normalizedMasses),
  });
}

function validateCandidateSet(candidateActionIds: readonly string[], chosenActionId: string): void {
  if (candidateActionIds.length === 0) {
    throw new Error('candidateActionIds must be non-empty');
  }
  const uniq = new Set(candidateActionIds);
  if (uniq.size !== candidateActionIds.length) {
    throw new Error('candidateActionIds must be unique');
  }
  if (!uniq.has(chosenActionId)) {
    throw new Error('chosenActionId must be one of candidateActionIds');
  }
}

/** Build P(action|context) table for every candidate; deterministic policies omit invented masses. */
export function behaviorPolicyProbabilities(snapshot: BehaviorPolicySnapshot): ReadonlyMap<string, ProbabilityRational | 'DETERMINISTIC_POLICY'> {
  const map = new Map<string, ProbabilityRational | 'DETERMINISTIC_POLICY'>();
  if (snapshot.policyKind === 'DETERMINISTIC_POLICY') {
    for (const id of snapshot.candidateActionIds) {
      map.set(id, 'DETERMINISTIC_POLICY');
    }
    return map;
  }
  for (const row of snapshot.propensityMasses) {
    map.set(row.actionId, row.probabilityMass);
  }
  return map;
}
