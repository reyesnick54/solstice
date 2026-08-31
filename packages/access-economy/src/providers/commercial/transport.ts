/**
 * Commercial provider transport boundary.
 *
 * Injected fixture transport only — no live network in CI.
 */

export type CommercialProviderTransportRequest = {
  readonly method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  readonly path: string;
  readonly body?: Record<string, unknown>;
  readonly idempotencyKey?: string;
};

export type CommercialProviderTransportResponse = {
  readonly status: number;
  readonly body: Record<string, unknown>;
  readonly timedOut?: boolean;
};

export type CommercialProviderTransport = {
  readonly kind: 'FIXTURE' | 'SCRIPTED' | 'INJECTED_NETWORK';
  readonly networkEnabled: boolean;
  execute(request: CommercialProviderTransportRequest): CommercialProviderTransportResponse;
};

export function createFixtureCommercialTransport(
  handlers: Record<string, (request: CommercialProviderTransportRequest) => CommercialProviderTransportResponse>,
): CommercialProviderTransport {
  return Object.freeze({
    kind: 'FIXTURE',
    networkEnabled: false,
    execute(request) {
      const key = `${request.method}:${request.path}`;
      const handler = handlers[key];
      if (!handler) {
        return Object.freeze({ status: 404, body: Object.freeze({ error: 'fixture_not_found' }) });
      }
      return handler(request);
    },
  });
}
