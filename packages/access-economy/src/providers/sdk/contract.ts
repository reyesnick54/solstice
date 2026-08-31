/**
 * ACCESS Wave 2 — AccessProvider base contract.
 *
 * Extends the SunRey provider-sdk lifecycle pattern for Access-specific
 * providers. Optional operations are determined by declared capabilities.
 */

import type { AccessProviderId, ProviderCapabilityId } from '../types.ts';
import type { AccessProviderDescriptor } from './descriptor.ts';
import type { AccessProviderHealthSnapshot } from './health.ts';

export type AccessProviderRuntimeContext = {
  readonly environment: 'simulation' | 'sandbox' | 'production';
  readonly nowUtc: () => string;
};

export type AccessProvider = {
  readonly id: AccessProviderId;
  readonly descriptor: AccessProviderDescriptor;

  initialize(context: AccessProviderRuntimeContext): Promise<void>;
  healthCheck(): Promise<AccessProviderHealthSnapshot>;
  getCapabilities(): readonly ProviderCapabilityId[];
  shutdown(): Promise<void>;
};

export function assertAccessProvider(value: AccessProvider): AccessProvider {
  if (!value.id || value.id !== value.descriptor.providerId) {
    throw new TypeError('AccessProvider id must match descriptor.providerId');
  }
  return value;
}
