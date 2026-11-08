import { randomUUID } from 'node:crypto';

import type { Clock } from '@solstice/config';
import type { UtcInstant } from '@solstice/domain';
import {
  ForwardCampaignOrchestrator,
  type CampaignOrchestratorSnapshot,
  type CampaignRuntimeTickResult,
  type CampaignTriggerKind,
  type ForwardCampaignOrchestratorPorts,
} from '@solstice/strategy-lab';

import {
  advanceCampaignEvaluationSchedule,
  advanceMarketSessionSchedule,
  advanceOutcomeMaturitySchedule,
  type ProactiveCampaignSchedule,
} from './scheduler.ts';
import type { MarketFeatureEvent, ProactiveCampaignTickResult, ProactiveForwardCampaignBinding } from './types.ts';

export type { ProactiveForwardCampaignBinding, ProactiveCampaignTickResult } from './types.ts';

export class ProactiveForwardCampaignCoordinator {
  readonly orchestrator: ForwardCampaignOrchestrator;
  private readonly clock: Clock;
  private readonly bindings = new Map<string, ProactiveForwardCampaignBinding>();

  constructor(ports: ForwardCampaignOrchestratorPorts) {
    this.orchestrator = new ForwardCampaignOrchestrator(ports);
    this.clock = ports.clock;
  }

  now(): UtcInstant {
    return this.clock.now();
  }

  bindCampaign(input: {
    readonly campaignId: string;
    readonly ownerId: string;
    readonly evaluationIntervalMs?: number;
    readonly marketSessionIntervalMs?: number;
    readonly outcomeMaturityIntervalMs?: number;
  }): ProactiveForwardCampaignBinding {
    const now = this.now();
    const evaluationSchedule =
      input.evaluationIntervalMs !== undefined
        ? Object.freeze({
            intervalMs: input.evaluationIntervalMs,
            nextFireAt: new Date(Date.parse(now) + input.evaluationIntervalMs).toISOString() as UtcInstant,
          })
        : null;
    const marketSessionSchedule =
      input.marketSessionIntervalMs !== undefined
        ? Object.freeze({
            intervalMs: input.marketSessionIntervalMs,
            nextFireAt: new Date(Date.parse(now) + input.marketSessionIntervalMs).toISOString() as UtcInstant,
          })
        : null;
    const outcomeMaturitySchedule =
      input.outcomeMaturityIntervalMs !== undefined
        ? Object.freeze({
            intervalMs: input.outcomeMaturityIntervalMs,
            nextFireAt: new Date(Date.parse(now) + input.outcomeMaturityIntervalMs).toISOString() as UtcInstant,
          })
        : null;
    const binding: ProactiveForwardCampaignBinding = Object.freeze({
      bindingId: `pfcamp_${randomUUID().slice(0, 12)}`,
      campaignId: input.campaignId,
      ownerId: input.ownerId,
      evaluationSchedule,
      marketSessionSchedule,
      outcomeMaturitySchedule,
      active: true,
      registeredAt: now,
      updatedAt: now,
    });
    this.bindings.set(binding.bindingId, binding);
    return binding;
  }

  listBindings(): readonly ProactiveForwardCampaignBinding[] {
    return Object.freeze([...this.bindings.values()]);
  }

  putBinding(binding: ProactiveForwardCampaignBinding): void {
    this.bindings.set(binding.bindingId, binding);
  }

  enqueueMarketEventTrigger(event: MarketFeatureEvent): number {
    let count = 0;
    for (const binding of this.bindings.values()) {
      if (!binding.active) continue;
      const result = this.orchestrator.enqueueTrigger({
        campaignId: binding.campaignId as import('@solstice/strategy-lab').ForwardAlphaCampaignId,
        triggerKind: 'EVENT_DRIVEN',
        notBefore: event.emittedAt,
        boundaryKey: `market:${event.eventId}`,
      });
      if (!('code' in result)) count += 1;
    }
    return count;
  }

  tickCampaigns(input?: { readonly workLimit?: number }): ProactiveCampaignTickResult {
    const now = this.now();
    let evaluationSchedulesFired = 0;
    let marketSessionSchedulesFired = 0;
    let outcomeMaturitySchedulesFired = 0;
    let eventTriggersEnqueued = 0;

    for (const [bindingId, binding] of this.bindings.entries()) {
      if (!binding.active) continue;
      let next = binding;
      if (binding.evaluationSchedule) {
        const advanced = advanceCampaignEvaluationSchedule(binding, now);
        if (advanced) {
          next = Object.freeze({ ...advanced, bindingId });
          evaluationSchedulesFired += 1;
          const enqueued = this.orchestrator.enqueueTrigger({
            campaignId: binding.campaignId as import('@solstice/strategy-lab').ForwardAlphaCampaignId,
            triggerKind: 'SCHEDULED_EVALUATION',
          });
          if (!('code' in enqueued)) eventTriggersEnqueued += 1;
        }
      }
      if (next.marketSessionSchedule) {
        const advanced = advanceMarketSessionSchedule(next, now);
        if (advanced) {
          next = Object.freeze({ ...advanced, bindingId });
          marketSessionSchedulesFired += 1;
          const enqueued = this.orchestrator.enqueueTrigger({
            campaignId: binding.campaignId as import('@solstice/strategy-lab').ForwardAlphaCampaignId,
            triggerKind: 'MARKET_SESSION',
          });
          if (!('code' in enqueued)) eventTriggersEnqueued += 1;
        }
      }
      if (next.outcomeMaturitySchedule) {
        const advanced = advanceOutcomeMaturitySchedule(next, now);
        if (advanced) {
          next = Object.freeze({ ...advanced, bindingId });
          outcomeMaturitySchedulesFired += 1;
          const enqueued = this.orchestrator.enqueueTrigger({
            campaignId: binding.campaignId as import('@solstice/strategy-lab').ForwardAlphaCampaignId,
            triggerKind: 'OUTCOME_MATURITY',
          });
          if (!('code' in enqueued)) eventTriggersEnqueued += 1;
        }
      }
      this.bindings.set(bindingId, next);
    }

    const owners = new Set([...this.bindings.values()].filter((row) => row.active).map((row) => row.ownerId));
    const tickResults: CampaignRuntimeTickResult[] = [];
    for (const ownerId of owners) {
      const passes = this.orchestrator.drainDueWork({
        ownerId,
        limit: input?.workLimit ?? 8,
      });
      for (const pass of passes) {
        if (pass.ok) tickResults.push(pass.value);
      }
    }

    return Object.freeze({
      evaluationSchedulesFired,
      marketSessionSchedulesFired,
      outcomeMaturitySchedulesFired,
      eventTriggersEnqueued,
      runtimePasses: tickResults.length,
      tickResults: Object.freeze(tickResults),
    });
  }

  exportOrchestratorSnapshot(): CampaignOrchestratorSnapshot {
    return this.orchestrator.exportSnapshot();
  }

  loadOrchestratorSnapshot(snapshot: CampaignOrchestratorSnapshot): void {
    this.orchestrator.loadSnapshot(snapshot);
  }
}

export function campaignTriggerLabel(kind: CampaignTriggerKind): string {
  switch (kind) {
    case 'EVENT_DRIVEN':
      return 'event-driven';
    case 'MARKET_SESSION':
      return 'market-session';
    case 'SCHEDULED_EVALUATION':
      return 'scheduled-evaluation';
    case 'OUTCOME_MATURITY':
      return 'outcome-maturity';
    default:
      return kind;
  }
}
