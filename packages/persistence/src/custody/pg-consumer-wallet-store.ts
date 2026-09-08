import type { Pool } from 'pg';

import { withClient } from '../postgres/pools.ts';

export type PersistedConsumerWallet = {
  readonly walletId: string;
  readonly customerId: string;
  readonly assetId: 'SUNREY_COIN' | 'MOONREY_COIN';
  readonly networkId: 'SUNREY_CHAIN';
  readonly custodyModel: 'SUNREY_NATIVE' | 'EXTERNAL_CUSTODY' | 'INTERNAL_OPERATIONAL';
  readonly status: 'PENDING' | 'ACTIVE' | 'RESTRICTED' | 'FROZEN' | 'CLOSED';
  readonly withdrawalEnabled: boolean;
  readonly providerRef: string | null;
  readonly custodyAccountId: string;
  readonly idempotencyKey: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

type WalletRow = {
  wallet_id: string;
  customer_id: string;
  asset_id: PersistedConsumerWallet['assetId'];
  network_id: PersistedConsumerWallet['networkId'];
  custody_model: PersistedConsumerWallet['custodyModel'];
  status: PersistedConsumerWallet['status'];
  withdrawal_enabled: boolean;
  provider_ref: string | null;
  custody_account_id: string;
  idempotency_key: string;
  created_at: Date | string;
  updated_at: Date | string;
};

export async function persistConsumerWallet(pool: Pool, wallet: PersistedConsumerWallet): Promise<void> {
  await withClient(pool, async (client) => {
    await client.query(
      `INSERT INTO custody.consumer_wallet (
         wallet_id, customer_id, asset_id, network_id, custody_model, status,
         withdrawal_enabled, provider_ref, custody_account_id, idempotency_key,
         created_at, updated_at, production_money_movement,
         production_signing_authorized, not_a_ledger
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,FALSE,FALSE,TRUE)
       ON CONFLICT (wallet_id) DO UPDATE SET
         status = EXCLUDED.status,
         withdrawal_enabled = EXCLUDED.withdrawal_enabled,
         provider_ref = EXCLUDED.provider_ref,
         updated_at = EXCLUDED.updated_at`,
      [
        wallet.walletId,
        wallet.customerId,
        wallet.assetId,
        wallet.networkId,
        wallet.custodyModel,
        wallet.status,
        wallet.withdrawalEnabled,
        wallet.providerRef,
        wallet.custodyAccountId,
        wallet.idempotencyKey,
        wallet.createdAt,
        wallet.updatedAt,
      ],
    );
  });
}

export async function loadConsumerWalletByIdempotency(
  pool: Pool,
  idempotencyKey: string,
): Promise<PersistedConsumerWallet | null> {
  const result = await pool.query<WalletRow>(
    `SELECT wallet_id, customer_id, asset_id, network_id, custody_model, status,
            withdrawal_enabled, provider_ref, custody_account_id, idempotency_key,
            created_at, updated_at
       FROM custody.consumer_wallet
      WHERE idempotency_key = $1`,
    [idempotencyKey],
  );
  return result.rows[0] ? rowToWallet(result.rows[0]) : null;
}

export async function loadConsumerWallet(
  pool: Pool,
  customerId: string,
  walletId: string,
): Promise<PersistedConsumerWallet | null> {
  const result = await pool.query<WalletRow>(
    `SELECT wallet_id, customer_id, asset_id, network_id, custody_model, status,
            withdrawal_enabled, provider_ref, custody_account_id, idempotency_key,
            created_at, updated_at
       FROM custody.consumer_wallet
      WHERE customer_id = $1 AND wallet_id = $2`,
    [customerId, walletId],
  );
  return result.rows[0] ? rowToWallet(result.rows[0]) : null;
}

export async function loadConsumerWalletByAsset(
  pool: Pool,
  customerId: string,
  assetId: PersistedConsumerWallet['assetId'],
): Promise<PersistedConsumerWallet | null> {
  const result = await pool.query<WalletRow>(
    `SELECT wallet_id, customer_id, asset_id, network_id, custody_model, status,
            withdrawal_enabled, provider_ref, custody_account_id, idempotency_key,
            created_at, updated_at
       FROM custody.consumer_wallet
      WHERE customer_id = $1 AND asset_id = $2`,
    [customerId, assetId],
  );
  return result.rows[0] ? rowToWallet(result.rows[0]) : null;
}

export async function listConsumerWallets(
  pool: Pool,
  customerId: string,
): Promise<readonly PersistedConsumerWallet[]> {
  const result = await pool.query<WalletRow>(
    `SELECT wallet_id, customer_id, asset_id, network_id, custody_model, status,
            withdrawal_enabled, provider_ref, custody_account_id, idempotency_key,
            created_at, updated_at
       FROM custody.consumer_wallet
      WHERE customer_id = $1
      ORDER BY created_at ASC, wallet_id ASC`,
    [customerId],
  );
  return Object.freeze(result.rows.map(rowToWallet));
}

function rowToWallet(row: WalletRow): PersistedConsumerWallet {
  return Object.freeze({
    walletId: row.wallet_id,
    customerId: row.customer_id,
    assetId: row.asset_id,
    networkId: row.network_id,
    custodyModel: row.custody_model,
    status: row.status,
    withdrawalEnabled: row.withdrawal_enabled,
    providerRef: row.provider_ref,
    custodyAccountId: row.custody_account_id,
    idempotencyKey: row.idempotency_key,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  });
}

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
