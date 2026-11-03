/**
 * HELIOS NATIVE12 — Seris strategy + research autopilot assimilation (simulation-only).
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ResearchAutopilotCoordinator,
  RESEARCH_AUTOPILOT_TASK_KINDS,
} from '../packages/agentic-capital-mesh/src/research-autopilot/index.ts';
import { FrozenClock } from '../packages/config/src/clock.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import { asCustomerId } from '../packages/domain/src/customer.ts';
import { asJurisdiction } from '../packages/domain/src/jurisdiction.ts';
import { EvidenceVault } from '../packages/evidence/src/vault.ts';
import { DomainEventLog } from '../packages/events/src/events.ts';
import { SimulatedIdentityAdapter } from '../packages/identity/src/simulation.ts';
import { ModelRegistry, seedCanonicalRiskModel } from '../packages/model-registry/src/registry.ts';
import { defaultSimulationBudget, RiskEngine } from '../packages/risk/src/engine.ts';
import { createSimulationKeyProvider } from '../packages/security/src/simulation.ts';
import { buildOs05ExampleStrategyGenome } from '../packages/strategy-lab/src/os05/fixtures.ts';
import {
  buildSerisAiStrategyProposal,
  buildSimulationMarketContext,
  evaluateSerisNative12Qualification,
  HELIOS_NATIVE_SERIS_STRATEGY_AUTOPILOT_QUALIFIED,
  HELIOS_NATIVE12_SERIS_UPSTREAM,
  reviewStrategySource,
  SerisNativeStrategyPipeline,
} from '../packages/strategy-lab/src/native12-seris/index.ts';
import { EXPLICIT_COSTS, equalWeightSpec, syntheticTwoEtfDataset } from '../packages/strategy-lab/src/fixtures.ts';
import { StrategyLab } from '../packages/strategy-lab/src/service.ts';
import {
  asResearchMonitorId,
  asResearchMonitorManifestId,
  asResearchMonitorTriggerEventId,
  buildProactiveInvestigationFromTrigger,
  evaluateResearchMonitorNative12Qualification,
  SerisResearchAutopilotLoop,
  type HeliosResearchMonitorTriggerRecord,
} from '../packages/platform/src/helios/research-monitor/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const NOW = asUtcInstant('2026-11-03T09:00:00.000Z');

function day(offset: number) {
  return asUtcInstant(`2026-01-${String(1 + offset).padStart(2, '0')}T00:00:00.000Z`);
}

function featureCatalog() {
  return Object.freeze({
    hasCatalogFeature: (ref: string) => ref.startsWith('feature.') || ref.startsWith('condition.'),
    hasDataFeature: (id: string) =>
      ['realized_volatility_20d', 'daily-close', 'membership', 'corporate-actions'].includes(id),
  });
}

function labHarness(subjectId = 'cust_native12') {
  const clock = new FrozenClock(NOW);
  const keys = createSimulationKeyProvider({ clock: { now: () => clock.now() } });
  const events = new DomainEventLog();
  const evidence = new EvidenceVault(clock);
  const identity = new SimulatedIdentityAdapter({ clock, keys, events });
  assert.equal(
    identity.provisionSimulatedActor({
      actorId: 'operator_native12',
      jurisdiction: asJurisdiction('US'),
      identityId: 'id_native12',
      customerId: asCustomerId(subjectId),
      capabilities: ['VIEW_ACCOUNT', 'INVESTMENT_OPERATE_REQUEST'],
    }).ok,
    true,
  );
  const actor = identity.service.resolveActorContext('operator_native12');
  if (!actor.ok) throw new Error('actor');
  const registry = new ModelRegistry();
  assert.equal(seedCanonicalRiskModel(registry, actor.value, NOW).ok, true);
  const risk = new RiskEngine({ clock, registry, events, evidence });
  const strategyLab = new StrategyLab({ clock, risk, registry, events, evidence });
  const budget = defaultSimulationBudget({ subjectId, portfolioId: 'inv_native12', reviewBy: NOW });
  risk.putBudget(budget);
  return { strategyLab, budget, subjectId, actor: actor.value };
}

describe('HELIOS NATIVE12 — Seris strategy + research autopilot', () => {
  it('architecture guard: native12 surfaces stay inside HELIOS boundaries', () => {
    const findings = lintHeliosBoundary(process.cwd()).filter(
      (row) =>
        row.file.includes('native12-seris') ||
        row.file.includes('research-monitor/seris') ||
        row.file.includes('research-autopilot'),
    );
    assert.equal(findings.length, 0, JSON.stringify(findings));
  });

  it('runs AI proposal through genome → features → backtest → walk-forward pipeline', () => {
    const ctx = labHarness();
    const genome = buildOs05ExampleStrategyGenome();
    const source = reviewStrategySource({
      strategyName: 'mean-reversion-v1',
      researchAgentRef: 'agent/research/native12',
    });
    assert.equal(source.ok, true);
    if (!source.ok) return;

    const proposal = buildSerisAiStrategyProposal({
      genome,
      specificationDraft: equalWeightSpec(EXPLICIT_COSTS),
      evaluationPlan: Object.freeze({
        train: Object.freeze({ start: day(0), end: day(9), partition: 'TRAIN' as const }),
        validation: Object.freeze({ start: day(10), end: day(17), partition: 'VALIDATION' as const }),
        holdout: Object.freeze({ start: day(18), end: day(27), partition: 'OUT_OF_SAMPLE_TEST' as const }),
        walkForward: Object.freeze({ trainDays: 7, testDays: 3 }),
      }),
      marketContext: buildSimulationMarketContext({
        symbol: 'SIM_ETF_PAIR',
        kind: 'etf',
        from: day(0),
        to: day(27),
      }),
      sourceReview: source.value,
      researchAgentRef: 'agent/research/native12',
      proposedAt: NOW,
    });

    const pipeline = new SerisNativeStrategyPipeline(ctx.strategyLab);
    const outcome = pipeline.processProposal({
      proposal,
      dataset: syntheticTwoEtfDataset(),
      riskBudget: ctx.budget,
      subjectId: ctx.subjectId,
      startingCapitalMinor: 100_000n,
      sealedAt: NOW,
      featureCatalog: featureCatalog(),
      governanceActor: ctx.actor,
      investmentAccountId: 'acct_paper_native12',
      maxDrawdownBps: 10_000,
    });
    assert.equal(outcome.ok, true, !outcome.ok ? outcome.error.message : '');
    if (!outcome.ok) return;
    assert.equal(outcome.value.deployed, false);
    assert.equal(outcome.value.liveExecutionPermitted, false);
    assert.ok(outcome.value.stagesCompleted.includes('GENOME_VALIDATION'));
    assert.ok(outcome.value.stagesCompleted.includes('HISTORICAL_TEST'));
    assert.ok(outcome.value.stagesCompleted.includes('WALK_FORWARD'));
    assert.ok(outcome.value.backtestSummaries.length >= 2);
    assert.equal(pipeline.runStore.listRunsForProposal(proposal.proposalId).length, 1);
  });

  it('proactive monitor bridge + research autopilot loop request research only', async () => {
    const trigger: HeliosResearchMonitorTriggerRecord = Object.freeze({
      triggerEventId: asResearchMonitorTriggerEventId('hrmt_native12_demo'),
      monitorId: asResearchMonitorId('hrm_native12_demo'),
      manifestId: asResearchMonitorManifestId('hrm_mf_native12'),
      action: 'REQUEST_RESEARCH',
      researchTopic: 'Semiconductor vol dislocation follow-up',
      triggeredAt: NOW,
      fingerprint: 'fp_native12',
      budgetReservedMinor: '100',
      priority: 'HIGH',
      allowedAgentClasses: Object.freeze(['MACRO_RESEARCH']),
      requiredEvidence: Object.freeze(['PUBLIC_MARKET_DATA']),
      watch: Object.freeze(['feat_nvda_vol', 'feat_sox_breadth']),
      evidenceRefs: Object.freeze([]),
    });
    const investigation = buildProactiveInvestigationFromTrigger(trigger);
    assert.equal(investigation.grantsExecutionAuthority, false);
    assert.equal(investigation.researchOnly, true);

    const loop = new SerisResearchAutopilotLoop();
    loop.register({
      scheduleId: 'sched_native12',
      investigation,
      intervalMs: 5_000,
    });
    const tick = await loop.tick({
      scheduleId: 'sched_native12',
      now: NOW,
      market: {
        observe: async () => Object.freeze({ primaryMetric: 2.5, watch: investigation.marketWatch }),
      },
      metricThreshold: 2,
    });
    assert.ok(tick);
    assert.equal(tick!.fundMovementRequested, false);
    assert.equal(tick!.shouldRequestResearch, true);
  });

  it('agentic capital mesh research autopilot enqueues mesh research without execution authority', () => {
    assert.ok(RESEARCH_AUTOPILOT_TASK_KINDS.includes('GENOME_CANDIDATE_RESEARCH'));
    const coordinator = new ResearchAutopilotCoordinator();
    const task = coordinator.enqueueTask({
      workOrderId: 'ewo_native12',
      subjectId: 'cust_native12',
      kind: 'GENOME_CANDIDATE_RESEARCH',
      objective: 'Review AI genome candidate under simulation market context',
      genomeCandidateRef: 'sgnm_helios_os05_mean_reversion_example',
      now: NOW,
    });
    assert.equal(task.grantsExecutionAuthority, false);
    const result = coordinator.runAutonomousResearchLoop({
      task,
      now: NOW,
      mesh: {
        runResearch: () => ({ ok: true, value: { runId: 'cmrm_native12_demo' } }),
      },
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.financialExecutionRequested, false);
    assert.equal(result.value.meshRunId, 'cmrm_native12_demo');
  });

  it('emits HELIOS_NATIVE_SERIS_STRATEGY_AUTOPILOT_QUALIFIED when assimilation checks pass', () => {
    const lab = evaluateSerisNative12Qualification({
      aiProposalBecomesGenomeCandidate: true,
      sourceReviewEnforced: true,
      genomeValidationRequired: true,
      featureValidityRequired: true,
      historicalHoldoutWalkForwardOrchestrated: true,
      durableRunHistory: true,
      marketContextInjection: true,
      researchAutopilotNotFinancialAutopilot: true,
      shadowPaperSimulationOnly: true,
      liveExecutionForbidden: true,
      upstreamAttributionPresent: HELIOS_NATIVE12_SERIS_UPSTREAM.referenceSha.length === 40,
    });
    assert.equal(lab.marker, HELIOS_NATIVE_SERIS_STRATEGY_AUTOPILOT_QUALIFIED);

    const monitor = evaluateResearchMonitorNative12Qualification({
      proactiveInvestigationBridge: true,
      researchAutopilotLoop: true,
      monitorTriggersResearchOnly: true,
      autopilotNeverRequestsFundMovement: true,
      simulationMarketObservationOnly: true,
    });
    assert.equal(monitor.marker, HELIOS_NATIVE_SERIS_STRATEGY_AUTOPILOT_QUALIFIED);
  });
});
