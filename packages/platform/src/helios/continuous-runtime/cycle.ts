import { randomUUID } from 'node:crypto';

import type { UtcInstant } from '../../../../domain/src/time.ts';
import { HELIOS_CYCLE_STAGES, type HeliosCycleStage, type HeliosRuntimeState } from './taxonomy.ts';
import type { InMemoryHeliosRuntimeStore } from './store.ts';
import type {
  CycleStageContext,
  CycleStageResult,
  HeliosRuntimePorts,
  MandateRuntimeRegistration,
  RuntimeCycleRecord,
} from './types.ts';

export function nextStage(after: HeliosCycleStage | null): HeliosCycleStage | null {
  if (after === null) return HELIOS_CYCLE_STAGES[0] ?? null;
  const index = HELIOS_CYCLE_STAGES.indexOf(after);
  if (index < 0 || index >= HELIOS_CYCLE_STAGES.length - 1) return null;
  return HELIOS_CYCLE_STAGES[index + 1] ?? null;
}

export function executeCycleStage(
  stage: HeliosCycleStage,
  ctx: CycleStageContext,
  ports: HeliosRuntimePorts,
): CycleStageResult {
  if (ctx.exitOnly && !['MONITOR', 'EXIT', 'SETTLE', 'RECONCILE', 'ATTRIBUTE', 'LEARN'].includes(stage)) {
    return Object.freeze({
      continueCycle: stage !== 'LEARN',
      runtimeState: 'FAILED_SAFE',
      outcome: stage === 'LEARN' ? 'EXIT_ONLY' : null,
      noActionReason: 'exit-only supervision active',
    });
  }

  switch (stage) {
    case 'OBSERVE':
      return Object.freeze({
        continueCycle: true,
        runtimeState: ctx.runtimeState,
        outcome: null,
        noActionReason: null,
      });
    case 'DETECT':
      return Object.freeze({
        continueCycle: true,
        runtimeState: ctx.runtimeState,
        outcome: null,
        noActionReason: null,
        opportunitiesDiscovered: 1,
      });
    case 'RESEARCH':
    case 'CHALLENGE':
    case 'QUALIFY': {
      const qualified = ports.qualifiedOpportunityExists({
        customerId: ctx.registration.customerId,
        subjectId: ctx.registration.subjectId,
        strategyIds: ctx.registration.config.strategyIds,
        now: ctx.now,
      });
      if (!qualified) {
        return Object.freeze({
          continueCycle: false,
          runtimeState: 'IDLE',
          outcome: 'NO_ACTION',
          noActionReason: 'no qualified opportunity',
          opportunitiesRejected: 1,
        });
      }
      return Object.freeze({
        continueCycle: true,
        runtimeState: ctx.runtimeState,
        outcome: null,
        noActionReason: null,
      });
    }
    case 'RANK':
      return Object.freeze({
        continueCycle: true,
        runtimeState: ctx.runtimeState,
        outcome: null,
        noActionReason: null,
        strategiesEvaluated: ctx.registration.config.strategyIds.length,
      });
    case 'ALLOCATE':
    case 'RISK': {
      if (
        !ports.riskPermitsNewEntries({
          customerId: ctx.registration.customerId,
          subjectId: ctx.registration.subjectId,
          now: ctx.now,
        })
      ) {
        return Object.freeze({
          continueCycle: false,
          runtimeState: 'RISK_BLOCKED',
          outcome: 'BLOCKED',
          noActionReason: 'risk block',
          riskBlock: true,
        });
      }
      return Object.freeze({
        continueCycle: true,
        runtimeState: ctx.runtimeState,
        outcome: null,
        noActionReason: null,
      });
    }
    case 'COMPLIANCE': {
      if (
        !ports.compliancePermitsAction({
          customerId: ctx.registration.customerId,
          subjectId: ctx.registration.subjectId,
          now: ctx.now,
        })
      ) {
        return Object.freeze({
          continueCycle: false,
          runtimeState: 'COMPLIANCE_BLOCKED',
          outcome: 'BLOCKED',
          noActionReason: 'compliance block',
          complianceBlock: true,
        });
      }
      return Object.freeze({
        continueCycle: true,
        runtimeState: ctx.runtimeState,
        outcome: null,
        noActionReason: null,
      });
    }
    case 'AUTHORIZE':
      return Object.freeze({
        continueCycle: true,
        runtimeState: 'WAITING_FOR_AUTHORIZATION',
        outcome: null,
        noActionReason: null,
      });
    case 'PAPER_EXECUTE':
      if (ctx.exitOnly) {
        return Object.freeze({
          continueCycle: true,
          runtimeState: 'FAILED_SAFE',
          outcome: null,
          noActionReason: 'exit-only; skipping new paper execution',
        });
      }
      return Object.freeze({
        continueCycle: true,
        runtimeState: 'ACTIVE',
        outcome: null,
        noActionReason: null,
        paperTrades: 1,
      });
    case 'MONITOR':
    case 'EXIT':
    case 'SETTLE':
      return Object.freeze({
        continueCycle: true,
        runtimeState: ctx.runtimeState,
        outcome: null,
        noActionReason: null,
      });
    case 'RECONCILE': {
      if (
        ports.reconciliationRequired({
          customerId: ctx.registration.customerId,
          subjectId: ctx.registration.subjectId,
        })
      ) {
        return Object.freeze({
          continueCycle: false,
          runtimeState: 'RECONCILIATION_REQUIRED',
          outcome: 'BLOCKED',
          noActionReason: 'reconciliation required',
          reconciliationException: true,
        });
      }
      return Object.freeze({
        continueCycle: true,
        runtimeState: ctx.runtimeState,
        outcome: null,
        noActionReason: null,
      });
    }
    case 'ATTRIBUTE':
    case 'LEARN':
      return Object.freeze({
        continueCycle: false,
        runtimeState: 'ACTIVE',
        outcome: ctx.exitOnly ? 'EXIT_ONLY' : 'PAPER_TRADE',
        noActionReason: null,
      });
    default:
      return Object.freeze({
        continueCycle: false,
        runtimeState: 'FAILED_SAFE',
        outcome: 'BLOCKED',
        noActionReason: 'unknown stage',
      });
  }
}

export function runBoundedCycle(input: {
  readonly store: InMemoryHeliosRuntimeStore;
  readonly registration: MandateRuntimeRegistration;
  readonly ports: HeliosRuntimePorts;
  readonly now: UtcInstant;
  readonly runtimeState: HeliosRuntimeState;
  readonly exitOnly: boolean;
  readonly resumeFrom?: RuntimeCycleRecord;
  readonly mandateLookup: (mandateId: string) => import('../../mandate/types.ts').CompiledEconomicMandate | undefined;
}): RuntimeCycleRecord {
  const mandate = input.mandateLookup(input.registration.mandateId);
  if (!mandate) {
    return finalizeCycle({
      cycleId: input.resumeFrom?.cycleId ?? `hrc_${randomUUID()}`,
      registrationId: input.registration.registrationId,
      customerId: input.registration.customerId,
      startedAt: input.resumeFrom?.startedAt ?? input.now,
      completedAt: input.now,
      currentStage: null,
      lastCompletedStage: input.resumeFrom?.lastCompletedStage ?? null,
      outcome: 'BLOCKED',
      runtimeState: 'FAILED_SAFE',
      evidenceRef: null,
      noActionReason: 'mandate missing during cycle',
    }, input.store);
  }

  const cycleId = input.resumeFrom?.cycleId ?? `hrc_${randomUUID()}`;
  const startedAt = input.resumeFrom?.startedAt ?? input.now;
  let stage = input.resumeFrom?.lastCompletedStage
    ? nextStage(input.resumeFrom.lastCompletedStage)
    : HELIOS_CYCLE_STAGES[0] ?? null;
  let runtimeState = input.runtimeState;
  let outcome: RuntimeCycleRecord['outcome'] = null;
  let noActionReason: string | null = null;
  let lastCompleted: HeliosCycleStage | null = input.resumeFrom?.lastCompletedStage ?? null;

  const ctxBase = {
    now: input.now,
    registration: input.registration,
    mandate,
    exitOnly: input.exitOnly,
  };

  while (stage) {
    const stageResult = executeCycleStage(stage, { ...ctxBase, runtimeState }, input.ports);
    runtimeState = stageResult.runtimeState;
    if (stageResult.opportunitiesDiscovered) {
      input.store.incrementMetric('opportunitiesDiscovered', stageResult.opportunitiesDiscovered);
    }
    if (stageResult.opportunitiesRejected) {
      input.store.incrementMetric('opportunitiesRejected', stageResult.opportunitiesRejected);
    }
    if (stageResult.strategiesEvaluated) {
      input.store.incrementMetric('strategiesEvaluated', stageResult.strategiesEvaluated);
    }
    if (stageResult.paperTrades) {
      input.store.incrementMetric('paperTradesExecuted', stageResult.paperTrades);
    }
    if (stageResult.providerError) input.store.incrementMetric('providerErrors');
    if (stageResult.riskBlock) input.store.incrementMetric('riskBlocks');
    if (stageResult.complianceBlock) input.store.incrementMetric('complianceBlocks');
    if (stageResult.reconciliationException) input.store.incrementMetric('reconciliationExceptions');

    lastCompleted = stage;

    if (!stageResult.continueCycle) {
      outcome = stageResult.outcome;
      noActionReason = stageResult.noActionReason;
      break;
    }

    stage = nextStage(stage);
  }

  if (outcome === 'NO_ACTION') {
    input.store.incrementMetric('noActionDecisions');
  }

  return finalizeCycle(
    Object.freeze({
      cycleId,
      registrationId: input.registration.registrationId,
      customerId: input.registration.customerId,
      startedAt,
      completedAt: input.now,
      currentStage: null,
      lastCompletedStage: lastCompleted,
      outcome: outcome ?? (input.exitOnly ? 'EXIT_ONLY' : 'PAPER_TRADE'),
      runtimeState,
      evidenceRef: `ev_cycle_${cycleId}`,
      noActionReason,
    }),
    input.store,
  );
}

function finalizeCycle(record: RuntimeCycleRecord, store: InMemoryHeliosRuntimeStore): RuntimeCycleRecord {
  store.putCycle(record);
  return record;
}
