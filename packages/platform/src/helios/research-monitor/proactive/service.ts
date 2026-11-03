import { createHash, randomUUID } from 'node:crypto';

import type { Clock } from '@solstice/config';
import type { UtcInstant } from '@solstice/domain';
import { createH20ResearchBudgetPort } from '../h20-budget.ts';
import { HeliosResearchMonitorService } from '../service.ts';
import { InMemoryResearchMonitorStore } from '../store.ts';
import { ResearchTriggerRouter } from '../../open-source-integration/os08/router.ts';
import type { ResearchTriggerRunResult } from '../../open-source-integration/os08/types.ts';
import { lifecycleFromMonitorState } from './lifecycle.ts';
import { advanceSchedule, seedSchedule } from './scheduler.ts';
import {
  createEventSubscription,
  registrationMatchesEvent,
  subscriptionMatchesEvent,
} from './event-subscriptions.ts';
import { buildIntegrationTriggerEvent } from './trigger-mapper.ts';
import { ProactiveResearchEngineStore } from './store.ts';
import { sealProactivePipelineRecord } from './evidence.ts';
import type {
  MarketFeatureEvent,
  ProactiveDispatchResult,
  ProactiveEventSubscription,
  ProactiveMonitorRegistration,
  ProactiveMonitorSchedule,
  ProactivePipelineRecord,
  ProactiveResearchEnginePorts,
  ProactiveResearchEngineSnapshot,
  ProactiveEngineTickResult,
} from './types.ts';
import type { ResearchMonitorDefinition, CanonicalFeatureObservation } from '../types.ts';
import type { EconomicWorkOrder } from '../../types.ts';
import { computeKnowableAt } from '../../observation/information-time.ts';

export type RegisterProactiveMonitorInput = {
  readonly customerId: string;
  readonly subjectId: string;
  readonly definition: ResearchMonitorDefinition;
  readonly mandateBoundWorkOrder: EconomicWorkOrder;
  readonly schedule?: ProactiveMonitorSchedule | null;
};

export class HeliosProactiveResearchEngine {
  readonly monitorService: HeliosResearchMonitorService;
  readonly engineStore: ProactiveResearchEngineStore;
  readonly triggerRouter: ResearchTriggerRouter;
  private readonly clock: Clock;
  private readonly ports: ProactiveResearchEnginePorts;
  private readonly pendingEvents: MarketFeatureEvent[] = [];

  constructor(input: {
    readonly ports: ProactiveResearchEnginePorts;
    readonly monitorStore?: InMemoryResearchMonitorStore;
    readonly engineStore?: ProactiveResearchEngineStore;
    readonly triggerRouter?: ResearchTriggerRouter;
  }) {
    this.ports = input.ports;
    this.clock = input.ports.clock;
    const monitorStore = input.monitorStore ?? new InMemoryResearchMonitorStore();
    this.monitorService = new HeliosResearchMonitorService({ store: monitorStore });
    this.engineStore = input.engineStore ?? new ProactiveResearchEngineStore();
    this.triggerRouter =
      input.triggerRouter ??
      new ResearchTriggerRouter({
        mesh: input.ports.mesh,
        ...(input.ports.evidenceVault !== undefined ? { evidenceVault: input.ports.evidenceVault } : {}),
      });
  }

  now(): UtcInstant {
    return this.clock.now();
  }

  subscribeToMarketEvents(instrumentIds: readonly string[] | null): ProactiveEventSubscription {
    const subscription = createEventSubscription({ instrumentIds });
    this.engineStore.putSubscription(subscription);
    return subscription;
  }

  registerMonitor(input: RegisterProactiveMonitorInput): ProactiveMonitorRegistration {
    const now = this.now();
    const compiled = this.monitorService.compile(input.definition, now);
    if (!compiled) {
      throw new Error(`monitor compile failed: ${input.definition.monitorId}`);
    }
    let registration: ProactiveMonitorRegistration = Object.freeze({
      registrationId: `prmon_${randomUUID().slice(0, 12)}`,
      customerId: input.customerId,
      subjectId: input.subjectId,
      monitorId: input.definition.monitorId,
      definition: input.definition,
      lifecycle: 'WATCHING',
      mandateBoundWorkOrder: input.mandateBoundWorkOrder,
      schedule: input.schedule ?? null,
      registeredAt: now,
      updatedAt: now,
    });
    if (input.schedule) {
      registration = seedSchedule(registration, now, input.schedule.intervalMs);
    }
    this.engineStore.putRegistration(registration);
    this.recordHistory({
      kind: 'MONITOR_REGISTERED',
      stage: 'RESEARCH_MONITOR',
      monitorId: input.definition.monitorId,
      eventId: null,
      triggerEventId: null,
      runId: null,
      detail: `Registered proactive monitor ${input.definition.name}`,
    });
    return registration;
  }

  pauseMonitor(registrationId: string): void {
    const row = this.engineStore.getRegistration(registrationId);
    if (!row) return;
    this.engineStore.putRegistration(
      Object.freeze({ ...row, lifecycle: 'PAUSED', updatedAt: this.now() }),
    );
  }

  disableMonitor(registrationId: string): void {
    const row = this.engineStore.getRegistration(registrationId);
    if (!row) return;
    this.engineStore.putRegistration(
      Object.freeze({ ...row, lifecycle: 'DISABLED', updatedAt: this.now() }),
    );
  }

  enqueueMarketEvent(event: MarketFeatureEvent): void {
    this.pendingEvents.push(event);
    this.recordHistory({
      kind: 'MARKET_EVENT_RECEIVED',
      stage: 'MARKET_EVENT',
      monitorId: null,
      eventId: event.eventId,
      triggerEventId: null,
      runId: null,
      detail: event.summary,
    });
  }

  tick(input?: { readonly eventLimit?: number }): ProactiveEngineTickResult {
    const limit = input?.eventLimit ?? 32;
    let processedEvents = 0;
    let evaluations = 0;
    let triggersRouted = 0;
    let triggersBlocked = 0;
    let schedulesFired = 0;

    const subscriptions = this.engineStore.listSubscriptions().filter((row) => row.active);

    while (this.pendingEvents.length > 0 && processedEvents < limit) {
      const event = this.pendingEvents.shift();
      if (!event) break;
      if (!subscriptions.some((sub) => subscriptionMatchesEvent(sub, event))) {
        continue;
      }
      processedEvents += 1;
      for (const registration of this.engineStore.listActiveRegistrations()) {
        if (!registrationMatchesEvent(registration, event)) {
          continue;
        }
        const result = this.dispatchMonitorEvaluation({
          registration,
          featureFabric: event.featureFabric,
          evaluatedAt: event.emittedAt,
          triggerReason: 'THRESHOLD_CROSSED',
        });
        evaluations += 1;
        if (result.routeResult?.outcome === 'RESEARCH_COMPLETED') {
          triggersRouted += 1;
        } else if (result.evaluation.triggerEmitted && result.routeResult) {
          triggersBlocked += 1;
        }
      }
    }

    const now = this.now();
    for (const registration of this.engineStore.listActiveRegistrations()) {
      const advanced = advanceSchedule(registration, now);
      if (!advanced) {
        continue;
      }
      this.engineStore.putRegistration(advanced);
      schedulesFired += 1;
      this.recordHistory({
        kind: 'SCHEDULE_TICK',
        stage: 'RESEARCH_MONITOR',
        monitorId: registration.monitorId,
        eventId: null,
        triggerEventId: null,
        runId: null,
        detail: `Scheduled re-eval for ${registration.definition.name}`,
      });
      const result = this.dispatchMonitorEvaluation({
        registration: advanced,
        featureFabric: this.defaultScheduleFabric(registration),
        evaluatedAt: now,
        triggerReason: 'SCHEDULED_REEVAL',
      });
      evaluations += 1;
      if (result.routeResult?.outcome === 'RESEARCH_COMPLETED') {
        triggersRouted += 1;
      }
    }

    return Object.freeze({
      processedEvents,
      evaluations,
      triggersRouted,
      triggersBlocked,
      schedulesFired,
    });
  }

  dispatchMonitorEvaluation(input: {
    readonly registration: ProactiveMonitorRegistration;
    readonly featureFabric: import('../types.ts').AafFeatureFabricPort;
    readonly evaluatedAt: UtcInstant;
    readonly triggerReason: 'THRESHOLD_CROSSED' | 'SCHEDULED_REEVAL';
  }): ProactiveDispatchResult {
    const budget = createH20ResearchBudgetPort(this.ports.researchBudget);
    const evaluation = this.monitorService.evaluate({
      definition: input.registration.definition,
      evaluatedAt: input.evaluatedAt,
      featureFabric: input.featureFabric,
      observationFabric: Object.freeze({ observationStoreRef: 'helios-proactive-engine' }),
      researchBudget: budget,
      ...(this.ports.evidenceVault !== undefined ? { evidenceVault: this.ports.evidenceVault } : {}),
    });

    this.recordHistory({
      kind: 'MONITOR_EVALUATED',
      stage: 'RESEARCH_MONITOR',
      monitorId: input.registration.monitorId,
      eventId: null,
      triggerEventId: evaluation.triggerEvent?.triggerEventId ?? null,
      runId: null,
      detail: `Evaluation outcome ${evaluation.outcome}`,
    });

    const monitorState = this.monitorService.getStore().getState(input.registration.monitorId);
    const lifecycle = lifecycleFromMonitorState(input.registration.lifecycle, monitorState);
    this.engineStore.putRegistration(
      Object.freeze({
        ...input.registration,
        lifecycle,
        updatedAt: input.evaluatedAt,
      }),
    );

    if (evaluation.outcome !== 'TRIGGERED' || !evaluation.triggerEvent) {
      return Object.freeze({
        evaluation,
        integrationTrigger: null,
        routeResult: null,
      });
    }

    const integrationTrigger = buildIntegrationTriggerEvent({
      definition: input.registration.definition,
      evaluation,
      triggerRecord: evaluation.triggerEvent,
      customerId: input.registration.customerId,
      subjectId: input.registration.subjectId,
      emittedAt: input.evaluatedAt,
      triggerReason: input.triggerReason,
    });

    const routed = this.triggerRouter.route({
      trigger: integrationTrigger,
      now: input.evaluatedAt,
      mandateBoundWorkOrder: input.registration.mandateBoundWorkOrder,
      researchBudget: this.ports.researchBudget,
      voiContext: this.ports.voiContext,
    });

    let routeResult: ResearchTriggerRunResult | null = null;
    if (routed.ok) {
      routeResult = routed.value;
      const kind = routeResult.outcome === 'RESEARCH_COMPLETED' ? 'TRIGGER_ROUTED' : 'TRIGGER_BLOCKED';
      this.recordHistory({
        kind,
        stage: routeResult.outcome === 'RESEARCH_COMPLETED' ? 'AGENT_RESEARCH' : 'TRIGGER',
        monitorId: input.registration.monitorId,
        eventId: null,
        triggerEventId: integrationTrigger.triggerEventId,
        runId: routeResult.runId,
        detail: `Router outcome ${routeResult.outcome}`,
      });
    }

    return Object.freeze({
      evaluation,
      integrationTrigger,
      routeResult,
    });
  }

  exportSnapshot(): ProactiveResearchEngineSnapshot {
    const partial = this.engineStore.snapshot(this.monitorService.getStore());
    return Object.freeze({
      ...partial,
      triggerRuns: this.triggerRouter.store.listRuns(),
      dedupe: this.triggerRouter.dedupe.snapshot(),
    });
  }

  recoverFromSnapshot(snapshot: ProactiveResearchEngineSnapshot): void {
    this.monitorService.getStore().loadSnapshot(snapshot.monitorStore);
    this.engineStore.loadPartial(snapshot);
    this.triggerRouter.store.restoreRuns(snapshot.triggerRuns);
    this.triggerRouter.dedupe.restore(snapshot.dedupe);
    this.recordHistory({
      kind: 'ENGINE_RECOVERED',
      stage: null,
      monitorId: null,
      eventId: null,
      triggerEventId: null,
      runId: null,
      detail: `Recovered ${snapshot.registrations.length} monitors and ${snapshot.triggerRuns.length} trigger runs`,
    });
  }

  private defaultScheduleFabric(
    registration: ProactiveMonitorRegistration,
  ): import('../types.ts').AafFeatureFabricPort {
    return Object.freeze({
      resolveFeatures: (): readonly CanonicalFeatureObservation[] => {
        const now = this.now();
        return Object.freeze(
          registration.definition.pointInTimeFeatureRequirements.map((req) => {
            const informationTime = Object.freeze({
              sourceEventTime: now,
              sourcePublishedTime: null,
              providerAvailabilityTime: null,
              sunreyArrivalTime: now,
              ingestionTime: now,
              knowableAt: computeKnowableAt({
                providerAvailabilityTime: null,
                sunreyArrivalTime: now,
                ingestionTime: now,
              }),
            });
            return Object.freeze({
              featureId: req.featureId,
              kind: req.requiredKind ?? 'realized_volatility',
              instrumentId: registration.definition.watch[0] ?? null,
              value: '0',
              asOf: now,
              informationTime,
              observationRef: null,
              stale: true,
              missing: true,
            });
          }),
        );
      },
    });
  }

  private recordHistory(input: Omit<ProactivePipelineRecord, 'recordId' | 'recordedAt' | 'evidenceRef'>): void {
    const now = this.now();
    const recordId = `prhist_${createHash('sha256').update(`${input.kind}:${now}:${randomUUID()}`).digest('hex').slice(0, 16)}`;
    const evidenceRef = sealProactivePipelineRecord(this.ports.evidenceVault, {
      recordId,
      ...input,
      recordedAt: now,
      evidenceRef: null,
    });
    this.engineStore.appendHistory(
      Object.freeze({
        recordId,
        ...input,
        recordedAt: now,
        evidenceRef,
      }),
    );
  }
}
