import { randomUUID } from 'node:crypto';

import type { Clock } from '../../config/src/clock.ts';
import { err, ok, type Result } from '../../domain/src/result.ts';
import type { EvidenceVault } from '../../evidence/src/vault.ts';
import type { DomainEventLog } from '../../events/src/events.ts';
import {
  createSimulationPolicyEngine,
  type PolicyRegistry,
  type PolicyVersionRecord,
} from '../../kernel/src/policy/index.ts';
import {
  authorizeHistoricalCustomerScenario,
  authorizeOperateTwin,
  authorizeViewTwin,
  type RegulatoryAccessFailure,
} from './access.ts';
import { changeAssumptionStatus, createAssumption, type AssumptionFailure } from './assumptions.ts';
import { compareCurrentVsCandidate, evaluateScenario, replayHistorical } from './compare.ts';
import { EXPECTED_BATCH_COUNTS } from './fixtures.ts';
import { assessGrowthPlanImpact, estimatePeveImpact } from './growth.ts';
import {
  asCandidatePolicySetId,
  asImpactReportId,
  asRegulatoryTwinId,
  asScenarioRunId,
  type CandidatePolicySetId,
  type RegulatorySnapshotId,
} from './ids.ts';
import { runInvariantSuite } from './invariants.ts';
import {
  assessCardReadiness,
  assessCorridorReadiness,
  assessInvestmentReadiness,
  assessProductReadiness,
} from './readiness.ts';
import { disposeReadiness } from './review.ts';
import { createSandboxEngine, refuseProductionActivation } from './sandbox.ts';
import { captureRegulatorySnapshot } from './snapshot.ts';
import { RegulatoryTwinStore } from './store.ts';
import { EVIDENCE_KIND_SIMULATION } from './taxonomy.ts';
import type {
  BatchImpactCounts,
  BatchImpactResult,
  CandidatePolicySet,
  CurrentVsCandidateResult,
  PolicyActivationRefusal,
  RegulatoryAssumption,
  RegulatoryImpactReport,
  RegulatoryScenario,
  RegulatorySnapshot,
  RegulatoryTwinRecord,
} from './types.ts';

export type RegulatoryDigitalTwinOptions = {
  readonly clock: Clock;
  readonly evidence: EvidenceVault;
  readonly events: DomainEventLog;
  readonly store?: RegulatoryTwinStore;
  readonly productionRegistry?: PolicyRegistry;
};

function countBatch(rows: readonly CurrentVsCandidateResult[]): BatchImpactCounts {
  let unchanged = 0;
  let newReview = 0;
  let newBlock = 0;
  let newDefer = 0;
  let newAllow = 0;
  let insufficientFacts = 0;
  for (const row of rows) {
    if (row.candidate.decisionClass === 'INSUFFICIENT_FACTS') {
      insufficientFacts += 1;
      continue;
    }
    if (!row.changed) {
      unchanged += 1;
      continue;
    }
    if (row.candidate.decision === 'REQUIRE_MANUAL_REVIEW' && row.current.decision !== 'REQUIRE_MANUAL_REVIEW') {
      newReview += 1;
    } else if (row.candidate.decision === 'BLOCK' && row.current.decision !== 'BLOCK') {
      newBlock += 1;
    } else if (row.candidate.decision === 'DEFER' && row.current.decision !== 'DEFER') {
      newDefer += 1;
    } else if (row.candidate.decision === 'ALLOW' && row.current.decision !== 'ALLOW') {
      newAllow += 1;
    } else {
      unchanged += 1;
    }
  }
  return Object.freeze({
    totalEvaluated: rows.length,
    unchanged,
    newReview,
    newBlock,
    newDefer,
    newAllow,
    insufficientFacts,
  });
}

/**
 * Canonical Regulatory Digital Twin. Simulation / counterfactual only.
 * Reuses the existing PolicyEngine through an isolated sandbox.
 */
export class RegulatoryDigitalTwin {
  readonly store: RegulatoryTwinStore;
  readonly productionRegistry: PolicyRegistry;
  private readonly clock: Clock;
  private readonly evidence: EvidenceVault;
  private readonly events: DomainEventLog;
  readonly twin: RegulatoryTwinRecord;

  constructor(options: RegulatoryDigitalTwinOptions) {
    this.clock = options.clock;
    this.evidence = options.evidence;
    this.events = options.events;
    this.store = options.store ?? new RegulatoryTwinStore();
    this.productionRegistry = options.productionRegistry ?? createSimulationPolicyEngine().registry;
    this.twin = Object.freeze({
      twinId: asRegulatoryTwinId(`rtw_${randomUUID().replaceAll('-', '')}`),
      createdAt: this.clock.now(),
      label: 'canonical-regulatory-digital-twin',
    });
    this.store.putTwin(this.twin);
  }

  captureSnapshot(actor: unknown): Result<RegulatorySnapshot, RegulatoryAccessFailure> {
    const auth = authorizeViewTwin(actor);
    if (!auth.ok) return auth;
    const snapshot = captureRegulatorySnapshot({
      twinId: this.twin.twinId,
      registry: this.productionRegistry,
      capturedAt: this.clock.now(),
      effectiveAt: this.clock.now(),
    });
    this.store.putSnapshot(snapshot);
    this.seal('REGULATORY_TWIN_SNAPSHOT', {
      snapshotId: snapshot.snapshotId,
      contentHash: snapshot.contentHash,
      simulation: true,
      executionAuthorization: false,
    });
    return ok(snapshot);
  }

  createScenario(
    actor: unknown,
    scenario: RegulatoryScenario,
  ): Result<RegulatoryScenario, RegulatoryAccessFailure> {
    const historical = Boolean(scenario.historicalPolicyPin || scenario.subjectRef);
    const auth = historical
      ? authorizeHistoricalCustomerScenario(actor)
      : authorizeOperateTwin(actor);
    if (!auth.ok) return auth;
    this.store.putScenario(scenario);
    this.emit('RegulatoryTwinScenarioCreated', scenario.scenarioId, {
      scenarioId: scenario.scenarioId,
      category: scenario.category,
      invariant: scenario.invariant,
      factSourceKinds: Object.values(scenario.facts)
        .filter(Boolean)
        .map((fact) => fact?.source),
    });
    return ok(scenario);
  }

  registerCandidateSet(
    actor: unknown,
    input: Omit<CandidatePolicySet, 'candidateSetId'>,
  ): Result<CandidatePolicySet, RegulatoryAccessFailure> {
    const auth = authorizeOperateTwin(actor);
    if (!auth.ok) return auth;
    const row: CandidatePolicySet = Object.freeze({
      ...input,
      candidateSetId: asCandidatePolicySetId(`cps_${randomUUID().replaceAll('-', '')}`),
      versions: Object.freeze([...input.versions]),
      sourceRefs: Object.freeze([...input.sourceRefs]),
    });
    this.store.putCandidate(row);
    return ok(row);
  }

  compare(
    actor: unknown,
    input: {
      readonly scenario: RegulatoryScenario;
      readonly candidateVersions: readonly PolicyVersionRecord[];
      readonly baselineSnapshotId: RegulatorySnapshotId;
      readonly candidateSetId: CandidatePolicySetId;
    },
  ): Result<CurrentVsCandidateResult, RegulatoryAccessFailure> {
    const auth = input.scenario.subjectRef
      ? authorizeHistoricalCustomerScenario(actor)
      : authorizeViewTwin(actor);
    if (!auth.ok) return auth;
    const result = compareCurrentVsCandidate({
      productionRegistry: this.productionRegistry,
      scenario: input.scenario,
      candidateVersions: input.candidateVersions,
      baselineSnapshotId: input.baselineSnapshotId,
      candidateSetId: input.candidateSetId,
      at: this.clock.now(),
    });
    this.emit('RegulatoryTwinRunCompleted', result.runId, {
      runId: result.runId,
      scenarioId: result.scenarioId,
      changed: result.changed,
      transition: result.transition,
      executionAuthorityIssued: false,
    });
    if (result.changed) {
      this.emit('RegulatoryTwinImpactDetected', result.runId, {
        runId: result.runId,
        transition: result.transition,
        restrictiveness: result.restrictiveness,
      });
    }
    this.seal('REGULATORY_TWIN_RUN', {
      runId: result.runId,
      scenarioId: result.scenarioId,
      currentDecision: result.current.decision,
      candidateDecision: result.candidate.decision,
      factsHash: result.current.factsHash,
      simulation: true,
      executionAuthorization: false,
    });
    return ok(result);
  }

  runBatch(
    actor: unknown,
    input: {
      readonly scenarios: readonly RegulatoryScenario[];
      readonly candidateVersions: readonly PolicyVersionRecord[];
      readonly baselineSnapshotId: RegulatorySnapshotId;
      readonly candidateSetId: CandidatePolicySetId;
      readonly suiteId: BatchImpactResult['suiteId'];
    },
  ): Result<BatchImpactResult, RegulatoryAccessFailure> {
    const auth = authorizeViewTwin(actor);
    if (!auth.ok) return auth;
    if (input.scenarios.some((row) => row.subjectRef)) {
      const hist = authorizeHistoricalCustomerScenario(actor);
      if (!hist.ok) return hist;
    }
    const transitions = input.scenarios.map((scenario) =>
      compareCurrentVsCandidate({
        productionRegistry: this.productionRegistry,
        scenario,
        candidateVersions: input.candidateVersions,
        baselineSnapshotId: input.baselineSnapshotId,
        candidateSetId: input.candidateSetId,
        at: this.clock.now(),
      }),
    );
    const counts = countBatch(transitions);
    const result: BatchImpactResult = Object.freeze({
      runId: transitions[0]?.runId ?? asScenarioRunId(`rrn_${randomUUID().replaceAll('-', '')}`),
      suiteId: input.suiteId,
      baselineSnapshotId: input.baselineSnapshotId,
      candidateSetId: input.candidateSetId,
      evaluatedAt: this.clock.now(),
      counts,
      transitions: Object.freeze(transitions),
    });
    this.emit('RegulatoryTwinRunCompleted', String(result.runId), {
      suiteId: result.suiteId,
      totalEvaluated: counts.totalEvaluated,
      unchanged: counts.unchanged,
      newReview: counts.newReview,
      newBlock: counts.newBlock,
      insufficientFacts: counts.insufficientFacts,
    });
    return ok(result);
  }

  generateImpactReport(
    actor: unknown,
    input: {
      readonly baseline: RegulatorySnapshot;
      readonly candidateSnapshot?: RegulatorySnapshot;
      readonly candidateSet: CandidatePolicySet;
      readonly suiteId: RegulatoryImpactReport['suiteId'];
      readonly batch: BatchImpactResult;
      readonly invariantFailures: RegulatoryImpactReport['invariantFailures'];
      readonly assumptionIds: RegulatoryImpactReport['assumptionIds'];
    },
  ): Result<RegulatoryImpactReport, RegulatoryAccessFailure> {
    const auth = authorizeViewTwin(actor);
    if (!auth.ok) return auth;
    const material = input.batch.transitions.filter((row) => row.restrictiveness !== 'UNCHANGED').length;
    const missingFacts = [
      ...new Set(input.batch.transitions.flatMap((row) => [...row.candidate.missingFacts])),
    ];
    const legalReviewGaps = input.candidateSet.legalReviewStatus === 'CONFIRMED_BY_COUNSEL'
      ? []
      : [`candidate ${input.candidateSet.candidateSetId} legal review is ${input.candidateSet.legalReviewStatus}`];
    const report: RegulatoryImpactReport = Object.freeze({
      reportId: asImpactReportId(`rir_${randomUUID().replaceAll('-', '')}`),
      twinId: this.twin.twinId,
      baselineSnapshotId: input.baseline.snapshotId,
      candidateSnapshotId: input.candidateSnapshot?.snapshotId ?? null,
      candidateSetId: input.candidateSet.candidateSetId,
      suiteId: input.suiteId,
      totalEvaluated: input.batch.counts.totalEvaluated,
      counts: input.batch.counts,
      decisionChanges: input.batch.transitions.filter((row) => row.changed).length,
      materialChanges: material,
      newBlocks: input.batch.counts.newBlock,
      newReviews: input.batch.counts.newReview,
      invariantFailures: input.invariantFailures,
      assumptionIds: input.assumptionIds,
      missingFacts: Object.freeze(missingFacts),
      legalReviewGaps: Object.freeze(legalReviewGaps),
      candidateSimulationReady: input.invariantFailures.length === 0,
      generatedAt: this.clock.now(),
      simulationOnly: true,
    });
    this.store.putReport(report);
    this.seal('REGULATORY_TWIN_IMPACT', {
      reportId: report.reportId,
      baselineHash: input.baseline.contentHash,
      candidateSetId: report.candidateSetId,
      simulation: true,
      executionAuthorization: false,
    });
    return ok(report);
  }

  runInvariants(
    actor: unknown,
    input: {
      readonly scenarios: readonly RegulatoryScenario[];
      readonly candidateVersions: readonly PolicyVersionRecord[];
      readonly baselineSnapshotId: RegulatorySnapshotId;
      readonly candidateSetId: CandidatePolicySetId;
    },
  ) {
    const auth = authorizeViewTwin(actor);
    if (!auth.ok) return auth;
    const result = runInvariantSuite({
      productionRegistry: this.productionRegistry,
      ...input,
      at: this.clock.now(),
    });
    if (!result.passed) {
      this.emit('RegulatoryTwinInvariantFailed', input.candidateSetId, {
        candidateSetId: input.candidateSetId,
        failureCount: result.failures.length,
      });
    }
    return ok(result);
  }

  assessProduct(actor: unknown, input: Parameters<typeof assessProductReadiness>[0]) {
    const auth = authorizeViewTwin(actor);
    if (!auth.ok) return auth;
    const row = assessProductReadiness(input);
    this.store.putAssessment(row);
    this.emit('RegulatoryTwinReadinessAssessed', row.assessmentId, {
      assessmentId: row.assessmentId,
      kind: row.kind,
      state: row.state,
    });
    this.seal('REGULATORY_TWIN_READINESS', {
      assessmentId: row.assessmentId,
      state: row.state,
      simulation: true,
      executionAuthorization: false,
    });
    return ok(row);
  }

  assessCorridor(actor: unknown, input: Parameters<typeof assessCorridorReadiness>[0]) {
    const auth = authorizeViewTwin(actor);
    if (!auth.ok) return auth;
    const row = assessCorridorReadiness(input);
    this.store.putAssessment(row);
    this.emit('RegulatoryTwinReadinessAssessed', row.assessmentId, {
      assessmentId: row.assessmentId,
      kind: row.kind,
      state: row.state,
    });
    return ok(row);
  }

  assessCard(actor: unknown, input: Parameters<typeof assessCardReadiness>[0]) {
    const auth = authorizeViewTwin(actor);
    if (!auth.ok) return auth;
    return ok(assessCardReadiness(input));
  }

  assessInvestment(actor: unknown, input: Parameters<typeof assessInvestmentReadiness>[0]) {
    const auth = authorizeViewTwin(actor);
    if (!auth.ok) return auth;
    return ok(assessInvestmentReadiness(input));
  }

  growthImpact(actor: unknown, input: Parameters<typeof assessGrowthPlanImpact>[0]) {
    const auth = authorizeViewTwin(actor);
    if (!auth.ok) return auth;
    return ok(assessGrowthPlanImpact(input));
  }

  peveImpact(actor: unknown, input: Parameters<typeof estimatePeveImpact>[0]) {
    const auth = authorizeViewTwin(actor);
    if (!auth.ok) return auth;
    return ok(estimatePeveImpact(input));
  }

  registerAssumption(
    actor: unknown,
    input: Parameters<typeof createAssumption>[0],
  ): Result<RegulatoryAssumption, RegulatoryAccessFailure | AssumptionFailure> {
    const auth = authorizeOperateTwin(actor);
    if (!auth.ok) return auth;
    const created = createAssumption(input);
    if (created.ok) {
      this.store.putAssumption(created.value);
    }
    return created;
  }

  changeAssumption(
    actor: unknown,
    input: Parameters<typeof changeAssumptionStatus>[0],
  ): Result<RegulatoryAssumption, RegulatoryAccessFailure | AssumptionFailure> {
    const auth = authorizeOperateTwin(actor);
    if (!auth.ok) return auth;
    const changed = changeAssumptionStatus(input);
    if (changed.ok) {
      this.store.putAssumption(changed.value);
    }
    return changed;
  }

  dispose(
    actor: unknown,
    input: Parameters<typeof disposeReadiness>[0],
  ) {
    const auth = authorizeOperateTwin(actor);
    if (!auth.ok) return auth;
    const result = disposeReadiness(input);
    if (result.ok) {
      this.store.putDisposition(result.value);
      this.seal('REGULATORY_TWIN_DISPOSITION', {
        reviewId: result.value.reviewId,
        disposition: result.value.disposition,
        simulation: true,
        executionAuthorization: false,
        legalStatusUnchanged: true,
      });
    }
    return result;
  }

  replay(actor: unknown, scenario: RegulatoryScenario) {
    const auth = authorizeHistoricalCustomerScenario(actor);
    if (!auth.ok) return auth;
    return ok(
      replayHistorical({
        productionRegistry: this.productionRegistry,
        scenario,
        at: this.clock.now(),
      }),
    );
  }

  evaluateCurrent(scenario: RegulatoryScenario) {
    return evaluateScenario(createSandboxEngine(this.productionRegistry), scenario, this.clock.now());
  }

  activateCandidatePolicy(): PolicyActivationRefusal {
    return Object.freeze({
      ok: false,
      code: 'RDT_CANNOT_ACTIVATE_POLICY',
      message:
        'RDT cannot activate candidate jurisdiction packs. Activation remains a separate human policy-change process.',
    });
  }

  productionActivationGuard() {
    return refuseProductionActivation();
  }

  expectedBatchCounts() {
    return EXPECTED_BATCH_COUNTS;
  }

  private emit(eventType: string, aggregateId: string, payload: Record<string, unknown>): void {
    this.events.append({
      eventType: eventType as never,
      schemaVersion: 1,
      occurredAt: this.clock.now(),
      payload,
      aggregateType: 'regulatory',
      aggregateId,
    } as never);
  }

  private seal(kind: string, payload: Record<string, unknown>): void {
    this.evidence.seal(`${EVIDENCE_KIND_SIMULATION}:${kind}`, {
      ...payload,
      kind,
      simulation: true,
      executionAuthorization: false,
    });
  }
}
