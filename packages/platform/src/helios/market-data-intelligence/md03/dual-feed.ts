import type { UtcInstant } from '@solstice/domain';
import type { Md03DualFeedArbitration, Md03FeedIdentity, Md03SequenceState } from './types.ts';
import type { Md03FeedRole } from './taxonomy.ts';

export const DEFAULT_MD03_DUAL_FEED_ARBITRATION: Md03DualFeedArbitration = Object.freeze({
  preferredRole: 'PRIMARY',
  secondaryUsableWhenPrimaryStale: true,
  maxSkewMs: 2_000,
});

function feedFreshnessMs(sequence: Md03SequenceState, now: UtcInstant): number | null {
  if (sequence.lastAppliedAt === null) {
    return null;
  }
  return Date.parse(now) - Date.parse(sequence.lastAppliedAt);
}

export function selectMd03ActiveFeedRole(input: {
  readonly primary: Md03SequenceState;
  readonly secondary: Md03SequenceState;
  readonly arbitration: Md03DualFeedArbitration;
  readonly now: UtcInstant;
}): Md03FeedRole {
  const primaryAge = feedFreshnessMs(input.primary, input.now);
  const secondaryAge = feedFreshnessMs(input.secondary, input.now);

  if (primaryAge !== null && primaryAge <= input.arbitration.maxSkewMs) {
    return 'PRIMARY';
  }
  if (
    input.arbitration.secondaryUsableWhenPrimaryStale &&
    secondaryAge !== null &&
    secondaryAge <= input.arbitration.maxSkewMs
  ) {
    return 'SECONDARY';
  }
  if (input.secondary.lastSequence > input.primary.lastSequence) {
    return 'SECONDARY';
  }
  return input.arbitration.preferredRole;
}

export function feedsAreConsistent(input: {
  readonly primary: Md03FeedIdentity;
  readonly secondary: Md03FeedIdentity;
}): boolean {
  return input.primary.venueId === input.secondary.venueId && input.primary.channel === input.secondary.channel;
}
