import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  DEFAULT_MESH_BUDGET_LIMITS,
  ResearchMeshBudgetController,
  ResearchMeshStore,
  SpecialistResearchMesh,
} from '../packages/agentic-capital-mesh/src/research-mesh/index.ts';
import { interpretMandateLanguage } from '../packages/agent/src/interpretation.ts';
import { FrozenClock } from '../packages/config/src/clock.ts';
import { asCustomerId } from '../packages/domain/src/customer.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import { EvidenceVault } from '../packages/evidence/src/vault.ts';
import {
  HELIOS_OS08_TRIGGERED_AGENTIC_RESEARCH_QUALIFIED,
  ResearchTriggerRouter,
  aggregateMeshCost,
  createEconomicWorkOrderDraft,
  initialBudgetSnapshot,
  mandateBindingRefFromCompiled,
  meshRolesPermittedForTrigger,
  routeTriggerSpecialistClasses,
  type ResearchMonitorTriggerEvent,
  type ResearchTriggerMeshPort,
  type WorkOrderScope,
} from '../packages/platform/src/helios/index.ts';
import { compileEconomicMandate, mandateDraftFromInterpretation } from '../packages/platform/src/mandate/compiler.ts';
import type { CompiledEconomicMandate } from '../packages/platform/src/mandate/types.ts';
import { workOrderIdFor } from '../packages/platform/src/helios/ids.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const NOW = asUtcInstant('2026-11-03T06:30:00.000Z');
const ROOT = process.cwd();

function activeMandate(subjectId: string): CompiledEconomicMandate {
  const interpretation = interpretMandateLanguage({
    subjectId,
    sourceText: 'Keep at least $8,000 liquid. Research only unless I approve trades.',
    now: NOW,
  });
  if (!interpretation.ok) throw new Error('interpretation');
  const draft = mandateDraftFromInterpretation(interpretation.value, NOW);
  const compiled = compileEconomicMandate({ draft, now: NOW });
  if (!compiled.ok) throw new Error('compile');
  return Object.freeze({ ...compiled.value, state: 'ACTIVE' });
}

function researchOnlyScope(): WorkOrderScope {
  return Object.freeze({
    objectiveClasses: Object.freeze(['RESEARCH', 'ANALYSIS'] as const),
    activityClasses: Object.freeze(['RESEARCH', 'DATA_ACCESS'] as const),
    productClasses: Object.freeze(['CASH', 'EQUITIES', 'ETF'] as const),
    capitalCeiling: { minorUnits: '100000', currency: 'USD' },
    accountIds: Object.freeze(['acct_checking']),
    jurisdiction: 'US' as import('../packages/domain/src/jurisdiction.ts').Jurisdiction,
    horizonDays: 14,
    toolIds: Object.freeze(['tool_research']),
    modelIds: Object.freeze(['mdl_s3m']),
  });
}

function activeResearchWorkOrder(customerId: string, subjectId: string) {
  const mandate = activeMandate(subjectId);
  const scope = researchOnlyScope();
  const workOrderId = workOrderIdFor(customerId, 'os08');
  const draft = createEconomicWorkOrderDraft({
    workOrderId,
    customerId: asCustomerId(customerId),
    subjectId,
    growObjectiveId: 'grow_os08',
    requestedScope: scope,
    mandateRef: mandateBindingRefFromCompiled(mandate, asCustomerId(customerId), NOW),
    approvalRef: null,
    requiredApprovalClass: 'NONE',
    now: NOW,
  });
  return Object.freeze({
    ...draft,
    state: 'ACTIVE' as const,
    effectiveScope: scope,
    activatedAt: NOW,
  });
}

function baseTrigger(overrides: Partial<ResearchMonitorTriggerEvent> = {}): ResearchMonitorTriggerEvent {
  return Object.freeze({
    triggerEventId: 'rt_trig_1',
    idempotencyKey: overrides.idempotencyKey ?? 'idem_os08_1',
    dedupeFingerprint: overrides.dedupeFingerprint ?? 'fp_os08_1',
    monitorId: 'mon_vol_spike',
    monitorVersion: '1.0.0',
    customerId: 'cust_os08',
    subjectId: 'subj_os08',
    triggerReason: 'THRESHOLD_CROSSED',
    triggerExplanation: 'Realized vol crossed upper band on watchlist symbol',
    observationRef: 'obs/os08/1',
    featureRef: 'feat/os08/vol_z',
    availableInformation: Object.freeze({
      observationRefs: Object.freeze(['obs/os08/1']),
      featureRefs: Object.freeze(['feat/os08/vol_z']),
      evidenceQuality: 'MEDIUM',
      dataAvailable: true,
      summary: 'Vol z-score 2.4 with fresh quote',
      capturedAt: NOW,
    }),
    requestedSpecialistClasses: Object.freeze(['TECHNICAL', 'OPTIONS', 'ADVERSARIAL_CRITIC']),
    requestedBudgetMinor: '5000',
    requestedBudgetCurrency: 'USD',
    cooldownKey: 'cooldown:mon_vol_spike:subj_os08',
    cooldownSeconds: 120,
    confidenceBefore: 'LOW_CONFIDENCE',
    opportunityKind: 'GENERIC',
    emittedAt: NOW,
    ...overrides,
  });
}

function defaultVoiContext() {
  return Object.freeze({
    estimatedOpportunitySizeMinor: '250000',
    unresolvedUncertainty: 'HIGH' as const,
    accountSizeFeasible: true,
    opportunityHalfLifeHours: 48,
    timeRemainingHours: 12,
    specialistDisagreement: false,
    calibratedProbabilityBps: null,
  });
}

function meshPort(clock: FrozenClock): ResearchTriggerMeshPort {
  const store = new ResearchMeshStore();
  const budget = new ResearchMeshBudgetController(DEFAULT_MESH_BUDGET_LIMITS);
  const mesh = new SpecialistResearchMesh({ clock, store, budget, limits: DEFAULT_MESH_BUDGET_LIMITS });
  return {
    runTriggeredResearch(input) {
      const result = mesh.runResearch({
        workOrderId: input.workOrderId,
        subjectId: input.subjectId,
        objective: input.objective,
        opportunityKind: input.opportunityKind,
        privacyClass: 'PUBLIC_RESEARCH',
        contextRef: `ctx_${input.workOrderId}`,
        evidenceBundle: input.evidenceBundle.map((row) =>
          Object.freeze({
            ...row,
            sourceKind: row.sourceKind as 'MARKET_OBSERVATION',
          }),
        ),
      });
      if (!result.ok) {
        return { ok: false, message: result.error.message };
      }
      const agents = result.value.outputs.map((row) =>
        Object.freeze({
          role: row.specialistRole,
          taskId: row.taskId,
          modelProvider: row.model.provider,
          modelId: row.model.modelId,
          sourceRefs: Object.freeze(row.evidenceReferences.map((ev) => ev.sourceRef)),
          costMicros: row.usage.costMicros,
          inputTokens: row.usage.inputTokens,
          outputTokens: row.usage.outputTokens,
        }),
      );
      const sourcesUsed = Object.freeze([...new Set(agents.flatMap((row) => row.sourceRefs))]);
      const cost = aggregateMeshCost(agents);
      return Object.freeze({
        ok: true,
        meshRunId: result.value.run.runId,
        agents,
        sourcesUsed,
        cost,
        confidenceAfter: 'CALIBRATED',
      });
    },
  };
}

describe('HELIOS OS08 event-triggered agentic research', () => {
  it('exposes qualification marker', () => {
    assert.equal(
      HELIOS_OS08_TRIGGERED_AGENTIC_RESEARCH_QUALIFIED,
      'HELIOS_OS08_TRIGGERED_AGENTIC_RESEARCH_QUALIFIED',
    );
  });

  it('architecture guard: OS08 router does not import execution or custody paths', () => {
    const findings = lintHeliosBoundary(ROOT).filter((row) => row.file.includes('open-source-integration'));
    assert.equal(findings.length, 0);
    const routerSource = readFileSync(
      join(ROOT, 'packages/platform/src/helios/open-source-integration/os08/router.ts'),
      'utf8',
    );
    assert.equal(
      /^import .* from '.*(?:order-lifecycle|custody|execution-routing|postJournal)/m.test(routerSource),
      false,
    );
    assert.ok(meshRolesPermittedForTrigger().every((role) => role !== 'EXECUTION_RESEARCH'));
  });

  it('maps monitor specialist classes without execution research roles', () => {
    const roles = routeTriggerSpecialistClasses(['MACRO', 'FLOW', 'CRYPTO_ONCHAIN']);
    assert.ok(roles.includes('MACRO_FX'));
    assert.ok(roles.includes('MICROSTRUCTURE'));
    assert.ok(!roles.includes('EXECUTION_RESEARCH' as (typeof roles)[number]));
  });

  it('routes monitor trigger through VoI, work order, mesh, and evidence vault', () => {
    const clock = new FrozenClock(NOW);
    const vault = new EvidenceVault(clock);
    const router = new ResearchTriggerRouter({ mesh: meshPort(clock), evidenceVault: vault });
    const workOrder = activeResearchWorkOrder('cust_os08', 'subj_os08');
    const routed = router.route({
      trigger: baseTrigger(),
      now: NOW,
      mandateBoundWorkOrder: workOrder,
      researchBudget: initialBudgetSnapshot({
        ceilingAmount: '50000',
        unitKind: 'USD_MINOR',
        currency: 'USD',
      }),
      voiContext: defaultVoiContext(),
    });
    assert.equal(routed.ok, true);
    if (!routed.ok) return;
    assert.equal(routed.value.outcome, 'RESEARCH_COMPLETED');
    assert.ok(routed.value.triggeredWorkOrder);
    assert.equal(routed.value.triggeredWorkOrder!.grantsExecutionAuthority, false);
    assert.equal(routed.value.triggeredWorkOrder!.researchOnly, true);
    assert.ok(routed.value.evidence);
    assert.ok(routed.value.evidence!.agentsRan.length > 0);
    assert.ok(routed.value.evidence!.sealedVaultEvidenceId);
    assert.equal(routed.value.evidence!.confidenceDelta.deltaLabel, 'IMPROVED');
  });

  it('replays idempotent trigger without duplicate mesh side effects', () => {
    const clock = new FrozenClock(NOW);
    let meshCalls = 0;
    const base = meshPort(clock);
    const router = new ResearchTriggerRouter({
      mesh: {
        runTriggeredResearch(input) {
          meshCalls += 1;
          return base.runTriggeredResearch(input);
        },
      },
    });
    const workOrder = activeResearchWorkOrder('cust_os08_idem', 'subj_os08_idem');
    const budget = initialBudgetSnapshot({ ceilingAmount: '50000', unitKind: 'USD_MINOR', currency: 'USD' });
    const input = {
      trigger: baseTrigger({
        idempotencyKey: 'idem_os08_dup',
        dedupeFingerprint: 'fp_os08_idem',
        customerId: 'cust_os08_idem',
        subjectId: 'subj_os08_idem',
        cooldownKey: 'cooldown:idem',
      }),
      now: NOW,
      mandateBoundWorkOrder: workOrder,
      researchBudget: budget,
      voiContext: defaultVoiContext(),
    };
    const first = router.route(input);
    const second = router.route(input);
    assert.equal(first.ok && second.ok, true);
    assert.equal(meshCalls, 1);
    if (second.ok) {
      assert.equal(second.value.outcome, 'IDEMPOTENT_REPLAY');
    }
  });

  it('dedupes fingerprint within window', () => {
    const clock = new FrozenClock(NOW);
    const router = new ResearchTriggerRouter({ mesh: meshPort(clock) });
    const workOrder = activeResearchWorkOrder('cust_os08_dedupe', 'subj_os08_dedupe');
    const budget = initialBudgetSnapshot({ ceilingAmount: '50000', unitKind: 'USD_MINOR', currency: 'USD' });
    const sharedFingerprint = 'fp_shared_dedupe';
    const first = router.route({
      trigger: baseTrigger({
        idempotencyKey: 'idem_a',
        dedupeFingerprint: sharedFingerprint,
        customerId: 'cust_os08_dedupe',
        subjectId: 'subj_os08_dedupe',
        cooldownKey: 'cooldown:dedupe:a',
      }),
      now: NOW,
      mandateBoundWorkOrder: workOrder,
      researchBudget: budget,
      voiContext: defaultVoiContext(),
    });
    const second = router.route({
      trigger: baseTrigger({
        triggerEventId: 'rt_trig_2',
        idempotencyKey: 'idem_b',
        dedupeFingerprint: sharedFingerprint,
        customerId: 'cust_os08_dedupe',
        subjectId: 'subj_os08_dedupe',
        cooldownKey: 'cooldown:dedupe:b',
      }),
      now: NOW,
      mandateBoundWorkOrder: workOrder,
      researchBudget: budget,
      voiContext: defaultVoiContext(),
    });
    assert.equal(first.ok && second.ok, true);
    if (second.ok) {
      assert.equal(second.value.outcome, 'DEDUPED');
    }
  });

  it('respects cooldown keys', () => {
    const clock = new FrozenClock(NOW);
    const router = new ResearchTriggerRouter({ mesh: meshPort(clock) });
    const workOrder = activeResearchWorkOrder('cust_os08_cd', 'subj_os08_cd');
    const budget = initialBudgetSnapshot({ ceilingAmount: '50000', unitKind: 'USD_MINOR', currency: 'USD' });
    const cooldownKey = 'cooldown:shared';
    const first = router.route({
      trigger: baseTrigger({
        idempotencyKey: 'idem_cd_1',
        dedupeFingerprint: 'fp_cd_1',
        customerId: 'cust_os08_cd',
        subjectId: 'subj_os08_cd',
        cooldownKey,
      }),
      now: NOW,
      mandateBoundWorkOrder: workOrder,
      researchBudget: budget,
      voiContext: defaultVoiContext(),
    });
    const second = router.route({
      trigger: baseTrigger({
        triggerEventId: 'rt_trig_cd_2',
        idempotencyKey: 'idem_cd_2',
        dedupeFingerprint: 'fp_cd_2',
        customerId: 'cust_os08_cd',
        subjectId: 'subj_os08_cd',
        cooldownKey,
      }),
      now: NOW,
      mandateBoundWorkOrder: workOrder,
      researchBudget: budget,
      voiContext: defaultVoiContext(),
    });
    assert.equal(first.ok && second.ok, true);
    if (second.ok) {
      assert.equal(second.value.outcome, 'COOLDOWN');
    }
  });

  it('denies research when H20 VoI rejects spend', () => {
    const clock = new FrozenClock(NOW);
    const router = new ResearchTriggerRouter({ mesh: meshPort(clock) });
    const workOrder = activeResearchWorkOrder('cust_os08_voi', 'subj_os08_voi');
    const routed = router.route({
      trigger: baseTrigger({
        idempotencyKey: 'idem_voi',
        dedupeFingerprint: 'fp_voi',
        customerId: 'cust_os08_voi',
        subjectId: 'subj_os08_voi',
        cooldownKey: 'cooldown:voi',
        availableInformation: Object.freeze({
          observationRefs: Object.freeze([]),
          featureRefs: Object.freeze([]),
          evidenceQuality: 'INSUFFICIENT',
          dataAvailable: false,
          summary: 'Stale feed',
          capturedAt: NOW,
        }),
      }),
      now: NOW,
      mandateBoundWorkOrder: workOrder,
      researchBudget: initialBudgetSnapshot({ ceilingAmount: '50000', unitKind: 'USD_MINOR', currency: 'USD' }),
      voiContext: defaultVoiContext(),
    });
    assert.equal(routed.ok, true);
    if (routed.ok) {
      assert.equal(routed.value.outcome, 'VOI_DENIED');
    }
  });

  it('optional strategy evaluation port receives research evidence only', () => {
    const clock = new FrozenClock(NOW);
    let strategyCalls = 0;
    const router = new ResearchTriggerRouter({
      mesh: meshPort(clock),
      strategyEvaluation: {
        evaluateResearchResult() {
          strategyCalls += 1;
        },
      },
    });
    const workOrder = activeResearchWorkOrder('cust_os08_strat', 'subj_os08_strat');
    router.route({
      trigger: baseTrigger({
        idempotencyKey: 'idem_strat',
        dedupeFingerprint: 'fp_strat',
        customerId: 'cust_os08_strat',
        subjectId: 'subj_os08_strat',
        cooldownKey: 'cooldown:strat',
      }),
      now: NOW,
      mandateBoundWorkOrder: workOrder,
      researchBudget: initialBudgetSnapshot({ ceilingAmount: '50000', unitKind: 'USD_MINOR', currency: 'USD' }),
      voiContext: defaultVoiContext(),
      requestStrategyEvaluation: true,
    });
    assert.equal(strategyCalls, 1);
  });
});
