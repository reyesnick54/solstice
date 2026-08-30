/**
 * Scheduled refresh tracker for provider data pipelines.
 */

export type RefreshSchedule = {
  readonly providerId: string;
  readonly scheduleId: string;
  readonly intervalMs: number;
  readonly lastAttemptAt: string | null;
  readonly lastSuccessAt: string | null;
  readonly consecutiveFailures: number;
};

export class ProviderSchedulerTracker {
  readonly #schedules = new Map<string, RefreshSchedule>();

  register(input: {
    readonly providerId: string;
    readonly scheduleId: string;
    readonly intervalMs: number;
  }): RefreshSchedule {
    const schedule = Object.freeze({
      providerId: input.providerId,
      scheduleId: input.scheduleId,
      intervalMs: input.intervalMs,
      lastAttemptAt: null,
      lastSuccessAt: null,
      consecutiveFailures: 0,
    });
    this.#schedules.set(input.scheduleId, schedule);
    return schedule;
  }

  recordAttempt(scheduleId: string, nowUtc: string, success: boolean): RefreshSchedule {
    const current = this.#schedules.get(scheduleId);
    if (!current) {
      throw new Error(`schedule ${scheduleId} is not registered`);
    }
    const next = Object.freeze({
      ...current,
      lastAttemptAt: nowUtc,
      lastSuccessAt: success ? nowUtc : current.lastSuccessAt,
      consecutiveFailures: success ? 0 : current.consecutiveFailures + 1,
    });
    this.#schedules.set(scheduleId, next);
    return next;
  }

  get(scheduleId: string): RefreshSchedule | undefined {
    return this.#schedules.get(scheduleId);
  }

  forProvider(providerId: string): readonly RefreshSchedule[] {
    return Object.freeze([...this.#schedules.values()].filter((row) => row.providerId === providerId));
  }

  isFailing(scheduleId: string, threshold = 3): boolean {
    const schedule = this.#schedules.get(scheduleId);
    return schedule ? schedule.consecutiveFailures >= threshold : false;
  }
}
