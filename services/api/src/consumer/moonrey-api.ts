/**
 * Wave 8 — MoonRey product read models.
 * GPUV is not MoonRey market price. No mint authority.
 */

import type { NativeEconomySurface } from './native-economy-adapter.ts';
import type { ProductiveEconomySurface } from './productive-economy-adapter.ts';
import type { BffPrincipal } from './ports.ts';
import { mapProductiveClaimStatus, type EconomicClaimStatus } from './status-semantics.ts';

export type MoonReyApiSurface = {
  readonly balance: (principal: BffPrincipal, requestId: string) => MoonReyBalanceView;
  readonly supply: (requestId: string) => MoonReySupplyView;
  readonly categories: (requestId: string) => MoonReyCategoriesView;
  readonly indicators: (requestId: string, category?: string) => MoonReyIndicatorsView;
  readonly gpuv: (requestId: string, category?: string) => MoonReyGpuvView;
  readonly claims: (requestId: string) => MoonReyClaimsView;
  readonly receipts: (requestId: string) => MoonReyReceiptsView;
  readonly providers: (requestId: string) => MoonReyProvidersView;
};

export type MoonReyBalanceView = {
  readonly schema: 'sunrey.consumer.moonrey.balance.v1';
  readonly requestId: string;
  readonly assetId: 'MOONREY_COIN';
  readonly balanceMinorUnits: string | null;
  readonly availableMinorUnits: string | null;
  readonly state: 'SIMULATION_ONLY' | 'UNAVAILABLE';
  readonly productionActive: false;
  readonly gpuvIsNotMarketPrice: true;
  readonly isMarketPrice: false;
};

export type MoonReySupplyView = {
  readonly schema: 'sunrey.consumer.moonrey.supply.v1';
  readonly requestId: string;
  readonly protocolNative: true;
  readonly productionActive: false;
  readonly supply: unknown;
  readonly gpuvIsNotMarketPrice: true;
};

export type MoonReyCategoriesView = {
  readonly schema: 'sunrey.consumer.moonrey.categories.v1';
  readonly requestId: string;
  readonly items: readonly unknown[];
  readonly productiveEconomyConnected: boolean;
};

export type MoonReyIndicatorsView = {
  readonly schema: 'sunrey.consumer.moonrey.indicators.v1';
  readonly requestId: string;
  readonly category: string | null;
  readonly items: readonly unknown[];
  readonly observationDoesNotMint: true;
};

export type MoonReyGpuvView = {
  readonly schema: 'sunrey.consumer.moonrey.gpuv.v1';
  readonly requestId: string;
  readonly category: string | null;
  readonly gpuv: unknown;
  readonly gpuvIsNotMoonReyQuantity: true;
  readonly gpuvIsNotMarketPrice: true;
  readonly gpuvIsNotExchangePrice: true;
  readonly productionValuationActive: false;
};

export type MoonReyClaimItem = {
  readonly claimId: string;
  readonly category: string;
  readonly claimStatus: EconomicClaimStatus;
  readonly observedAt: string | null;
};

export type MoonReyClaimsView = {
  readonly schema: 'sunrey.consumer.moonrey.claims.v1';
  readonly requestId: string;
  readonly items: readonly MoonReyClaimItem[];
  readonly observationDoesNotMint: true;
};

export type MoonReyReceiptsView = {
  readonly schema: 'sunrey.consumer.moonrey.receipts.v1';
  readonly requestId: string;
  readonly items: readonly {
    readonly receiptId: string;
    readonly assetId: 'MOONREY_COIN';
    readonly quantityMinorUnits: string;
    readonly status: 'SIMULATION_ONLY';
    readonly governanceAuthorized: false;
  }[];
  readonly productionIssuanceActive: false;
};

export type MoonReyProvidersView = {
  readonly schema: 'sunrey.consumer.moonrey.providers.v1';
  readonly requestId: string;
  readonly items: readonly {
    readonly providerId: string;
    readonly displayName: string;
    readonly status: 'SIMULATED' | 'SANDBOX' | 'UNAVAILABLE';
    readonly certified: boolean;
    readonly configuredProviderIsNotTrusted: true;
  }[];
};

export function createMoonReyApiSurface(input: {
  readonly nativeEconomy?: NativeEconomySurface;
  readonly productiveEconomy?: ProductiveEconomySurface;
}): MoonReyApiSurface {
  return Object.freeze({
    balance(principal, requestId) {
      return Object.freeze({
        schema: 'sunrey.consumer.moonrey.balance.v1',
        requestId,
        assetId: 'MOONREY_COIN',
        balanceMinorUnits: principal.restricted ? null : '0',
        availableMinorUnits: principal.restricted ? null : '0',
        state: principal.restricted ? 'UNAVAILABLE' : 'SIMULATION_ONLY',
        productionActive: false,
        gpuvIsNotMarketPrice: true,
        isMarketPrice: false,
      });
    },
    supply(requestId) {
      const surface = input.nativeEconomy;
      const asset = surface?.asset('MOONREY_COIN');
      return Object.freeze({
        schema: 'sunrey.consumer.moonrey.supply.v1',
        requestId,
        protocolNative: true,
        productionActive: false,
        supply: asset && !('error' in asset) ? asset : null,
        gpuvIsNotMarketPrice: true,
      });
    },
    categories(requestId) {
      const productive = input.productiveEconomy;
      const items = productive ? productive.categories() : [];
      return Object.freeze({
        schema: 'sunrey.consumer.moonrey.categories.v1',
        requestId,
        items: Object.freeze(items),
        productiveEconomyConnected: productive !== undefined,
      });
    },
    indicators(requestId, category) {
      const productive = input.productiveEconomy;
      const history = productive ? productive.history(category) : [];
      return Object.freeze({
        schema: 'sunrey.consumer.moonrey.indicators.v1',
        requestId,
        category: category ?? null,
        items: Object.freeze(history),
        observationDoesNotMint: true,
      });
    },
    gpuv(requestId, category) {
      const productive = input.productiveEconomy;
      const inputSummary = productive ? productive.moonreyInput() : null;
      return Object.freeze({
        schema: 'sunrey.consumer.moonrey.gpuv.v1',
        requestId,
        category: category ?? null,
        gpuv: inputSummary,
        gpuvIsNotMoonReyQuantity: true,
        gpuvIsNotMarketPrice: true,
        gpuvIsNotExchangePrice: true,
        productionValuationActive: false,
      });
    },
    claims(requestId) {
      void requestId;
      return Object.freeze({
        schema: 'sunrey.consumer.moonrey.claims.v1',
        requestId,
        items: Object.freeze([
          Object.freeze({
            claimId: 'claim.simulation.placeholder',
            category: 'compute',
            claimStatus: mapProductiveClaimStatus('OBSERVED'),
            observedAt: null,
          }),
        ]),
        observationDoesNotMint: true,
      });
    },
    receipts(requestId) {
      return Object.freeze({
        schema: 'sunrey.consumer.moonrey.receipts.v1',
        requestId,
        items: Object.freeze([]),
        productionIssuanceActive: false,
      });
    },
    providers(requestId) {
      const productive = input.productiveEconomy;
      const sources = productive ? productive.sources() : [];
      const items = (Array.isArray(sources) ? sources : []).map((row: { providerId?: string; displayName?: string; status?: string }) =>
        Object.freeze({
          providerId: row.providerId ?? 'unknown',
          displayName: row.displayName ?? row.providerId ?? 'Provider',
          status: 'SIMULATED' as const,
          certified: false,
          configuredProviderIsNotTrusted: true as const,
        }),
      );
      return Object.freeze({
        schema: 'sunrey.consumer.moonrey.providers.v1',
        requestId,
        items: Object.freeze(items),
      });
    },
  });
}
