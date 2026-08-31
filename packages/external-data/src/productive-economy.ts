/**
 * Wave 5 productive-economy external data integration for the external data plane.
 */

import {
  createProductiveEconomyRuntime,
  type ProductiveEconomyProviderRuntime,
  WAVE5_ADAPTER_IDS,
  wave5CoverageReport,
} from '../../sunrey-chain/src/productive-economy-providers/index.ts';
import type {
  EnergyObservation,
  ProductiveEconomicObservation,
  ResourceObservation,
} from '../../sunrey-chain/src/productive-economy-providers/types.ts';
import type { ExternalObservation } from '../../provider-sdk/src/index.ts';

export { WAVE5_ADAPTER_IDS, wave5CoverageReport };

type EnergyPegProjection = Awaited<
  ReturnType<ProductiveEconomyProviderRuntime['index']['energy']['pegProjection']>
>;
type ResourcePegProjection = ReturnType<
  ProductiveEconomyProviderRuntime['index']['resources']['pegProjection']
>;

export type Wave5ExternalData = {
  readonly runtime: ProductiveEconomyProviderRuntime;
  getEnergyObservations(): Promise<readonly ExternalObservation<EnergyObservation>[]>;
  getResourceObservations(): Promise<readonly ExternalObservation<ResourceObservation>[]>;
  getProductiveEconomicObservations(): Promise<readonly ProductiveEconomicObservation[]>;
  energyPegProjection(): Promise<EnergyPegProjection>;
  resourcePegProjection(): Promise<ResourcePegProjection>;
};

export function createWave5ExternalData(options?: {
  readonly nowUtc?: () => string;
  readonly providerDown?: string;
  readonly rateLimited?: string;
  readonly circuitOpen?: string;
}): Wave5ExternalData {
  const runtime = createProductiveEconomyRuntime({
    mode: 'simulation',
    ...(options?.nowUtc ? { nowUtc: options.nowUtc } : {}),
    adapterContext: {
      ...(options?.providerDown ? { providerDown: true } : {}),
      ...(options?.rateLimited ? { rateLimited: true } : {}),
      ...(options?.circuitOpen ? { circuitOpen: true } : {}),
    },
  });

  return Object.freeze({
    runtime,
    async getEnergyObservations() {
      const result = await runtime.index.energy.getEnergyObservations();
      return result.observations;
    },
    async getResourceObservations() {
      const result = await runtime.index.resources.getResourceObservations();
      return result.observations;
    },
    async getProductiveEconomicObservations() {
      return runtime.index.toProductiveEconomicObservations();
    },
    async energyPegProjection() {
      return runtime.index.energy.pegProjection();
    },
    async resourcePegProjection() {
      const resources = await runtime.index.resources.getResourceObservations();
      return runtime.index.resources.pegProjection(resources.observations);
    },
  });
}
