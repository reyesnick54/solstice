/**
 * Sandbox digital-asset lifecycle used by Phase G qualification and the Consumer BFF.
 * Composes ConsumerExchangeEngine + native clearing. Not a second matching engine.
 */

import { createHash, randomUUID } from 'node:crypto';

import type { UtcInstant } from '../../../domain/src/time.ts';
import {
  MOONREY_COIN_NATIVE_ASSET_ID,
  SUNREY_COIN_NATIVE_ASSET_ID,
  SUNREY_MOONREY_MARKET_ID,
} from '../ids.ts';
import { ConsumerExchangeEngine } from '../consumer/engine.ts';
import type { ConsumerAuthorization, ConsumerOrderStatus, ConsumerTradePreview } from '../consumer/types.ts';
import { depthFromOrders } from '../ops/market-data.ts';
import { engageExchangeKillSwitch } from '../regulated/kill-switches.ts';
import { EXCHANGE_LOVABLE_SCREENS } from './taxonomy.ts';
import { marketDataClientStatus } from './economy.ts';

export type LifecycleMode =
  | 'READY'
  | 'MARKET_CLOSED'
  | 'MARKET_HALTED'
  | 'NO_LIQUIDITY'
  | 'INSUFFICIENT_BALANCE'
  | 'INVALID_QUANTITY'
  | 'INVALID_PRICE'
  | 'STALE_MARKET_DATA'
  | 'CUSTODY_UNAVAILABLE'
  | 'CHAIN_UNAVAILABLE'
  | 'SETTLEMENT_FAILURE'
  | 'TRAVEL_RULE_PENDING'
  | 'COMPLIANCE_BLOCKED'
  | 'PROVIDER_KILL_SWITCH';

export type DigitalAssetProposal = {
  readonly proposalId: string;
  readonly participantId: string;
  readonly side: 'BUY' | 'SELL';
  readonly quantity: bigint;
  readonly notionalUsdMinor: string;
  readonly previewId: string;
  readonly humanReadableIntent: string;
  readonly estimatedPrice: string | null;
  readonly fees: string;
  readonly marketRisk: string;
  readonly noGuaranteedExecutionPrice: true;
  readonly approved: boolean;
  readonly stepUpSatisfied: boolean;
  readonly origin: 'HUMAN' | 'AGENT';
  readonly executionAuthorityIssued: boolean;
};

function id(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, '')}`;
}

function walletAuth(intentDisplay: string, origin: 'HUMAN' | 'AGENT' = 'HUMAN'): ConsumerAuthorization {
  return Object.freeze({
    sessionId: 'cses_phase_g',
    sessionAuthenticated: true,
    wallet: Object.freeze({
      walletId: 'wallet_phase_g',
      signedIntentHex: 'signed-phase-g-intent-aabbccddeeff',
      intentDisplay,
      authorizationKind: 'WALLET_SIGNATURE' as const,
    }),
    origin,
    agentMandate:
      origin === 'AGENT'
        ? Object.freeze({
            mandateId: 'man_phase_g_trade',
            capability: 'CONSUMER_TRADE' as const,
            matchingPriority: 'NONE' as const,
            privilegedPrice: false as const,
          })
        : null,
  });
}

export class DigitalAssetLifecycle {
  readonly engine: ConsumerExchangeEngine;
  readonly participantId: string;
  readonly now: UtcInstant;
  readonly mode: LifecycleMode;
  readonly proposals = new Map<string, DigitalAssetProposal>();
  readonly deposits = new Map<string, Record<string, unknown>>();
  readonly withdrawals = new Map<string, Record<string, unknown>>();
  readonly evidence: string[] = [];
  readonly activity: Record<string, unknown>[] = [];
  private snapshot: Record<string, unknown> | null = null;
  moonreyIssuanceAuthorized = false;

  constructor(input: { readonly now: UtcInstant; readonly participantId?: string; readonly mode?: LifecycleMode }) {
    this.now = input.now;
    this.participantId = input.participantId ?? 'phase_g_user';
    this.mode = input.mode ?? 'READY';
    this.engine = new ConsumerExchangeEngine({ now: input.now });
    this.engine.registerConsumer({
      participantId: this.participantId,
      environment: 'SANDBOX',
      jurisdiction: 'GB',
      custodyReady: this.mode !== 'CUSTODY_UNAVAILABLE',
      walletReady: this.mode !== 'CUSTODY_UNAVAILABLE',
      complianceState: this.mode === 'COMPLIANCE_BLOCKED' ? 'BLOCKED' : 'CLEAR',
      exchangeCapabilityActive: this.mode !== 'PROVIDER_KILL_SWITCH',
    });
    if (this.mode === 'MARKET_CLOSED') {
      this.engine.ops.transitionMarket({
        marketId: SUNREY_MOONREY_MARKET_ID,
        state: 'CLOSED',
        actorKind: 'HUMAN',
        reason: 'PHASE_G_MARKET_CLOSED',
        now: input.now,
      });
    }
    if (this.mode === 'MARKET_HALTED') {
      this.engine.ops.transitionMarket({
        marketId: SUNREY_MOONREY_MARKET_ID,
        state: 'HALTED',
        actorKind: 'HUMAN',
        reason: 'PHASE_G_MARKET_HALTED',
        now: input.now,
      });
    }
    if (this.mode !== 'NO_LIQUIDITY') {
      this.engine.seedLiquidity({
        participantId: `${this.participantId}_maker_sell`,
        side: 'SELL',
        quantity: 50n,
        priceUnits: 2_500_000n,
        now: input.now,
      });
      this.engine.seedLiquidity({
        participantId: `${this.participantId}_maker_buy`,
        side: 'BUY',
        quantity: 50n,
        priceUnits: 2_400_000n,
        now: input.now,
      });
    }
    if (this.mode === 'PROVIDER_KILL_SWITCH') {
      engageExchangeKillSwitch({
        scope: 'ORDER_ENTRY',
        targetId: SUNREY_MOONREY_MARKET_ID,
        actorKind: 'HUMAN',
        reason: 'PHASE_G_KILL_SWITCH_REHEARSAL',
      });
    }
  }

  home(): Record<string, unknown> {
    return {
      schema: 'sunrey.consumer.exchange.home.v1',
      productionMoneyMovement: false,
      liveExchangeEnabled: false,
      screens: EXCHANGE_LOVABLE_SCREENS,
      marketId: SUNREY_MOONREY_MARKET_ID,
      eligibility: this.eligibility(),
      marketDataStatus: this.marketDataStatus(),
    };
  }

  eligibility(): Record<string, unknown> {
    const gate = this.engine.eligibility(this.participantId);
    return {
      ...gate,
      kycVerified: gate.identityEligible && gate.complianceClear,
      sandboxCompliance: true,
    };
  }

  markets(): Record<string, unknown> {
    const market = this.engine.getConsumerMarket(this.now);
    return {
      schema: 'sunrey.consumer.exchange.markets.v1',
      items: [
        {
          marketId: market.marketId,
          symbol: 'SUNREY/MOONREY',
          baseAsset: market.baseAsset,
          quoteAsset: market.quoteAsset,
          state: market.marketState,
          last: market.lastEligibleTrade?.toString() ?? null,
          marketDataStatus: this.marketDataStatus(),
        },
        {
          marketId: 'market:sunrey-coin-usd-simulation',
          symbol: 'SUNREY/USD',
          baseAsset: 'SUNREY_COIN',
          quoteAsset: 'USD',
          state: 'SANDBOX_INDICATIVE',
          last: null,
          marketDataStatus: 'SANDBOX',
          informationalOnly: true,
        },
      ],
    };
  }

  marketDetail(marketId: string): Record<string, unknown> {
    const market = this.engine.getConsumerMarket(this.now);
    return {
      schema: 'sunrey.consumer.exchange.market.v1',
      requestedMarketId: marketId,
      ...market,
      lastEligibleTrade: market.lastEligibleTrade?.toString() ?? null,
      bestBid: market.bestBid?.toString() ?? null,
      bestAsk: market.bestAsk?.toString() ?? null,
      marketDataStatus: this.marketDataStatus(),
    };
  }

  ticker(): Record<string, unknown> {
    const market = this.engine.getConsumerMarket(this.now);
    return {
      schema: 'sunrey.consumer.exchange.ticker.v1',
      marketId: market.marketId,
      last: market.lastEligibleTrade?.toString() ?? null,
      bid: market.bestBid?.toString() ?? null,
      ask: market.bestAsk?.toString() ?? null,
      guaranteed: false,
      marketDataStatus: this.marketDataStatus(),
    };
  }

  orderBook(): Record<string, unknown> {
    const book = depthFromOrders([...this.engine.ops.orders.values()]);
    return {
      schema: 'sunrey.consumer.exchange.order-book.v1',
      marketId: book.marketId,
      bids: book.bids.map((row) => ({ priceUnits: row.priceUnits.toString(), quantity: row.quantity.toString(), orderCount: row.orderCount })),
      asks: book.asks.map((row) => ({ priceUnits: row.priceUnits.toString(), quantity: row.quantity.toString(), orderCount: row.orderCount })),
      marketDataStatus: this.marketDataStatus(),
    };
  }

  chart(): Record<string, unknown> {
    const market = this.engine.getConsumerMarket(this.now);
    return {
      schema: 'sunrey.consumer.exchange.chart.v1',
      marketId: market.marketId,
      candles: market.statistics.valid
        ? [
            {
              open: market.statistics.lowPriceUnits?.toString() ?? null,
              high: market.statistics.highPriceUnits?.toString() ?? null,
              low: market.statistics.lowPriceUnits?.toString() ?? null,
              close: market.lastEligibleTrade?.toString() ?? null,
              quality: this.marketDataStatus(),
            },
          ]
        : [],
      statisticsValid: market.statistics.valid,
      reason: market.statistics.reason,
      marketDataStatus: this.marketDataStatus(),
    };
  }

  holdings(): Record<string, unknown> {
    const profile = this.engine.profiles.get(this.participantId);
    if (!profile) {
      return { ok: false, reason: 'UNKNOWN_CONSUMER' };
    }
    const sun = this.engine.ops.clearing.position(profile.accountId, SUNREY_COIN_NATIVE_ASSET_ID);
    const moon = this.engine.ops.clearing.position(profile.accountId, MOONREY_COIN_NATIVE_ASSET_ID);
    return {
      schema: 'sunrey.consumer.wallet.holdings.v1',
      accountId: profile.accountId,
      items: [
        { assetId: 'SUNREY_COIN', available: sun.available.toString(), reserved: sun.reserved.toString(), pending: sun.pendingSettlement.toString(), finalized: sun.finalized.toString() },
        { assetId: 'MOONREY_COIN', available: moon.available.toString(), reserved: moon.reserved.toString(), pending: moon.pendingSettlement.toString(), finalized: moon.finalized.toString() },
      ],
      ledgerWins: true,
      productionLabel: 'NON_PRODUCTION',
    };
  }

  fundQuote(quantity = 1_000_000n): Record<string, unknown> {
    const profile = this.engine.profiles.get(this.participantId)!;
    this.engine.creditSimulationHolding(profile.accountId, 'MOONREY_COIN', quantity);
    this.activity.push({ kind: 'SANDBOX_FUND_QUOTE', quantity: quantity.toString() });
    this.evidence.push('sandbox_quote_funded');
    return { ok: true, assetId: 'MOONREY_COIN', quantity: quantity.toString(), source: 'SANDBOX_FAUCET' };
  }

  fundBase(quantity = 100n): Record<string, unknown> {
    const profile = this.engine.profiles.get(this.participantId)!;
    this.engine.creditSimulationHolding(profile.accountId, 'SUNREY_COIN', quantity);
    return { ok: true, assetId: 'SUNREY_COIN', quantity: quantity.toString(), source: 'SANDBOX_FAUCET' };
  }

  preview(input: { readonly side: 'BUY' | 'SELL'; readonly quantity: bigint; readonly notionalUsdMinor?: string }): ConsumerTradePreview | { readonly ok: false; readonly reason: string } {
    if (this.mode === 'INVALID_QUANTITY' || input.quantity <= 0n) {
      return { ok: false, reason: 'INVALID_QUANTITY' };
    }
    if (this.mode === 'STALE_MARKET_DATA') {
      return { ok: false, reason: 'STALE_MARKET_DATA' };
    }
    const preview = this.engine.previewConsumerTrade({
      participantId: this.participantId,
      flow: input.side,
      side: input.side,
      orderType: 'LIMIT',
      quantity: input.quantity,
      now: this.now,
    });
    if ('ok' in preview) {
      return preview;
    }
    return preview;
  }

  createProposal(input: {
    readonly side: 'BUY' | 'SELL';
    readonly quantity: bigint;
    readonly notionalUsdMinor?: string;
    readonly origin?: 'HUMAN' | 'AGENT';
  }): DigitalAssetProposal | { readonly ok: false; readonly reason: string } {
    const preview = this.preview(input);
    if ('ok' in preview && preview.ok === false) {
      return preview;
    }
    const ready = preview as ConsumerTradePreview;
    const proposal: DigitalAssetProposal = Object.freeze({
      proposalId: id('xprp'),
      participantId: this.participantId,
      side: input.side,
      quantity: input.quantity,
      notionalUsdMinor: input.notionalUsdMinor ?? (input.side === 'BUY' ? '50000' : '0'),
      previewId: ready.previewId,
      humanReadableIntent: ready.humanReadableIntent,
      estimatedPrice: ready.estimatedExecutionPriceUnits?.toString() ?? null,
      fees: ready.estimatedFee.exchangeFeeQuantity.toString(),
      marketRisk: ready.riskDisclosure.noGuaranteedPrice ? 'MARKET_RISK_DISCLOSED' : 'MARKET_RISK_DISCLOSED',
      noGuaranteedExecutionPrice: true,
      approved: false,
      stepUpSatisfied: false,
      origin: input.origin ?? 'HUMAN',
      executionAuthorityIssued: false,
    });
    this.proposals.set(proposal.proposalId, proposal);
    this.activity.push({ kind: 'PROPOSAL_CREATED', proposalId: proposal.proposalId, side: proposal.side });
    return proposal;
  }

  approveProposal(input: {
    readonly proposalId: string;
    readonly actor: 'HUMAN' | 'AGENT';
    readonly stepUpSatisfied?: boolean;
  }): DigitalAssetProposal | { readonly ok: false; readonly reason: string } {
    const existing = this.proposals.get(input.proposalId);
    if (!existing) {
      return { ok: false, reason: 'UNKNOWN_PROPOSAL' };
    }
    if (input.actor === 'AGENT') {
      return { ok: false, reason: 'AGENT_CANNOT_SELF_APPROVE' };
    }
    if (input.stepUpSatisfied !== true) {
      return { ok: false, reason: 'STEP_UP_REQUIRED' };
    }
    const next: DigitalAssetProposal = Object.freeze({
      ...existing,
      approved: true,
      stepUpSatisfied: true,
      executionAuthorityIssued: true,
    });
    this.proposals.set(next.proposalId, next);
    this.evidence.push('human_approval_and_step_up');
    return next;
  }

  submitOrder(proposalId: string, clientOrderId = id('clord')): ConsumerOrderStatus | { readonly ok: false; readonly reason: string } {
    if (this.mode === 'CHAIN_UNAVAILABLE') {
      return { ok: false, reason: 'CHAIN_UNAVAILABLE' };
    }
    if (this.mode === 'SETTLEMENT_FAILURE') {
      return { ok: false, reason: 'SETTLEMENT_FAILURE' };
    }
    if (this.mode === 'INVALID_PRICE') {
      return { ok: false, reason: 'INVALID_PRICE' };
    }
    const proposal = this.proposals.get(proposalId);
    if (!proposal || !proposal.approved || !proposal.stepUpSatisfied || !proposal.executionAuthorityIssued) {
      return { ok: false, reason: 'EXECUTION_AUTHORITY_REQUIRED' };
    }
    if (this.mode === 'INSUFFICIENT_BALANCE') {
      return { ok: false, reason: 'INSUFFICIENT_BALANCE' };
    }
    const result = this.engine.submitConsumerTrade({
      participantId: this.participantId,
      now: this.now,
      authorization: walletAuth(proposal.humanReadableIntent, proposal.origin),
      request: {
        clientOrderId,
        marketId: SUNREY_MOONREY_MARKET_ID,
        flow: proposal.side,
        side: proposal.side,
        orderType: 'LIMIT',
        quantity: proposal.quantity,
        limitPriceUnits: proposal.side === 'BUY' ? 2_500_000n : 2_400_000n,
        priceProtectionBps: null,
        quoteId: null,
        previewId: proposal.previewId,
      },
    });
    if ('ok' in result) {
      return result;
    }
    this.activity.push({ kind: 'ORDER_SUBMITTED', orderId: result.orderId, view: result.view });
    this.evidence.push('order_submitted_matched_settled');
    return result;
  }

  orders(): Record<string, unknown> {
    const items = [...this.engine.orders.values()].filter((row) => {
      const profile = this.engine.profiles.get(this.participantId);
      return Boolean(profile);
    });
    return { schema: 'sunrey.consumer.exchange.orders.v1', items };
  }

  fills(): Record<string, unknown> {
    const items = [...this.engine.receipts.values()].flatMap((receipt) =>
      receipt.fills.map((fill) => ({
        ...fill,
        quantity: fill.quantity.toString(),
        priceUnits: fill.priceUnits.toString(),
        orderId: receipt.orderId,
        fees: receipt.fees,
      })),
    );
    return { schema: 'sunrey.consumer.exchange.fills.v1', items };
  }

  wallet(): Record<string, unknown> {
    const deposit = this.engine.depositReference(this.participantId);
    return {
      schema: 'sunrey.consumer.wallet.v1',
      walletId: `wal_${this.participantId}`,
      depositAddress: deposit.address,
      source: deposit.source,
      holdings: this.holdings(),
      productionSigning: false,
    };
  }

  simulateDeposit(quantity = 25n): Record<string, unknown> {
    if (this.mode === 'CHAIN_UNAVAILABLE') {
      return { ok: false, reason: 'CHAIN_UNAVAILABLE' };
    }
    const profile = this.engine.profiles.get(this.participantId)!;
    const address = this.engine.ops.clearing.allocateDepositAddress(profile.accountId);
    const pending = this.engine.ops.clearing.observeChainTransfer({
      address,
      assetId: SUNREY_COIN_NATIVE_ASSET_ID,
      quantity,
      transactionId: `ntx_dep_${randomUUID().replace(/-/g, '')}`,
      finality: 'PENDING_PROPOSAL',
    });
    this.engine.creditSimulationHolding(profile.accountId, 'SUNREY_COIN', quantity);
    const row = {
      depositId: pending.depositId,
      address,
      quantity: quantity.toString(),
      finality: 'BFT_FINALIZED' as const,
      credited: true,
      detected: true,
    };
    this.deposits.set(pending.depositId, row);
    this.activity.push({ kind: 'DEPOSIT_FINALIZED', ...row });
    this.evidence.push('native_deposit_finalized');
    return { ok: true, ...row };
  }

  withdrawalQuote(input: { readonly assetId: 'SUNREY_COIN' | 'MOONREY_COIN'; readonly quantity: bigint; readonly destination: string }): Record<string, unknown> {
    if (this.mode === 'TRAVEL_RULE_PENDING') {
      return { ok: false, reason: 'TRAVEL_RULE_PENDING', travelRule: 'PENDING' };
    }
    if (input.destination === 'INVALID' || input.destination.length < 4) {
      return { ok: false, reason: 'DESTINATION_INVALID' };
    }
    return {
      ok: true,
      quoteId: id('wquote'),
      assetId: input.assetId,
      quantity: input.quantity.toString(),
      destination: input.destination,
      travelRule: 'SANDBOX_CLEAR',
      compliance: 'CLEAR',
      guaranteedNetworkFee: false,
    };
  }

  withdraw(input: {
    readonly assetId: 'SUNREY_COIN' | 'MOONREY_COIN';
    readonly quantity: bigint;
    readonly destination: string;
    readonly approved?: boolean;
    readonly actor?: 'HUMAN' | 'AGENT';
  }): Record<string, unknown> {
    if (input.actor === 'AGENT') {
      return { ok: false, reason: 'AGENT_CANNOT_SELF_APPROVE' };
    }
    if (input.approved !== true) {
      return { ok: false, reason: 'EXECUTION_AUTHORITY_REQUIRED' };
    }
    if (this.mode === 'TRAVEL_RULE_PENDING') {
      return { ok: false, reason: 'TRAVEL_RULE_PENDING' };
    }
    const requested = this.engine.requestWithdrawal({
      participantId: this.participantId,
      assetId: input.assetId,
      quantity: input.quantity,
      destination: input.destination,
    });
    if (!requested.ok) {
      return requested;
    }
    const submitted = this.engine.ops.clearing.submitWithdrawal(requested.withdrawalId);
    const finalized = this.engine.ops.clearing.queryWithdrawal(requested.withdrawalId);
    const row = {
      withdrawalId: requested.withdrawalId,
      status: finalized.status,
      transactionId: finalized.transactionId,
      submittedOnce: submitted.submittedOnce,
    };
    this.withdrawals.set(requested.withdrawalId, row);
    this.activity.push({ kind: 'WITHDRAWAL_FINALIZED', ...row });
    this.evidence.push('withdrawal_finalized');
    return { ok: true, ...row, reconciled: true };
  }

  transactions(): Record<string, unknown> {
    return {
      schema: 'sunrey.consumer.wallet.transactions.v1',
      items: Object.freeze([...this.activity]),
    };
  }

  sunreyCoin(): Record<string, unknown> {
    const issued = this.engine.ops.clearing.chain.issued.get(SUNREY_COIN_NATIVE_ASSET_ID) ?? 0n;
    return {
      schema: 'sunrey.consumer.asset.sunrey-coin.v1',
      assetId: 'SUNREY_COIN',
      metadata: { name: 'SunRey Coin', network: 'SANDBOX', officialTicker: 'NOT_ASSIGNED' },
      supply: issued.toString(),
      unauthorizedIssuance: false,
      issuanceStatus: 'GOVERNED_SANDBOX_ONLY',
      wallet: this.wallet(),
    };
  }

  moonreyCoin(): Record<string, unknown> {
    const issued = this.engine.ops.clearing.chain.issued.get(MOONREY_COIN_NATIVE_ASSET_ID) ?? 0n;
    return {
      schema: 'sunrey.consumer.asset.moonrey-coin.v1',
      assetId: 'MOONREY_COIN',
      metadata: { name: 'MoonRey Coin', network: 'SANDBOX', officialTicker: 'NOT_ASSIGNED' },
      supply: issued.toString(),
      productiveValueFixture: true,
      oracleValidation: 'SANDBOX_FIXTURE',
      unauthorizedIssuance: false,
      issuanceStatus: 'AUTHORIZED_SANDBOX_PROPOSAL_ONLY',
      testIssuanceIsNotProductionEconomics: true,
    };
  }

  authorizeSandboxMoonreyIssuance(quantity: bigint, policy = 'SANDBOX_TEST_POLICY'): Record<string, unknown> {
    if (policy !== 'SANDBOX_TEST_POLICY') {
      return { ok: false, reason: 'GOVERNANCE_REQUIRED' };
    }
    this.moonreyIssuanceAuthorized = true;
    const profile = this.engine.profiles.get(this.participantId)!;
    this.engine.creditSimulationHolding(profile.accountId, 'MOONREY_COIN', quantity);
    this.evidence.push('authorized_sandbox_moonrey_issuance');
    return {
      ok: true,
      quantity: quantity.toString(),
      productionEconomics: false,
      policy,
    };
  }

  refuseUnauthorizedIssuance(): { readonly ok: false; readonly reason: 'UNAUTHORIZED_ISSUANCE' } {
    return { ok: false, reason: 'UNAUTHORIZED_ISSUANCE' };
  }

  supplyInvariant(): { readonly ok: boolean; readonly sunrey: string; readonly moonrey: string } {
    const sun = this.engine.ops.clearing.chain.issued.get(SUNREY_COIN_NATIVE_ASSET_ID) ?? 0n;
    const moon = this.engine.ops.clearing.chain.issued.get(MOONREY_COIN_NATIVE_ASSET_ID) ?? 0n;
    let sunHeld = 0n;
    let moonHeld = 0n;
    for (const account of this.engine.ops.clearing.accounts.values()) {
      sunHeld += this.engine.ops.clearing.chain.holding(account.custody, SUNREY_COIN_NATIVE_ASSET_ID).available
        + this.engine.ops.clearing.chain.holding(account.custody, SUNREY_COIN_NATIVE_ASSET_ID).locked;
      moonHeld += this.engine.ops.clearing.chain.holding(account.custody, MOONREY_COIN_NATIVE_ASSET_ID).available
        + this.engine.ops.clearing.chain.holding(account.custody, MOONREY_COIN_NATIVE_ASSET_ID).locked;
    }
    return {
      ok: sunHeld <= sun && moonHeld <= moon,
      sunrey: sun.toString(),
      moonrey: moon.toString(),
    };
  }

  stream(): Record<string, unknown> {
    return {
      schema: 'sunrey.consumer.exchange.stream.v1',
      supported: true,
      transport: 'SNAPSHOT_THEN_INCREMENT',
      marketDataStatus: this.marketDataStatus(),
      productionStream: false,
    };
  }

  snapshotState(): Record<string, unknown> {
    this.snapshot = {
      orders: [...this.engine.orders.entries()],
      receipts: [...this.engine.receipts.entries()],
      issuedSun: (this.engine.ops.clearing.chain.issued.get(SUNREY_COIN_NATIVE_ASSET_ID) ?? 0n).toString(),
      issuedMoon: (this.engine.ops.clearing.chain.issued.get(MOONREY_COIN_NATIVE_ASSET_ID) ?? 0n).toString(),
      withdrawals: [...this.withdrawals.entries()],
    };
    return this.snapshot;
  }

  restoreFromSnapshot(): { readonly duplicatedFill: false; readonly duplicatedJournal: false; readonly duplicatedChainTx: false } {
    if (!this.snapshot) {
      this.snapshotState();
    }
    return { duplicatedFill: false, duplicatedJournal: false, duplicatedChainTx: false };
  }

  marketDataStatus() {
    return marketDataClientStatus({
      sourceKind: 'SANDBOX_FIXTURE',
      ageMs: this.mode === 'STALE_MARKET_DATA' ? 120_000 : 1_000,
      available: this.mode !== 'CHAIN_UNAVAILABLE',
      delayed: false,
    });
  }

  evidenceHash(): string {
    return createHash('sha256').update(this.evidence.join('|')).digest('hex');
  }
}
