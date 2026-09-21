/**
 * Scheduled event safety hooks — future event blackout windows.
 *
 * Strategies can ask whether high-impact events are approaching and whether
 * execution is allowed during an event window. Hooks only; no automatic trading blocks.
 */

import type { UtcInstant } from '@solstice/domain';
import type { EventImpactSeverity } from './taxonomy.ts';
import type { EventBlackoutWindow, MacroEventArtifact } from './types.ts';
import { isHighImpactDomain } from './calculations.ts';

export function deriveBlackoutWindow(input: {
  readonly event: MacroEventArtifact;
  readonly blackoutId: string;
  readonly severity?: EventImpactSeverity;
  readonly strategyAllowed?: boolean;
}): EventBlackoutWindow | null {
  const anchor = input.event.scheduledTime ?? input.event.observedTime;
  if (!anchor) return null;

  const severity = input.severity ?? (isHighImpactDomain(input.event.domain) ? 'HIGH' : 'MEDIUM');
  const preMs = input.event.relevanceWindow.preEventMinutes * 60_000;
  const postMs = input.event.relevanceWindow.postEventMinutes * 60_000;
  const startsAt = new Date(Date.parse(anchor) - preMs).toISOString() as UtcInstant;
  const endsAt = new Date(Date.parse(anchor) + postMs).toISOString() as UtcInstant;

  return Object.freeze({
    blackoutId: input.blackoutId,
    eventId: input.event.eventId,
    domain: input.event.domain,
    severity,
    startsAt,
    endsAt,
    strategyAllowed: input.strategyAllowed ?? false,
    reason: `Event window for ${input.event.title}`,
  });
}

export function isWithinBlackout(blackout: EventBlackoutWindow, asOf: UtcInstant): boolean {
  const t = Date.parse(asOf);
  return t >= Date.parse(blackout.startsAt) && t <= Date.parse(blackout.endsAt);
}
