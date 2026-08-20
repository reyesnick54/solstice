import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { ProviderHealth } from '../ports.ts';

export function complianceProviderHealth(input: {
  readonly providerId: string;
  readonly available: boolean;
  readonly now: UtcInstant;
  readonly lastErrorCode?: string;
}): ProviderHealth {
  return Object.freeze({
    providerId: input.providerId,
    available: input.available,
    lastCheckedAt: input.now,
    lastErrorCode: input.available ? null : (input.lastErrorCode ?? 'PROVIDER_UNAVAILABLE'),
  });
}
