import { createHash, randomUUID } from 'node:crypto';

import type { UtcInstant } from '../../../domain/src/time.ts';
import { AssetQuantity } from '../../../money/src/asset-quantity.ts';
import {
  asExchangeAccountId,
  asOrderId,
  asTradeId,
  MOONREY_COIN_NATIVE_ASSET_ID,
  newSettlementId,
  SUNREY_COIN_NATIVE_ASSET_ID,
  SUNREY_MOONREY_MARKET_ID,
  type ExchangeAccountId,
  type OrderId,
  type SettlementId,
  type TradeId,
} from '../ids.ts';
import { applyFill, matchIncoming, sortBook } from '../matching.ts';
import { exchangePrice, quoteAssetQuantity, type ExchangePrice } from '../price.ts';
import type { DigitalOrder } from '../types.ts';
import { InMemoryNativeChain } from './chain.ts';
import { requireCanonicalAssetId, sunreyMoonreyMarket } from './markets.ts';
import {
  EXCHANGE_SETTLEMENT_ISSUER,
  NATIVE_SETTLEMENT_POLICY,
  type ChainQueryResult,
  type DerivedNativePosition,
  type ExchangeSettlementIntent,
  type MarketDefinition,
  type NativeDeposit,
  type NativeFeeLeg,
  type NativeReconciliationReport,
  type NativeReservation,
  type NativeSettlement,
  type NativeTrade,
  type NativeWithdrawal,
  type TradeSettlementReceipt,
} from './types.ts';

export type NativeClearingFees = {
  readonly tradingFeeQuote: bigint;
  readonly networkFeeBase: bigint;
};

const ZERO_FEES: NativeClearingFees = { tradingFeeQuote: 0n, networkFeeBase: 0n };

export class NativeClearingEngine {
  readonly chain: InMemoryNativeChain;
  readonly market: MarketDefinition;
  readonly fees: NativeClearingFees;
  readonly networkId = 'net_sunrey_development';
  readonly chainId = 'chn_sunrey_development';
  readonly accounts = new Map<string, { accountId: ExchangeAccountId; custody: string; customerId: string }>();
  readonly depositAddresses = new Map<string, ExchangeAccountId>();
  readonly deposits = new Map<string, NativeDeposit>();
  readonly reservations = new Map<string, NativeReservation>();
  readonly reservationsByOrder = new Map<string, string>();
  readonly orders = new Map<string, DigitalOrder>();
  readonly trades = new Map<string, NativeTrade>();
  readonly settlements = new Map<string, NativeSettlement>();
  readonly settlementsByTrade = new Map<string, SettlementId>();
  readonly receipts = new Map<string, TradeSettlementReceipt>();
  readonly withdrawals = new Map<string, NativeWithdrawal>();
  readonly observedTrades: Array<{
    tradeId: string;
    marketId: string;
    buyer: string;
    seller: string;
    quantity: bigint;
    priceUnits: bigint;
    settlementId: string;
    transactionId: string | null;
  }> = [];
  private nonce = 0n;
  private orderSequence = 0;
  private readonly exchangeSignature: string;

  constructor(input?: { readonly chain?: InMemoryNativeChain; readonly fees?: NativeClearingFees }) {
    this.chain = input?.chain ?? new InMemoryNativeChain();
    this.market = sunreyMoonreyMarket();
    this.fees = input?.fees ?? ZERO_FEES;
    this.exchangeSignature = `${EXCHANGE_SETTLEMENT_ISSUER}:${randomUUID().replace(/-/g, '')}`;
    this.chain.registerExchangeKey(this.exchangeSignature);
  }

  openExchangeAccount(customerId: string, custody = `cust_${customerId}`): ExchangeAccountId {
    const accountId = asExchangeAccountId(`xacct_native_${customerId}`);
    this.accounts.set(accountId, { accountId, custody, customerId });
    return accountId;
  }

  allocateDepositAddress(accountId: ExchangeAccountId): string {
    const account = this.requireAccount(accountId);
    const address = `sr1ex_${account.custody}`;
    this.depositAddresses.set(address, accountId);
    return address;
  }

  observeChainTransfer(input: {
    readonly address: string;
    readonly assetId: string;
    readonly quantity: bigint;
    readonly transactionId: string;
    readonly finality: 'PENDING_PROPOSAL' | 'BFT_FINALIZED';
  }): NativeDeposit {
    requireCanonicalAssetId(input.assetId);
    const accountId = this.depositAddresses.get(input.address);
    if (!accountId) {
      throw Object.assign(new Error('UNMAPPED_ADDRESS'), { code: 'UNMAPPED_ADDRESS' });
    }
    const deposit: NativeDeposit = {
      depositId: `ndep_${randomUUID().replace(/-/g, '')}`,
      accountId,
      assetId: input.assetId,
      quantity: input.quantity,
      address: input.address,
      transactionId: input.transactionId,
      finality: input.finality,
      credited: input.finality === 'BFT_FINALIZED',
    };
    this.deposits.set(deposit.depositId, deposit);
    return deposit;
  }

  faucetToCustody(accountId: ExchangeAccountId, assetId: string, quantity: bigint): NativeDeposit {
    const account = this.requireAccount(accountId);
    requireCanonicalAssetId(assetId);
    this.chain.issue(account.custody, assetId, quantity);
    const address = this.allocateDepositAddress(accountId);
    return this.observeChainTransfer({
      address,
      assetId,
      quantity,
      transactionId: `ntx_faucet_${randomUUID().replace(/-/g, '')}`,
      finality: 'BFT_FINALIZED',
    });
  }

  creditFinalizedDeposit(from: string, accountId: ExchangeAccountId, assetId: string, quantity: bigint): NativeDeposit {
    const account = this.requireAccount(accountId);
    const address = this.allocateDepositAddress(accountId);
    const transactionId = this.chain.transfer(from, account.custody, assetId, quantity);
    return this.observeChainTransfer({
      address,
      assetId,
      quantity,
      transactionId,
      finality: 'BFT_FINALIZED',
    });
  }

  position(accountId: ExchangeAccountId, assetId: string): DerivedNativePosition {
    const account = this.requireAccount(accountId);
    const holding = this.chain.holding(account.custody, assetId);
    let reserved = 0n;
    for (const reservation of this.reservations.values()) {
      if (reservation.accountId === accountId && reservation.assetId === assetId && (reservation.state === 'ACTIVE' || reservation.state === 'PARTIAL')) {
        reserved += reservation.remaining;
      }
    }
    let pendingSettlement = 0n;
    for (const settlement of this.settlements.values()) {
      if (settlement.status === 'SUBMITTED' || settlement.status === 'SUBMISSION_UNKNOWN' || settlement.status === 'SETTLEMENT_CREATED') {
        if (settlement.intent.seller === accountId && settlement.intent.baseAsset === assetId) {
          pendingSettlement += settlement.intent.baseQuantity;
        }
        if (settlement.intent.buyer === accountId && settlement.intent.quoteAsset === assetId) {
          pendingSettlement += settlement.intent.quoteQuantity;
        }
      }
    }
    let pendingWithdrawal = 0n;
    for (const withdrawal of this.withdrawals.values()) {
      if (withdrawal.accountId === accountId && withdrawal.assetId === assetId && withdrawal.status !== 'FINALIZED' && withdrawal.status !== 'FAILED') {
        pendingWithdrawal += withdrawal.quantity;
      }
    }
    const finalized = holding.available + holding.locked;
    const available = holding.available - pendingWithdrawal;
    return Object.freeze({
      accountId,
      assetId,
      available: available < 0n ? 0n : available,
      reserved,
      pendingSettlement,
      finalized,
      pendingWithdrawal,
    });
  }

  placeOrder(input: {
    readonly accountId: ExchangeAccountId;
    readonly side: 'BUY' | 'SELL';
    readonly quantity: bigint;
    readonly priceUnits: bigint;
    readonly now: UtcInstant;
  }): DigitalOrder {
    const account = this.requireAccount(input.accountId);
    const market = this.market;
    if (input.quantity % market.quantityIncrement !== 0n || input.quantity < market.minimumQuantity) {
      throw Object.assign(new Error('INVALID_QUANTITY'), { code: 'INVALID_QUANTITY' });
    }
    const price = this.price(input.priceUnits);
    const quantity = AssetQuantity.fromScaledUnits(input.quantity, market.baseAsset);
    const quote = quoteAssetQuantity(price, quantity);
    const reserveAsset = input.side === 'SELL' ? market.baseAsset : market.quoteAsset;
    const reserveQty = input.side === 'SELL' ? input.quantity : quote.scaledUnits + this.fees.tradingFeeQuote;
    const required = input.side === 'SELL' ? reserveQty + this.fees.networkFeeBase : reserveQty;
    const available = this.position(input.accountId, reserveAsset).available;
    if (available < required) {
      throw Object.assign(new Error('INSUFFICIENT_ASSET'), { code: 'INSUFFICIENT_ASSET' });
    }
    const orderId = asOrderId(`xord_${randomUUID().replace(/-/g, '')}`);
    const lockId = `lock_${orderId}`;
    this.chain.lock(lockId, account.custody, reserveAsset, reserveQty);
    const reservation: NativeReservation = {
      reservationId: `nres_${orderId}`,
      orderId,
      accountId: input.accountId,
      assetId: reserveAsset,
      quantity: reserveQty,
      remaining: reserveQty,
      lockId,
      purpose: 'EXCHANGE_ORDER',
      state: 'ACTIVE',
    };
    this.reservations.set(reservation.reservationId, reservation);
    this.reservationsByOrder.set(orderId, reservation.reservationId);
    this.orderSequence += 1;
    const order: DigitalOrder = Object.freeze({
      orderId,
      version: 1 as DigitalOrder['version'],
      exchangeAccountId: input.accountId,
      beneficialParticipantId: account.customerId,
      marketId: SUNREY_MOONREY_MARKET_ID,
      family: 'DIGITAL_ASSET',
      side: input.side,
      orderType: 'LIMIT',
      quantity,
      remaining: quantity,
      limitPrice: price,
      createdAt: input.now,
      timeInForce: 'GTC',
      status: 'OPEN',
      clientIdempotencyKey: orderId,
      authorizationRef: null,
      holdId: null,
      coinHoldId: lockId,
      sourceAccountId: account.custody,
      sequence: this.orderSequence,
    });
    this.orders.set(orderId, order);
    this.match(order, input.now);
    return this.orders.get(orderId) ?? order;
  }

  cancel(orderId: OrderId): DigitalOrder {
    const order = this.orders.get(orderId);
    if (!order) {
      throw Object.assign(new Error('UNKNOWN_ORDER'), { code: 'UNKNOWN_ORDER' });
    }
    if (order.status === 'FILLED' || order.status === 'CANCELLED') {
      return order;
    }
    this.releaseReservation(orderId);
    const cancelled: DigitalOrder = Object.freeze({
      ...order,
      status: 'CANCELLED',
      version: (order.version + 1) as DigitalOrder['version'],
    });
    this.orders.set(orderId, cancelled);
    return cancelled;
  }

  requestWithdrawal(accountId: ExchangeAccountId, assetId: string, quantity: bigint, destination: string): NativeWithdrawal {
    requireCanonicalAssetId(assetId);
    if (this.position(accountId, assetId).available < quantity) {
      throw Object.assign(new Error('INSUFFICIENT_ASSET'), { code: 'INSUFFICIENT_ASSET' });
    }
    const withdrawal: NativeWithdrawal = {
      withdrawalId: `nwd_${randomUUID().replace(/-/g, '')}`,
      accountId,
      assetId,
      quantity,
      destination,
      status: 'REQUESTED',
      transactionId: null,
      submittedOnce: false,
    };
    this.withdrawals.set(withdrawal.withdrawalId, withdrawal);
    return withdrawal;
  }

  submitWithdrawal(withdrawalId: string, timeoutAfterBroadcast = false): NativeWithdrawal {
    const current = this.withdrawals.get(withdrawalId);
    if (!current) {
      throw Object.assign(new Error('UNKNOWN_WITHDRAWAL'), { code: 'UNKNOWN_WITHDRAWAL' });
    }
    if (current.submittedOnce) {
      return current;
    }
    const account = this.requireAccount(current.accountId);
    if (timeoutAfterBroadcast) {
      const transactionId = `ntx_unknown_${randomUUID().replace(/-/g, '')}`;
      const pending: NativeWithdrawal = { ...current, status: 'SUBMISSION_UNKNOWN', transactionId, submittedOnce: true };
      this.withdrawals.set(withdrawalId, pending);
      this.chain.txs.set(transactionId, {
        transactionId,
        kind: 'TRANSFER',
        settlementId: null,
        status: 'PENDING_PROPOSAL',
        payload: { from: account.custody, to: current.destination, assetId: current.assetId, quantity: current.quantity.toString() },
      });
      return pending;
    }
    const transactionId = this.chain.transfer(account.custody, current.destination, current.assetId, current.quantity);
    const settled: NativeWithdrawal = { ...current, status: 'FINALIZED', transactionId, submittedOnce: true };
    this.withdrawals.set(withdrawalId, settled);
    return settled;
  }

  queryWithdrawal(withdrawalId: string): NativeWithdrawal {
    const current = this.withdrawals.get(withdrawalId);
    if (!current) {
      throw Object.assign(new Error('UNKNOWN_WITHDRAWAL'), { code: 'UNKNOWN_WITHDRAWAL' });
    }
    if (current.status !== 'SUBMISSION_UNKNOWN' || !current.transactionId) {
      return current;
    }
    const queried = this.chain.query(current.transactionId);
    if (queried.finality !== 'BFT_FINALIZED') {
      const tx = this.chain.txs.get(current.transactionId);
      if (tx && tx.status === 'PENDING_PROPOSAL') {
        const payload = tx.payload as { from: string; to: string; assetId: string; quantity: string };
        this.chain.transfer(payload.from, payload.to, payload.assetId, BigInt(payload.quantity));
        tx.status = 'BFT_FINALIZED';
      }
    }
    const resolved: NativeWithdrawal = { ...current, status: 'FINALIZED' };
    this.withdrawals.set(withdrawalId, resolved);
    return resolved;
  }

  submitSettlement(settlementId: SettlementId, timeoutAfterBroadcast = false): NativeSettlement {
    const current = this.settlements.get(settlementId);
    if (!current) {
      throw Object.assign(new Error('UNKNOWN_SETTLEMENT'), { code: 'UNKNOWN_SETTLEMENT' });
    }
    if (current.submittedOnce && current.transactionId) {
      return current;
    }
    const tx = this.chain.submitSettlement(current.intent);
    if (timeoutAfterBroadcast) {
      const unknown: NativeSettlement = {
        ...current,
        status: 'SUBMISSION_UNKNOWN',
        transactionId: tx.transactionId,
        submittedOnce: true,
      };
      this.settlements.set(settlementId, unknown);
      return unknown;
    }
    try {
      const finalized = this.chain.finalize(tx.transactionId);
      return this.markFinalized(current, finalized.transactionId);
    } catch (error) {
      this.chain.rejectPending(tx.transactionId, error instanceof Error ? error.message : 'FAILED');
      const failed: NativeSettlement = {
        ...current,
        status: 'RECONCILIATION_REQUIRED',
        transactionId: tx.transactionId,
        submittedOnce: true,
      };
      this.settlements.set(settlementId, failed);
      return failed;
    }
  }

  querySettlement(settlementId: SettlementId): NativeSettlement {
    const current = this.settlements.get(settlementId);
    if (!current) {
      throw Object.assign(new Error('UNKNOWN_SETTLEMENT'), { code: 'UNKNOWN_SETTLEMENT' });
    }
    if (!current.transactionId) {
      return current;
    }
    const queried = this.chain.query(current.transactionId);
    if (queried.finality === 'BFT_FINALIZED') {
      return this.markFinalized(current, current.transactionId);
    }
    if (current.status === 'SUBMISSION_UNKNOWN' && queried.found && queried.finality === 'PENDING_PROPOSAL') {
      try {
        this.chain.finalize(current.transactionId);
        return this.markFinalized(current, current.transactionId);
      } catch {
        const failed: NativeSettlement = { ...current, status: 'RECONCILIATION_REQUIRED' };
        this.settlements.set(settlementId, failed);
        return failed;
      }
    }
    return current;
  }

  queryTransaction(transactionId: string): ChainQueryResult {
    const queried = this.chain.query(transactionId);
    return {
      transactionId,
      found: queried.found,
      finality: queried.finality,
      settlementId: queried.settlementId,
    };
  }

  receipt(tradeId: TradeId): TradeSettlementReceipt | undefined {
    return this.receipts.get(tradeId);
  }

  reconcile(): NativeReconciliationReport {
    const notes: string[] = [];
    try {
      this.chain.reconcile();
    } catch (error) {
      notes.push(error instanceof Error ? error.message : 'chain mismatch');
    }
    for (const trade of this.trades.values()) {
      const settlementId = this.settlementsByTrade.get(trade.tradeId);
      if (!settlementId) {
        notes.push(`trade ${trade.tradeId} has no settlement`);
        continue;
      }
      const settlement = this.settlements.get(settlementId);
      if (!settlement) {
        notes.push(`trade ${trade.tradeId} settlement missing`);
        continue;
      }
      if (settlement.status === 'FINALIZED' && !this.receipts.has(trade.tradeId)) {
        notes.push(`trade ${trade.tradeId} missing receipt`);
      }
      if (settlement.status === 'SUBMISSION_UNKNOWN' || settlement.status === 'RECONCILIATION_REQUIRED') {
        notes.push(`settlement ${settlement.settlementId} needs investigation`);
      }
    }
    for (const [tradeId, count] of this.settledTradeCounts()) {
      if (count > 1) {
        notes.push(`trade ${tradeId} settled more than once`);
      }
    }
    return Object.freeze({
      outcome: notes.length === 0 ? 'MATCHED' : 'INVESTIGATION_REQUIRED',
      notes,
      autoCorrected: false,
      autoCreatedAssets: false,
    });
  }

  private match(incoming: DigitalOrder, now: UtcInstant): void {
    const resting = [...this.orders.values()].filter(
      (order) => order.orderId !== incoming.orderId && (order.status === 'OPEN' || order.status === 'PARTIALLY_FILLED'),
    );
    const result = matchIncoming(incoming, resting, { selfTrade: 'CANCEL_INCOMING' });
    if (result.rejectIncoming) {
      this.releaseReservation(incoming.orderId);
      this.orders.set(incoming.orderId, { ...incoming, status: 'REJECTED' });
      return;
    }
    let taker = incoming;
    for (const match of result.matches) {
      const quote = quoteAssetQuantity(match.price, match.quantity);
      const tradeId = asTradeId(`xtrd_${randomUUID().replace(/-/g, '')}`);
      const seller = match.maker.side === 'SELL' ? match.maker : taker;
      const buyer = match.maker.side === 'BUY' ? match.maker : taker;
      const trade: NativeTrade = {
        tradeId,
        marketId: SUNREY_MOONREY_MARKET_ID,
        buyer: buyer.exchangeAccountId,
        seller: seller.exchangeAccountId,
        baseAsset: this.market.baseAsset,
        quoteAsset: this.market.quoteAsset,
        quantity: match.quantity,
        quoteQuantity: quote,
        price: match.price,
        tradingFee: AssetQuantity.fromScaledUnits(this.fees.tradingFeeQuote, this.market.quoteAsset),
        networkFee: AssetQuantity.fromScaledUnits(this.fees.networkFeeBase, this.market.baseAsset),
        matchedAt: now,
      };
      this.trades.set(tradeId, trade);
      this.captureReservation(seller.orderId, match.quantity.scaledUnits);
      this.captureReservation(buyer.orderId, quote.scaledUnits + this.fees.tradingFeeQuote);
      const intent = this.createIntent(trade, seller, buyer);
      const settlement: NativeSettlement = {
        settlementId: intent.settlementId,
        intent,
        tradeIds: [tradeId],
        status: 'SETTLEMENT_CREATED',
        transactionId: null,
        finalizedHeight: null,
        blockId: null,
        stateRoot: null,
        submittedOnce: false,
      };
      this.settlements.set(intent.settlementId, settlement);
      this.settlementsByTrade.set(tradeId, intent.settlementId);
      this.observedTrades.push({
        tradeId,
        marketId: trade.marketId,
        buyer: trade.buyer,
        seller: trade.seller,
        quantity: trade.quantity.scaledUnits,
        priceUnits: trade.price.priceUnits,
        settlementId: intent.settlementId,
        transactionId: null,
      });
      const makerFilled = applyFill(this.orders.get(match.maker.orderId) ?? match.maker, match.quantity);
      taker = applyFill(this.orders.get(taker.orderId) ?? taker, match.quantity);
      this.orders.set(makerFilled.orderId, makerFilled);
      this.orders.set(taker.orderId, taker);
      if (makerFilled.status === 'FILLED') {
        this.releaseReservation(makerFilled.orderId);
      }
      if (taker.status === 'FILLED') {
        this.releaseReservation(taker.orderId);
      }
    }
  }

  private createIntent(trade: NativeTrade, seller: DigitalOrder, buyer: DigitalOrder): ExchangeSettlementIntent {
    this.nonce += 1n;
    const sellerRes = this.reservationFor(seller.orderId);
    const buyerRes = this.reservationFor(buyer.orderId);
    const feeLegs: NativeFeeLeg[] = [];
    if (this.fees.tradingFeeQuote > 0n) {
      feeLegs.push({
        kind: 'TRADING_FEE',
        assetId: this.market.quoteAsset,
        quantity: this.fees.tradingFeeQuote,
        payer: buyer.exchangeAccountId,
        recipient: 'fees',
      });
    }
    if (this.fees.networkFeeBase > 0n) {
      feeLegs.push({
        kind: 'NETWORK_FEE',
        assetId: this.market.baseAsset,
        quantity: this.fees.networkFeeBase,
        payer: seller.exchangeAccountId,
        recipient: 'fees',
      });
    }
    const settlementId = newSettlementId();
    return Object.freeze({
      settlementId,
      tradeIds: [trade.tradeId],
      buyer: buyer.exchangeAccountId,
      seller: seller.exchangeAccountId,
      buyerCustody: this.requireAccount(buyer.exchangeAccountId).custody,
      sellerCustody: this.requireAccount(seller.exchangeAccountId).custody,
      baseAsset: trade.baseAsset,
      baseQuantity: trade.quantity.scaledUnits,
      quoteAsset: trade.quoteAsset,
      quoteQuantity: trade.quoteQuantity.scaledUnits,
      feeLegs,
      reservationRefs: [sellerRes.lockId, buyerRes.lockId],
      expirationHeight: this.chain.height + 1_000n,
      exchangeSignature: this.exchangeSignature,
      policyVersion: NATIVE_SETTLEMENT_POLICY,
      networkId: this.networkId,
      chainId: this.chainId,
      nonce: this.nonce,
    });
  }

  private markFinalized(current: NativeSettlement, transactionId: string): NativeSettlement {
    const finalized: NativeSettlement = {
      ...current,
      status: 'FINALIZED',
      transactionId,
      finalizedHeight: this.chain.height,
      blockId: this.chain.blockId,
      stateRoot: this.chain.stateRoot,
      submittedOnce: true,
    };
    this.settlements.set(current.settlementId, finalized);
    for (const tradeId of current.tradeIds) {
      const trade = this.trades.get(tradeId);
      if (!trade) {
        continue;
      }
      const receipt: TradeSettlementReceipt = {
        tradeId,
        marketId: trade.marketId,
        buyer: trade.buyer,
        seller: trade.seller,
        priceUnits: trade.price.priceUnits,
        quantity: trade.quantity.scaledUnits,
        notional: trade.quoteQuantity.scaledUnits,
        tradingFee: trade.tradingFee.scaledUnits,
        networkFee: trade.networkFee.scaledUnits,
        settlementId: current.settlementId,
        blockchainTransactionId: transactionId,
        finalizedHeight: this.chain.height,
        blockId: this.chain.blockId,
        stateRootReference: this.chain.stateRoot,
        signature: createHash('sha256').update(`${current.settlementId}:${transactionId}`).digest('hex'),
      };
      this.receipts.set(tradeId, receipt);
      const observed = this.observedTrades.find((item) => item.tradeId === tradeId);
      if (observed) {
        observed.transactionId = transactionId;
      }
    }
    return finalized;
  }

  private captureReservation(orderId: OrderId, quantity: bigint): void {
    const reservation = this.reservationFor(orderId);
    if (reservation.remaining < quantity) {
      throw Object.assign(new Error('ORDER_HOLD_MISMATCH'), { code: 'ORDER_HOLD_MISMATCH' });
    }
    const remaining = reservation.remaining - quantity;
    this.reservations.set(reservation.reservationId, {
      ...reservation,
      remaining,
      state: remaining === 0n ? 'CAPTURED' : 'PARTIAL',
    });
  }

  private releaseReservation(orderId: OrderId): void {
    const id = this.reservationsByOrder.get(orderId);
    if (!id) {
      return;
    }
    const reservation = this.reservations.get(id);
    if (!reservation || reservation.state === 'RELEASED' || reservation.state === 'CAPTURED') {
      return;
    }
    if (reservation.remaining > 0n) {
      const lock = this.chain.locks.get(reservation.lockId);
      if (lock && lock.status === 'LOCKED') {
        this.chain.unlock(reservation.lockId);
      }
    }
    this.reservations.set(id, { ...reservation, remaining: 0n, state: 'RELEASED' });
  }

  private reservationFor(orderId: OrderId): NativeReservation {
    const id = this.reservationsByOrder.get(orderId);
    const reservation = id ? this.reservations.get(id) : undefined;
    if (!reservation) {
      throw Object.assign(new Error('ORDER_HOLD_MISMATCH'), { code: 'ORDER_HOLD_MISMATCH' });
    }
    return reservation;
  }

  private price(priceUnits: bigint): ExchangePrice {
    return exchangePrice({
      baseAssetId: SUNREY_COIN_NATIVE_ASSET_ID,
      quoteAssetId: MOONREY_COIN_NATIVE_ASSET_ID,
      quoteKind: 'ASSET',
      priceUnits,
      quoteScale: 6,
      basePrecision: 6,
    });
  }

  private requireAccount(accountId: ExchangeAccountId): { accountId: ExchangeAccountId; custody: string; customerId: string } {
    const account = this.accounts.get(accountId);
    if (!account) {
      throw Object.assign(new Error('UNKNOWN_ACCOUNT'), { code: 'UNKNOWN_ACCOUNT' });
    }
    return account;
  }

  private settledTradeCounts(): Map<string, number> {
    const counts = new Map<string, number>();
    for (const settlement of this.settlements.values()) {
      if (settlement.status !== 'FINALIZED') {
        continue;
      }
      for (const tradeId of settlement.tradeIds) {
        counts.set(tradeId, (counts.get(tradeId) ?? 0) + 1);
      }
    }
    return counts;
  }

  book(): { readonly bids: DigitalOrder[]; readonly asks: DigitalOrder[] } {
    return sortBook([...this.orders.values()]);
  }
}
