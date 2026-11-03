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
