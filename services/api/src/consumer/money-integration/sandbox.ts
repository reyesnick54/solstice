/**
 * Deterministic Wave 8 money-integration sandbox wiring.
 * Simulation only. Not a second ledger or custody authority.
 */

import { asUtcInstant } from '../../../../../packages/domain/src/time.ts';
import { WalletProductService } from '../../../../../packages/custody/src/product/service.ts';
import { WalletEngine } from '../../../../../packages/sunrey-chain/src/wallet/engine.ts';
import {
  MOONREY_COIN_NATIVE_ASSET_ID,
  SUNREY_COIN_NATIVE_ASSET_ID,
} from '../../../../../packages/sunrey-exchange/src/ids.ts';
import { NativeClearingEngine } from '../../../../../packages/sunrey-exchange/src/native-clearing/engine.ts';
import { createMoneyIntegrationPlatform, type MoneyIntegrationPlatform } from './platform.ts';

const NOW = asUtcInstant('2026-09-02T12:00:00.000Z');

export type SandboxMoneyIntegration = {
  readonly walletEngine: WalletEngine;
  readonly nativeClearing: NativeClearingEngine;
  readonly platform: MoneyIntegrationPlatform;
};

export function createSandboxMoneyIntegration(input: {
  readonly walletProduct: WalletProductService;
  readonly exchangeCustomerId?: string;
  readonly counterpartyCustomerId?: string;
  readonly nowUtc?: typeof NOW;
}): SandboxMoneyIntegration {
  const walletEngine = new WalletEngine();
  walletEngine.unlock('development-passphrase');
  const nativeClearing = new NativeClearingEngine();
  const nowUtc = input.nowUtc ?? NOW;

  if (input.exchangeCustomerId && input.counterpartyCustomerId) {
    seedSandboxNativeTrade(nativeClearing, {
      buyerCustomerId: input.exchangeCustomerId,
      sellerCustomerId: input.counterpartyCustomerId,
      nowUtc,
    });
  }

  const platform = createMoneyIntegrationPlatform({
    walletEngine,
    walletProduct: input.walletProduct,
    nativeClearing,
    nowUtc,
  });

  return Object.freeze({ walletEngine, nativeClearing, platform });
}

export function seedSandboxNativeTrade(
  clearing: NativeClearingEngine,
  input: {
    readonly buyerCustomerId: string;
    readonly sellerCustomerId: string;
    readonly nowUtc: typeof NOW;
  },
): void {
  const buyer = clearing.openExchangeAccount(input.buyerCustomerId);
  const seller = clearing.openExchangeAccount(input.sellerCustomerId);
  clearing.faucetToCustody(seller, SUNREY_COIN_NATIVE_ASSET_ID, 1_000_000n);
  clearing.faucetToCustody(buyer, MOONREY_COIN_NATIVE_ASSET_ID, 2_500_000n);
  clearing.placeOrder({
    accountId: seller,
    side: 'SELL',
    quantity: 100_000n,
    priceUnits: 2_500_000n,
    now: input.nowUtc,
  });
  clearing.placeOrder({
    accountId: buyer,
    side: 'BUY',
    quantity: 100_000n,
    priceUnits: 2_500_000n,
    now: input.nowUtc,
  });
  const settlement = [...clearing.settlements.values()][0];
  if (settlement) {
    clearing.submitSettlement(settlement.settlementId);
  }
}
