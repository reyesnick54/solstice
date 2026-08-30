/**
 * Canonical external-data provider lifecycle contract.
 */

import type {
  ProviderCapability,
  ProviderDescriptor,
  ProviderHealthStatus,
  ProviderId,
  ProviderRuntimeContext,
} from './types.ts';

export type SunReyProvider = {
  readonly id: ProviderId;
  readonly descriptor: ProviderDescriptor;

  initialize(context: ProviderRuntimeContext): Promise<void>;
  healthCheck(): Promise<ProviderHealthStatus>;
  getCapabilities(): readonly ProviderCapability[];
  shutdown(): Promise<void>;
};

export function assertSunReyProvider(value: SunReyProvider): SunReyProvider {
  if (!value.id || value.id !== value.descriptor.id) {
    throw new TypeError('provider id must match descriptor.id');
  }
  return value;
}
