/**
 * Home experience enrichment — native coins, action center, economic indicators.
 * Balances are read from backend; never computed in the browser.
 */

import type { WalletProductService } from '../../../../packages/custody/src/product/index.ts';
import type { NativeEconomySurface } from './native-economy-adapter.ts';
import type { WorldExternalDataBff } from './world-external-data-adapter.ts';
import { resourceField, moneyView, type ResourceField } from './types.ts';
import type { BffPrincipal } from './ports.ts';
import { actionCenterSummaryFrom, buildActionCenter, type ActionCenterDeps } from './action-center.ts';
import type { HomeResource } from './orchestrator.ts';

export type NativeCoinBalance = {
  readonly assetId: 'SUNREY_COIN' | 'MOONREY_COIN';
  readonly displayName: string;
  readonly economyContext: 'HUMAN_ECONOMY' | 'PRODUCTIVE_ECONOMY';
  readonly quantityMinorUnits: string;
  readonly currency: string;
  readonly authoritativeBalance: true;
  readonly isMarketPrice: false;
  readonly gpuvIsNotMarketPrice: true;
};

export type EconomicIndicator = {
  readonly category: string;
  readonly label: string;
  readonly dataState: string;
  readonly verified: boolean;
  readonly value: string | null;
  readonly unit: string | null;
};

export function readNativeCoinBalances(
  wallets: WalletProductService | undefined,
  principal: BffPrincipal,
): ResourceField<{ readonly sunrey: NativeCoinBalance | null; readonly moonrey: NativeCoinBalance | null }> {
  if (!wallets) {
    return resourceField({
      state: 'FEATURE_DISABLED',
      availability: 'NOT_YET_PRODUCTIZED',
      reason: 'Native coin wallets are not connected',
    });
  }
  const sunrey = wallets.assetDetail(principal.customerId, 'SUNREY_COIN');
  const moonrey = wallets.assetDetail(principal.customerId, 'MOONREY_COIN');
  const mapCoin = (
    assetId: 'SUNREY_COIN' | 'MOONREY_COIN',
    outcome: ReturnType<WalletProductService['assetDetail']>,
    economyContext: 'HUMAN_ECONOMY' | 'PRODUCTIVE_ECONOMY',
    displayName: string,
  ): NativeCoinBalance | null => {
    if (!outcome.ok) return null;
    const detail = outcome.value;
    const wallet = detail.wallet;
    if (!wallet) return null;
    return Object.freeze({
      assetId,
      displayName,
      economyContext,
      quantityMinorUnits: wallet.balance.availableMinorUnits,
      currency: wallet.assetId,
      authoritativeBalance: true,
      isMarketPrice: false,
      gpuvIsNotMarketPrice: true,
    });
  };
  return resourceField({
    state: sunrey.ok || moonrey.ok ? 'READY' : 'EMPTY',
    availability: 'AVAILABLE_SIMULATION',
    value: Object.freeze({
      sunrey: mapCoin('SUNREY_COIN', sunrey, 'HUMAN_ECONOMY', 'SunRey Coin'),
      moonrey: mapCoin('MOONREY_COIN', moonrey, 'PRODUCTIVE_ECONOMY', 'MoonRey Coin'),
    }),
  });
}

export function readEconomicIndicators(
  world: WorldExternalDataBff | undefined,
  nativeEconomy: NativeEconomySurface | undefined,
  now: string,
): ResourceField<readonly EconomicIndicator[]> {
  if (!world && !nativeEconomy) {
    return resourceField({
      state: 'FEATURE_DISABLED',
      availability: 'NOT_YET_PRODUCTIZED',
      reason: 'Economic awareness fabric is not connected',
    });
  }
  const categories = [
    'ENERGY',
    'RESOURCES',
    'COMPUTE',
    'MANUFACTURING',
    'AGRICULTURE',
    'REAL_ESTATE',
    'TRAVEL',
    'WATER',
    'LOGISTICS',
  ] as const;
  const items: EconomicIndicator[] = categories.map((category) =>
    Object.freeze({
      category,
      label: category.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()),
      dataState: 'SIMULATED',
      verified: false,
      value: null,
      unit: null,
    }),
  );
  if (nativeEconomy) {
    const supply = nativeEconomy.supply();
    items.push(
      Object.freeze({
        category: 'SUNREY_SUPPLY',
        label: 'SunRey protocol supply (read-only)',
        dataState: 'SIMULATED',
        verified: true,
        value: supply.assets.find((a) => a.asset.assetId === 'SUNREY_COIN')?.supply.circulatingSupply ?? null,
        unit: 'SUNREY',
      }),
      Object.freeze({
        category: 'MOONREY_SUPPLY',
        label: 'MoonRey protocol supply (read-only)',
        dataState: 'SIMULATED',
        verified: true,
        value: supply.assets.find((a) => a.asset.assetId === 'MOONREY_COIN')?.supply.circulatingSupply ?? null,
        unit: 'MOONREY',
      }),
    );
  }
  void now;
  return resourceField({
    state: 'SIMULATION_ONLY',
    availability: 'AVAILABLE_SIMULATION',
    reason: 'External observations are simulation fixtures until verified provider admission',
    value: Object.freeze(items),
  });
}

export function enrichHomeResource(
  home: HomeResource,
  input: {
    readonly wallets?: WalletProductService;
    readonly worldExternalData?: WorldExternalDataBff;
    readonly nativeEconomy?: NativeEconomySurface;
    readonly actionCenterDeps: ActionCenterDeps;
    readonly principal: BffPrincipal;
    readonly now: string;
  },
): HomeResource & {
  readonly nativeCoins: ReturnType<typeof readNativeCoinBalances>;
  readonly actionCenter: ResourceField<ReturnType<typeof actionCenterSummaryFrom>>;
  readonly economicIndicators: ReturnType<typeof readEconomicIndicators>;
} {
  const center = buildActionCenter(input.actionCenterDeps, input.principal);
  return Object.freeze({
    ...home,
    nativeCoins: readNativeCoinBalances(input.wallets, input.principal),
    actionCenter: resourceField({
      state: center.summary.total === 0 ? 'EMPTY' : 'READY',
      availability: 'AVAILABLE_SIMULATION',
      value: actionCenterSummaryFrom(center),
    }),
    economicIndicators: readEconomicIndicators(input.worldExternalData, input.nativeEconomy, input.now),
  });
}
