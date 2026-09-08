import { createHash } from 'node:crypto';

import {
  createWalletProductFromKernel,
  isNativeCustodyAssetId,
  type ConsumerWallet,
  type WalletProductService,
} from '@solstice/custody';

import type { DurableSimulationRuntime } from '../../../accounts/src/product-durable-adapters.ts';
import {
  listProductWallets,
  loadProductWalletByAsset,
  loadProductWalletByIdempotency,
  persistProductWallet,
  type PersistedConsumerWallet,
} from '../../../accounts/src/product-durable-adapters.ts';
import type { BffPrincipal } from './ports.ts';

export type DurableWalletCreateInput = {
  readonly assetId: string;
  readonly idempotencyKey: string;
};

export type DurableWalletCreateOutcome =
  | { readonly outcome: 'OK'; readonly value: ConsumerWallet; readonly replay: boolean }
  | { readonly outcome: 'REJECTED'; readonly code: string; readonly message: string };

export type DurableWalletBindingReport = {
  readonly schema: 'sunrey.durable-wallet-binding.v1';
  readonly hydratedWallets: number;
  readonly productionMoneyMovement: false;
  readonly productionSigningAuthorized: false;
  readonly mainnetActive: false;
};

/**
 * Durable customer-wallet composition for the hosted internal sandbox.
 *
 * WalletProductService remains the canonical customer wallet product layer.
 * PostgreSQL stores only restart-safe wallet metadata. It does not store token
 * balances, private keys, signing authority, or a second financial ledger.
 */
export class DurableWalletSurface {
  readonly product: WalletProductService;
  readonly bindingReport: DurableWalletBindingReport;
  private readonly durable: DurableSimulationRuntime;

  private constructor(
    durable: DurableSimulationRuntime,
    product: WalletProductService,
    hydratedWallets: number,
  ) {
    this.durable = durable;
    this.product = product;
    this.bindingReport = Object.freeze({
      schema: 'sunrey.durable-wallet-binding.v1',
      hydratedWallets,
      productionMoneyMovement: false,
      productionSigningAuthorized: false,
      mainnetActive: false,
    });
  }

  static async create(durable: DurableSimulationRuntime): Promise<DurableWalletSurface> {
    const runtime = durable.runtime;
    const wired = createWalletProductFromKernel({
      clock: runtime.clock,
      kernel: runtime.kernel,
      issuer: runtime.issuer,
      evidence: runtime.evidence,
      events: runtime.events,
      identity: runtime.identity.service,
      keyProvider: runtime.keyProvider as never,
      customers: runtime.customers,
      chainAvailable: true,
      custodyAvailable: true,
    });

    let hydratedWallets = 0;
    for (const customer of runtime.customers.list()) {
      const rows = await listProductWallets(durable.session.pools.customer, customer.id);
      for (const row of rows) {
        const hydrated = wired.product.provisionWallet({
          walletId: row.walletId,
          ownerId: row.customerId,
          assetId: row.assetId,
          custodyModel: row.custodyModel,
          status: row.status,
          withdrawalEnabled: row.withdrawalEnabled,
          operationalApproved: row.custodyModel === 'INTERNAL_OPERATIONAL',
          providerRef: row.providerRef,
          seedMinorUnits: 0n,
        });
        if (!hydrated.ok) {
          throw new Error(`durable wallet hydration failed for ${row.walletId}: ${hydrated.message}`);
        }
        hydratedWallets += 1;
      }
    }

    return new DurableWalletSurface(durable, wired.product, hydratedWallets);
  }

  async createWallet(
    principal: BffPrincipal,
    input: DurableWalletCreateInput,
  ): Promise<DurableWalletCreateOutcome> {
    if (
      principal.verification !== 'VERIFIED' ||
      principal.customerStatus !== 'ACTIVE' ||
      principal.restricted
    ) {
      return {
        outcome: 'REJECTED',
        code: 'WALLET_NOT_ELIGIBLE',
        message: 'wallet creation requires an active verified unrestricted sandbox customer',
      };
    }
    if (!isNativeCustodyAssetId(input.assetId)) {
      return {
        outcome: 'REJECTED',
        code: 'UNSUPPORTED_ASSET',
        message: 'only SunRey Coin and MoonRey Coin wallets are available in this sandbox',
      };
    }
    if (!input.idempotencyKey.trim()) {
      return {
        outcome: 'REJECTED',
        code: 'IDEMPOTENCY_KEY_REQUIRED',
        message: 'wallet creation requires an idempotency key',
      };
    }

    const prior = await loadProductWalletByIdempotency(
      this.durable.session.pools.customer,
      input.idempotencyKey,
    );
    if (prior) {
      if (prior.customerId !== principal.customerId || prior.assetId !== input.assetId) {
        return {
          outcome: 'REJECTED',
          code: 'IDEMPOTENCY_CONFLICT',
          message: 'idempotency key is already bound to a different wallet request',
        };
      }
      const existing = this.product.getWallet(principal.customerId, prior.walletId);
      if (!existing.ok) {
        return {
          outcome: 'REJECTED',
          code: 'DURABLE_WALLET_INCONSISTENT',
          message: 'persisted wallet could not be resolved from the canonical wallet product',
        };
      }
      return { outcome: 'OK', value: existing.value, replay: true };
    }

    const existingAssetWallet = await loadProductWalletByAsset(
      this.durable.session.pools.customer,
      principal.customerId,
      input.assetId,
    );
    if (existingAssetWallet) {
      return {
        outcome: 'REJECTED',
        code: 'WALLET_ALREADY_EXISTS',
        message: `a ${input.assetId} wallet already exists for this customer`,
      };
    }

    const walletId = durableWalletId(principal.customerId, input.assetId);
    const created = this.product.provisionWallet({
      walletId,
      ownerId: principal.customerId,
      assetId: input.assetId,
      custodyModel: 'SUNREY_NATIVE',
      status: 'ACTIVE',
      withdrawalEnabled: true,
      seedMinorUnits: 0n,
      providerRef: 'sunrey-native',
    });
    if (!created.ok) {
      return { outcome: 'REJECTED', code: created.code, message: created.message };
    }

    const now = created.value.createdAt;
    const row: PersistedConsumerWallet = Object.freeze({
      walletId: created.value.walletId,
      customerId: principal.customerId,
      assetId: created.value.assetId,
      networkId: 'SUNREY_CHAIN',
      custodyModel: 'SUNREY_NATIVE',
      status: created.value.status,
      withdrawalEnabled: created.value.withdrawalEnabled,
      providerRef: created.value.providerRef,
      custodyAccountId: created.value.custodyAccountId,
      idempotencyKey: input.idempotencyKey,
      createdAt: now,
      updatedAt: now,
    });
    await persistProductWallet(this.durable.session.pools.customer, row);

    return { outcome: 'OK', value: created.value, replay: false };
  }
}

function durableWalletId(customerId: string, assetId: string): string {
  const digest = createHash('sha256').update(`${customerId}\n${assetId}`).digest('hex').slice(0, 24);
  return `wal_${assetId === 'MOONREY_COIN' ? 'mr' : 'sr'}_${digest}`;
}
