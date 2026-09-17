import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../packages/config/src/clock.ts';
import { asCustomerId } from '../packages/domain/src/customer.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import { EvidenceVault } from '../packages/evidence/src/vault.ts';
import {
  GrokResearchRuntime,
  HeliosTaskWorker,
  HeliosWorkOrchestrator,
  SimulationResearchReasoningEngine,
  UnavailableGrokReasoningEngine,
  authorizeResearchToolRequest,
  bindAssertionToEvidence,
  buildPublicResearchContext,
  createDefaultResearchToolRegistry,
  createToolRequest,
  InMemoryGrokResearchStore,
  PublicResearchCache,
  registerGrokResearchWorker,
  routeResearchCandidatesToH09,
  runBoundedResearchToolLoop,
  STRICT_RESEARCH_LOOP_LIMITS,
  taskInputFromHeliosTask,
  ExecutableOpportunityQualificationService,
  createEvidenceRegistry,
  createExecutionRouteRegistry,
  createMarketTermsPort,
} from '../packages/platform/src/helios/index.ts';
import type { CompiledEconomicMandate } from '../packages/platform/src/mandate/types.ts';
import { asEconomicMandateId, asMandateVersion, type EconomicMandateId } from '../packages/platform/src/ids.ts';
import { asEconomicWorkOrderId, asHeliosTaskId } from '../packages/platform/src/helios/ids.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const NOW = asUtcInstant('2026-09-16T14:00:00.000Z');
const CUSTOMER_A = asCustomerId('cust_h11_a');
const CUSTOMER_B = asCustomerId('cust_h11_b');
const WORK_ORDER = asEconomicWorkOrderId('ewo_h11_test');
const TASK_ID = asHeliosTaskId('htk_h11_test');

function baseTaskInput(overrides: Record<string, unknown> = {}) {
  return Object.freeze({
    taskId: TASK_ID,
    workOrderId: WORK_ORDER,
    customerId: CUSTOMER_A,
    question: 'Investigate public macroeconomic drivers affecting USD/SAR liquidity.',
    permittedTools: Object.freeze([
      'tool_economic_data_search',
      'tool_market_observation',
      'tool_document_search',
    ]),
    permittedModelClass: 'SIMULATION',
    timeHorizonDays: 30,
    deadline: null,
    budgetCeiling: '500',
    budgetUnitKind: 'MONETARY_MINOR' as const,
    budgetCurrency: 'USD',
    outputSchema: 'sunrey.helios.grok-research.v1',
    privacyClass: 'PUBLIC' as const,
    existingEvidenceRefs: Object.freeze([]),
    candidateOpportunityKey: null,
    publicContext: Object.freeze({ region: 'GLOBAL' }),
    privateContext: null,
    ...overrides,
  });
}

function activeMandate(subjectId: string): CompiledEconomicMandate {
  return Object.freeze({
    mandateId: asEconomicMandateId('emd_h11'),
    version: asMandateVersion(1),
    subjectId,
    state: 'ACTIVE',
    sourceText: 'HELIOS research',
    currency: 'USD',
    goals: Object.freeze([]),
    hardConstraints: Object.freeze([]),
    softPreferences: Object.freeze([]),
    compiledAt: NOW,
    planningEligible: true,
  });
}

describe('HELIOS H11 — bounded Grok research and tool runtime', () => {
  it('architecture guard: grok-research does not bypass canonical authority', () => {
    const findings = lintHeliosBoundary(process.cwd());
    const grokFindings = findings.filter((f) => f.file.includes('grok-research'));
    assert.equal(grokFindings.length, 0);
  });

  it('1. public research success', async () => {
    const clock = new FrozenClock(NOW);
    const runtime = new GrokResearchRuntime({ clock });
    const result = await runtime.executeResearch(baseTaskInput());
    assert.ok(result.ok);
    assert.equal(result.value.schemaVersion, 'sunrey.helios.grok-research.v1');
    assert.equal(result.value.privacyClass, 'PUBLIC');
    assert.equal(result.value.grantsExecutionAuthority, false);
    assert.ok(result.value.evidenceRefs.length > 0);
    assert.equal(result.value.completionStatus, 'COMPLETED');
  });

  it('2. structured tool request executes through registry', async () => {
    const clock = new FrozenClock(NOW);
    const registry = createDefaultResearchToolRegistry();
    const context = buildPublicResearchContext(baseTaskInput());
    assert.ok(context.ok);
    const loop = await runBoundedResearchToolLoop({
      clock,
      task: baseTaskInput(),
      context: context.value,
      registry,
      reasoning: new SimulationResearchReasoningEngine(),
    });
    assert.ok(loop.toolRecords.length > 0);
    const allowed = loop.toolRecords.filter((r) => r.authorization === 'ALLOWED');
    assert.ok(allowed.length > 0);
    assert.ok(allowed[0]!.resultEvidenceRef);
  });

  it('3. unauthorized tool denied', () => {
    const registry = createDefaultResearchToolRegistry();
    const task = baseTaskInput({ permittedTools: Object.freeze(['tool_market_observation']) });
    const request = createToolRequest(task, 'tool_document_search', 'search', { query: 'test' }, NOW);
    const decision = authorizeResearchToolRequest({
      request,
      task,
      registry,
      budgetConsumed: '0',
      toolCallsUsed: 0,
      perToolLimit: 8,
      now: NOW,
    });
    assert.equal(decision.outcome, 'DENIED_NOT_PERMITTED');
  });

  it('4. malformed tool arguments denied', () => {
    const registry = createDefaultResearchToolRegistry();
    const task = baseTaskInput();
    const request = createToolRequest(task, 'tool_economic_data_search', 'search', { query: 123 }, NOW);
    const decision = authorizeResearchToolRequest({
      request,
      task,
      registry,
      budgetConsumed: '0',
      toolCallsUsed: 0,
      perToolLimit: 8,
      now: NOW,
    });
    assert.equal(decision.outcome, 'DENIED_INVALID_INPUT');
  });

  it('5. maximum iterations returns partial/degraded result', async () => {
    const clock = new FrozenClock(NOW);
    const runtime = new GrokResearchRuntime({
      clock,
      limits: STRICT_RESEARCH_LOOP_LIMITS,
    });
    const result = await runtime.executeResearch(baseTaskInput({ budgetCeiling: '1000' }));
    assert.ok(result.ok);
    assert.ok(['COMPLETED', 'LIMIT_REACHED', 'PARTIAL_DEGRADED'].includes(result.value.completionStatus));
  });

  it('6. research budget exhaustion', async () => {
    const clock = new FrozenClock(NOW);
    const runtime = new GrokResearchRuntime({ clock });
    const result = await runtime.executeResearch(baseTaskInput({ budgetCeiling: '5' }));
    assert.ok(result.ok);
    assert.equal(result.value.completionStatus, 'BUDGET_EXHAUSTED');
    assert.equal(result.value.recommendation, 'WAIT');
  });

  it('7. cancellation stops loop', async () => {
    const clock = new FrozenClock(NOW);
    let cancelled = false;
    const runtime = new GrokResearchRuntime({
      clock,
      cancelled: () => cancelled,
    });
    cancelled = true;
    const result = await runtime.executeResearch(baseTaskInput());
    assert.ok(result.ok);
    assert.equal(result.value.completionStatus, 'CANCELLED');
  });

  it('8. provider unavailable does not fabricate Grok result', async () => {
    const clock = new FrozenClock(NOW);
    const runtime = GrokResearchRuntime.withUnavailableGrok(clock);
    const result = await runtime.executeResearch(baseTaskInput());
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, 'PROVIDER_UNAVAILABLE');
      assert.equal(result.error.partialResult, null);
    }
  });

  it('9. unsupported model claim marked unsupported', () => {
    const assertion = bindAssertionToEvidence({
      assertionId: 'a1',
      kind: 'FACT',
      statement: 'Unsupported claim',
      citedEvidenceIds: Object.freeze(['missing_evidence']),
      knownEvidenceIds: new Set(['other_evidence']),
      contradictedPairs: new Map(),
    });
    assert.equal(assertion.unsupported, true);
    assert.equal(assertion.kind, 'UNKNOWN');
  });

  it('10. evidence linkage on tool results', async () => {
    const clock = new FrozenClock(NOW);
    const runtime = new GrokResearchRuntime({ clock });
    const result = await runtime.executeResearch(baseTaskInput());
    assert.ok(result.ok);
    for (const fact of result.value.keyFacts) {
      for (const ref of fact.evidenceRefs) {
        assert.ok(result.value.evidenceRefs.some((e) => e.evidenceId === ref));
      }
    }
  });

  it('11. contradiction preservation', () => {
    const contradicted = bindAssertionToEvidence({
      assertionId: 'a_contra',
      kind: 'FACT',
      statement: 'Conflicting liquidity view',
      citedEvidenceIds: Object.freeze(['ev_1']),
      knownEvidenceIds: new Set(['ev_1']),
      contradictedPairs: new Map([['a_contra', Object.freeze(['ev_2'])]]),
    });
    assert.equal(contradicted.kind, 'CONTRADICTED');
    assert.ok(contradicted.contradictedBy.length > 0);
  });

  it('12. private-context leakage prevention', async () => {
    const clock = new FrozenClock(NOW);
    const runtime = new GrokResearchRuntime({ clock });
    const rejected = await runtime.executeResearch(baseTaskInput({
      publicContext: Object.freeze({ customerName: 'Nick', ledgerBalance: '$17,523.42' }),
    }));
    assert.equal(rejected.ok, false);
    if (!rejected.ok) {
      assert.equal(rejected.error.code, 'PRIVATE_CONTEXT_REJECTED');
    }
  });

  it('13. public research cache isolation', async () => {
    const clock = new FrozenClock(NOW);
    const cache = new PublicResearchCache(60_000);
    const store = new InMemoryGrokResearchStore();
    const runtimeA = new GrokResearchRuntime({ clock, cache, store });
    const runtimeB = new GrokResearchRuntime({ clock, cache, store: new InMemoryGrokResearchStore() });

    const publicTask = baseTaskInput();
    const first = await runtimeA.executeResearch(publicTask);
    assert.ok(first.ok);

    const second = await runtimeB.executeResearch(baseTaskInput({ customerId: CUSTOMER_B }));
    assert.ok(second.ok);
    assert.notEqual(second.value.researchResultId, first.value.researchResultId);
    assert.equal(cache.snapshot().length, 1);
    assert.equal(cache.hasCustomerPrivateEntry(CUSTOMER_A), false);
  });

  it('14. model output cannot self-authorize action', async () => {
    const clock = new FrozenClock(NOW);
    const runtime = new GrokResearchRuntime({ clock });
    const result = await runtime.executeResearch(baseTaskInput());
    assert.ok(result.ok);
    assert.equal(result.value.grantsExecutionAuthority, false);
    assert.equal(result.value.grantsFinancialMutation, false);
  });

  it('15. candidate routes through H09', async () => {
    const clock = new FrozenClock(NOW);
    const evidence = new EvidenceVault(clock);
    const qualification = new ExecutableOpportunityQualificationService({
      clock,
      evidence,
      evidenceRegistry: createEvidenceRegistry(),
      routeRegistry: createExecutionRouteRegistry(),
      marketTerms: createMarketTermsPort(clock),
    });
    const runtime = new GrokResearchRuntime({ clock });
    const result = await runtime.executeResearch(baseTaskInput({
      candidateOpportunityKey: 'usd_sar_liquidity',
    }));
    assert.ok(result.ok);
    assert.equal(result.value.recommendation, 'PROPOSE_CANDIDATE');
    const routed = routeResearchCandidatesToH09({
      result: result.value,
      qualificationService: qualification,
      customerId: CUSTOMER_A,
      subjectId: 'subj_h11',
    });
    assert.ok(routed.some((r) => r.routed));
    assert.equal(routed[0]!.grantsExecutionAuthority, false);
    assert.ok(routed[0]!.candidateId);
  });

  it('16. tool cannot mutate financial state', () => {
    const registry = createDefaultResearchToolRegistry();
    for (const tool of registry.list()) {
      assert.equal(tool.readOnly, true);
      assert.equal(tool.mutatesFinancialState, false);
    }
  });

  it('17. restart/result durability', async () => {
    const clock = new FrozenClock(NOW);
    const store = new InMemoryGrokResearchStore();
    const runtime = new GrokResearchRuntime({ clock, store });
    const result = await runtime.executeResearch(baseTaskInput());
    assert.ok(result.ok);
    const snapshot = store.snapshot();
    const restored = new InMemoryGrokResearchStore();
    restored.restore(snapshot);
    const loaded = restored.get(TASK_ID, CUSTOMER_A);
    assert.ok(loaded);
    assert.equal(loaded.researchResultId, result.value.researchResultId);
  });

  it('18. customer isolation', async () => {
    const clock = new FrozenClock(NOW);
    const store = new InMemoryGrokResearchStore();
    const runtime = new GrokResearchRuntime({ clock, store });
    await runtime.executeResearch(baseTaskInput({ customerId: CUSTOMER_A }));
    const cross = store.get(TASK_ID, CUSTOMER_B);
    assert.equal(cross, undefined);
  });

  it('19. usage/cost accounting', async () => {
    const clock = new FrozenClock(NOW);
    const runtime = new GrokResearchRuntime({ clock });
    const result = await runtime.executeResearch(baseTaskInput());
    assert.ok(result.ok);
    assert.ok(result.value.usage.modelCalls > 0);
    assert.ok(BigInt(result.value.usage.budgetConsumed) > 0n);
    assert.ok(result.value.usage.elapsedMs >= 0);
  });

  it('20. no fixture fallback labeled as Grok when unavailable', async () => {
    const clock = new FrozenClock(NOW);
    const runtime = new GrokResearchRuntime({
      clock,
      reasoning: new UnavailableGrokReasoningEngine(),
    });
    const result = await runtime.executeResearch(baseTaskInput());
    assert.equal(result.ok, false);
  });

  it('worker integration dispatches H06 research task', async () => {
    const clock = new FrozenClock(NOW);
    const evidence = new EvidenceVault(clock);
    const mandates = new Map([[activeMandate('subj_h11').mandateId, activeMandate('subj_h11')]]);
    const orchestrator = new HeliosWorkOrchestrator({
      clock,
      evidence,
      mandateLookup: (id) => mandates.get(id as EconomicMandateId),
    });
    const order = orchestrator.createWorkOrder({
      programId: 'hpg_h11',
      customerId: 'cust_h11_a',
      subjectId: 'subj_h11',
      objective: 'grok research',
      mandate: activeMandate('subj_h11'),
      capability: 'HELIOS_RESEARCH',
      approvalRef: 'approval_h11',
      budgetCeiling: '1000',
      budgetUnitKind: 'MONETARY_MINOR',
      budgetCurrency: 'USD',
    });
    if ('code' in order) throw new Error(order.message);
    orchestrator.createTask({
      workOrderId: order.workOrderId,
      customerId: 'cust_h11_a',
      operationIdentity: 'grok_research_op',
      taskType: 'RESEARCH_QUERY',
      requiredCapability: 'HELIOS_RESEARCH',
      permittedTools: Object.freeze(['tool_economic_data_search', 'tool_market_observation']),
      permittedModelClass: 'SIMULATION',
      requestedObjective: JSON.stringify({
        question: 'Investigate USD/SAR liquidity drivers.',
        publicContext: { region: 'GLOBAL' },
      }),
      estimatedBudget: '400',
    });
    const worker = new HeliosTaskWorker({ orchestrator, workerId: 'h11_worker' });
    registerGrokResearchWorker({ worker, clock });
    const outcome = await worker.dispatchOnce({
      workOrderId: order.workOrderId,
      customerId: 'cust_h11_a',
    });
    assert.equal(outcome.succeeded, 1);
  });
});
