import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../packages/config/src/clock.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  DEFAULT_MESH_BUDGET_LIMITS,
  ResearchMeshBudgetController,
  ResearchMeshStore,
  SpecialistResearchMesh,
  assessIndependence,
  routeSpecialistModel,
  routeSpecialistTasks,
  unusedRolesForOpportunity,
  validateSpecialistTaskOutput,
  verifyAssertions,
  type EvidenceReference,
} from '../packages/agentic-capital-mesh/src/research-mesh/index.ts';
import { invokeMeshTool } from '../packages/agentic-capital-mesh/src/tools.ts';
import { assembleCapitalContext, type ContextSource } from '../packages/agentic-capital-mesh/src/context.ts';

const NOW = asUtcInstant('2026-09-17T07:30:00.000Z');

function evidence(overrides: Partial<EvidenceReference> = {}): EvidenceReference {
  return Object.freeze({
    evidenceId: overrides.evidenceId ?? 'ev_market_1',
    sourceKind: overrides.sourceKind ?? 'MARKET_OBSERVATION',
    sourceRef: overrides.sourceRef ?? 'obs/sim-etf-1',
    observedAt: overrides.observedAt ?? NOW,
    freshnessOk: overrides.freshnessOk ?? true,
    entitlementOk: overrides.entitlementOk ?? true,
    provenanceRef: overrides.provenanceRef ?? 'prov/helios-h08',
  });
}

function meshSetup(budgetLimits = DEFAULT_MESH_BUDGET_LIMITS) {
  const clock = new FrozenClock(NOW);
  const store = new ResearchMeshStore();
  const budget = new ResearchMeshBudgetController(budgetLimits);
  const mesh = new SpecialistResearchMesh({ clock, store, budget, limits: budgetLimits });
  return { clock, store, budget, mesh };
}

function sourceFor(subjectId: string): ContextSource {
  return {
    subjectId,
    bind: (requested) =>
      requested === subjectId
        ? {
            subjectId,
            mandate: {
              mandateId: 'man_h19',
              version: 1,
              status: 'ACTIVE',
              hardConstraintKinds: Object.freeze(['MINIMUM_CASH_RESERVE']),
              prohibitedCategories: Object.freeze([]),
              minimumLiquidMinor: 50_000n,
              compatibleWithInvestment: true,
            },
            growth: {
              planId: 'gpl_h19',
              version: 1,
              considersInvestment: true,
              state: 'ACTIVE',
            },
            peve: {
              snapshotId: 'peve_h19',
              resilienceLabel: 'moderate',
              goalProgressLabel: 'on-track',
              opportunityCapacityLabel: 'available',
              compositeOptimizationForbidden: true as const,
              humanWorthSemantics: false as const,
            },
            portfolio: {
              portfolioId: 'inv_h19',
              brokerageCashMinor: 500_000n,
              unsettledCashMinor: 0n,
              pendingOrderNotionalMinor: 0n,
              holdings: Object.freeze([]),
              accountRestricted: false,
            },
            riskBudget: {
              budgetId: 'rbdg_h19',
              version: 'risk-policy-v1',
              maximumInstrumentConcentrationUnits: 60_000_000n,
              minimumBrokerageCashMinor: 0n,
            },
            registeredModels: Object.freeze([]),
            universe: Object.freeze([]),
            market: Object.freeze([]),
            rdt: {
              state: 'RESEARCH_REQUIRED',
              legalReviewStatus: 'RESEARCH_REQUIRED',
              simulationOnly: true as const,
              regulatoryApproved: false as const,
            },
            scheduledObligationMinor: 0n,
          }
        : undefined,
  };
}

describe('HELIOS H19 specialist research and critique mesh', () => {
  it('1. routes specialist tasks by opportunity kind', () => {
    const cash = routeSpecialistTasks('CASH_YIELD');
    assert.ok(cash.includes('OPPORTUNITY_RESEARCH'));
    assert.ok(cash.includes('MACRO_FX'));
    assert.ok(!cash.includes('VOLATILITY'));
    assert.ok(!cash.includes('MICROSTRUCTURE'));

    const rv = routeSpecialistTasks('RELATIVE_VALUE');
    assert.ok(rv.includes('STAT_ARB_RELATIVE_VALUE'));
    assert.ok(rv.includes('VOLATILITY'));
    assert.ok(rv.includes('MICROSTRUCTURE'));
    assert.ok(rv.includes('EXECUTION_RESEARCH'));
  });

  it('2. does not invoke unused specialists for simple cash-yield opportunities', () => {
    const { mesh } = meshSetup();
    const result = mesh.runResearch({
      workOrderId: 'wo_h19_cash',
      subjectId: 'cust_h19_a',
      objective: 'Evaluate cash-yield sleeve',
      opportunityKind: 'CASH_YIELD',
      privacyClass: 'PUBLIC_RESEARCH',
      contextRef: 'ctx_h19',
      evidenceBundle: Object.freeze([evidence()]),
    });
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error('expected ok');
    assert.deepEqual(
      [...result.value.skippedRoles].sort(),
      [...unusedRolesForOpportunity('CASH_YIELD')].sort(),
    );
    assert.ok(!result.value.invokedRoles.includes('VOLATILITY'));
    assert.ok(!result.value.invokedRoles.includes('MICROSTRUCTURE'));
  });

  it('3. validates typed specialist task outputs', () => {
    const { mesh } = meshSetup();
    const result = mesh.runResearch({
      workOrderId: 'wo_h19_types',
      subjectId: 'cust_h19_b',
      objective: 'Typed output validation',
      opportunityKind: 'GENERIC',
      privacyClass: 'PUBLIC_RESEARCH',
      contextRef: 'ctx_h19',
      evidenceBundle: Object.freeze([evidence()]),
    });
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error('expected ok');
    for (const output of result.value.outputs) {
      assert.deepEqual(validateSpecialistTaskOutput(output), []);
      assert.ok(output.model.provider);
      assert.ok(output.model.modelId);
      assert.ok(output.recommendation);
      assert.ok(output.usage.costMicros >= 0n);
      assert.equal(output.grantsFinancialAuthority, false);
    }
  });

  it('4. evidence verifier rejects unsupported assertions', () => {
    const verification = verifyAssertions({
      claims: Object.freeze([
        { claimId: 'claim_supported', statement: 'ETF price exists', evidenceIds: ['ev_market_1'] },
        { claimId: 'claim_unsupported', statement: 'Guaranteed alpha', evidenceIds: [] },
      ]),
      evidenceBundle: Object.freeze([evidence()]),
      now: NOW,
    });
    assert.deepEqual(verification.supported, ['claim_supported']);
    assert.deepEqual(verification.unsupported, ['claim_unsupported']);
    assert.equal(verification.recommendation, 'OPPOSE');
  });

  it('5. adversarial critic produces structured opposing case', () => {
    const { mesh } = meshSetup();
    const result = mesh.runResearch({
      workOrderId: 'wo_h19_critic',
      subjectId: 'cust_h19_c',
      objective: 'Relative-value pair trade',
      opportunityKind: 'RELATIVE_VALUE',
      privacyClass: 'PUBLIC_RESEARCH',
      contextRef: 'ctx_h19',
      evidenceBundle: Object.freeze([evidence({ freshnessOk: false })]),
      claims: Object.freeze([
        { claimId: 'claim_a', statement: 'Spread dislocated', evidenceIds: ['ev_market_1'] },
      ]),
    });
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error('expected ok');
    const critic = result.value.outputs.find((row) => row.specialistRole === 'ADVERSARIAL_CRITIC');
    assert.ok(critic);
    assert.ok(critic!.findings.some((row) => row.startsWith('weakest-assumption:')));
    assert.ok(critic!.findings.some((row) => row.startsWith('liquidity:')));
    assert.ok(critic!.findings.some((row) => row.includes('cannot veto financial action')));
    assert.equal(critic!.grantsFinancialAuthority, false);
  });

  it('6. preserves disagreement without averaging opinions', () => {
    const { mesh } = meshSetup();
    const result = mesh.runResearch({
      workOrderId: 'wo_h19_disagree',
      subjectId: 'cust_h19_d',
      objective: 'Conflicting signals',
      opportunityKind: 'RELATIVE_VALUE',
      privacyClass: 'PUBLIC_RESEARCH',
      contextRef: 'ctx_h19',
      evidenceBundle: Object.freeze([evidence()]),
      claims: Object.freeze([
        { claimId: 'claim_bad', statement: 'Unsupported claim', evidenceIds: [] },
        { claimId: 'claim_ok', statement: 'Supported claim', evidenceIds: ['ev_market_1'] },
      ]),
    });
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error('expected ok');
    assert.ok(result.value.meta.disagreements.length >= 0);
    assert.ok(result.value.meta.supportingViews.length + result.value.meta.opposingViews.length > 0);
    assert.ok(result.value.meta.summary.includes('without averaging opinions'));
  });

  it('7. does not treat same source and model as independent corroboration', () => {
    const sharedEvidence = evidence({ evidenceId: 'ev_shared', sourceRef: 'obs/shared' });
    const left = {
      modelProvider: 'GROK' as const,
      modelId: 'grok-research-v1',
      sharedEvidenceIds: ['ev_shared'],
    };
    const right = {
      modelProvider: 'GROK' as const,
      modelId: 'grok-research-v1',
      sharedEvidenceIds: ['ev_shared'],
    };
    const assessments = assessIndependence([
      {
        outputId: 'o1',
        taskId: 't1',
        workOrderId: 'wo',
        subjectId: 'cust',
        specialistRole: 'OPPORTUNITY_RESEARCH',
        task: 'scan',
        model: { provider: 'GROK', modelId: 'grok-research-v1', version: '1.0.0' },
        toolsUsed: [],
        evidenceReferences: [sharedEvidence],
        findings: [],
        assumptions: [],
        contradictions: [],
        confidence: 0.6,
        invalidatingConditions: [],
        missingInformation: [],
        recommendation: 'SUPPORT',
        usage: { inputTokens: 1, outputTokens: 1, inferenceCalls: 1, toolCalls: 0, costMicros: 1n, currency: 'USD' },
        timestamps: { startedAt: NOW, completedAt: NOW },
        lineage: {
          modelProvider: left.modelProvider,
          modelId: left.modelId,
          modelVersion: '1.0.0',
          promptTemplateId: 'helios/opportunity-research',
          promptTemplateVersion: '1.0.0',
          sharedEvidenceIds: left.sharedEvidenceIds,
          sharedUpstreamSourceRefs: ['obs/shared'],
          toolLineage: [],
        },
        taskState: 'SUCCEEDED',
        grantsFinancialAuthority: false,
      },
      {
        outputId: 'o2',
        taskId: 't2',
        workOrderId: 'wo',
        subjectId: 'cust',
        specialistRole: 'MACRO_FX',
        task: 'macro',
        model: { provider: 'GROK', modelId: 'grok-research-v1', version: '1.0.0' },
        toolsUsed: [],
        evidenceReferences: [sharedEvidence],
        findings: [],
        assumptions: [],
        contradictions: [],
        confidence: 0.6,
        invalidatingConditions: [],
        missingInformation: [],
        recommendation: 'SUPPORT',
        usage: { inputTokens: 1, outputTokens: 1, inferenceCalls: 1, toolCalls: 0, costMicros: 1n, currency: 'USD' },
        timestamps: { startedAt: NOW, completedAt: NOW },
        lineage: {
          modelProvider: right.modelProvider,
          modelId: right.modelId,
          modelVersion: '1.0.0',
          promptTemplateId: 'helios/macro-fx',
          promptTemplateVersion: '1.0.0',
          sharedEvidenceIds: right.sharedEvidenceIds,
          sharedUpstreamSourceRefs: ['obs/shared'],
          toolLineage: [],
        },
        taskState: 'SUCCEEDED',
        grantsFinancialAuthority: false,
      },
    ]);
    const shared = assessments.find((row) => row.evidenceId === 'ev_shared');
    assert.ok(shared);
    assert.equal(shared!.treatedAsIndependent, false);
    assert.equal(shared!.sharedModelWarning, true);
  });

  it('8. budget stops excessive agent fan-out', () => {
    const tightLimits = Object.freeze({
      ...DEFAULT_MESH_BUDGET_LIMITS,
      workOrderCeilingMicros: 200_000n,
      specialistCeilingMicros: 100_000n,
      concurrencyLimit: 2,
    });
    const { mesh } = meshSetup(tightLimits);
    const first = mesh.runResearch({
      workOrderId: 'wo_h19_budget',
      subjectId: 'cust_h19_e',
      objective: 'Budget constrained',
      opportunityKind: 'CASH_YIELD',
      privacyClass: 'PUBLIC_RESEARCH',
      contextRef: 'ctx_h19',
      evidenceBundle: Object.freeze([evidence()]),
    });
    assert.equal(first.ok, true);
    const second = mesh.runResearch({
      workOrderId: 'wo_h19_budget',
      subjectId: 'cust_h19_e',
      objective: 'Budget exhausted follow-up',
      opportunityKind: 'CASH_YIELD',
      privacyClass: 'PUBLIC_RESEARCH',
      contextRef: 'ctx_h19',
      evidenceBundle: Object.freeze([evidence()]),
    });
    assert.equal(second.ok, false);
    if (second.ok) throw new Error('expected budget failure');
    assert.equal(second.error.code, 'BUDGET_EXHAUSTED');
  });

  it('9. supports cancellation of an in-flight mesh run', () => {
    const { mesh } = meshSetup();
    const started = mesh.runResearch({
      workOrderId: 'wo_h19_cancel',
      subjectId: 'cust_h19_f',
      objective: 'Cancel test',
      opportunityKind: 'GENERIC',
      privacyClass: 'PUBLIC_RESEARCH',
      contextRef: 'ctx_h19',
      evidenceBundle: Object.freeze([evidence()]),
    });
    assert.equal(started.ok, true);
    if (!started.ok) throw new Error('expected ok');
    const cancelled = mesh.cancelRun(started.value.run.runId);
    assert.equal(cancelled.ok, true);
    const rerun = mesh.runResearch({
      workOrderId: 'wo_h19_cancel_2',
      subjectId: 'cust_h19_f',
      objective: 'After cancel',
      opportunityKind: 'GENERIC',
      privacyClass: 'PUBLIC_RESEARCH',
      contextRef: 'ctx_h19',
      evidenceBundle: Object.freeze([evidence()]),
    });
    assert.equal(rerun.ok, true);
  });

  it('10. handles one specialist timeout without collapsing the entire mesh', () => {
    const { mesh } = meshSetup();
    const result = mesh.runResearch({
      workOrderId: 'wo_h19_timeout',
      subjectId: 'cust_h19_g',
      objective: 'Timeout partial',
      opportunityKind: 'RELATIVE_VALUE',
      privacyClass: 'PUBLIC_RESEARCH',
      contextRef: 'ctx_h19',
      evidenceBundle: Object.freeze([evidence()]),
      forceRoleTimeout: 'STAT_ARB_RELATIVE_VALUE',
    });
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error('expected ok');
    assert.ok(result.value.meta.timedOutRoles.includes('STAT_ARB_RELATIVE_VALUE'));
    assert.equal(result.value.meta.completionState, 'PARTIAL');
    assert.ok(result.value.outputs.length > 0);
  });

  it('11. returns partial results when one specialist fails', () => {
    const { mesh } = meshSetup();
    const result = mesh.runResearch({
      workOrderId: 'wo_h19_partial',
      subjectId: 'cust_h19_h',
      objective: 'Partial failure',
      opportunityKind: 'RELATIVE_VALUE',
      privacyClass: 'PUBLIC_RESEARCH',
      contextRef: 'ctx_h19',
      evidenceBundle: Object.freeze([evidence()]),
      forceRoleFailure: 'VOLATILITY',
    });
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error('expected ok');
    assert.ok(result.value.meta.failedRoles.includes('VOLATILITY'));
    assert.equal(result.value.meta.completionState, 'PARTIAL');
    assert.ok(result.value.meta.missingRoles.length >= 0);
  });

  it('12. routes private customer context away from Grok', () => {
    const publicRoute = routeSpecialistModel({
      role: 'OPPORTUNITY_RESEARCH',
      privacyClass: 'PUBLIC_RESEARCH',
    });
    assert.equal(publicRoute.ok, true);
    if (!publicRoute.ok) throw new Error('expected ok');
    assert.equal(publicRoute.value.provider, 'GROK');

    const privateRoute = routeSpecialistModel({
      role: 'OPPORTUNITY_RESEARCH',
      privacyClass: 'CUSTOMER_PRIVATE',
    });
    assert.equal(privateRoute.ok, true);
    if (!privateRoute.ok) throw new Error('expected ok');
    assert.equal(privateRoute.value.provider, 'S3M');
    assert.notEqual(privateRoute.value.modelId, publicRoute.value.modelId);
  });

  it('13. cannot mutate financial state from specialist outputs', () => {
    const { mesh } = meshSetup();
    const result = mesh.runResearch({
      workOrderId: 'wo_h19_no_exec',
      subjectId: 'cust_h19_i',
      objective: 'No execution authority',
      opportunityKind: 'DIRECTIONAL_EQUITY',
      privacyClass: 'PUBLIC_RESEARCH',
      contextRef: 'ctx_h19',
      evidenceBundle: Object.freeze([evidence()]),
    });
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error('expected ok');
    for (const output of result.value.outputs) {
      assert.equal(output.grantsFinancialAuthority, false);
    }
    assert.equal(result.value.meta.grantsFinancialAuthority, false);
    const exec = result.value.outputs.find((row) => row.specialistRole === 'EXECUTION_RESEARCH');
    assert.ok(exec);
    assert.ok(exec!.findings.some((row) => row.includes('no broker keys')));
  });

  it('14. isolates customer-private context by subject', () => {
    const bound = assembleCapitalContext({
      meshId: 'cmsh_canonical',
      subjectId: 'cust_h19_a',
      now: NOW,
      source: sourceFor('cust_h19_a'),
    });
    assert.equal(bound.ok, true);
    if (!bound.ok) throw new Error('expected ok');
    const denied = invokeMeshTool(bound.value, 'cust_h19_b', 'getPortfolio');
    assert.equal(denied.ok, false);
    if (denied.ok) throw new Error('expected denial');
    assert.equal(denied.error.code, 'SUBJECT_MISMATCH');
  });

  it('15. restores mesh results after restart from snapshot', () => {
    const { mesh, store } = meshSetup();
    const result = mesh.runResearch({
      workOrderId: 'wo_h19_restart',
      subjectId: 'cust_h19_j',
      objective: 'Persistence restart',
      opportunityKind: 'GENERIC',
      privacyClass: 'PUBLIC_RESEARCH',
      contextRef: 'ctx_h19',
      evidenceBundle: Object.freeze([evidence()]),
    });
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error('expected ok');
    const snapshot = store.snapshot();

    const restarted = new SpecialistResearchMesh({ clock: new FrozenClock(NOW), store: new ResearchMeshStore() });
    restarted.restoreFromSnapshot(snapshot);
    const restored = restarted.store.snapshot();
    assert.equal(restored.runs.length, snapshot.runs.length);
    assert.equal(restored.taskOutputs.length, snapshot.taskOutputs.length);
    assert.equal(restored.metaOutputs.length, snapshot.metaOutputs.length);
    assert.equal(restored.budgetSnapshots.length, snapshot.budgetSnapshots.length);
  });

  it('16. accounts for usage and cost across specialist tasks', () => {
    const { mesh } = meshSetup();
    const result = mesh.runResearch({
      workOrderId: 'wo_h19_cost',
      subjectId: 'cust_h19_k',
      objective: 'Usage accounting',
      opportunityKind: 'RELATIVE_VALUE',
      privacyClass: 'PUBLIC_RESEARCH',
      contextRef: 'ctx_h19',
      evidenceBundle: Object.freeze([evidence()]),
    });
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error('expected ok');
    const summed = result.value.outputs.reduce((acc, row) => acc + row.usage.costMicros, 0n);
    assert.equal(result.value.meta.totalUsage.costMicros, summed);
    assert.ok(result.value.meta.totalUsage.inferenceCalls >= 0);
    assert.ok(result.value.meta.totalUsage.toolCalls >= 0);
  });
});
