/**
 * HELIOS NATIVE08 — OpenChart-inspired proactive research engine (native assimilation).
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { createProactiveResearchMeshBridge } from '../packages/agentic-capital-mesh/src/proactive-research/index.ts';
import { interpretMandateLanguage } from '../packages/agent/src/interpretation.ts';
import { FrozenClock } from '../packages/config/src/clock.ts';
import { asCustomerId } from '../packages/domain/src/customer.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import { EvidenceVault } from '../packages/evidence/src/vault.ts';
import {
  createEconomicWorkOrderDraft,
  initialBudgetSnapshot,
  mandateBindingRefFromCompiled,
  type WorkOrderScope,
} from '../packages/platform/src/helios/index.ts';
import type { ResearchTriggerMeshPort } from '../packages/platform/src/helios/open-source-integration/os08/types.ts';
import type { MeshSpecialistRoleName } from '../packages/platform/src/helios/open-source-integration/os08/taxonomy.ts';
import {
  HELIOS_NATIVE_PROACTIVE_RESEARCH_ENGINE_QUALIFIED,
  HeliosProactiveResearchEngine,
  evaluateNative08ProactiveResearchQualification,
  triggeredSemiconductorFeatureSet,
  semiconductorVolatilityDislocationDefinition,
} from '../packages/platform/src/helios/research-monitor/index.ts';
import { compileEconomicMandate, mandateDraftFromInterpretation } from '../packages/platform/src/mandate/compiler.ts';
import type { CompiledEconomicMandate } from '../packages/platform/src/mandate/types.ts';
import { workOrderIdFor } from '../packages/platform/src/helios/ids.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const NOW = asUtcInstant('2026-11-03T06:30:00.000Z');
const ROOT = process.cwd();

function adaptMeshBridgeToOs08(
  bridge: ReturnType<typeof createProactiveResearchMeshBridge>,
): ResearchTriggerMeshPort {
  return {
    runTriggeredResearch(input) {
      const result = bridge.runTriggeredResearch({
        workOrderId: input.workOrderId,
        subjectId: input.subjectId,
        objective: input.objective,
        opportunityKind: input.opportunityKind,
        evidenceBundle: input.evidenceBundle.map((row) =>
          Object.freeze({
            evidenceId: row.evidenceId,
            sourceRef: row.sourceRef,
            sourceKind: row.sourceKind,
            contentHash: row.contentHash,
          }),
        ),
      });
      if (!result.ok) {
        return { ok: false, message: result.message };
      }
      return Object.freeze({
        ok: true,
        meshRunId: result.meshRunId,
        agents: result.agents.map((row) =>
          Object.freeze({
            role: row.role as MeshSpecialistRoleName,
            taskId: row.taskId,
            modelProvider: row.modelProvider,
            modelId: row.modelId,
            sourceRefs: row.sourceRefs,
            costMicros: row.costMicros,
            inputTokens: row.inputTokens,
            outputTokens: row.outputTokens,
          }),
        ),
        sourcesUsed: result.sourcesUsed,
        cost: result.cost,
        confidenceAfter: result.confidenceAfter,
      });
    },
  };
}

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
  const workOrderId = workOrderIdFor(customerId, 'native08');
  const draft = createEconomicWorkOrderDraft({
    workOrderId,
    customerId: asCustomerId(customerId),
    subjectId,
    growObjectiveId: 'grow_native08',
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

describe('HELIOS NATIVE08 proactive research engine', () => {
  it('exposes qualification marker', () => {
    assert.equal(
      HELIOS_NATIVE_PROACTIVE_RESEARCH_ENGINE_QUALIFIED,
      'HELIOS_NATIVE_PROACTIVE_RESEARCH_ENGINE_QUALIFIED',
    );
  });

  it('passes HELIOS boundary guard for proactive engine sources', () => {
    const findings = lintHeliosBoundary(ROOT).filter((row) => row.file.includes('research-monitor/proactive'));
    assert.equal(findings.length, 0);
    const serviceSource = readFileSync(
      join(ROOT, 'packages/platform/src/helios/research-monitor/proactive/service.ts'),
      'utf8',
    );
    assert.equal(/postJournal|openAccount|order-lifecycle|execution-routing/.test(serviceSource), false);
  });

  it('runs market event → feature fabric → monitor → trigger → work order → agent research', () => {
    const clock = new FrozenClock(NOW);
    const vault = new EvidenceVault(clock);
    const bridge = createProactiveResearchMeshBridge({ clock });
    const engine = new HeliosProactiveResearchEngine({
      ports: {
        clock,
        mesh: adaptMeshBridgeToOs08(bridge),
        evidenceVault: vault,
        researchBudget: initialBudgetSnapshot({
          ceilingAmount: '50000',
          unitKind: 'MONETARY_MINOR',
          currency: 'USD',
        }),
        voiContext: Object.freeze({
          estimatedOpportunitySizeMinor: '250000',
          unresolvedUncertainty: 'HIGH',
          accountSizeFeasible: true,
          opportunityHalfLifeHours: 48,
          timeRemainingHours: 12,
          specialistDisagreement: false,
          calibratedProbabilityBps: null,
        }),
      },
    });

    engine.subscribeToMarketEvents(Object.freeze(['NVDA', 'SOXX', 'QQQ']));
    const workOrder = activeResearchWorkOrder('cust_native08', 'subj_native08');
    engine.registerMonitor({
      customerId: 'cust_native08',
      subjectId: 'subj_native08',
      definition: semiconductorVolatilityDislocationDefinition(),
      mandateBoundWorkOrder: workOrder,
    });

    engine.enqueueMarketEvent(
      Object.freeze({
        eventId: 'mkt_evt_1',
        instrumentIds: Object.freeze(['NVDA', 'SOXX']),
        featureFabric: Object.freeze({
          resolveFeatures: () => triggeredSemiconductorFeatureSet(),
        }),
        primaryObservationRef: 'obs/native08/1',
        summary: 'NVDA vol spike on watchlist',
        emittedAt: NOW,
      }),
    );

    const tick = engine.tick();
    assert.ok(tick.evaluations >= 1);
    assert.equal(tick.triggersRouted, 1);

    const history = engine.engineStore.listHistory();
    assert.ok(history.some((row) => row.kind === 'MARKET_EVENT_RECEIVED'));
    assert.ok(history.some((row) => row.kind === 'MONITOR_EVALUATED'));
    assert.ok(history.some((row) => row.kind === 'TRIGGER_ROUTED'));

    const runs = engine.triggerRouter.store.listRuns();
    assert.equal(runs.length, 1);
    assert.equal(runs[0]?.outcome, 'RESEARCH_COMPLETED');
    assert.equal(runs[0]?.triggeredWorkOrder?.grantsExecutionAuthority, false);
    assert.equal(runs[0]?.triggeredWorkOrder?.researchOnly, true);
    assert.ok(runs[0]?.evidence?.sealedVaultEvidenceId);
  });

  it('persists monitor state and recovers idempotent trigger routing after restart', () => {
    const clock = new FrozenClock(NOW);
    const bridge = createProactiveResearchMeshBridge({ clock });
    const engine = new HeliosProactiveResearchEngine({
      ports: {
        clock,
        mesh: adaptMeshBridgeToOs08(bridge),
        researchBudget: initialBudgetSnapshot({
          ceilingAmount: '50000',
          unitKind: 'MONETARY_MINOR',
          currency: 'USD',
        }),
        voiContext: Object.freeze({
          estimatedOpportunitySizeMinor: '250000',
          unresolvedUncertainty: 'MEDIUM',
          accountSizeFeasible: true,
          opportunityHalfLifeHours: 48,
          timeRemainingHours: 12,
          specialistDisagreement: false,
          calibratedProbabilityBps: null,
        }),
      },
    });

    engine.subscribeToMarketEvents(null);
    const workOrder = activeResearchWorkOrder('cust_native08_rec', 'subj_native08_rec');
    engine.registerMonitor({
      customerId: 'cust_native08_rec',
      subjectId: 'subj_native08_rec',
      definition: semiconductorVolatilityDislocationDefinition({
        cooldownMs: 3_600_000,
        maxTriggers: 10,
      }),
      mandateBoundWorkOrder: workOrder,
    });

    engine.enqueueMarketEvent(
      Object.freeze({
        eventId: 'mkt_evt_rec',
        instrumentIds: Object.freeze(['NVDA']),
        featureFabric: Object.freeze({ resolveFeatures: () => triggeredSemiconductorFeatureSet() }),
        primaryObservationRef: 'obs/rec/1',
        summary: 'recovery fixture',
        emittedAt: NOW,
      }),
    );
    engine.tick();

    const snapshot = engine.exportSnapshot();
    assert.ok(snapshot.monitorStore.states.length >= 1);
    assert.ok(snapshot.triggerRuns.length >= 1);

    let meshCalls = 0;
    const countingBridge = createProactiveResearchMeshBridge({ clock });
    const wrappedMesh: ResearchTriggerMeshPort = {
      runTriggeredResearch(input) {
        meshCalls += 1;
        return adaptMeshBridgeToOs08(countingBridge).runTriggeredResearch(input);
      },
    };

    const restarted = new HeliosProactiveResearchEngine({
      ports: {
        clock,
        mesh: wrappedMesh,
        researchBudget: initialBudgetSnapshot({
          ceilingAmount: '50000',
          unitKind: 'MONETARY_MINOR',
          currency: 'USD',
        }),
        voiContext: Object.freeze({
          estimatedOpportunitySizeMinor: '250000',
          unresolvedUncertainty: 'MEDIUM',
          accountSizeFeasible: true,
          opportunityHalfLifeHours: 48,
          timeRemainingHours: 12,
          specialistDisagreement: false,
          calibratedProbabilityBps: null,
        }),
      },
    });
    restarted.recoverFromSnapshot(snapshot);

    restarted.enqueueMarketEvent(
      Object.freeze({
        eventId: 'mkt_evt_rec_replay',
        instrumentIds: Object.freeze(['NVDA']),
        featureFabric: Object.freeze({ resolveFeatures: () => triggeredSemiconductorFeatureSet() }),
        primaryObservationRef: 'obs/rec/2',
        summary: 'duplicate replay attempt',
        emittedAt: NOW,
      }),
    );
    restarted.tick();
    assert.equal(meshCalls, 0);
    assert.ok(restarted.engineStore.listHistory().some((row) => row.kind === 'ENGINE_RECOVERED'));
  });

  it('qualification gate passes native08 checks', () => {
    const result = evaluateNative08ProactiveResearchQualification({
      marketEventToFeatureFabric: true,
      featureFabricToMonitor: true,
      monitorToTriggerOnlyResearch: true,
      triggerToWorkOrderNotTrade: true,
      workOrderToAgentResearch: true,
      cooldownEnforced: true,
      deduplicationEnforced: true,
      triggerPersistence: true,
      monitorStatePersisted: true,
      restartRecovery: true,
      monitorHistoryRecorded: true,
      evidenceVaultRecords: true,
      scheduleTickSupported: true,
      eventSubscriptionSupported: true,
      noCapitalMovementFromTrigger: true,
    });
    assert.equal(result.marker, HELIOS_NATIVE_PROACTIVE_RESEARCH_ENGINE_QUALIFIED);
    assert.equal(result.qualified, true);
  });
});
