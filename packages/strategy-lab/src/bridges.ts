import { err, ok, type Result } from '../../domain/src/result.ts';
import type { ReadinessState } from '../../regulatory-twin/src/taxonomy.ts';
import type { StrategyFailure } from './types.ts';

type ValueRealizationState = 'REALIZED' | 'OBSERVED' | 'ESTIMATED' | 'PROJECTED' | 'COUNTERFACTUAL';

export type MeshCapitalProposal = {
  readonly proposalId: string;
  readonly subjectId: string;
  readonly thesisSummary: string;
  readonly instrumentUniverse: readonly string[];
  readonly riskBudgetRef: string;
  readonly modelRefs: readonly { readonly modelId: string; readonly version: string }[];
  readonly source: 'AGENTIC_CAPITAL_MESH';
  readonly meshCannotSetValidation: true;
};

export type StrategyDraftFromMesh = {
  readonly proposalId: string;
  readonly subjectId: string;
  readonly instrumentUniverse: readonly string[];
  readonly riskBudgetRef: string;
  readonly modelRefs: readonly { readonly modelId: string; readonly version: string }[];
  readonly validationSetByMesh: false;
};

export function draftFromMeshProposal(proposal: MeshCapitalProposal): Result<StrategyDraftFromMesh, StrategyFailure> {
  if (proposal.source !== 'AGENTIC_CAPITAL_MESH') {
    return err({ code: 'MESH_CANNOT_VALIDATE', message: 'only a Mesh CapitalProposal may create this draft path' });
  }
  return ok(
    Object.freeze({
      proposalId: proposal.proposalId,
      subjectId: proposal.subjectId,
      instrumentUniverse: Object.freeze([...proposal.instrumentUniverse]),
      riskBudgetRef: proposal.riskBudgetRef,
      modelRefs: Object.freeze([...proposal.modelRefs]),
      validationSetByMesh: false,
    }),
  );
}

export function refuseMeshValidation(): Result<never, StrategyFailure> {
  return err({
    code: 'MESH_CANNOT_VALIDATE',
    message: 'Agentic Capital Mesh cannot set a Strategy Lab validation result',
  });
}

export type PeveStrategyValueClass =
  | 'BACKTEST_NOT_REALIZED'
  | 'SHADOW_NOT_REALIZED'
  | 'PROJECTED_NOT_REALIZED'
  | 'PAPER_SIMULATION_ANALYTICS';

export function classifyPeveStrategyValue(kind: 'BACKTEST' | 'SHADOW' | 'PROJECTED' | 'PAPER'): {
  readonly class: PeveStrategyValueClass;
  readonly realization: ValueRealizationState;
  readonly realizedUserValue: false;
  readonly simulation: true;
} {
  if (kind === 'PAPER') {
    return Object.freeze({
      class: 'PAPER_SIMULATION_ANALYTICS',
      realization: 'OBSERVED',
      realizedUserValue: false,
      simulation: true,
    });
  }
  if (kind === 'BACKTEST') {
    return Object.freeze({
      class: 'BACKTEST_NOT_REALIZED',
      realization: 'COUNTERFACTUAL',
      realizedUserValue: false,
      simulation: true,
    });
  }
  if (kind === 'SHADOW') {
    return Object.freeze({
      class: 'SHADOW_NOT_REALIZED',
      realization: 'COUNTERFACTUAL',
      realizedUserValue: false,
      simulation: true,
    });
  }
  return Object.freeze({
    class: 'PROJECTED_NOT_REALIZED',
    realization: 'PROJECTED',
    realizedUserValue: false,
    simulation: true,
  });
}

export function refusePeveRealizedBacktest(): Result<never, StrategyFailure> {
  return err({
    code: 'PEVE_REALIZED_FORBIDDEN',
    message: 'PEVE must not treat backtest, shadow, or projected gain as realized user value',
  });
}

export type GrowthStrategyGate = 'NEEDS_BACKTEST' | 'PAPER_VALIDATED' | 'VALIDATION_FAILED';

export function growthGateFromLab(input: {
  readonly paperApproved: boolean;
  readonly validationFailed: boolean;
}): GrowthStrategyGate {
  if (input.validationFailed) {
    return 'VALIDATION_FAILED';
  }
  if (input.paperApproved) {
    return 'PAPER_VALIDATED';
  }
  return 'NEEDS_BACKTEST';
}

export function rdtLaunchReadiness(state: ReadinessState | 'UNRESOLVED'): {
  readonly launchReady: false;
  readonly paperSimulationAcceptable: boolean;
  readonly reason: string;
} {
  if (
    state === 'UNRESOLVED' ||
    state === 'RESEARCH_REQUIRED' ||
    state === 'COUNSEL_REVIEW_REQUIRED' ||
    state === 'CONTROL_GAP' ||
    state === 'TECHNICAL_GAP' ||
    state === 'DEPENDENCY_NOT_IMPLEMENTED'
  ) {
    return Object.freeze({
      launchReady: false,
      paperSimulationAcceptable: false,
      reason: 'RDT status is unresolved; do not claim launch readiness',
    });
  }
  return Object.freeze({
    launchReady: false,
    paperSimulationAcceptable: state === 'SIMULATION_READY',
    reason: 'RDT may assess strategy category and universe; launch readiness is never claimed by Strategy Lab',
  });
}

export function evaluateAggressiveObjective(input: {
  readonly objective: string;
  readonly achieved: boolean;
  readonly omittedLosses: boolean;
  readonly ignoredCosts: boolean;
  readonly leakedFuture: boolean;
  readonly relaxedRisk: boolean;
}): {
  readonly evaluated: true;
  readonly guaranteed: false;
  readonly fabricated: false;
  readonly promote: false;
  readonly notes: readonly string[];
} {
  const notes = [
    `Objective preserved: ${input.objective}`,
    'Strategy Lab does not guarantee achievement.',
    input.achieved ? 'Historical fixture met the numeric path in-sample only.' : 'Historical fixture did not achieve the objective.',
  ];
  if (input.omittedLosses || input.ignoredCosts || input.leakedFuture || input.relaxedRisk) {
    notes.push('A result that omitted losses, ignored costs, leaked future data, or relaxed RiskBudget is rejected.');
  }
  return Object.freeze({
    evaluated: true,
    guaranteed: false,
    fabricated: false,
    promote: false,
    notes: Object.freeze(notes),
  });
}
