import { randomUUID } from 'node:crypto';

import type { UtcInstant } from '../../domain/src/time.ts';
import {
  diffPolicyVersions,
  type PolicyEngine,
  type PolicyRegistry,
  type PolicyVersionRecord,
} from '../../kernel/src/policy/index.ts';
import { policyFactsFromScenario, requiredMissingFacts } from './facts.ts';
import { asScenarioRunId, type CandidatePolicySetId, type RegulatorySnapshotId } from './ids.ts';
import {
  createCandidateSandboxEngine,
  createSandboxEngine,
  evaluateInSandbox,
  toSandboxEvaluation,
} from './sandbox.ts';
import { decisionTransition, restrictivenessChange, stringSetDiff } from './transitions.ts';
import type { CurrentVsCandidateResult, RegulatoryScenario, SandboxEvaluation } from './types.ts';

function insufficientEvaluation(missing: readonly string[]): SandboxEvaluation {
  return Object.freeze({
    decision: 'DEFER',
    decisionClass: 'INSUFFICIENT_FACTS',
    reasonCodes: Object.freeze(['REQUIRED_FACT_MISSING', 'INSUFFICIENT_FACTS', ...missing]),
    matchedRuleIds: Object.freeze([]),
    evaluatedRuleIds: Object.freeze([]),
    reviewRequired: false,
    packId: null,
    versionId: null,
    packHash: null,
    factsHash: 'insufficient',
    legalConfidence: 'RESEARCH_REQUIRED',
    missingFacts: missing,
    executionAuthorityIssued: false,
    journalPosted: false,
  });
}

export function evaluateScenario(
  engine: PolicyEngine,
  scenario: RegulatoryScenario,
  at: UtcInstant,
): SandboxEvaluation {
  const missing = requiredMissingFacts(scenario.facts);
  if (missing.length > 0 && (!scenario.facts.customerId || !scenario.facts.jurisdiction)) {
    return insufficientEvaluation(missing);
  }
  const facts = policyFactsFromScenario(scenario.facts, at);
  const pinned = scenario.historicalPolicyPin
    ? { ...facts, policyPin: scenario.historicalPolicyPin }
    : facts;
  return evaluateInSandbox(engine, pinned, at);
}

export function compareCurrentVsCandidate(input: {
  readonly productionRegistry: PolicyRegistry;
  readonly scenario: RegulatoryScenario;
  readonly candidateVersions: readonly PolicyVersionRecord[];
  readonly baselineSnapshotId: RegulatorySnapshotId;
  readonly candidateSetId: CandidatePolicySetId;
  readonly at: UtcInstant;
}): CurrentVsCandidateResult {
  const currentEngine = createSandboxEngine(input.productionRegistry);
  const candidateEngine = createCandidateSandboxEngine(
    input.productionRegistry,
    input.candidateVersions,
    input.at,
  );
  const current = evaluateScenario(currentEngine, input.scenario, input.at);
  const candidate = evaluateScenario(candidateEngine, input.scenario, input.at);
  const packId = input.scenario.facts.jurisdiction?.value;
  const currentVersion =
    packId === 'US' || packId === 'SA' || packId === 'GB'
      ? input.productionRegistry
          .listVersions(packId)
          .find((row) => row.lifecycle === 'ACTIVE_SIMULATION')
      : undefined;
  const candidateVersion = input.candidateVersions[0];
  const ruleDiff =
    currentVersion && candidateVersion ? diffPolicyVersions(currentVersion, candidateVersion) : null;

  const result: CurrentVsCandidateResult = {
    runId: asScenarioRunId(`rrn_${randomUUID().replaceAll('-', '')}`),
    scenarioId: input.scenario.scenarioId,
    baselineSnapshotId: input.baselineSnapshotId,
    candidateSetId: input.candidateSetId,
    evaluatedAt: input.at,
    current,
    candidate,
    changed: current.decision !== candidate.decision || current.decisionClass !== candidate.decisionClass,
    transition: decisionTransition(current.decision, candidate.decision),
    restrictiveness: restrictivenessChange(current.decision, candidate.decision),
    reasonCodeDiff: stringSetDiff(current.reasonCodes, candidate.reasonCodes),
    ruleDiff,
    reviewRequirementDiff: {
      currentReviewRequired: current.reviewRequired,
      candidateReviewRequired: candidate.reviewRequired,
      changed: current.reviewRequired !== candidate.reviewRequired,
    },
    legallyDesirable: null,
    ...(input.scenario.subjectRef ? { subjectRef: input.scenario.subjectRef } : {}),
  };
  return Object.freeze(result);
}

export function replayHistorical(input: {
  readonly productionRegistry: PolicyRegistry;
  readonly scenario: RegulatoryScenario;
  readonly at: UtcInstant;
}): {
  readonly reproduced: boolean;
  readonly current: SandboxEvaluation;
  readonly original: string | undefined;
} {
  if (!input.scenario.historicalPolicyPin || !input.scenario.historicalDecision) {
    throw new Error('historical replay requires a policy pin and original decision');
  }
  const engine = createSandboxEngine(input.productionRegistry);
  const current = evaluateScenario(engine, input.scenario, input.at);
  return Object.freeze({
    reproduced: current.decision === input.scenario.historicalDecision,
    current,
    original: input.scenario.historicalDecision,
  });
}

export { toSandboxEvaluation };
