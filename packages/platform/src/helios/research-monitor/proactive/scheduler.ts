import type { UtcInstant } from '@solstice/domain';
import type { ProactiveMonitorRegistration } from './types.ts';

export function advanceSchedule(
  registration: ProactiveMonitorRegistration,
  now: UtcInstant,
): ProactiveMonitorRegistration | null {
  if (!registration.schedule) {
    return null;
  }
  const nowMs = Date.parse(now);
  const fireMs = Date.parse(registration.schedule.nextFireAt);
  if (!Number.isFinite(nowMs) || !Number.isFinite(fireMs) || nowMs < fireMs) {
    return null;
  }
  const nextFireAt = new Date(nowMs + registration.schedule.intervalMs).toISOString() as UtcInstant;
  return Object.freeze({
    ...registration,
    schedule: Object.freeze({
      intervalMs: registration.schedule.intervalMs,
      nextFireAt,
    }),
    updatedAt: now,
  });
}

export function seedSchedule(
  registration: ProactiveMonitorRegistration,
  now: UtcInstant,
  intervalMs: number,
): ProactiveMonitorRegistration {
  const nextFireAt = new Date(Date.parse(now) + intervalMs).toISOString() as UtcInstant;
  return Object.freeze({
    ...registration,
    schedule: Object.freeze({ intervalMs, nextFireAt }),
    updatedAt: now,
  });
}

export type ProactiveCampaignSchedule = {
  readonly intervalMs: number;
  readonly nextFireAt: UtcInstant;
};

function advanceBindingSchedule<T extends { readonly updatedAt: UtcInstant }>(
  binding: T & {
    readonly evaluationSchedule?: ProactiveCampaignSchedule | null;
    readonly marketSessionSchedule?: ProactiveCampaignSchedule | null;
    readonly outcomeMaturitySchedule?: ProactiveCampaignSchedule | null;
  },
  now: UtcInstant,
  field: 'evaluationSchedule' | 'marketSessionSchedule' | 'outcomeMaturitySchedule',
): (T & { readonly updatedAt: UtcInstant }) | null {
  const schedule = binding[field];
  if (!schedule) return null;
  const nowMs = Date.parse(now);
  const fireMs = Date.parse(schedule.nextFireAt);
  if (!Number.isFinite(nowMs) || !Number.isFinite(fireMs) || nowMs < fireMs) {
    return null;
  }
  const nextFireAt = new Date(nowMs + schedule.intervalMs).toISOString() as UtcInstant;
  return Object.freeze({
    ...binding,
    [field]: Object.freeze({ intervalMs: schedule.intervalMs, nextFireAt }),
    updatedAt: now,
  }) as T & { readonly updatedAt: UtcInstant };
}

export function advanceCampaignEvaluationSchedule<T extends {
  readonly evaluationSchedule: ProactiveCampaignSchedule | null;
  readonly updatedAt: UtcInstant;
}>(binding: T, now: UtcInstant): T | null {
  return advanceBindingSchedule(binding, now, 'evaluationSchedule');
}

export function advanceMarketSessionSchedule<T extends {
  readonly marketSessionSchedule: ProactiveCampaignSchedule | null;
  readonly updatedAt: UtcInstant;
}>(binding: T, now: UtcInstant): T | null {
  return advanceBindingSchedule(binding, now, 'marketSessionSchedule');
}

export function advanceOutcomeMaturitySchedule<T extends {
  readonly outcomeMaturitySchedule: ProactiveCampaignSchedule | null;
  readonly updatedAt: UtcInstant;
}>(binding: T, now: UtcInstant): T | null {
  return advanceBindingSchedule(binding, now, 'outcomeMaturitySchedule');
}
