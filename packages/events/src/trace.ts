import {
  asCausationId,
  asCorrelationId,
  ENVELOPE_ENVIRONMENT,
  type CausationId,
  type CorrelationId,
  type EnvelopeEnvironment,
  type EnvelopeHints,
} from './envelope.ts';

/**
 * Correlation plane for a customer transaction.
 *
 * API request → policy → workflow → provider → Ledger → notification
 * is traced by these three ids. Secrets never belong here.
 */
export type TraceContext = {
  readonly requestId: string;
  readonly correlationId: CorrelationId;
  readonly causationId: CausationId | null;
  readonly environment: EnvelopeEnvironment;
};

export function createTraceContext(input: {
  readonly requestId: string;
  readonly correlationId?: string;
  readonly causationId?: string | null;
}): TraceContext {
  if (input.requestId.length === 0) {
    throw new TypeError('requestId must be a non-empty string');
  }
  return Object.freeze({
    requestId: input.requestId,
    correlationId: asCorrelationId(input.correlationId ?? input.requestId),
    causationId: input.causationId ? asCausationId(input.causationId) : null,
    environment: ENVELOPE_ENVIRONMENT,
  });
}

export function propagateTrace(parent: TraceContext, nextCausationId: string): TraceContext {
  return Object.freeze({
    requestId: parent.requestId,
    correlationId: parent.correlationId,
    causationId: asCausationId(nextCausationId),
    environment: ENVELOPE_ENVIRONMENT,
  });
}

export function envelopeTraceHints(trace: TraceContext): EnvelopeHints {
  return {
    requestId: trace.requestId,
    correlationId: trace.correlationId,
    causationId: trace.causationId,
    environment: ENVELOPE_ENVIRONMENT,
  };
}

export function assertNoSecretInTrace(value: Readonly<Record<string, string>>): void {
  const forbidden = ['secret', 'signature', 'password', 'privateKey', 'accessToken', 'rawBody'];
  for (const key of Object.keys(value)) {
    if (forbidden.includes(key)) {
      throw new Error(`trace context must not include '${key}'`);
    }
  }
}
