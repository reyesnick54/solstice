/**
 * Wave 6 health reference external data integration.
 */

import {
  createHealthProviderRuntime,
  HEALTH_ADAPTER_IDS,
  healthCoverageReport,
  type HealthReferenceService,
} from '../../sunrey-chain/src/health-reference/index.ts';

export { HEALTH_ADAPTER_IDS, healthCoverageReport };

export type Wave6HealthExternalData = {
  readonly runtime: ReturnType<typeof createHealthProviderRuntime>;
  readonly service: HealthReferenceService;
};

export function createWave6HealthExternalData(options?: {
  readonly nowUtc?: () => string;
}): Wave6HealthExternalData {
  const runtime = createHealthProviderRuntime({
    mode: 'simulation',
    ...(options?.nowUtc ? { nowUtc: options.nowUtc } : {}),
  });
  return Object.freeze({
    runtime,
    service: runtime.service,
  });
}
