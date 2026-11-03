import type { UtcInstant } from '@solstice/domain';
import type { SerisProactiveInvestigation } from './seris-proactive-bridge.ts';

/** Simulation-only market observation port (no live Seris Hyperliquid/Binance calls). */
export type SerisMarketObservationPort = {
  readonly observe: (input: {
    readonly watch: readonly string[];
    readonly evaluatedAt: UtcInstant;
  }) => Promise<Readonly<Record<string, unknown>>>;
};

export type SerisResearchAutopilotTick = {
  readonly tickAt: UtcInstant;
  readonly ok: boolean;
  readonly summary: string;
  readonly observed: Readonly<Record<string, unknown>>;
  readonly shouldRequestResearch: boolean;
  readonly researchObjective: string | null;
  readonly notifications: readonly string[];
  readonly fundMovementRequested: false;
};

const MIN_AUTOPILOT_INTERVAL_MS = 5_000;

export type SerisResearchAutopilotSchedule = {
  readonly scheduleId: string;
  readonly investigation: SerisProactiveInvestigation;
  readonly intervalMs: number;
  readonly status: 'ACTIVE' | 'PAUSED';
  readonly lastTickAt: UtcInstant | null;
  readonly runCount: number;
  readonly history: readonly SerisResearchAutopilotTick[];
};

export class SerisResearchAutopilotLoop {
  readonly #schedules = new Map<string, SerisResearchAutopilotSchedule>();
  readonly #historyCap = 50;

  register(input: {
    readonly scheduleId: string;
    readonly investigation: SerisProactiveInvestigation;
    readonly intervalMs: number;
  }): SerisResearchAutopilotSchedule {
    if (input.intervalMs < MIN_AUTOPILOT_INTERVAL_MS) {
      throw new Error(`research autopilot interval must be at least ${MIN_AUTOPILOT_INTERVAL_MS}ms`);
    }
    const schedule: SerisResearchAutopilotSchedule = Object.freeze({
      scheduleId: input.scheduleId,
      investigation: input.investigation,
      intervalMs: input.intervalMs,
      status: 'ACTIVE',
      lastTickAt: null,
      runCount: 0,
      history: Object.freeze([]),
    });
    this.#schedules.set(input.scheduleId, schedule);
    return schedule;
  }

  get(scheduleId: string): SerisResearchAutopilotSchedule | undefined {
    return this.#schedules.get(scheduleId);
  }

  async tick(input: {
    readonly scheduleId: string;
    readonly now: UtcInstant;
    readonly market: SerisMarketObservationPort;
    readonly metricThreshold?: number;
  }): Promise<SerisResearchAutopilotTick | null> {
    const schedule = this.#schedules.get(input.scheduleId);
    if (!schedule || schedule.status !== 'ACTIVE') {
      return null;
    }
    const nowMs = Date.parse(input.now);
    const lastMs = schedule.lastTickAt ? Date.parse(schedule.lastTickAt) : 0;
    if (Number.isFinite(nowMs) && Number.isFinite(lastMs) && nowMs - lastMs < schedule.intervalMs) {
      return null;
    }

    const observed = await input.market.observe({
      watch: schedule.investigation.marketWatch,
      evaluatedAt: input.now,
    });
    const metric = typeof observed.primaryMetric === 'number' ? observed.primaryMetric : null;
    const threshold = input.metricThreshold ?? 1;
    const shouldRequestResearch = metric !== null && Math.abs(metric) >= threshold;
    const tick: SerisResearchAutopilotTick = Object.freeze({
      tickAt: input.now,
      ok: true,
      summary: shouldRequestResearch
        ? `${schedule.investigation.researchTopic}: metric ${metric} crossed research threshold`
        : `${schedule.investigation.researchTopic}: observing`,
      observed,
      shouldRequestResearch,
      researchObjective: shouldRequestResearch ? schedule.investigation.researchTopic : null,
      notifications: Object.freeze(
        shouldRequestResearch ? [`research-autopilot:${schedule.investigation.monitorId}:investigate`] : [],
      ),
      fundMovementRequested: false,
    });

    const history = [tick, ...schedule.history].slice(0, this.#historyCap);
    this.#schedules.set(
      input.scheduleId,
      Object.freeze({
        ...schedule,
        lastTickAt: input.now,
        runCount: schedule.runCount + 1,
        history: Object.freeze(history),
      }),
    );
    return tick;
  }
}
