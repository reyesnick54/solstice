/**
 * Consumer Internal Alpha exchange persistence snapshot.
 * Captures workflow state only — not a ledger, balance authority, or live venue.
 */

import type { UtcInstant } from '@solstice/domain';
import type { ConsumerOrderStatus, ConsumerPriceAlert, ConsumerTradeReceipt, ConsumerTradingProfile } from '../consumer/types.ts';
import type { DigitalOrder, ImmutableTrade } from '../types.ts';
import { InMemoryNativeChain, type SimulatedHolding, type SimulatedLock, type SimulatedTx } from '../native-clearing/chain.ts';
import { NativeClearingEngine } from '../native-clearing/engine.ts';
import { MarketOperationsEngine } from '../ops/engine.ts';
import { ConsumerExchangeEngine } from '../consumer/engine.ts';
import { issueTradingCredential } from '../ops/gateway.ts';
import { DigitalAssetLifecycle, type DigitalAssetProposal, type LifecycleMode } from './lifecycle.ts';

export type ConsumerAlphaIdempotencyResource = 'ORDER' | 'DEPOSIT' | 'WITHDRAWAL' | 'SETTLEMENT';

export type ConsumerAlphaIdempotencyRecord = {
  readonly idempotencyKey: string;
  readonly customerId: string;
  readonly resourceType: ConsumerAlphaIdempotencyResource;
  readonly resourceId: string;
  readonly responseCanonical: string;
  readonly createdAt: string;
};

export type ConsumerAlphaSnapshot = {
  readonly schema: 'sunrey-exchange-consumer-alpha/1';
  readonly productionActive: false;
  readonly liveTradingEnabled: false;
  readonly participantId: string;
  readonly lifecycleMode: LifecycleMode;
  readonly moonreyIssuanceAuthorized: boolean;
  readonly proposals: readonly DigitalAssetProposal[];
  readonly deposits: readonly [string, Record<string, unknown>][];
  readonly withdrawals: readonly [string, Record<string, unknown>][];
  readonly activity: readonly Record<string, unknown>[];
  readonly evidence: readonly string[];
  readonly engine: ConsumerAlphaEngineSnapshot;
};

type ConsumerAlphaEngineSnapshot = {
  readonly profiles: readonly ConsumerTradingProfile[];
  readonly orders: readonly ConsumerOrderStatus[];
  readonly ordersByClient: readonly [string, string][];
  readonly receipts: readonly ConsumerTradeReceipt[];
  readonly favorites: readonly [string, Record<string, unknown>][];
  readonly alerts: readonly ConsumerPriceAlert[];
  readonly ops: ConsumerAlphaOpsSnapshot;
};

type ConsumerAlphaOpsSnapshot = {
  readonly orders: readonly DigitalOrder[];
  readonly ordersByClOrd: readonly [string, string][];
  readonly states: readonly [string, Record<string, unknown>][];
  readonly sessions: readonly [string, Record<string, unknown>][];
  readonly reservations: readonly [string, string][];
  readonly participants: readonly [string, Record<string, unknown>][];
  readonly tradeSeq: number;
  readonly clearing: ConsumerAlphaClearingSnapshot;
};

type ConsumerAlphaClearingSnapshot = {
  readonly exchangeSignature: string;
  readonly nonce: string;
  readonly orderSequence: number;
  readonly accounts: readonly [string, Record<string, unknown>][];
  readonly depositAddresses: readonly [string, string][];
  readonly deposits: readonly [string, Record<string, unknown>][];
  readonly reservations: readonly [string, Record<string, unknown>][];
  readonly reservationsByOrder: readonly [string, string][];
  readonly orders: readonly DigitalOrder[];
  readonly trades: readonly [string, Record<string, unknown>][];
  readonly settlements: readonly [string, Record<string, unknown>][];
  readonly settlementsByTrade: readonly [string, string][];
  readonly receipts: readonly [string, Record<string, unknown>][];
  readonly withdrawals: readonly [string, Record<string, unknown>][];
  readonly chain: ConsumerAlphaChainSnapshot;
};

type ConsumerAlphaChainSnapshot = {
  readonly height: string;
  readonly blockId: string;
  readonly stateRoot: string;
  readonly holdings: readonly [string, SimulatedHolding][];
  readonly locks: readonly [string, SimulatedLock][];
  readonly txs: readonly [string, SimulatedTx][];
  readonly issued: readonly [string, string][];
  readonly usedSettlements: readonly string[];
  readonly settledTrades: readonly string[];
  readonly usedNonces: readonly string[];
  readonly exchangeKeys: readonly string[];
};

export type ConsumerAlphaPersistencePort = {
  load(customerId: string, mode: LifecycleMode): ConsumerAlphaSnapshot | null | Promise<ConsumerAlphaSnapshot | null>;
  save(customerId: string, mode: LifecycleMode, snapshot: ConsumerAlphaSnapshot): void | Promise<void>;
  loadIdempotency(idempotencyKey: string): ConsumerAlphaIdempotencyRecord | null | Promise<ConsumerAlphaIdempotencyRecord | null>;
  saveIdempotency(record: ConsumerAlphaIdempotencyRecord): void | Promise<void>;
};

export function captureConsumerAlphaSnapshot(world: DigitalAssetLifecycle): ConsumerAlphaSnapshot {
  const engine = world.engine;
  const ops = engine.ops;
  const clearing = ops.clearing;
  const chain = clearing.chain;
  return Object.freeze({
    schema: 'sunrey-exchange-consumer-alpha/1' as const,
    productionActive: false,
    liveTradingEnabled: false,
    participantId: world.participantId,
    lifecycleMode: world.mode,
    moonreyIssuanceAuthorized: world.moonreyIssuanceAuthorized,
    proposals: [...world.proposals.values()],
    deposits: [...world.deposits.entries()],
    withdrawals: [...world.withdrawals.entries()],
    activity: [...world.activity],
    evidence: [...world.evidence],
    engine: Object.freeze({
      profiles: [...engine.profiles.values()],
      orders: [...engine.orders.values()],
      ordersByClient: [...engine.ordersByClient.entries()],
      receipts: [...engine.receipts.values()],
      favorites: [...engine.favorites.entries()] as [string, Record<string, unknown>][],
      alerts: [...engine.alerts.values()],
      ops: Object.freeze({
        orders: [...ops.orders.values()],
        ordersByClOrd: [...ops.ordersByClOrd.entries()].map(([key, value]) => [key, String(value)]),
        states: [...ops.states.entries()] as [string, Record<string, unknown>][],
        sessions: [...ops.sessions.entries()] as [string, Record<string, unknown>][],
        reservations: [...ops.reservations.entries()].map(([key, value]) => [key, value.toString()]),
        participants: [...ops.participants.entries()] as [string, Record<string, unknown>][],
        tradeSeq: ops.trades.length,
        clearing: captureClearingSnapshot(clearing, chain),
      }),
    }),
  }) as unknown as ConsumerAlphaSnapshot;
}

function captureClearingSnapshot(
  clearing: NativeClearingEngine,
  chain: InMemoryNativeChain,
): ConsumerAlphaClearingSnapshot {
  return Object.freeze({
    exchangeSignature: clearing.exchangeSignature,
    nonce: clearing.nonce.toString(),
    orderSequence: clearing.orderSequence,
    accounts: [...clearing.accounts.entries()].map(([key, value]) => [key, { ...value }]),
    depositAddresses: [...clearing.depositAddresses.entries()].map(([key, value]) => [key, String(value)]),
    deposits: [...clearing.deposits.entries()].map(([key, value]) => [key, { ...value, quantity: value.quantity.toString() }]),
    reservations: [...clearing.reservations.entries()].map(([key, value]) => [
      key,
      {
        ...value,
        quantity: value.quantity.toString(),
        remaining: value.remaining.toString(),
      },
    ]),
    reservationsByOrder: [...clearing.reservationsByOrder.entries()],
    orders: [...clearing.orders.values()],
    trades: [...clearing.trades.entries()].map(([key, value]) => [key, serializeTrade(value)]),
    settlements: [...clearing.settlements.entries()].map(([key, value]) => [key, serializeSettlement(value)]),
    settlementsByTrade: [...clearing.settlementsByTrade.entries()].map(([key, value]) => [key, String(value)]),
    receipts: [...clearing.receipts.entries()].map(([key, value]) => [key, serializeReceipt(value)]),
    withdrawals: [...clearing.withdrawals.entries()].map(([key, value]) => [key, serializeWithdrawal(value)]),
    chain: Object.freeze({
      height: chain.height.toString(),
      blockId: chain.blockId,
      stateRoot: chain.stateRoot,
      holdings: [...chain.holdings.entries()].map(([key, value]) => [
        key,
        { available: value.available, locked: value.locked },
      ]),
      locks: [...chain.locks.entries()].map(([key, value]) => [
        key,
        { ...value, quantity: value.quantity.toString() },
      ]),
      txs: [...chain.txs.entries()].map(([key, value]) => [key, value]),
      issued: [...chain.issued.entries()].map(([key, value]) => [key, value.toString()]),
      usedSettlements: [...chain.usedSettlements],
      settledTrades: [...chain.settledTrades],
      usedNonces: [...chain.usedNonces],
      exchangeKeys: [...chain.exchangeKeys],
    }),
  }) as unknown as ConsumerAlphaClearingSnapshot;
}

export function hydrateConsumerAlphaLifecycle(input: {
  readonly snapshot: ConsumerAlphaSnapshot;
  readonly now: UtcInstant;
}): DigitalAssetLifecycle {
  if (input.snapshot.schema !== 'sunrey-exchange-consumer-alpha/1') {
    throw new Error('unsupported consumer alpha snapshot schema');
  }
  if (input.snapshot.productionActive !== false || input.snapshot.liveTradingEnabled !== false) {
    throw new Error('refusing to hydrate live consumer alpha exchange state');
  }
  const chain = new InMemoryNativeChain();
  hydrateChain(chain, input.snapshot.engine.ops.clearing.chain);
  const clearing = new NativeClearingEngine({
    chain,
    exchangeSignature: input.snapshot.engine.ops.clearing.exchangeSignature,
  });
  clearing.nonce = BigInt(input.snapshot.engine.ops.clearing.nonce);
  clearing.orderSequence = input.snapshot.engine.ops.clearing.orderSequence;
  hydrateClearingMaps(clearing, input.snapshot.engine.ops.clearing);
  const ops = new MarketOperationsEngine({ now: input.now, ports: { clearing } });
  const engine = new ConsumerExchangeEngine({ now: input.now, ports: { ops } });
  const world = new DigitalAssetLifecycle({
    now: input.now,
    participantId: input.snapshot.participantId,
    mode: input.snapshot.lifecycleMode,
    skipDefaultSeed: true,
    engine,
  });
  world.moonreyIssuanceAuthorized = input.snapshot.moonreyIssuanceAuthorized;
  for (const proposal of input.snapshot.proposals) {
    world.proposals.set(proposal.proposalId, proposal);
  }
  for (const [key, value] of input.snapshot.deposits) {
    world.deposits.set(key, value);
  }
  for (const [key, value] of input.snapshot.withdrawals) {
    world.withdrawals.set(key, value);
  }
  world.activity.push(...input.snapshot.activity);
  world.evidence.push(...input.snapshot.evidence);
  hydrateEngineMaps(world.engine, input.snapshot.engine);
  rebindTradingSessions(world.engine);
  return world;
}

function rebindTradingSessions(engine: ConsumerExchangeEngine): void {
  engine.opsBindings.clear();
  engine.sessions.clear();
  for (const [participantId, participant] of engine.ops.participants) {
    const profile = engine.profiles.get(participantId);
    const accountId = profile?.accountId ?? (`xacct_native_${participantId}` as never);
    const credential = issueTradingCredential({
      participantId,
      accountId,
      marketPermissions: [participant.family],
      environment: 'SIMULATION',
    });
    engine.ops.gateway.register(credential);
    const session = engine.ops.openTradingSession(credential, engine.ops.createdAt);
    if (profile) {
      engine.opsBindings.set(participantId, { credential, session });
      engine.sessions.set(`cses_${participantId}`, { participantId, authenticated: true });
    }
  }
}

function hydrateEngineMaps(engine: ConsumerExchangeEngine, snapshot: ConsumerAlphaEngineSnapshot): void {
  engine.profiles.clear();
  engine.orders.clear();
  engine.ordersByClient.clear();
  engine.receipts.clear();
  engine.favorites.clear();
  engine.alerts.clear();
  for (const profile of snapshot.profiles) {
    engine.profiles.set(profile.participantId, profile);
  }
  for (const order of snapshot.orders) {
    if (order.orderId) {
      engine.orders.set(order.orderId, order);
    }
  }
  for (const [clientOrderId, orderId] of snapshot.ordersByClient) {
    engine.ordersByClient.set(clientOrderId, orderId);
  }
  for (const receipt of snapshot.receipts) {
    engine.receipts.set(receipt.orderId, receipt);
  }
  for (const [key, value] of snapshot.favorites) {
    engine.favorites.set(key, value as never);
  }
  for (const alert of snapshot.alerts) {
    engine.alerts.set(alert.alertId, alert);
  }
  hydrateOpsMaps(engine.ops, snapshot.ops);
}

function hydrateOpsMaps(ops: MarketOperationsEngine, snapshot: ConsumerAlphaOpsSnapshot): void {
  ops.orders.clear();
  ops.ordersByClOrd.clear();
  ops.states.clear();
  ops.sessions.clear();
  ops.reservations.clear();
  ops.participants.clear();
  ops.trades.length = 0;
  for (const order of snapshot.orders) {
    ops.orders.set(order.orderId, order);
  }
  for (const [clOrdId, orderId] of snapshot.ordersByClOrd) {
    ops.ordersByClOrd.set(clOrdId, orderId as never);
  }
  for (const [marketId, state] of snapshot.states) {
    ops.states.set(marketId, state as never);
  }
  for (const [sessionId, session] of snapshot.sessions) {
    ops.sessions.set(sessionId, session as never);
  }
  for (const [key, value] of snapshot.reservations) {
    ops.reservations.set(key, BigInt(value));
  }
  for (const [participantId, participant] of snapshot.participants) {
    ops.participants.set(participantId, participant as never);
  }
}

function hydrateClearingMaps(clearing: NativeClearingEngine, snapshot: ConsumerAlphaClearingSnapshot): void {
  clearing.accounts.clear();
  clearing.depositAddresses.clear();
  clearing.deposits.clear();
  clearing.reservations.clear();
  clearing.reservationsByOrder.clear();
  clearing.orders.clear();
  clearing.trades.clear();
  clearing.settlements.clear();
  clearing.settlementsByTrade.clear();
  clearing.receipts.clear();
  clearing.withdrawals.clear();
  for (const [key, value] of snapshot.accounts) {
    clearing.accounts.set(key, value as never);
  }
  for (const [address, accountId] of snapshot.depositAddresses) {
    clearing.depositAddresses.set(address, accountId as never);
  }
  for (const [key, value] of snapshot.deposits) {
    clearing.deposits.set(key, { ...value, quantity: BigInt(String(value.quantity)) } as never);
  }
  for (const [key, value] of snapshot.reservations) {
    clearing.reservations.set(key, {
      ...value,
      quantity: BigInt(String(value.quantity)),
      remaining: BigInt(String(value.remaining)),
    } as never);
  }
  for (const [orderId, reservationId] of snapshot.reservationsByOrder) {
    clearing.reservationsByOrder.set(orderId, reservationId);
  }
  for (const order of snapshot.orders) {
    clearing.orders.set(order.orderId, order);
  }
  for (const [key, value] of snapshot.trades) {
    clearing.trades.set(key, deserializeTrade(value));
  }
  for (const [key, value] of snapshot.settlements) {
    clearing.settlements.set(key, deserializeSettlement(value));
  }
  for (const [tradeId, settlementId] of snapshot.settlementsByTrade) {
    clearing.settlementsByTrade.set(tradeId, settlementId as never);
  }
  for (const [key, value] of snapshot.receipts) {
    clearing.receipts.set(key, deserializeReceipt(value));
  }
  for (const [key, value] of snapshot.withdrawals) {
    clearing.withdrawals.set(key, deserializeWithdrawal(value));
  }
}

function hydrateChain(chain: InMemoryNativeChain, snapshot: ConsumerAlphaChainSnapshot): void {
  chain.height = BigInt(snapshot.height);
  chain.blockId = snapshot.blockId;
  chain.stateRoot = snapshot.stateRoot;
  chain.holdings.clear();
  chain.locks.clear();
  chain.txs.clear();
  chain.issued.clear();
  chain.usedSettlements.clear();
  chain.settledTrades.clear();
  chain.usedNonces.clear();
  chain.exchangeKeys.clear();
  for (const [key, value] of snapshot.holdings) {
    chain.holdings.set(key, { available: BigInt(String(value.available)), locked: BigInt(String(value.locked)) });
  }
  for (const [key, value] of snapshot.locks) {
    chain.locks.set(key, { ...value, quantity: BigInt(String(value.quantity)) });
  }
  for (const [key, value] of snapshot.txs) {
    chain.txs.set(key, value);
  }
  for (const [assetId, quantity] of snapshot.issued) {
    chain.issued.set(assetId, BigInt(quantity));
  }
  for (const settlementId of snapshot.usedSettlements) {
    chain.usedSettlements.add(settlementId);
  }
  for (const tradeId of snapshot.settledTrades) {
    chain.settledTrades.add(tradeId);
  }
  for (const nonce of snapshot.usedNonces) {
    chain.usedNonces.add(nonce);
  }
  for (const key of snapshot.exchangeKeys) {
    chain.exchangeKeys.add(key);
  }
}

export function encodeConsumerAlphaSnapshot(snapshot: ConsumerAlphaSnapshot): string {
  return JSON.stringify(snapshot, (_key, value) => (typeof value === 'bigint' ? value.toString() : value));
}

export function decodeConsumerAlphaSnapshot(raw: string): ConsumerAlphaSnapshot {
  const parsed = JSON.parse(raw, reviveConsumerAlphaValue) as ConsumerAlphaSnapshot;
  if (parsed.schema !== 'sunrey-exchange-consumer-alpha/1') {
    throw new Error('unsupported consumer alpha snapshot schema');
  }
  return parsed;
}

function reviveConsumerAlphaValue(key: string, value: unknown): unknown {
  if (typeof value === 'string' && /^-?\d+$/.test(value)) {
    if (
      key === 'quantity' ||
      key === 'remaining' ||
      key === 'available' ||
      key === 'locked' ||
      key === 'nonce' ||
      key === 'height' ||
      key === 'priceUnits' ||
      key === 'notional' ||
      key === 'tradingFee' ||
      key === 'networkFee' ||
      key === 'finalizedHeight' ||
      key === 'expirationHeight' ||
      key === 'baseQuantity' ||
      key === 'quoteQuantity'
    ) {
      return BigInt(value);
    }
  }
  return value;
}

function serializeTrade(value: unknown): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value, (_key, item) => (typeof item === 'bigint' ? item.toString() : item)));
}

function deserializeTrade(value: Record<string, unknown>): never {
  return JSON.parse(JSON.stringify(value), reviveConsumerAlphaValue) as never;
}

function serializeSettlement(value: unknown): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value, (_key, item) => (typeof item === 'bigint' ? item.toString() : item)));
}

function deserializeSettlement(value: Record<string, unknown>): never {
  return JSON.parse(JSON.stringify(value), reviveConsumerAlphaValue) as never;
}

function serializeReceipt(value: unknown): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value, (_key, item) => (typeof item === 'bigint' ? item.toString() : item)));
}

function deserializeReceipt(value: Record<string, unknown>): never {
  return JSON.parse(JSON.stringify(value), reviveConsumerAlphaValue) as never;
}

function serializeWithdrawal(value: unknown): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value, (_key, item) => (typeof item === 'bigint' ? item.toString() : item)));
}

function deserializeWithdrawal(value: Record<string, unknown>): never {
  return JSON.parse(JSON.stringify(value), reviveConsumerAlphaValue) as never;
}
