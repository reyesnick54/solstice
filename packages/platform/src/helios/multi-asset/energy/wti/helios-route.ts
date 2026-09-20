/**
 * M08 — HELIOS integration route for WTI energy market intelligence.
 */

import type { UtcInstant } from '../../../../../../domain/src/time.ts';
import { createWtiEnergyMarketService, type WtiEnergyMarketService } from './service.ts';
import type { WtiMarketState } from './types.ts';
import { HELIOS_MULTI_ASSET_M08_WTI_ENERGY_DATA_QUALIFIED } from './qualification.ts';

export const HELIOS_WTI_ENERGY_ROUTE_ID = 'helios.multi-asset.wti-energy' as const;

export type HeliosWtiEnergyRouteSnapshot = {
  readonly routeId: typeof HELIOS_WTI_ENERGY_ROUTE_ID;
  readonly providerId: string;
  readonly qualificationMarker: typeof HELIOS_MULTI_ASSET_M08_WTI_ENERGY_DATA_QUALIFIED | null;
  readonly evaluatedAt: UtcInstant;
};

export class HeliosWtiEnergyRoute {
  readonly #service: WtiEnergyMarketService;

  constructor(service?: WtiEnergyMarketService) {
    this.#service = service ?? createWtiEnergyMarketService();
  }

  get service(): WtiEnergyMarketService {
    return this.#service;
  }

  async snapshot(nowUtc: UtcInstant, qualified: boolean): Promise<HeliosWtiEnergyRouteSnapshot> {
    return Object.freeze({
      routeId: HELIOS_WTI_ENERGY_ROUTE_ID,
      providerId: this.#service.provider.providerId,
      qualificationMarker: qualified ? HELIOS_MULTI_ASSET_M08_WTI_ENERGY_DATA_QUALIFIED : null,
      evaluatedAt: nowUtc,
    });
  }

  async fetchMarketState(nowUtc: UtcInstant): Promise<WtiMarketState> {
    return this.#service.buildMarketState(nowUtc);
  }
}

export function createHeliosWtiEnergyRoute(service?: WtiEnergyMarketService): HeliosWtiEnergyRoute {
  return new HeliosWtiEnergyRoute(service);
}
