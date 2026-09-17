import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { ProviderRuntimeDiscoveryPort } from './adapter-port.ts';
import { discoverProviderCapabilities } from './capability-discovery.ts';
import type { OrchestrationReadinessReport } from './types.ts';
import type { ProviderOrchestrationEnvironment } from './taxonomy.ts';

export const HELIOS_H22_PROVIDER_ORCHESTRATION = 'HELIOS_H22_PROVIDER_ORCHESTRATION' as const;

/**
 * Bounded qualification — does not fake provider certification when credentials
 * or contracts are unavailable.
 */
export function assessProviderOrchestrationReadiness(input: {
  readonly runtime: ProviderRuntimeDiscoveryPort;
  readonly environment: ProviderOrchestrationEnvironment;
  readonly now: UtcInstant;
  readonly sandboxCredentialsPresent: boolean;
}): OrchestrationReadinessReport {
  const registrations = input.runtime.list();
  let qualified = 0;
  const notes: string[] = [];

  for (const registration of registrations) {
    const discovery = discoverProviderCapabilities(
      input.runtime,
      registration.providerId,
      input.environment,
      input.now,
    );
    if (!discovery?.overallAvailable) {
      notes.push(`${registration.providerId}: capability discovery unavailable`);
      continue;
    }
    if (!registration.credentialConfigured) {
      notes.push(`${registration.providerId}: credentials not configured`);
      continue;
    }
    if (
      registration.lifecycleState === 'SIMULATED' ||
      registration.lifecycleState === 'SANDBOX' ||
      registration.lifecycleState === 'CERTIFICATION'
    ) {
      qualified += 1;
    } else {
      notes.push(`${registration.providerId}: lifecycle ${registration.lifecycleState} not qualification-ready`);
    }
  }

  if (!input.sandboxCredentialsPresent) {
    return Object.freeze({
      readiness: 'EXTERNAL_PROVIDER_QUALIFICATION_PENDING',
      providerCount: registrations.length,
      qualifiedProviderCount: qualified,
      evaluatedAt: input.now,
      notes: Object.freeze([
        ...notes,
        'sandbox/certification credentials unavailable; orchestration code ready but external qualification pending',
      ]),
    });
  }

  if (qualified === 0) {
    return Object.freeze({
      readiness: 'EXTERNAL_PROVIDER_QUALIFICATION_PENDING',
      providerCount: registrations.length,
      qualifiedProviderCount: 0,
      evaluatedAt: input.now,
      notes: Object.freeze([
        ...notes,
        'no providers passed bounded sandbox qualification',
      ]),
    });
  }

  return Object.freeze({
    readiness: 'PROVIDER_ORCHESTRATION_READY',
    providerCount: registrations.length,
    qualifiedProviderCount: qualified,
    evaluatedAt: input.now,
    notes: Object.freeze(notes),
  });
}
