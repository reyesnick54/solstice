import type { UtcInstant } from '../../domain/src/time.ts';
import type { PolicyRegistry, PolicyVersionRecord } from '../../kernel/src/policy/index.ts';
import { compareCurrentVsCandidate } from './compare.ts';
import type { CandidatePolicySetId, RegulatorySnapshotId } from './ids.ts';
import type { InvariantFailure, RegulatoryScenario } from './types.ts';

export function runInvariantSuite(input: {
  readonly productionRegistry: PolicyRegistry;
  readonly scenarios: readonly RegulatoryScenario[];
  readonly candidateVersions: readonly PolicyVersionRecord[];
  readonly baselineSnapshotId: RegulatorySnapshotId;
  readonly candidateSetId: CandidatePolicySetId;
  readonly at: UtcInstant;
}): {
  readonly passed: boolean;
  readonly failures: readonly InvariantFailure[];
  readonly candidateSimulationReady: boolean;
} {
  const failures: InvariantFailure[] = [];
  for (const scenario of input.scenarios) {
    if (!scenario.invariant || !scenario.expectedInvariantDecision) {
      continue;
    }
    const comparison = compareCurrentVsCandidate({
      productionRegistry: input.productionRegistry,
      scenario,
      candidateVersions: input.candidateVersions,
      baselineSnapshotId: input.baselineSnapshotId,
      candidateSetId: input.candidateSetId,
      at: input.at,
    });
    if (comparison.candidate.decision !== scenario.expectedInvariantDecision) {
      failures.push(
        Object.freeze({
          scenarioId: scenario.scenarioId,
          name: scenario.name,
          expected: scenario.expectedInvariantDecision,
          actual: comparison.candidate.decision,
          reasonCodes: comparison.candidate.reasonCodes,
        }),
      );
    }
    if (comparison.candidate.decision === 'ALLOW' && scenario.expectedInvariantDecision !== 'ALLOW') {
      failures.push(
        Object.freeze({
          scenarioId: scenario.scenarioId,
          name: `${scenario.name}: silent ALLOW`,
          expected: scenario.expectedInvariantDecision,
          actual: comparison.candidate.decision,
          reasonCodes: comparison.candidate.reasonCodes,
        }),
      );
    }
  }
  const unique = failures.filter(
    (row, index) =>
      failures.findIndex((other) => other.scenarioId === row.scenarioId && other.name === row.name) ===
      index,
  );
  return Object.freeze({
    passed: unique.length === 0,
    failures: Object.freeze(unique),
    candidateSimulationReady: unique.length === 0,
  });
}
