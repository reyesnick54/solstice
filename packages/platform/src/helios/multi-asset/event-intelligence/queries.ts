/**
 * Macro event query helpers — upcoming events, stale detection, strategy safety.
 */

import type { MacroEventIntelligenceStore } from './store.ts';
import type {
  StrategyEventSafetyQuery,
  StrategyEventSafetyResult,
  UpcomingEventMatch,
  UpcomingEventQuery,
} from './types.ts';
import {
  isEventStale,
  isHighImpactDomain,
  minutesUntilScheduled,
  resolveEventRelevanceState,
} from './calculations.ts';
import { isWithinBlackout } from './blackout.ts';

const SEVERITY_RANK: Record<string, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };

export function queryUpcomingEvents(
  store: MacroEventIntelligenceStore,
  query: UpcomingEventQuery,
): readonly UpcomingEventMatch[] {
  const horizonMs = query.horizonMinutes * 60_000;
  const asOfMs = Date.parse(query.asOf);
  const matches: UpcomingEventMatch[] = [];

  for (const sealed of store.list()) {
    const event = sealed.artifact;
    if (query.domains && !query.domains.includes(event.domain)) continue;
    if (query.instrumentId && !event.affectedInstrumentIds.includes(query.instrumentId)) continue;
    if (isEventStale({ relevanceWindow: event.relevanceWindow, asOf: query.asOf })) continue;

    const relevanceState = resolveEventRelevanceState({
      scheduledTime: event.scheduledTime,
      observedTime: event.observedTime,
      relevanceWindow: event.relevanceWindow,
      asOf: query.asOf,
    });

    if (relevanceState !== 'UPCOMING' && relevanceState !== 'ACTIVE') continue;

    const minutesUntil = minutesUntilScheduled(event.scheduledTime, query.asOf);
    if (minutesUntil !== null && minutesUntil > query.horizonMinutes) continue;
    if (event.scheduledTime) {
      const delta = Date.parse(event.scheduledTime) - asOfMs;
      if (delta > horizonMs && relevanceState === 'UPCOMING') continue;
    }

    const highImpact = isHighImpactDomain(event.domain);
    if (query.minSeverity) {
      const required = SEVERITY_RANK[query.minSeverity] ?? 0;
      const actual = highImpact ? 3 : 2;
      if (actual < required) continue;
    }

    matches.push(Object.freeze({
      event,
      relevanceState,
      minutesUntilScheduled: minutesUntil,
      highImpact,
    }));
  }

  return Object.freeze(
    matches.sort((a, b) => {
      const aTime = a.event.scheduledTime ? Date.parse(a.event.scheduledTime) : Number.MAX_SAFE_INTEGER;
      const bTime = b.event.scheduledTime ? Date.parse(b.event.scheduledTime) : Number.MAX_SAFE_INTEGER;
      return aTime - bTime;
    }),
  );
}

export function assessStrategyEventSafety(
  store: MacroEventIntelligenceStore,
  query: StrategyEventSafetyQuery,
): StrategyEventSafetyResult {
  const instrumentId = query.instrumentIds[0];
  const upcoming = queryUpcomingEvents(store, {
    asOf: query.asOf,
    horizonMinutes: 240,
    ...(instrumentId !== undefined ? { instrumentId } : {}),
  });

  const activeBlackouts = store.listBlackouts().filter((b) => isWithinBlackout(b, query.asOf));
  const approachingHighImpact = upcoming.some((m) => m.highImpact && (m.minutesUntilScheduled ?? 999) <= 60);

  const blockedByBlackout = activeBlackouts.some((b) => !b.strategyAllowed);
  const allowed = !blockedByBlackout;

  let reason = 'No active event restrictions';
  if (blockedByBlackout) reason = 'Strategy blocked by active event blackout window';
  else if (approachingHighImpact) reason = 'High-impact event approaching — review recommended';

  return Object.freeze({
    strategyId: query.strategyId,
    allowed,
    approachingHighImpactEvent: approachingHighImpact,
    activeBlackouts: Object.freeze([...activeBlackouts]),
    upcomingEvents: Object.freeze([...upcoming]),
    reason,
  });
}

export function detectConflictingSources(store: MacroEventIntelligenceStore, eventId: string): readonly string[] {
  const sealed = store.get(eventId);
  if (!sealed) return Object.freeze([]);

  const actualByMetric = new Map<string, Set<string>>();
  for (const actual of sealed.artifact.actualValues) {
    const sources = actualByMetric.get(actual.metricId) ?? new Set<string>();
    sources.add(actual.sourceId);
    actualByMetric.set(actual.metricId, sources);
  }

  const conflicts: string[] = [];
  for (const [metricId, sources] of actualByMetric) {
    if (sources.size > 1) conflicts.push(metricId);
  }
  return Object.freeze(conflicts);
}
