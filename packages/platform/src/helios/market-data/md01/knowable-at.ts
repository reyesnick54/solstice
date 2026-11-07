import type { UtcInstant } from '@solstice/domain';
import type { CanonicalMarketDataEvent } from '@solstice/provider-sdk';

export function assertMarketEventKnowableAtDecision(
  decisionTime: UtcInstant,
  event: CanonicalMarketDataEvent,
): { readonly ok: true } | { readonly ok: false; readonly code: 'NOT_YET_KNOWABLE'; readonly message: string } {
  if (event.knowableAt > decisionTime) {
    return {
      ok: false,
      code: 'NOT_YET_KNOWABLE',
      message: `event ${event.eventId} knowableAt ${event.knowableAt} after decision ${decisionTime}`,
    };
  }
  return { ok: true };
}

export function rejectKnowableFromEventTimeAlone(event: CanonicalMarketDataEvent): boolean {
  return event.knowableAt >= event.sunreyReceiveTime;
}
