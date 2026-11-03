/**
 * NATIVE11 — Seris-inspired native agent inference plane (Chunk 101 extension).
 * Not a second Model Gateway or Execution Authority.
 */

export const HELIOS_NATIVE_AGENT_RUNTIME_SCHEMA =
  'sunrey.helios.native-agent-runtime.v1' as const;

export const HELIOS_NATIVE_AGENT_RUNTIME_QUALIFIED =
  'HELIOS_NATIVE_AGENT_RUNTIME_QUALIFIED' as const;

export const HELIOS_NATIVE_AGENT_RUNTIME_BLOCKED =
  'HELIOS_NATIVE_AGENT_RUNTIME_BLOCKED' as const;

/** Seris upstream attribution for pattern lineage only. */
export const NATIVE11_SERIS_UPSTREAM = Object.freeze({
  repository: 'aowang-ai/seris',
  referenceSha: 'f73dbbb0cd7e3b52601abf905bb871cdb9098550',
  license: 'Apache-2.0',
  adaptedSurfaces: Object.freeze([
    'provider-neutral gateway composition (loop/modelFactory)',
    'session-scoped cancellation and usage accounting',
    'bounded inference retry budgets',
  ]),
});

export const DEFAULT_INFERENCE_RETRY_BUDGET = Object.freeze({
  maxAttempts: 3,
  maxRetryableFailures: 2,
});

export const NATIVE_SESSION_GATEWAY_OUTCOMES = ['SUCCESS', 'FAILURE', 'CANCELLED'] as const;
export type NativeSessionGatewayOutcome = (typeof NATIVE_SESSION_GATEWAY_OUTCOMES)[number];
