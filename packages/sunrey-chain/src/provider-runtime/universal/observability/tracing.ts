/**
 * Distributed tracing bridge for provider calls.
 */

import { TraceCollector, type SpanRecord } from '../../../ops/observability.ts';
import { sanitizeTraceAttributes } from './logging.ts';

export type ProviderTraceContext = {
  readonly traceId: string;
  readonly requestId: string;
  readonly parentSpan?: SpanRecord;
};

export class ProviderTraceBridge {
  readonly #collector: TraceCollector;
  readonly #service: string;

  constructor(collector: TraceCollector = new TraceCollector(), service = 'sunrey-provider-runtime') {
    this.#collector = collector;
    this.#service = service;
  }

  collector(): TraceCollector {
    return this.#collector;
  }

  startConsumerSpan(name: string, context: ProviderTraceContext): SpanRecord {
    return this.#collector.start(
      name,
      'sunrey-consumer-bff',
      context.parentSpan,
      sanitizeTraceAttributes({
        requestId: context.requestId,
        traceId: context.traceId,
      }),
    );
  }

  startDomainSpan(name: string, parent: SpanRecord): SpanRecord {
    return this.#collector.start(name, 'sunrey-domain-service', parent, sanitizeTraceAttributes({}));
  }

  startRegistrySpan(parent: SpanRecord): SpanRecord {
    return this.#collector.start('provider.registry.route', 'sunrey-provider-registry', parent, {});
  }

  startAdapterSpan(providerId: string, capability: string, parent: SpanRecord): SpanRecord {
    return this.#collector.start(
      'provider.adapter.execute',
      'sunrey-provider-adapter',
      parent,
      sanitizeTraceAttributes({ providerId, capability }),
    );
  }

  startTransportSpan(providerId: string, parent: SpanRecord): SpanRecord {
    return this.#collector.start(
      'provider.transport.request',
      'sunrey-provider-transport',
      parent,
      sanitizeTraceAttributes({ providerId }),
    );
  }

  providerCallChain(context: ProviderTraceContext, input: {
    readonly domain: string;
    readonly providerId: string;
    readonly capability: string;
  }): readonly SpanRecord[] {
    const bff = this.startConsumerSpan(`${input.domain}.request`, context);
    const domain = this.startDomainSpan(`${input.domain}.service`, bff);
    const registry = this.startRegistrySpan(domain);
    const adapter = this.startAdapterSpan(input.providerId, input.capability, registry);
    const transport = this.startTransportSpan(input.providerId, adapter);
    return Object.freeze([bff, domain, registry, adapter, transport]);
  }
}
