/**
 * Wave 4 — governed connector interface.
 *
 * Connectors handle transport and normalization handoff only.
 * They must NOT verify economic facts, create GPUV/PEVE, mint, or approve issuance.
 */

import type { ProviderDefinition } from './provider-definition.ts';
import type { ProviderOperationalHealth } from './operational-health.ts';
import type { ProviderLineageRecord } from './lineage.ts';

export const CONNECTOR_FORBIDDEN_CAPABILITIES = Object.freeze([
  'VERIFY_ECONOMIC_FACT',
  'CREATE_GPUV',
  'CREATE_PEVE',
  'MINT',
  'APPROVE_ISSUANCE',
] as const);

export type ConnectorRequestContext = {
  readonly requestId: string;
  readonly correlationId: string;
  readonly operation: string;
  readonly environment: 'simulation' | 'sandbox' | 'preview' | 'production_candidate';
  readonly nowUtc: string;
  /** Stable idempotency key for transport retries — survives deduplication. */
  readonly transportRetryIdentity: string;
};

export type RawCapturePolicy = 'FORBIDDEN' | 'HASH_ONLY' | 'PERMITTED_SHORT_TERM';

export type ConnectorNormalizationHandoff = {
  readonly providerId: string;
  readonly operation: string;
  readonly rawPayloadHash: string;
  readonly providerSchemaVersion: string;
  readonly normalizationVersion: string;
  readonly transportRetryIdentity: string;
  readonly capturedRaw: string | null;
  readonly httpStatus: number | null;
  readonly contentType: string | null;
};

export type ConnectorFetchResult<T = unknown> = {
  readonly ok: true;
  readonly data: T;
  readonly handoff: ConnectorNormalizationHandoff;
  readonly attemptCount: number;
  readonly latencyMs: number;
} | {
  readonly ok: false;
  readonly code: string;
  readonly message: string;
  readonly attemptCount: number;
  readonly latencyMs: number;
  readonly transportRetryIdentity: string;
};

export type ConnectorHealthMetadata = {
  readonly operational: ProviderOperationalHealth;
  readonly lineage: ProviderLineageRecord | null;
};

/**
 * Governed connector — one interface for all external economic information sources.
 */
export interface GovernedConnector {
  readonly definition: ProviderDefinition;
  readonly connectorId: string;

  /** Authentication, request construction, transport — no economic verification. */
  fetch<T = unknown>(
    operation: string,
    params: unknown,
    context: ConnectorRequestContext,
  ): Promise<ConnectorFetchResult<T>>;

  getOperationalHealth(): ProviderOperationalHealth;
  getLineage(): ProviderLineageRecord | null;
}

export function assertGovernedConnectorDoesNotMint(connector: GovernedConnector): void {
  const proto = Object.getPrototypeOf(connector) as Record<string, unknown>;
  for (const forbidden of CONNECTOR_FORBIDDEN_CAPABILITIES) {
    if (forbidden in connector || forbidden.toLowerCase() in proto) {
      throw new TypeError(`connector '${connector.connectorId}' exposes forbidden capability '${forbidden}'`);
    }
  }
}
