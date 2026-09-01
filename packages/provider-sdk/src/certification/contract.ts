/**
 * Certifiable provider contract — extends lifecycle with certification probes.
 */

import type { ProviderHealthStatus, ProviderId } from '../types.ts';
import type { ProviderCertificationProbeResult } from './types.ts';
import type { NormalizedProviderFailure, ProviderFailureCode } from './errors.ts';
import type { SunReyProvider } from '../contract.ts';

export type ProviderHealthCheckResult = ProviderHealthStatus & {
  readonly degraded?: boolean;
};

export type ProviderCertifyResult = ProviderCertificationProbeResult;

export type CertifiableProvider = SunReyProvider & {
  /**
   * Optional extended health check returning degradation signal.
   */
  healthCheck(): Promise<ProviderHealthCheckResult>;

  /**
   * Run certification probes for this provider instance.
   * Must derive status from actual checks — never accept client claims.
   */
  certify?(): Promise<ProviderCertifyResult>;

  /**
   * Classify a provider-specific error into the canonical taxonomy.
   */
  classifyError?(error: unknown): NormalizedProviderFailure;

  /**
   * Validate that a caller-supplied path is safe relative to the provider base URL.
   */
  validateRequestPath?(path: string): { readonly ok: true } | { readonly ok: false; readonly code: ProviderFailureCode };
};

export function isCertifiableProvider(value: SunReyProvider): value is CertifiableProvider {
  return typeof value.healthCheck === 'function';
}

export function classifyProviderError(
  provider: SunReyProvider,
  error: unknown,
  providerId?: ProviderId,
): NormalizedProviderFailure {
  if ('classifyError' in provider && typeof provider.classifyError === 'function') {
    return provider.classifyError(error);
  }
  const message = error instanceof Error ? error.message : String(error);
  return Object.freeze({
    code: 'UNKNOWN',
    message,
    retryable: false,
    providerId: providerId ?? provider.id,
    httpStatus: null,
  });
}
