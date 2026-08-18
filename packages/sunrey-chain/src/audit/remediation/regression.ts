import { hashCanonical } from './chain.ts';
import type { ExternalSecurityFinding, FindingRegressionEvidence } from './types.ts';

export type FormalRegressionBinding = {
  readonly findingId: string;
  readonly invariantId: string;
  readonly claim: 'BOUNDED_MODEL_VERIFICATION';
  readonly wholeSystemVerification: false;
};

export type FuzzRegressionCorpusEntry = {
  readonly findingId: string;
  readonly corpusPath: string;
  readonly minimized: true;
  readonly bytes: string;
};

export type AdversarialRegressionBinding = {
  readonly findingId: string;
  readonly scenarioId: string;
  readonly isolated: true;
  readonly productionTarget: false;
};

export type PerformanceComparison = {
  readonly findingId: string;
  readonly hotPath: string;
  readonly beforeOps: number;
  readonly afterOps: number;
  readonly severeDegradation: boolean;
  readonly correctnessPreferred: true;
};

export function recordRegressionEvidence(input: {
  readonly evidenceId: string;
  readonly finding: ExternalSecurityFinding;
  readonly testReference: string;
  readonly commit: string;
  readonly result: 'PASS' | 'FAIL';
  readonly formalReference?: string | null;
  readonly fuzzCorpusReference?: string | null;
  readonly adversarialScenarioId?: string | null;
  readonly performanceComparisonReference?: string | null;
}): FindingRegressionEvidence {
  if (!input.testReference.trim() || !input.commit.trim()) {
    throw new Error('FindingRegressionEvidence binds finding ID, test, commit, result, and artifact hash');
  }
  const artifactHash = hashCanonical({
    findingId: input.finding.findingId,
    testReference: input.testReference,
    commit: input.commit,
    result: input.result,
  });
  return Object.freeze({
    evidenceId: input.evidenceId,
    findingId: input.finding.findingId,
    testReference: input.testReference,
    commit: input.commit,
    result: input.result,
    artifactHash,
    formalReference: input.formalReference ?? null,
    fuzzCorpusReference: input.fuzzCorpusReference ?? null,
    adversarialScenarioId: input.adversarialScenarioId ?? null,
    performanceComparisonReference: input.performanceComparisonReference ?? null,
  });
}

export function bindFormalRegression(
  finding: ExternalSecurityFinding,
  invariantId: string,
): FormalRegressionBinding {
  if (!invariantId.trim()) {
    throw new Error('formal regression requires an invariant id');
  }
  return Object.freeze({
    findingId: finding.findingId,
    invariantId,
    claim: 'BOUNDED_MODEL_VERIFICATION',
    wholeSystemVerification: false,
  });
}

export function minimizedFuzzCorpusEntry(
  finding: ExternalSecurityFinding,
  bytes: string,
): FuzzRegressionCorpusEntry {
  return Object.freeze({
    findingId: finding.findingId,
    corpusPath: `tests/assurance/corpus/audit-remediation/${finding.findingId}.hex`,
    minimized: true,
    bytes,
  });
}

export function bindAdversarialRegression(
  finding: ExternalSecurityFinding,
  scenarioId = 'AUDIT-FINDING-REGRESSION',
): AdversarialRegressionBinding {
  return Object.freeze({
    findingId: finding.findingId,
    scenarioId,
    isolated: true,
    productionTarget: false,
  });
}

export function recordPerformanceComparison(input: {
  readonly finding: ExternalSecurityFinding;
  readonly hotPath: string;
  readonly beforeOps: number;
  readonly afterOps: number;
}): PerformanceComparison {
  const ratio = input.beforeOps === 0 ? 0 : input.afterOps / input.beforeOps;
  return Object.freeze({
    findingId: input.finding.findingId,
    hotPath: input.hotPath,
    beforeOps: input.beforeOps,
    afterOps: input.afterOps,
    severeDegradation: ratio < 0.5,
    correctnessPreferred: true,
  });
}

/**
 * Bounded model of the finding-lifecycle state machine. This is not
 * whole-system formal verification.
 */
export function findingLifecycleModelHolds(transitions: readonly { readonly from: string; readonly to: string }[]): boolean {
  const legal = new Set([
    'RECEIVED>TRIAGED',
    'RECEIVED>SUPERSEDED',
    'TRIAGED>REPRODUCED',
    'TRIAGED>NOT_REPRODUCIBLE_WITH_EVIDENCE',
    'TRIAGED>REMEDIATION_IN_PROGRESS',
    'TRIAGED>ACCEPTED_RISK',
    'TRIAGED>SUPERSEDED',
    'REPRODUCED>REMEDIATION_IN_PROGRESS',
    'REPRODUCED>ACCEPTED_RISK',
    'REPRODUCED>SUPERSEDED',
    'REMEDIATION_IN_PROGRESS>REMEDIATED_PENDING_RETEST',
    'REMEDIATION_IN_PROGRESS>ACCEPTED_RISK',
    'REMEDIATION_IN_PROGRESS>SUPERSEDED',
    'REMEDIATED_PENDING_RETEST>EXTERNALLY_RETESTED',
    'REMEDIATED_PENDING_RETEST>REMEDIATION_IN_PROGRESS',
    'REMEDIATED_PENDING_RETEST>SUPERSEDED',
    'EXTERNALLY_RETESTED>SUPERSEDED',
    'ACCEPTED_RISK>SUPERSEDED',
    'ACCEPTED_RISK>REMEDIATION_IN_PROGRESS',
    'NOT_REPRODUCIBLE_WITH_EVIDENCE>TRIAGED',
    'NOT_REPRODUCIBLE_WITH_EVIDENCE>SUPERSEDED',
  ]);
  return transitions.every((row) => legal.has(`${row.from}>${row.to}`));
}
