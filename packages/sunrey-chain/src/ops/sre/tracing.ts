import { TraceCollector, type SpanRecord } from '../observability.ts';
import { buildAuthorityLineage, correlateTrace } from '../control-room/correlation.ts';
import type { AuthorityLineage } from '../control-room/types.ts';

export const CRITICAL_TRACE_FLOWS = [
  'API_KERNEL_LEDGER',
  'AGENT_PROPOSAL',
  'EXCHANGE_SETTLEMENT',
] as const;
export type CriticalTraceFlow = (typeof CRITICAL_TRACE_FLOWS)[number];

export type TracedFlow = {
  readonly flow: CriticalTraceFlow;
  readonly traceId: string;
  readonly spans: readonly SpanRecord[];
  readonly lineage: AuthorityLineage | null;
};

const API_KERNEL_STEPS = [
  { name: 'api.request', service: 'sunrey-platform-api' },
  { name: 'kernel.submit', service: 'sunrey-kernel' },
  { name: 'execution_authority.verify', service: 'sunrey-permissions' },
  { name: 'domain.execute', service: 'sunrey-accounts' },
  { name: 'provider.submit', service: 'sunrey-payments' },
  { name: 'ledger.post_journal', service: 'sunrey-ledger' },
  { name: 'events.outbox', service: 'sunrey-events' },
  { name: 'evidence.seal', service: 'sunrey-evidence' },
] as const;

const AGENT_STEPS = [
  { name: 'agent.request', service: 'sunrey-agent' },
  { name: 'model.infer', service: 'sunrey-ai-runtime' },
  { name: 'tool.invoke', service: 'sunrey-agent' },
  { name: 'proposal.gate', service: 'sunrey-agent' },
  { name: 'human.consider', service: 'sunrey-agent' },
] as const;

const EXCHANGE_STEPS = [
  { name: 'exchange.order', service: 'sunrey-exchange' },
  { name: 'exchange.match', service: 'sunrey-exchange' },
  { name: 'exchange.settle', service: 'sunrey-exchange' },
  { name: 'custody.or.chain', service: 'sunrey-custody' },
] as const;

export function traceCriticalFlow(
  traces: TraceCollector,
  flow: CriticalTraceFlow,
  refs: {
    readonly requestId: string;
    readonly correlationId: string;
    readonly intentId?: string;
    readonly evidenceId?: string;
    readonly eventId?: string;
    readonly operationId?: string;
  },
): TracedFlow {
  const steps = stepsFor(flow);
  const spans: SpanRecord[] = [];
  let parent: SpanRecord | undefined;
  for (const step of steps) {
    const span = traces.start(step.name, step.service, parent, { flow });
    const correlated = correlateTrace(span, {
      requestId: refs.requestId,
      correlationId: refs.correlationId,
      traceId: span.traceId,
      ...(refs.intentId !== undefined ? { intentId: refs.intentId } : {}),
      ...(refs.evidenceId !== undefined ? { evidenceId: refs.evidenceId } : {}),
      ...(refs.eventId !== undefined ? { eventId: refs.eventId } : {}),
      ...(refs.operationId !== undefined ? { operationId: refs.operationId } : {}),
    });
    spans.push(correlated);
    parent = span;
  }
  const traceId = spans[0]?.traceId ?? '';
  const lineage =
    flow === 'API_KERNEL_LEDGER'
      ? buildAuthorityLineage({
          requestId: refs.requestId,
          intentId: refs.intentId ?? 'intent_trace',
          kernelDecision: 'ALLOW',
          executionAuthorityRef: 'ea_ref_trace',
          mutationRef: 'journal_or_domain_ref',
          evidenceId: refs.evidenceId ?? 'ev_trace',
          eventId: refs.eventId ?? 'evt_trace',
        })
      : null;
  return Object.freeze({ flow, traceId, spans: Object.freeze(spans), lineage });
}

export function tracePropagated(flow: TracedFlow): boolean {
  if (flow.spans.length === 0) {
    return false;
  }
  const traceId = flow.spans[0]!.traceId;
  return flow.spans.every((span) => span.traceId === traceId);
}

function stepsFor(flow: CriticalTraceFlow) {
  switch (flow) {
    case 'API_KERNEL_LEDGER':
      return API_KERNEL_STEPS;
    case 'AGENT_PROPOSAL':
      return AGENT_STEPS;
    case 'EXCHANGE_SETTLEMENT':
      return EXCHANGE_STEPS;
  }
}
