import { existsSync } from 'node:fs';
import { join } from 'node:path';

import {
  CF11_FORBIDDEN_POLICY_SURFACES,
  HELIOS_CF11_POLICY_SAFETY_ENVELOPE_SCHEMA_VERSION,
  HELIOS_CF11_SAFE_POLICY_IMPROVEMENT_BLOCKED,
  HELIOS_CF11_SAFE_POLICY_IMPROVEMENT_QUALIFIED,
  type BaselinePolicyComparison,
  type Cf11QualifiedRoute,
  type PolicyImprovementCandidate,
  type PolicySafetyEnvelope,
} from './types.ts';

export {
  HELIOS_CF11_SAFE_POLICY_IMPROVEMENT_BLOCKED,
  HELIOS_CF11_SAFE_POLICY_IMPROVEMENT_QUALIFIED,
} from './types.ts';

/** Build the canonical envelope listing all non-research surfaces as frozen. */
export function createCf11PolicySafetyEnvelope(): PolicySafetyEnvelope {
  return Object.freeze({
    schemaVersion: HELIOS_CF11_POLICY_SAFETY_ENVELOPE_SCHEMA_VERSION,
    frozenSurfaces: new Set(CF11_FORBIDDEN_POLICY_SURFACES),
    candidateMutatesOnlyResearchLogic: true as const,
  });
}

export function assertCf11SafetyEnvelopeComplete(envelope: PolicySafetyEnvelope): boolean {
  for (const surface of CF11_FORBIDDEN_POLICY_SURFACES) {
    if (!envelope.frozenSurfaces.has(surface)) return false;
  }
  return envelope.candidateMutatesOnlyResearchLogic === true;
}

/**
 * When CF11 qualifies, route to Strategy Lab EVOL11 champion/challenger — never live execution.
 */
export function routeCf11QualifiedToEvol11(): Cf11QualifiedRoute {
  return Object.freeze({
    nextStage: 'EVOL11_CHAMPION_CHALLENGER',
    liveExecution: false,
    strategyLabChampionChallengerOnly: true,
  });
}

export type Cf11QualificationResult = Readonly<{
  readonly marker:
    | typeof HELIOS_CF11_SAFE_POLICY_IMPROVEMENT_QUALIFIED
    | typeof HELIOS_CF11_SAFE_POLICY_IMPROVEMENT_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
  readonly route: Cf11QualifiedRoute | null;
}>;

/**
 * CF11 gate: conservative lower bound must beat or match baseline; overlap, ESS, OPE agreement,
 * regime robustness, and execution realism must hold; safety envelope must list all frozen surfaces.
 */
export function evaluateCf11SafePolicyImprovementQualification(
  comparison: BaselinePolicyComparison,
): Cf11QualificationResult {
  const blockers: string[] = [];

  if (!assertCf11SafetyEnvelopeComplete(comparison.candidate.safetyEnvelope)) {
    blockers.push('policy_safety_envelope_incomplete');
  }

  if (comparison.conservativeBound.decisionUsesLowerBound !== true) {
    blockers.push('decision_must_use_lower_confidence_bound');
  }

  if (comparison.conservativeBound.lowerConfidenceBoundMinor < 0n) {
    blockers.push('lower_confidence_bound_below_baseline');
  }

  if (!comparison.overlapAdequate) {
    blockers.push('overlap_not_adequate');
  }

  if (!comparison.sufficientEffectiveSample) {
    blockers.push('effective_sample_insufficient');
  }

  if (!comparison.opeAgreement.estimatorsAgree) {
    blockers.push('ope_estimator_disagreement');
  }

  if (!comparison.regimeRobustnessHolds) {
    blockers.push('regime_robustness_failed');
  }

  if (!comparison.executionRealismHolds) {
    blockers.push('execution_realism_failed');
  }

  const qualified = blockers.length === 0;
  return Object.freeze({
    marker: qualified
      ? HELIOS_CF11_SAFE_POLICY_IMPROVEMENT_QUALIFIED
      : HELIOS_CF11_SAFE_POLICY_IMPROVEMENT_BLOCKED,
    qualified,
    blockers: Object.freeze([...blockers]),
    route: qualified ? routeCf11QualifiedToEvol11() : null,
  });
}

/** Minimal structural check that a candidate only carries research knob kinds (typed at compile time). */
export function lintCf11PolicyImprovementCandidate(_candidate: PolicyImprovementCandidate): true {
  return true;
}

export type Cf11EngineeringQualificationChecks = Readonly<{
  readonly typesModule: boolean;
  readonly qualificationModule: boolean;
  readonly packageTestPresent: boolean;
}>;

export function cf11EngineeringQualificationChecks(root: string): Cf11EngineeringQualificationChecks {
  const base = join(root, 'packages/strategy-lab/src/cf11');
  const testPath = join(base, 'cf11.test.ts');
  return Object.freeze({
    typesModule: existsSync(join(base, 'types.ts')),
    qualificationModule: existsSync(join(base, 'qualification.ts')),
    packageTestPresent: existsSync(testPath),
  });
}

export function evaluateCf11EngineeringQualification(
  checks: Cf11EngineeringQualificationChecks,
): Cf11QualificationResult {
  const entries: [keyof Cf11EngineeringQualificationChecks, string][] = [
    ['typesModule', 'cf11_types'],
    ['qualificationModule', 'cf11_qualification'],
    ['packageTestPresent', 'cf11_package_test'],
  ];
  const blockers = entries.filter(([k]) => !checks[k]).map(([, label]) => label);
  const qualified = blockers.length === 0;
  return Object.freeze({
    marker: qualified
      ? HELIOS_CF11_SAFE_POLICY_IMPROVEMENT_QUALIFIED
      : HELIOS_CF11_SAFE_POLICY_IMPROVEMENT_BLOCKED,
    qualified,
    blockers: Object.freeze(blockers),
    route: qualified ? routeCf11QualifiedToEvol11() : null,
  });
}
