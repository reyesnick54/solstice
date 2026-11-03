/**
 * HELIOS NATIVE05 — WebSocket lifecycle, sequencing, heartbeat, rate limits, and retry posture.
 */

export type VenueWebSocketLifecycleState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'paused'
  | 'closed';

export type VenueSequencePolicy = Readonly<{
  /** When true, gaps in sequence numbers must trigger resync (snapshot + deltas). */
  readonly strictMonotonic: boolean;
  /** When true, duplicate sequence numbers are ignored. */
  readonly dedupeDuplicates: boolean;
  readonly resyncOnGap: boolean;
}>;

export type VenueHeartbeatPolicy = Readonly<{
  readonly intervalMs: number;
  readonly timeoutMs: number;
  readonly clientPingRequired: boolean;
}>;

export type VenueRateLimitPolicy = Readonly<{
  readonly restRequestsPerSecond: number | null;
  readonly websocketSubscriptionsMax: number | null;
  readonly orderRequestsPerSecond: number | null;
  readonly notes: string | null;
}>;

export type VenueRetryPolicy = Readonly<{
  readonly maxAttempts: number;
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
  readonly retryableHttpStatuses: readonly number[];
}>;

export type VenueConnectivityProfile = Readonly<{
  readonly websocketLifecycle: readonly VenueWebSocketLifecycleState[];
  readonly sequence: VenueSequencePolicy;
  readonly heartbeat: VenueHeartbeatPolicy;
  readonly rateLimits: VenueRateLimitPolicy;
  readonly retry: VenueRetryPolicy;
}>;

export const DEFAULT_VENUE_RETRY_POLICY: VenueRetryPolicy = Object.freeze({
  maxAttempts: 3,
  baseDelayMs: 250,
  maxDelayMs: 4_000,
  retryableHttpStatuses: Object.freeze([408, 429, 500, 502, 503, 504]),
});

export const DEFAULT_VENUE_HEARTBEAT_POLICY: VenueHeartbeatPolicy = Object.freeze({
  intervalMs: 30_000,
  timeoutMs: 10_000,
  clientPingRequired: false,
});

export const DEFAULT_VENUE_SEQUENCE_POLICY: VenueSequencePolicy = Object.freeze({
  strictMonotonic: true,
  dedupeDuplicates: true,
  resyncOnGap: true,
});
