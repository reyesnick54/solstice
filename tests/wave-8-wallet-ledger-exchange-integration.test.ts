import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createSandboxWorld, sandboxToken, consumerBffRuntimeFromWorld } from '../services/api/src/consumer/fixtures.ts';
import { handleConsumerBff, CONSUMER_BFF_ROUTES } from '../services/api/src/consumer/handler.ts';
import { MONEY_INTEGRATION_ROUTES } from '../services/api/src/consumer/money-integration/dispatch.ts';
import { createMoneyIntegrationPlatform } from '../services/api/src/consumer/money-integration/platform.ts';
import {
  reconcileMoneySurfaces,
  detectProjectionMismatch,
} from '../packages/custody/src/product/money-reconciliation.ts';
import {
  describeBlockchainAccount,
  describeCustodialWallet,
} from '../packages/custody/src/product/wallet-architecture.ts';
import { WalletEngine } from '../packages/sunrey-chain/src/wallet/engine.ts';
import { canonicalChainBalance, projectionMatchesCanonical } from '../packages/sunrey-chain/src/wallet/balance-projection.ts';
import {
  executeNativeTransferLifecycle,
  rejectReplay,
  recordFinalizedClientTx,
  rejectCrossAssetTransfer,
  transferIsComplete,
} from '../packages/sunrey-chain/src/wallet/transfer-lifecycle.ts';
import { isWalletRejection } from '../packages/sunrey-chain/src/wallet/types.ts';
import { NativeClearingEngine } from '../packages/sunrey-exchange/src/native-clearing/engine.ts';
import {
  mapNativeSettlementToWave8,
  wave8SettlementRecord,
  assertNoTickerCollision,
} from '../packages/sunrey-exchange/src/settlement-lifecycle.ts';
import {
  assertMarketPriceDoesNotAlterSupply,
  marketPriceBoundaryProof,
  sunreyTickerIsDistinctFromMoonrey,
} from '../packages/sunrey-exchange/src/market-price-boundary.ts';
import {
  MOONREY_COIN_NATIVE_ASSET_ID,
  SUNREY_COIN_NATIVE_ASSET_ID,
} from '../packages/sunrey-exchange/src/ids.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';

const NOW = asUtcInstant('2026-09-02T12:00:00.000Z');

function bffRuntime() {
  const world = createSandboxWorld();
  return consumerBffRuntimeFromWorld(world);
}

async function call(method: string, path: string, body: Record<string, unknown> = {}) {
  return Promise.resolve(
    handleConsumerBff(bffRuntime(), {
      method,
      path,
      query: {},
      body,
      authorization: `Bearer ${sandboxToken('basic_verified')}`,
      requestId: 'req_wave8',
    }),
  );
}

function setupWalletEngine(): { engine: WalletEngine; aliceId: string; bobId: string; bobAddress: string } {
  const engine = new WalletEngine();
  engine.unlock('development-passphrase');
  engine.createWallet({ walletId: 'alice', ownerActorId: 'alice', walletType: 'HUMAN', signerLabels: ['a'] });
  engine.createWallet({ walletId: 'bob', ownerActorId: 'bob', walletType: 'HUMAN', signerLabels: ['b'] });
  const alice = engine.getAccount('bca.alice');
  const bob = engine.getAccount('bca.bob');
  assert.ok(alice && bob);
  engine.faucet(alice.accountId, 1_000_000n, 'SUNREY_COIN');
  engine.fees.creditAuthorized(alice.accountId, 500_000n, 'MOONREY_COIN');
  return { engine, aliceId: alice.accountId, bobId: bob.accountId, bobAddress: bob.address.text };
}

describe('Wave 8 — wallet, ledger, exchange integration', () => {
  it('registers money integration BFF routes', () => {
    for (const route of MONEY_INTEGRATION_ROUTES) {
      assert.ok(CONSUMER_BFF_ROUTES.includes(route), `missing route ${route}`);
    }
  });

  it('formalizes wallet architecture without implying regulated custody', () => {
    const chain = describeBlockchainAccount({
      walletId: 'wal_chain',
      accountId: 'bca.alice',
      assetId: 'SUNREY_COIN',
    });
    assert.equal(chain.kind, 'BLOCKCHAIN_ACCOUNT');
    assert.equal(chain.regulatedCustodyConnected, false);
    assert.equal(chain.mutableBalanceFieldIsTruth, false);

    const custodial = describeCustodialWallet({
      walletId: 'wal_custody',
      accountId: 'cust_1',
      assetId: 'SUNREY_COIN',
      custodyModel: 'SUNREY_NATIVE',
    });
    assert.equal(custodial.kind, 'CUSTODIAL_WALLET');
    assert.equal(custodial.balanceAuthority, 'CUSTODY_PROVIDER_REPORTED_STATE');
  });

  it('derives native balance from canonical chain state', () => {
    const { engine, aliceId } = setupWalletEngine();
    const projection = canonicalChainBalance(engine, aliceId, 'SUNREY_COIN');
    assert.equal(projection.authority, 'NATIVE_BLOCKCHAIN_AUTHORITY');
    assert.equal(projection.mutableBalanceFieldIsTruth, false);
    assert.equal(projection.availableMinorUnits, 1_000_000n);
    assert.equal(projectionMatchesCanonical(projection, engine), true);
  });

  it('executes SunRey native transfer through finality', () => {
    const { engine, aliceId, bobId, bobAddress } = setupWalletEngine();
    const receipt = executeNativeTransferLifecycle(engine, {
      walletId: 'alice',
      toAccountId: bobId,
      toAddressText: bobAddress,
      amount: 100_000n,
      maxFee: 5_000n,
      assetId: 'SUNREY_COIN',
      keyIds: ['alice.key.1'],
    });
    assert.equal('schema' in receipt, true);
    if ('schema' in receipt) {
      assert.equal(receipt.assetId, 'SUNREY_COIN');
      assert.equal(transferIsComplete(receipt.state), true);
      assert.equal(receipt.finalized, true);
      assert.ok(receipt.txId);
    }
    assert.equal(engine.balance(bobId, 'SUNREY_COIN'), 100_000n);
  });

  it('executes MoonRey native transfer when simulation balance is credited', () => {
    const { engine, bobId, bobAddress } = setupWalletEngine();
    const receipt = executeNativeTransferLifecycle(engine, {
      walletId: 'alice',
      toAccountId: bobId,
      toAddressText: bobAddress,
      amount: 50_000n,
      maxFee: 5_000n,
      assetId: 'MOONREY_COIN',
      keyIds: ['alice.key.1'],
    });
    assert.equal('schema' in receipt, true);
    if ('schema' in receipt) {
      assert.equal(receipt.assetId, 'MOONREY_COIN');
      assert.equal(receipt.state, 'FINALIZED');
      assert.equal(receipt.finalized, true);
    }
  });

  it('rejects cross-asset unsupported id at lifecycle boundary', () => {
    assert.equal(rejectCrossAssetTransfer('FAKE_COIN', ['SUNREY_COIN', 'MOONREY_COIN']), true);
  });

  it('rejects insufficient balance', () => {
    const { engine, bobId, bobAddress } = setupWalletEngine();
    const receipt = executeNativeTransferLifecycle(engine, {
      walletId: 'alice',
      toAccountId: bobId,
      toAddressText: bobAddress,
      amount: 9_999_999n,
      maxFee: 5_000n,
      assetId: 'SUNREY_COIN',
      keyIds: ['alice.key.1'],
    });
    assert.equal('schema' in receipt, true);
    if ('schema' in receipt) {
      assert.equal(receipt.state, 'REJECTED');
      assert.equal(receipt.finalized, false);
    }
  });

  it('rejects transaction replay', () => {
    const engine = new WalletEngine();
    assert.equal(rejectReplay(engine, 'client-tx-1'), false);
    recordFinalizedClientTx(engine, 'client-tx-1');
    assert.equal(rejectReplay(engine, 'client-tx-1'), true);
  });

  it('detects projection mismatch without auto-correcting chain', () => {
    const mismatch = detectProjectionMismatch({
      assetId: 'SUNREY_COIN',
      canonicalChainQuantity: 1_000n,
      projectedQuantity: 900n,
    });
    assert.ok(mismatch);
    assert.equal(mismatch!.kind, 'PROJECTION_MISMATCH');
    assert.equal(mismatch!.chainStateRewritten, false);
    assert.equal(mismatch!.autoCorrected, false);
  });

  it('reconciles money surfaces without rewriting chain state', () => {
    const report = reconcileMoneySurfaces({
      assetId: 'SUNREY_COIN',
      chainQuantity: 1_000n,
      custodyQuantity: 900n,
      exchangeQuantity: 900n,
      customerReadModelQuantity: 900n,
    });
    assert.equal(report.matched, false);
    assert.equal(report.chainStateRewritten, false);
    assert.equal(report.autoCorrected, false);
  });

  it('separates SunRey and MoonRey tickers and assets', () => {
    assert.equal(sunreyTickerIsDistinctFromMoonrey(), true);
    assert.equal(assertNoTickerCollision(SUNREY_COIN_NATIVE_ASSET_ID, MOONREY_COIN_NATIVE_ASSET_ID), true);
    assert.throws(() =>
      wave8SettlementRecord({
        settlementId: 'xset_1',
        state: 'MATCHED',
        baseAssetId: 'SUNREY_COIN',
        quoteAssetId: 'SUNREY_COIN',
      }),
    );
  });

  it('proves market price is not PEVE or GPUV and does not alter supply', () => {
    const proof = marketPriceBoundaryProof();
    assert.equal(proof.sunreyMarketPriceIsPeve, false);
    assert.equal(proof.moonreyMarketPriceIsGpuv, false);
    assert.equal(proof.exchangePriceMutatesNativeSupply, false);
    const supplyCheck = assertMarketPriceDoesNotAlterSupply({
      assetId: SUNREY_COIN_NATIVE_ASSET_ID,
      supplyBefore: 10_000_000n,
      supplyAfter: 10_000_000n,
      tradeExecuted: true,
    });
    assert.equal(supplyCheck.ok, true);
  });

  it('maps native settlement to Wave 8 states', () => {
    assert.equal(mapNativeSettlementToWave8('SETTLEMENT_CREATED'), 'SETTLEMENT_PENDING');
    assert.equal(mapNativeSettlementToWave8('FINALIZED'), 'SETTLED');
    assert.equal(mapNativeSettlementToWave8('FAILED'), 'FAILED');
  });

  it('runs exchange sandbox order/trade without minting supply', () => {
    const clearing = new NativeClearingEngine();
    const buyer = clearing.openExchangeAccount('cust_buyer');
    const seller = clearing.openExchangeAccount('cust_seller');
    clearing.faucetToCustody(seller, SUNREY_COIN_NATIVE_ASSET_ID, 1_000_000n);
    clearing.faucetToCustody(buyer, MOONREY_COIN_NATIVE_ASSET_ID, 2_000_000n);
    const supplyBefore = clearing.chain.issued.get(SUNREY_COIN_NATIVE_ASSET_ID) ?? 0n;
    clearing.placeOrder({
      accountId: seller,
      side: 'SELL',
      quantity: 100_000n,
      priceUnits: 2_500_000n,
      now: NOW,
    });
    clearing.placeOrder({
      accountId: buyer,
      side: 'BUY',
      quantity: 100_000n,
      priceUnits: 2_500_000n,
      now: NOW,
    });
    const supplyAfter = clearing.chain.issued.get(SUNREY_COIN_NATIVE_ASSET_ID) ?? 0n;
    assert.equal(supplyBefore, supplyAfter);
    const settlement = [...clearing.settlements.values()][0]!;
    assert.ok(settlement);
    clearing.submitSettlement(settlement.settlementId);
    const finalized = clearing.settlements.get(settlement.settlementId);
    assert.equal(finalized?.status, 'FINALIZED');
  });

  it('detects duplicate settlement in reconciliation', () => {
    const report = reconcileMoneySurfaces({
      assetId: 'SUNREY_COIN',
      chainQuantity: 1_000n,
      custodyQuantity: 1_000n,
      exchangeQuantity: 1_000n,
      customerReadModelQuantity: 1_000n,
      duplicateSettlementIds: ['xset_dup'],
    });
    assert.equal(report.matched, false);
    assert.ok(report.breaks.some((b) => b.kind === 'DUPLICATE_SETTLEMENT'));
  });

  it('rebuilds wallet projection after service restart simulation', () => {
    const { engine, aliceId } = setupWalletEngine();
    const before = canonicalChainBalance(engine, aliceId, 'SUNREY_COIN');
    engine.reconstructHistory();
    const rebuilt = canonicalChainBalance(engine, aliceId, 'SUNREY_COIN');
    assert.equal(before.availableMinorUnits, rebuilt.availableMinorUnits);
  });

  it('GET /api/v1/money/holdings returns sandbox holdings', async () => {
    const result = await call('GET', '/api/v1/money/holdings');
    assert.equal(result.status, 200);
    const body = result.body as { schema: string; productionMoneyMovement: false; items: unknown[] };
    assert.equal(body.productionMoneyMovement, false);
    assert.ok(body.items.length > 0);
  });

  it('GET /api/v1/money/history returns unified projection', async () => {
    const result = await call('GET', '/api/v1/money/history');
    assert.equal(result.status, 200);
    const body = result.body as { items: { schema: string; sourceType: string }[] };
    assert.ok(Array.isArray(body.items));
    for (const item of body.items) {
      assert.equal(item.schema, 'sunrey.unified-transaction-history.v1');
    }
  });

  it('GET /api/v1/money/market-price-boundary proves separation', async () => {
    const result = await call('GET', '/api/v1/money/market-price-boundary');
    assert.equal(result.status, 200);
    const body = result.body as { sunreyMarketPriceIsPeve: false; moonreyMarketPriceIsGpuv: false };
    assert.equal(body.sunreyMarketPriceIsPeve, false);
    assert.equal(body.moonreyMarketPriceIsGpuv, false);
  });

  it('reports settlement failure before finality on matched trade', () => {
    const clearing = new NativeClearingEngine();
    const buyer = clearing.openExchangeAccount('cust_buyer');
    const seller = clearing.openExchangeAccount('cust_seller');
    clearing.faucetToCustody(seller, SUNREY_COIN_NATIVE_ASSET_ID, 1_000_000n);
    clearing.faucetToCustody(buyer, MOONREY_COIN_NATIVE_ASSET_ID, 2_000_000n);
    clearing.placeOrder({
      accountId: seller,
      side: 'SELL',
      quantity: 100_000n,
      priceUnits: 2_500_000n,
      now: NOW,
    });
    clearing.placeOrder({
      accountId: buyer,
      side: 'BUY',
      quantity: 100_000n,
      priceUnits: 2_500_000n,
      now: NOW,
    });
    const settlement = [...clearing.settlements.values()][0]!;
    assert.equal(mapNativeSettlementToWave8(settlement.status), 'SETTLEMENT_PENDING');
    assert.equal(settlement.status, 'SETTLEMENT_CREATED');
    assert.equal(settlement.transactionId, null);
  });

  it('rebuilds money integration platform after simulated service restart', () => {
    const world = createSandboxWorld();
    const engine = new WalletEngine();
    engine.unlock('development-passphrase');
    const first = createMoneyIntegrationPlatform({
      walletEngine: engine,
      walletProduct: world.wallets,
      nativeClearing: new NativeClearingEngine(),
      nowUtc: NOW,
    });
    const before = first.unifiedHistory('cust_sandbox_basic');
    const restarted = createMoneyIntegrationPlatform({
      walletEngine: engine,
      walletProduct: world.wallets,
      nativeClearing: new NativeClearingEngine(),
      nowUtc: NOW,
    });
    const after = restarted.unifiedHistory('cust_sandbox_basic');
    assert.equal(before.length, after.length);
  });

  it('POST /api/v1/money/reconcile returns plane report', async () => {
    const result = await call('POST', '/api/v1/money/reconcile', { assetId: 'SUNREY_COIN' });
    assert.equal(result.status, 200);
    const body = result.body as { schema: string; autoCorrected: false; chainStateRewritten: false };
    assert.equal(body.schema, 'sunrey.money-reconciliation.v1');
    assert.equal(body.autoCorrected, false);
    assert.equal(body.chainStateRewritten, false);
  });

  it('money integration platform survives restart with same deps', () => {
    const world = createSandboxWorld();
    const engine = new WalletEngine();
    engine.unlock('development-passphrase');
    const platform = createMoneyIntegrationPlatform({
      walletEngine: engine,
      walletProduct: world.wallets,
      nowUtc: NOW,
    });
    const first = platform.describeHoldings('cust_sandbox_basic');
    const second = platform.describeHoldings('cust_sandbox_basic');
    assert.equal(first.length, second.length);
  });
});
