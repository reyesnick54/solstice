/**
 * Wave 8 — wallet / ledger / exchange integration exit gate.
 *
 * Structural checks that money surfaces remain connected without creating
 * a second monetary ledger or weakening authority boundaries.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { ENVIRONMENT, LIVE_BANKING_RAILS } from '../packages/config/src/flags.ts';
import {
  reconcileMoneySurfaces,
  detectProjectionMismatch,
} from '../packages/custody/src/product/money-reconciliation.ts';
import {
  describeCustodialWallet,
  describeBlockchainAccount,
} from '../packages/custody/src/product/wallet-architecture.ts';
import { marketPriceBoundaryProof } from '../packages/sunrey-exchange/src/market-price-boundary.ts';
import {
  mapNativeSettlementToWave8,
  WAVE8_SETTLEMENT_STATES,
} from '../packages/sunrey-exchange/src/settlement-lifecycle.ts';
import { createSandboxMoneyIntegration } from '../services/api/src/consumer/money-integration/sandbox.ts';
import { createWalletProductSandbox } from '../packages/custody/src/product/sandbox.ts';
import { CONSUMER_BFF_ROUTES } from '../services/api/src/consumer/handler.ts';
import { MONEY_INTEGRATION_ROUTES } from '../services/api/src/consumer/money-integration/dispatch.ts';

const ROOT = join(import.meta.dirname, '..');

describe('Wave 8 exit gate — architecture artifacts', () => {
  it('ships integration and completion documentation', () => {
    assert.equal(existsSync(join(ROOT, 'docs/architecture/WAVE8_WALLET_LEDGER_EXCHANGE_INTEGRATION.md')), true);
    assert.equal(existsSync(join(ROOT, 'docs/architecture/WAVE8_COMPLETION_REPORT.md')), true);
  });

  it('does not create forbidden parallel wallet or ledger packages', () => {
    for (const forbidden of [
      'packages/wallet',
      'packages/wallet-v2',
      'packages/money-integration',
      'packages/access-ledger',
    ]) {
      assert.equal(existsSync(join(ROOT, forbidden)), false, `forbidden package ${forbidden}`);
    }
  });
});

describe('Wave 8 exit gate — authority invariants', () => {
  it('keeps simulation posture and live flags off', () => {
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_BANKING_RAILS, false);
  });

  it('never auto-corrects chain or ledger on reconciliation mismatch', () => {
    const report = reconcileMoneySurfaces({
      assetId: 'SUNREY_COIN',
      chainQuantity: 100n,
      custodyQuantity: 90n,
      exchangeQuantity: 90n,
      customerReadModelQuantity: 90n,
    });
    assert.equal(report.autoCorrected, false);
    assert.equal(report.chainStateRewritten, false);
    const mismatch = detectProjectionMismatch({
      assetId: 'SUNREY_COIN',
      canonicalChainQuantity: 100n,
      projectedQuantity: 90n,
    });
    assert.equal(mismatch?.autoCorrected, false);
    assert.equal(mismatch?.chainStateRewritten, false);
  });

  it('labels wallet descriptors without regulated custody or mutable balance truth', () => {
    const chain = describeBlockchainAccount({
      walletId: 'wal_chain',
      accountId: 'bca.test',
      assetId: 'SUNREY_COIN',
    });
    const custody = describeCustodialWallet({
      walletId: 'wal_custody',
      accountId: 'cust.test',
      assetId: 'SUNREY_COIN',
      custodyModel: 'SUNREY_NATIVE',
    });
    assert.equal(chain.mutableBalanceFieldIsTruth, false);
    assert.equal(custody.regulatedCustodyConnected, false);
    assert.notEqual(chain.balanceAuthority, custody.balanceAuthority);
  });

  it('proves exchange market price is not PEVE or GPUV and does not mutate supply', () => {
    const proof = marketPriceBoundaryProof();
    assert.equal(proof.sunreyMarketPriceIsPeve, false);
    assert.equal(proof.moonreyMarketPriceIsGpuv, false);
    assert.equal(proof.exchangePriceMutatesNativeSupply, false);
  });
});

describe('Wave 8 exit gate — product wiring', () => {
  it('registers money integration BFF routes on the consumer handler', () => {
    for (const route of MONEY_INTEGRATION_ROUTES) {
      assert.ok(CONSUMER_BFF_ROUTES.includes(route), `missing ${route}`);
    }
  });

  it('exposes unified settlement vocabulary', () => {
    assert.ok(WAVE8_SETTLEMENT_STATES.includes('SETTLEMENT_PENDING'));
    assert.equal(mapNativeSettlementToWave8('FINALIZED'), 'SETTLED');
    assert.equal(mapNativeSettlementToWave8('FAILED'), 'FAILED');
  });

  it('wires sandbox money integration with finalized native trade seed', () => {
    const sandbox = createWalletProductSandbox();
    const wired = createSandboxMoneyIntegration({
      walletProduct: sandbox.product,
      exchangeCustomerId: 'cust_exchange',
      counterpartyCustomerId: 'cust_counterparty',
    });
    const settlements = wired.platform.settlementRecords('cust_exchange');
    assert.ok(settlements.length > 0);
    assert.equal(settlements[0]?.state, 'SETTLED');
    assert.equal(settlements[0]?.sandboxSimulation, true);
    assert.equal(settlements[0]?.mutatesNativeSupply, false);
  });
});

describe('Wave 8 exit gate — documentation contracts', () => {
  it('integration doc forbids second ledger and live regulated rails', () => {
    const doc = readFileSync(join(ROOT, 'docs/architecture/WAVE8_WALLET_LEDGER_EXCHANGE_INTEGRATION.md'), 'utf8');
    assert.ok(doc.includes('without allowing any secondary system to become a second monetary ledger'));
    assert.ok(doc.includes('productionMoneyMovement: false'));
    assert.ok(doc.includes('chainStateRewritten: false'));
    assert.ok(doc.includes('Do not start Prompt 4') === false);
  });
});
