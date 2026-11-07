import type { UtcInstant } from '@solstice/domain';
import type { Md09SequenceIntegrity } from './types.ts';
import type { Md09VenueHealthState } from './taxonomy.ts';

export function assessMd09VenueHealth(input: {
  readonly observedAtUtc: UtcInstant;
  readonly eventTimeUtc: string;
  readonly sequenceIntegrity: Md09SequenceIntegrity;
  readonly venueOnline: boolean;
  readonly staleThresholdMs?: number;
}): Md09VenueHealthState {
  const staleMs = input.staleThresholdMs ?? 120_000;
  const eventMs = Date.parse(input.eventTimeUtc);
  const observedMs = Date.parse(input.observedAtUtc);
  if (!input.venueOnline) {
    return 'UNAVAILABLE';
  }
  if (!Number.isFinite(eventMs)) {
    return 'DEGRADED';
  }
  if (observedMs - eventMs > staleMs) {
    return 'STALE';
  }
  if (input.sequenceIntegrity.resyncRequired || input.sequenceIntegrity.gapDetected) {
    return 'DESYNCHRONIZED';
  }
  if (input.sequenceIntegrity.gapDetected) {
    return 'DESYNCHRONIZED';
  }
  return 'NORMAL';
}
