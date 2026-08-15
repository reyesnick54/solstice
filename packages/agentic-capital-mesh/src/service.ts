import { createHash } from 'node:crypto';

import type { Clock } from '../../config/src/clock.ts';
import { addMs } from '../../config/src/clock.ts';
import { err, ok, type Result } from '../../domain/src/result.ts';
import type { UtcInstant } from '../../domain/src/time.ts';
import type { EvidenceVault } from '../../evidence/src/vault.ts';
import type { DomainEventLog } from '../../events/src/events.ts';
import { interpretMandateLanguage } from '../../agent/src/interpretation.ts';
import { isVerifiedActorContext } from '../../identity/src/actor-context.ts';
import type { ModelRegistry } from '../../model-registry/src/registry.ts';
import { asPortfolioRiskSnapshotId } from '../../risk/src/ids.ts';
import { defaultSimulationBudget, RiskEngine } from '../../risk/src/engine.ts';
import type {
  PortfolioRiskSnapshot,
  ProposedPaperTrade,
  RiskBudget,
  RiskDecision,
  RiskOutcome,
} from '../../risk/src/types.ts';
import { compileAllocation, createAllocationCandidate } from './allocation.ts';
import { arbitrate, refuseAgentVoteAuthorization } from './arbiter.ts';
import { assembleCapitalContext, type ContextSource } from './context.ts';
import {
  asCapitalMeshId,
  asCapitalMeshRunId,
  asCapitalProposalId,
  type CapitalMeshId,
  type CapitalMeshRunId,
} from './ids.ts';
import { computeInvestableCapital } from './investable.ts';
import { assertTransition } from './lifecycle.ts';
import { freezeNodeOutput, nodeForRole } from './nodes.ts';
import { collectDisagreements, reviewCandidate } from './review.ts';
import { markStale } from './staleness.ts';
import { CapitalMeshStore } from './store.ts';
import { createScenarios, createThesis } from './thesis.ts';
import { classifyExternalContent, looksLikeInjection, preserveAsUserObjective } from './trust.ts';
import type {
  CapitalAllocationCandidate,
  CapitalArbitration,
  CapitalContext,
  CapitalProposal,
  CompiledAllocation,
  MeshRun,
  ModelRef,
  NodeOutput,
} from './types.ts';
import type { MeshRunState } from './lifecycle.ts';

export type MeshFailure = {
  readonly code:
    | 'ACTOR_CONTEXT_REQUIRED'
    | 'ILLEGAL_TRANSITION'
    | 'CONTEXT_FAILED'
    | 'ALLOCATION_INVALID'
    | 'COMPILE_FAILED'
    | 'RUN_NOT_FOUND';
  readonly message: string;
};

export type CandidateSpec = {
  readonly candidateId: string;
  readonly slices: readonly { readonly instrumentId: string; readonly percent: bigint; readonly cash?: boolean }[];
};

export type EvaluatedCandidate = {
  readonly candidate: CapitalAllocationCandidate;
  readonly compiled: CompiledAllocation;
  readonly risk?: RiskDecision;
  readonly arbitration: CapitalArbitration;
  readonly proposal?: CapitalProposal;
};

function hashId(prefix: string, material: string): string {
  return `${prefix}${createHash('sha256').update(material).digest('hex').slice(0, 24)}`;
}

export class CapitalMeshService {
  readonly store: CapitalMeshStore;
  private readonly clock: Clock;
  private readonly registry: ModelRegistry;
  private readonly risk: RiskEngine;
  private readonly events: DomainEventLog | undefined;
  private readonly evidence: EvidenceVault | undefined;
  readonly meshId: CapitalMeshId;

  constructor(input: {
    readonly clock: Clock;
    readonly registry: ModelRegistry;
    readonly risk: RiskEngine;
    readonly store?: CapitalMeshStore;
    readonly events?: DomainEventLog;
    readonly evidence?: EvidenceVault;
    readonly meshId?: string;
  }) {
    this.clock = input.clock;
    this.registry = input.registry;
    this.risk = input.risk;
    this.store = input.store ?? new CapitalMeshStore();
    this.events = input.events;
    this.evidence = input.evidence;
    this.meshId = asCapitalMeshId(input.meshId ?? 'cmsh_canonical');
  }

  createRun(subjectId: string): MeshRun {
    const now = this.clock.now();
    const run: MeshRun = Object.freeze({
      runId: asCapitalMeshRunId(hashId('cmrun_', `${this.meshId}:${subjectId}:${now}`)),
      meshId: this.meshId,
      subjectId,
      state: 'CREATED',
      createdAt: now,
      updatedAt: now,
    });
    this.store.putRun(run);
    this.emit('CapitalMeshRunStarted', run.runId, { runId: run.runId, subjectId });
    return run;
  }

  private transition(run: MeshRun, state: MeshRunState): MeshRun {
    assertTransition(run.state, state);
    const next = Object.freeze({ ...run, state, updatedAt: this.clock.now() });
    this.store.putRun(next);
    return next;
  }

  bindContext(run: MeshRun, source: ContextSource): Result<{ readonly run: MeshRun; readonly context: CapitalContext }, MeshFailure> {
    const assembled = assembleCapitalContext({
      meshId: this.meshId,
      subjectId: run.subjectId,
      now: this.clock.now(),
      source,
    });
    if (!assembled.ok) {
      return err({ code: 'CONTEXT_FAILED', message: assembled.error.message });
    }
    this.store.putContext(assembled.value);
    const next = this.transition({ ...run, contextId: assembled.value.contextId }, 'CONTEXT_BOUND');
    return ok({ run: next, context: assembled.value });
  }

  interpretObjective(actor: unknown, subjectId: string, sourceText: string): Result<string, MeshFailure> {
    if (!isVerifiedActorContext(actor)) {
      return err({
        code: 'ACTOR_CONTEXT_REQUIRED',
        message: 'Mesh objective interpretation reuses the Personal Economy Agent boundary and requires ActorContext',
      });
    }
    const interpreted = interpretMandateLanguage({
      subjectId,
      sourceText,
      now: this.clock.now(),
    });
    if (!interpreted.ok) {
      return ok(preserveAsUserObjective(sourceText).objective);
    }
    return ok(interpreted.value.goals[0]?.label ?? preserveAsUserObjective(sourceText).objective);
  }

  classifyMarketText(text: string) {
    return classifyExternalContent(text);
  }

  evaluateCandidates(input: {
    readonly run: MeshRun;
    readonly context: CapitalContext;
    readonly actor: unknown;
    readonly userObjective: string;
    readonly candidates: readonly CandidateSpec[];
    readonly budget?: RiskBudget;
    readonly externalMarketText?: string;
  }): Result<{ readonly run: MeshRun; readonly evaluations: readonly EvaluatedCandidate[] }, MeshFailure> {
    if (!isVerifiedActorContext(input.actor)) {
      return err({ code: 'ACTOR_CONTEXT_REQUIRED', message: 'Mesh evaluation requires a verified ActorContext' });
    }
    const budget = this.resolveBudget(input.context, input.budget);
    let run = input.run;
    run = this.transition(run, 'ANALYZING');
    const objective = preserveAsUserObjective(input.userObjective);
    const classified = classifyExternalContent(input.externalMarketText ?? '');
    if (looksLikeInjection(input.externalMarketText ?? '') && classified.treatedAsInstruction) {
      throw new Error('untrusted market text must never become an instruction');
    }

    const marketNode = nodeForRole('MARKET_RESEARCH');
    const riskCritic = nodeForRole('RISK_CRITIC');
    const mandateCritic = nodeForRole('MANDATE_CRITIC');
    const construction = nodeForRole('PORTFOLIO_CONSTRUCTION');
    const modelRefs: ModelRef[] = Object.freeze([
      marketNode.model,
      riskCritic.model,
      mandateCritic.model,
      construction.model,
    ]);

    const thesis = createThesis({
      subjectId: input.context.subjectId,
      objective: objective.objective,
      instrumentRefs: input.context.universe.map((row) => row.instrumentId),
      horizon: 'simulation-review',
      rationale: 'Structured capital thesis for analysis. This is not a trade.',
      sourceFacts: Object.freeze([
        `portfolio:${input.context.portfolio.portfolioId}`,
        `mandate:${input.context.mandate.mandateId}@${input.context.mandate.version}`,
        `growth:${input.context.growth.planId}`,
        `peve:${input.context.peve.resilienceLabel}/${input.context.peve.goalProgressLabel}`,
      ]),
      assumptions: Object.freeze(['Simulation prices remain the snapshot used for compilation.']),
      expectedMechanism: 'Rebalance brokerage cash into approved ETF fixtures only if controls allow.',
      supportingEvidence: Object.freeze(['Active simulated investment account', 'Approved simulation models']),
      contradictingEvidence: Object.freeze(['Strategy Lab is absent', 'RDT is not a legal approval']),
      riskFactors: Object.freeze(['concentration', 'liquidity', 'stale data', 'unvalidated strategy']),
      invalidationConditions: Object.freeze([
        'mandate change',
        'RiskBudget change',
        'model retirement',
        'stale market snapshot',
      ]),
      scenarios: createScenarios({
        downside: 'Equity shock reduces the proposed sleeve. Recovery is not guaranteed.',
        base: 'Allocation remains a candidate for Strategy Lab. No return is promised.',
        upside: 'Favorable mark-to-market is unrealized and not withdrawable.',
      }),
      modelRefs,
      createdAt: this.clock.now(),
    });
    this.store.putThesis(thesis);
    this.emit('CapitalMeshThesisCreated', run.runId, { thesisId: thesis.thesisId, runId: run.runId });

    run = this.transition(run, 'GENERATING_CANDIDATES');
    const investable = computeInvestableCapital(input.context);
    const built: {
      readonly spec: CandidateSpec;
      readonly candidate: CapitalAllocationCandidate;
      readonly compiled: CompiledAllocation;
    }[] = [];
    for (const spec of input.candidates) {
      const candidate = createAllocationCandidate({
        candidateId: spec.candidateId,
        subjectId: input.context.subjectId,
        slices: spec.slices,
      });
      if (!candidate.ok) {
        return err({ code: 'ALLOCATION_INVALID', message: candidate.error.message });
      }
      this.store.putCandidate(candidate.value);
      this.emit('CapitalMeshCandidateCreated', run.runId, {
        candidateId: candidate.value.candidateId,
        runId: run.runId,
      });
      const compiled = compileAllocation({
        candidate: candidate.value,
        investableMinor: investable.investableMinor,
        currency: input.context.universe[0]?.currency ?? 'USD',
        prices: input.context.market,
        universe: input.context.universe,
      });
      if (!compiled.ok) {
        return err({ code: 'COMPILE_FAILED', message: compiled.error.message });
      }
      built.push({ spec, candidate: candidate.value, compiled: compiled.value });
    }

    run = this.transition(run, 'CHALLENGING');
    run = this.transition(run, 'RISK_EVALUATING');
    run = this.transition(run, 'ARBITRATING');
    const evaluations: EvaluatedCandidate[] = [];
    for (const item of built) {
      const outputs: NodeOutput[] = [
        freezeNodeOutput({
          nodeId: marketNode.nodeId,
          role: 'MARKET_RESEARCH',
          stance: 'POSITIVE',
          summary: 'Approved ETF fixtures are available for simulation analysis.',
          facts: Object.freeze(input.context.universe.map((row) => row.instrumentId)),
          assumptions: Object.freeze(['Fixture prices are not forecasts.']),
          model: marketNode.model,
        }),
        freezeNodeOutput({
          nodeId: construction.nodeId,
          role: 'PORTFOLIO_CONSTRUCTION',
          stance: 'NEUTRAL',
          summary: 'Deterministic compiler produced quantities and a cash remainder.',
          facts: Object.freeze(item.compiled.quantities.map((qty) => `${qty.instrumentId}:${qty.quantityUnits}`)),
          assumptions: Object.freeze(['AI arithmetic was not used.']),
          model: construction.model,
        }),
      ];

      const concentration = item.candidate.slices
        .filter((slice) => slice.kind === 'INSTRUMENT')
        .map((slice) => `${slice.instrumentId}=${slice.weight.units.toString()}`)
        .join(',');
      const review = reviewCandidate({
        candidate: item.candidate,
        context: input.context,
        concentrationNote: concentration,
        riskNote: 'Risk Engine is the hard gate; critic output cannot override BLOCK.',
        staleNote: input.context.market.some((row) => row.stale) ? 'stale' : 'snapshot current for this run',
      });
      this.store.putReview(review);
      this.emit('CapitalMeshReviewCompleted', run.runId, { reviewId: review.reviewId, runId: run.runId });

      const snapshot = this.asRiskSnapshot(input.context);
      this.risk.captureSnapshot(snapshot);
      let worst: RiskOutcome = 'ALLOW_SIMULATION';
      let decision: RiskDecision | undefined;
      for (const qty of item.compiled.quantities) {
        if (qty.quantityUnits <= 0n) {
          continue;
        }
        const instrument = input.context.universe.find((row) => row.instrumentId === qty.instrumentId);
        const proposed: ProposedPaperTrade = Object.freeze({
          proposalRef: item.candidate.candidateId,
          instrumentId: qty.instrumentId,
          instrumentType: instrument?.instrumentType ?? 'ETF',
          currency: qty.currency,
          side: 'BUY',
          quantityUnits: qty.quantityUnits,
          quantityScale: 8,
          priceMinor: input.context.market.find((row) => row.instrumentId === qty.instrumentId)?.priceMinor ?? 0n,
          notionalMinor: qty.notionalMinor,
          feeMinor: 0n,
          liquidityClass: 'HIGH',
        });
        const assessed = this.risk.assessPreTrade({
          snapshot,
          proposed,
          budget,
        });
        decision = assessed;
        if (assessed.outcome === 'BLOCK') {
          worst = 'BLOCK';
          break;
        }
        if (assessed.outcome === 'REQUIRE_REVIEW' && worst === 'ALLOW_SIMULATION') {
          worst = 'REQUIRE_REVIEW';
        }
      }
      outputs.push(
        freezeNodeOutput({
          nodeId: riskCritic.nodeId,
          role: 'RISK_CRITIC',
          stance: worst === 'BLOCK' ? 'CHALLENGE' : 'NEUTRAL',
          summary:
            worst === 'BLOCK'
              ? 'High concentration or another hard Risk limit is breached.'
              : 'Risk Engine did not BLOCK this candidate in simulation.',
          facts: Object.freeze([`risk:${worst}`, decision?.assessmentId ?? 'none']),
          assumptions: Object.freeze(['Critic cannot relax RiskBudget.']),
          model: riskCritic.model,
        }),
        freezeNodeOutput({
          nodeId: mandateCritic.nodeId,
          role: 'MANDATE_CRITIC',
          stance: input.context.mandate.compatibleWithInvestment ? 'NEUTRAL' : 'CHALLENGE',
          summary: input.context.mandate.compatibleWithInvestment
            ? 'Mandate is compatible with considering investment activity.'
            : 'Mandate hard constraints forbid treating this as investable.',
          facts: Object.freeze(input.context.mandate.hardConstraintKinds),
          assumptions: Object.freeze(['Growth answers whether investment should be considered; Mesh does not replace Growth.']),
          model: mandateCritic.model,
        }),
      );
      for (const output of outputs) {
        this.store.putNodeOutput(output);
      }

      const arbitration = arbitrate({
        context: input.context,
        compiled: item.compiled,
        modelRefs,
        registry: this.registry,
        riskOutcome: decision?.outcome ?? (item.compiled.quantities.every((qty) => qty.quantityUnits === 0n) ? 'INSUFFICIENT_DATA' : worst),
        schemaValid: true,
        requiredFactsPresent: true,
        contradictionBlocks: false,
      });
      this.store.putArbitration(arbitration);
      if (arbitration.vetoes.length > 0) {
        this.emit('CapitalMeshVetoApplied', run.runId, {
          runId: run.runId,
          reasons: arbitration.vetoes.map((item) => item.reason),
        });
      }

      let proposal: CapitalProposal | undefined;
      if (arbitration.outcome !== 'BLOCKED') {
        proposal = this.proposalFrom({
          run,
          context: input.context,
          candidate: item.candidate,
          compiled: item.compiled,
          thesis,
          arbitration,
          decision,
          disagreements: collectDisagreements(outputs),
          modelRefs,
        });
        this.store.putProposal(proposal);
        this.emit('CapitalMeshProposalCreated', run.runId, { proposalId: proposal.proposalId, runId: run.runId });
        this.evidence?.seal('CAPITAL_MESH_PROPOSAL', {
          proposalId: proposal.proposalId,
          subjectId: input.context.subjectId,
          peg: input.context.pegSnapshotRef,
          mandate: input.context.mandate.mandateId,
          growthPlan: input.context.growth.planId,
          peve: input.context.peve.snapshotId,
          portfolio: input.context.portfolio.portfolioId,
          risk: decision?.assessmentId,
          rdt: input.context.rdt.state,
          arbiter: arbitration.arbitrationId,
          noSecrets: true,
          noRawPrompts: true,
        });
      }

      evaluations.push(
        Object.freeze({
          candidate: item.candidate,
          compiled: item.compiled,
          ...(decision ? { risk: decision } : {}),
          arbitration,
          ...(proposal ? { proposal } : {}),
        }),
      );
    }

    const anyReady = evaluations.some((item) => item.arbitration.outcome !== 'BLOCKED' && item.proposal);
    const anyBlockedOnly = evaluations.every((item) => item.arbitration.outcome === 'BLOCKED');
    run = this.advance(run, anyReady ? 'PROPOSAL_READY' : anyBlockedOnly ? 'REFUSED' : 'COMPLETED');
    if (run.state === 'PROPOSAL_READY') {
      run = this.transition(run, 'COMPLETED');
    }
    return ok({ run, evaluations: Object.freeze(evaluations) });
  }

  markProposalStale(proposal: CapitalProposal): CapitalProposal {
    const stale = markStale(proposal);
    this.store.putProposal(stale);
    this.emit('CapitalMeshProposalStale', proposal.runId, { proposalId: proposal.proposalId, runId: proposal.runId });
    return stale;
  }

  refuseVoting(votesFor: bigint, votesAgainst: bigint) {
    return refuseAgentVoteAuthorization(votesFor, votesAgainst);
  }

  private advance(run: MeshRun, state: MeshRunState): MeshRun {
    if (run.state === state) {
      return run;
    }
    return this.transition(run, state);
  }

  private resolveBudget(context: CapitalContext, budget?: RiskBudget): RiskBudget {
    if (budget) {
      return budget;
    }
    const stored = this.risk.store.getBudget(context.riskBudget.budgetId);
    if (stored) {
      return stored;
    }
    return defaultSimulationBudget({
      subjectId: context.subjectId,
      portfolioId: context.portfolio.portfolioId,
      reviewBy: this.clock.now(),
    });
  }

  private asRiskSnapshot(context: CapitalContext): PortfolioRiskSnapshot {
    return Object.freeze({
      snapshotId: asPortfolioRiskSnapshotId(hashId('prs_', context.contextId)),
      portfolioId: context.portfolio.portfolioId,
      subjectId: context.subjectId,
      asOf: context.generatedAt,
      currency: context.universe[0]?.currency ?? 'USD',
      positions: Object.freeze(
        context.portfolio.holdings.map((row) =>
          Object.freeze({
            instrumentId: row.instrumentId,
            instrumentType: row.instrumentType,
            currency: row.currency,
            quantityUnits: row.quantityUnits,
            marketValueMinor: row.marketValueMinor,
            priceMinor: row.priceMinor,
            priceTimestamp: context.generatedAt,
            priceQuality: 'CURRENT' as const,
            liquidityClass: 'HIGH' as const,
            sourceRef: context.contextId,
          }),
        ),
      ),
      brokerageCashMinor: context.portfolio.brokerageCashMinor,
      unsettledCashMinor: context.portfolio.unsettledCashMinor,
      pendingOrderNotionalMinor: context.portfolio.pendingOrderNotionalMinor,
      realizedPnlMinor: 0n,
      unrealizedPnlMinor: 0n,
      mandate: Object.freeze({
        kind: context.mandate.hardConstraintKinds.includes('KEEP_ALL_LIQUID')
          ? ('KEEP_ALL_LIQUID' as const)
          : ('MINIMUM_CASH_RESERVE' as const),
        minimumLiquidMinor: context.mandate.minimumLiquidMinor,
        currency: context.universe[0]?.currency ?? 'USD',
        overrideForbidden: true as const,
        sourceRef: context.mandate.mandateId,
      }),
      observations: Object.freeze([]),
      sourceRefs: Object.freeze([context.contextId]),
      simulationOnly: true as const,
    });
  }

  private proposalFrom(input: {
    readonly run: MeshRun;
    readonly context: CapitalContext;
    readonly candidate: CapitalAllocationCandidate;
    readonly compiled: CompiledAllocation;
    readonly thesis: ReturnType<typeof createThesis>;
    readonly arbitration: CapitalArbitration;
    readonly decision?: RiskDecision;
    readonly disagreements: ReturnType<typeof collectDisagreements>;
    readonly modelRefs: readonly ModelRef[];
  }): CapitalProposal {
    const now = this.clock.now();
    return Object.freeze({
      proposalId: asCapitalProposalId(hashId('cmpr_', `${input.run.runId}:${input.candidate.candidateId}`)),
      runId: input.run.runId,
      subjectId: input.context.subjectId,
      mandateId: input.context.mandate.mandateId,
      mandateVersion: input.context.mandate.version,
      growthPlanId: input.context.growth.planId,
      ...(input.context.pegSnapshotRef ? { pegSnapshotRef: input.context.pegSnapshotRef } : {}),
      ...(input.context.peve.snapshotId ? { peveSnapshotRef: input.context.peve.snapshotId } : {}),
      portfolioRef: input.context.portfolio.portfolioId,
      marketSnapshotAt: input.context.generatedAt,
      proposedAllocation: input.candidate,
      theses: Object.freeze([input.thesis]),
      scenarios: input.thesis.scenarioOutcomes,
      investableCapitalMinor: input.compiled.investableCapitalMinor,
      compiled: input.compiled,
      risks: Object.freeze(input.decision?.triggeredLimits.map((item) => item.message) ?? []),
      ...(input.decision ? { riskAssessmentId: input.decision.assessmentId, riskDecision: input.decision.outcome } : {}),
      ...(input.decision
        ? { riskModel: { modelId: input.decision.modelId as never, version: input.decision.modelVersion as never } }
        : {}),
      riskBudgetVersion: input.context.riskBudget.version,
      stressSummary: Object.freeze(input.decision?.calculations.map((item) => item.name) ?? []),
      breaches: Object.freeze(input.decision?.triggeredLimits.map((item) => item.dimension) ?? []),
      rdt: input.context.rdt,
      modelRefs: input.modelRefs,
      assumptions: Object.freeze(['Simulation only. No guaranteed return.']),
      disagreements: input.disagreements,
      confirmations: Object.freeze({
        userConfirmationRequired: true as const,
        stepUpAuthRequired: input.compiled.investableCapitalMinor >= 100_000n,
        strategyValidationRequired: true as const,
        riskRefreshRequired: true,
        regulatoryOrHumanReviewOutstanding:
          input.context.rdt.state === 'RESEARCH_REQUIRED' ||
          input.context.rdt.state === 'COUNSEL_REVIEW_REQUIRED' ||
          input.arbitration.outcome === 'NEEDS_HUMAN_REVIEW',
        silentEnrollment: false as const,
      }),
      strategyValidation: input.arbitration.strategyValidation,
      expiresAt: addMs(now, 3_600_000n),
      stale: false,
      executable: false,
      createdAt: now,
    });
  }

  private emit(eventType: string, runId: CapitalMeshRunId, payload: Record<string, unknown>): void {
    this.events?.append({
      eventType: eventType as never,
      schemaVersion: 1,
      occurredAt: this.clock.now(),
      payload: Object.freeze({ ...payload, runId, mutatesFinancialState: false }),
      aggregateType: 'capital_mesh',
      aggregateId: runId,
    } as never);
  }
}

export type { CapitalMeshRunId };
