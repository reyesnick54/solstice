/**
 * Configurable corroboration rules by domain and methodology version.
 */

import type { NormalizedEconomicObservation } from '../types.ts';
import type { CorroborationResult } from './types.ts';
import type { IndependenceAnalysis } from './independence.ts';
import {
  type CorroborationRule,
  type MethodologyPolicy,
  selectApplicableCorroborationRules,
} from './methodology.ts';

function classesPresent(
  observations: readonly NormalizedEconomicObservation[],
  independence: IndependenceAnalysis,
): Set<string> {
  return new Set(independence.independentSourceClasses.map((row) => row.sourceClass));
}

function ruleSatisfied(
  rule: CorroborationRule,
  observations: readonly NormalizedEconomicObservation[],
  independence: IndependenceAnalysis,
): boolean {
  if (observations.length < rule.minimumObservations) {
    return false;
  }
  const present = classesPresent(observations, independence);
  const matchedClasses = rule.requiredSourceClasses.filter((sourceClass) => present.has(sourceClass));
  if (matchedClasses.length < rule.minimumIndependentClasses) {
    return false;
  }
  return independence.independentLineageRootCount >= rule.minimumIndependentClasses;
}

export function evaluateCorroboration(
  policy: MethodologyPolicy,
  observations: readonly NormalizedEconomicObservation[],
  independence: IndependenceAnalysis,
): CorroborationResult {
  const applicable = selectApplicableCorroborationRules(policy, independence.independentLineageRootCount);
  const requiredRules = policy.corroborationRules.map((rule) => rule.ruleId);
  const matchedRules: string[] = [];

  for (const rule of policy.corroborationRules) {
    if (ruleSatisfied(rule, observations, independence)) {
      matchedRules.push(rule.ruleId);
    }
  }

  const bestRule = applicable.find((rule) => ruleSatisfied(rule, observations, independence)) ?? null;

  return Object.freeze({
    satisfied: bestRule !== null,
    requiredRules: Object.freeze(requiredRules),
    matchedRules: Object.freeze(matchedRules.sort()),
    independentSourceClassCount: independence.independentSourceClassCount,
    rawProviderCount: independence.rawProviderCount,
  });
}

export function minimumCorroborationRule(policy: MethodologyPolicy): CorroborationRule {
  return [...policy.corroborationRules].sort(
    (left, right) => left.minimumIndependentClasses - right.minimumIndependentClasses,
  )[0]!;
}
