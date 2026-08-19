/**
 * Injectable ExternalHttpTransport.
 *
 * Unit tests and the default CI runtime inject a deterministic fake.
 * The fake never contacts the public internet.
 */

import { err, ok, type Result } from '../../../../domain/src/result.ts';
import type { ProductionOracleRejection } from './types.ts';
import type { ExternalHttpRequest, ExternalHttpResponse, ExternalHttpTransport } from './runtime-types.ts';

export type FakeTransportHandler = (
  request: ExternalHttpRequest,
) => Promise<Result<ExternalHttpResponse, ProductionOracleRejection>> | Result<ExternalHttpResponse, ProductionOracleRejection>;

export type FakeTransportScriptedResponse = {
  readonly status?: number;
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: string;
  readonly delayMs?: number;
  readonly timeout?: boolean;
  readonly redirectTo?: string;
};

export class FakeExternalHttpTransport implements ExternalHttpTransport {
  readonly transportId = 'oracle.connector.fake-http';
  readonly contactsPublicInternet = false as const;
  private readonly handlers = new Map<string, FakeTransportHandler>();
  private readonly defaultHandler: FakeTransportHandler | undefined;
  readonly requests: ExternalHttpRequest[] = [];

  constructor(defaultHandler?: FakeTransportHandler) {
    this.defaultHandler = defaultHandler;
  }

  on(method: string, url: string, handler: FakeTransportHandler | FakeTransportScriptedResponse): this {
    const resolved: FakeTransportHandler =
      typeof handler === 'function'
        ? handler
        : () => {
            if (handler.timeout) {
              return err({ code: 'REQUEST_TIMEOUT', detail: 'fake transport timeout' });
            }
            if (handler.redirectTo) {
              return ok(
                Object.freeze({
                  status: 302,
                  headers: Object.freeze({ location: handler.redirectTo, 'content-type': 'application/json' }),
                  body: '',
                  finalUrl: url,
                  redirected: false,
                }),
              );
            }
            return ok(
              Object.freeze({
                status: handler.status ?? 200,
                headers: Object.freeze({ 'content-type': 'application/json', ...handler.headers }),
                body: handler.body ?? '{}',
                finalUrl: url,
                redirected: false,
              }),
            );
          };
    this.handlers.set(`${method.toUpperCase()} ${url}`, resolved);
    return this;
  }

  async request(input: ExternalHttpRequest): Promise<Result<ExternalHttpResponse, ProductionOracleRejection>> {
    this.requests.push(input);
    if (input.tls.rejectUnauthorized !== true) {
      return err({ code: 'TLS_POLICY_VIOLATION', detail: 'certificate verification cannot be disabled' });
    }
    const handler = this.handlers.get(`${input.method} ${input.url}`) ?? this.defaultHandler;
    if (!handler) {
      return err({ code: 'ENDPOINT_NOT_APPROVED', detail: `no fake handler for ${input.method} ${input.url}` });
    }
    return handler(input);
  }
}

export function headerValue(headers: Readonly<Record<string, string>>, name: string): string | undefined {
  const wanted = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === wanted) {
      return value;
    }
  }
  return undefined;
}
