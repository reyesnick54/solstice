/**
 * Node HTTP transport.
 *
 * This transport is never selected in FIXTURE CI mode. External network
 * access requires TESTNET_EXTERNAL or PRODUCTION_CANDIDATE_EXTERNAL plus
 * explicit configuration. Certificate verification is never disabled.
 */

import { err, ok, type Result } from '../../../../domain/src/result.ts';
import type { ProductionOracleRejection } from './types.ts';
import type {
  ConnectorRuntimeConfig,
  ExternalHttpRequest,
  ExternalHttpResponse,
  ExternalHttpTransport,
} from './runtime-types.ts';

export class NodeExternalHttpTransport implements ExternalHttpTransport {
  readonly transportId = 'oracle.connector.node-http';
  readonly contactsPublicInternet = true as const;
  private readonly config: ConnectorRuntimeConfig;

  constructor(config: ConnectorRuntimeConfig) {
    this.config = config;
  }

  async request(input: ExternalHttpRequest): Promise<Result<ExternalHttpResponse, ProductionOracleRejection>> {
    const gated = this.gate();
    if (!gated.ok) {
      return gated;
    }
    if (input.tls.rejectUnauthorized !== true) {
      return err({ code: 'TLS_POLICY_VIOLATION', detail: 'rejectUnauthorized=false is forbidden' });
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), input.timeoutMs);
    try {
      const response = await fetch(input.url, {
        method: input.method,
        headers: { ...input.headers },
        body: input.body,
        redirect: 'manual',
        signal: controller.signal,
      });
      const raw = Buffer.from(await response.arrayBuffer());
      if (raw.byteLength > input.maximumResponseBytes) {
        return err({
          code: 'RESPONSE_TOO_LARGE',
          detail: `response exceeded ${input.maximumResponseBytes} bytes`,
        });
      }
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key.toLowerCase()] = value;
      });
      return ok(
        Object.freeze({
          status: response.status,
          headers: Object.freeze(headers),
          body: raw.toString('utf8'),
          finalUrl: response.url || input.url,
          redirected: false,
        }),
      );
    } catch (cause) {
      const message = cause instanceof Error ? cause.name : 'transport';
      if (message === 'AbortError') {
        return err({ code: 'REQUEST_TIMEOUT', detail: 'request exceeded timeoutMs' });
      }
      return err({ code: 'CONNECTIVITY_DISABLED', detail: 'live transport failed closed' });
    } finally {
      clearTimeout(timer);
    }
  }

  private gate(): Result<true, ProductionOracleRejection> {
    if (this.config.mode === 'FIXTURE' || this.config.mode === 'SANDBOX') {
      return err({
        code: 'CONNECTIVITY_DISABLED',
        detail: `${this.config.mode} forbids the node HTTP transport`,
      });
    }
    if (this.config.mainnetConnectivity !== 'DISABLED' && this.config.mainnetConnectivity !== 'UNCONFIGURED') {
      return err({ code: 'CONNECTIVITY_DISABLED', detail: 'mainnet connectivity must stay DISABLED or UNCONFIGURED' });
    }
    if (this.config.mode === 'TESTNET_EXTERNAL' && this.config.externalNetworkEnabled !== true) {
      return err({
        code: 'CONNECTIVITY_DISABLED',
        detail: 'TESTNET_EXTERNAL requires explicit externalNetworkEnabled',
      });
    }
    if (this.config.mode === 'PRODUCTION_CANDIDATE_EXTERNAL') {
      if (this.config.externalNetworkEnabled !== true || this.config.productionCandidateExternalConfigured !== true) {
        return err({
          code: 'CONNECTIVITY_DISABLED',
          detail: 'PRODUCTION_CANDIDATE_EXTERNAL is UNCONFIGURED until explicitly configured',
        });
      }
    }
    return ok(true);
  }
}

export function createConnectorTransport(
  config: ConnectorRuntimeConfig,
  injected: ExternalHttpTransport,
): Result<ExternalHttpTransport, ProductionOracleRejection> {
  if (injected.contactsPublicInternet === true) {
    if (config.mode === 'FIXTURE' || config.mode === 'SANDBOX') {
      return err({
        code: 'CONNECTIVITY_DISABLED',
        detail: 'public-internet transports are forbidden in FIXTURE and SANDBOX',
      });
    }
    if (config.externalNetworkEnabled !== true) {
      return err({
        code: 'CONNECTIVITY_DISABLED',
        detail: 'public-internet transport requires explicit externalNetworkEnabled',
      });
    }
  }
  return ok(injected);
}
