/**
 * Future provider adapter contracts. These are portable interfaces, not SDKs.
 * Do not add AWS / GCP / Azure / Vault client libraries in this chunk.
 *
 * A production adapter implements KeyProvider + SecretProvider and never
 * returns raw production key material to application services.
 */

import type { KeyProvider } from './provider.ts';
import type { SecretProvider } from './secrets.ts';

export const FUTURE_PROVIDER_KINDS = [
  'AWS_KMS',
  'GCP_KMS',
  'AZURE_KEY_VAULT',
  'HASHICORP_VAULT',
  'HSM',
  'MPC_CUSTODY',
] as const;

export type FutureProviderKind = (typeof FUTURE_PROVIDER_KINDS)[number];

export type FutureProviderAdapter = {
  readonly kind: FutureProviderKind;
  readonly providerId: string;
  readonly keys: KeyProvider;
  readonly secrets: SecretProvider;
};

/**
 * Production adapters MUST:
 * - keep ENVIRONMENT=simulation / LIVE_* false until a later authorized chunk
 * - never persist KMS plaintext or HSM private keys in PostgreSQL
 * - fail closed when the remote provider is unavailable
 * - emit only metadata on security events
 *
 * They MUST NOT:
 * - couple domain services to a vendor SDK
 * - treat regulatory compatibility as a score
 * - mint Execution Authority themselves
 */
export const PRODUCTION_ADAPTER_RULES = Object.freeze({
  noVendorSdkInThisChunk: true,
  noLiveProvider: true,
  failClosedOnUnavailable: true,
  metadataOnlyInEvents: true,
});
