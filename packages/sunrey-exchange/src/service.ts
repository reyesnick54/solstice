import { randomUUID } from 'node:crypto';

import { type Clock } from '../../config/src/clock.ts';
import { LIVE_CRYPTO_ENABLED, LIVE_EXCHANGE_ENABLED } from '../../config/src/flags.ts';
import type { Customer, CustomerId } from '../../domain/src/customer.ts';
import type { Jurisdiction } from '../../domain/src/jurisdiction.ts';
import type { LegalEntity } from '../../domain/src/legal-entity.ts';
import type { Product } from '../../domain/src/product.ts';
import { err, isOk, ok, type Result } from '../../domain/src/result.ts';
import type { EvidenceVault } from '../../evidence/src/vault.ts';
import type { DomainEventLog } from '../../events/src/events.ts';
import { actionTypesFromCapabilities, type IdentityAuthorityPort } from '../../identity/src/index.ts';
import type { ComplianceKernel } from '../../kernel/src/kernel.ts';
import type { KernelFacts } from '../../kernel/src/proofs.ts';
import { AssetQuantity } from '../../money/src/asset-quantity.ts';
import { Money } from '../../money/src/money.ts';
import { asIntentId, type ActionIntent } from '../../permissions/src/action-intent.ts';
import { ACTION_TYPES } from '../../permissions/src/action-types.ts';
import type { AuthorizationDecision } from '../../permissions/src/decision.ts';
import type { AuthorityIssuer, ExecutionAuthority } from '../../permissions/src/execution-authority.ts';
import { validateIntentStructure } from '../../permissions/src/structural.ts';
import { SUNREY_COIN_ASSET_ID } from '../../sunrey-coin/src/ids.ts';
import {
  AGGREGATE_RESEARCH_LISTING_ID,
  EXCHANGE_FEE_BOOK,
  newClearingInstructionId,
  newExchangeAccountId,
  newExchangeHoldId,
  newReconciliationId,
  newSettlementId,
  SIMULATION_FEE_SCHEDULE_ID,
  SIMULATION_USD_CASH_ASSET_ID,
  SUNREY_COIN_USD_MARKET_ID,
  asExchangeAccountId,
  asListingId,
  newOrderId,
  type ExchangeAccountId,
  type ExchangeMarketId,
  type OrderId,
  type TradeId,
} from './ids.ts';
import { applyFill, matchIncoming, sortBook, toTrade } from './matching.ts';
import { comparePrice, exchangePrice, quoteMoney, type ExchangePrice } from './price.ts';
import {
    InMemoryExchangeCorePersistence,
  MatchingSequencer,
  ProductizedInstrumentRegistry,
  assessTradeFees,
  captureExchangeCore,
  controlBlocksNewOrders,
  expectedTakerFeeBuffer,
  hydrateExchangeStore,
  mapMarketStateToProductized,
  priceWithinBand,
  productizeFeeSchedule,
  productizedInstrumentFromMarket,
  recordOrderRate,
  rateAllows,
  rejectClientFeeOverride,
  replayAcceptedOrders,
  tripCircuitBreaker,
  validatePreTrade,
  type CircuitBreaker,
  type ExchangeCorePersistencePort,
  type ExchangeCoreSnapshot,
  type PriceBand,
  type ProductizedFeeSchedule,
  type RateWindow,
} from './production-core/index.ts';
import type {
  ChainAnchorPort,
  CleanRoomPort,
  CoinPort,
  ConsentPort,
  FiatPort,
  InformationMarketPort,
  MachineCapabilityPort,
  OraclePort,
  ProductiveGraphPort,
} from './ports.ts';
import { ExchangeProductPlatform } from './product/platform.ts';
import { ExchangeStore } from './store.ts';
import { UniversalExchangeEngine } from './universal.ts';
import {
  InMemoryCleanRoomPort,
  InMemoryConsentPort,
  InMemoryMachineCapabilityPort,
  InMemoryOraclePort,
  InMemoryProductiveGraphPort,
} from './adapters.ts';
import {
  GPU_COMPUTE_MARKET_ID,
  INFORMATION_RIGHT_MARKET_ID,
  MANUFACTURING_CAPACITY_MARKET_ID,
  MOONREY_COIN_ASSET_ID,
  SUNREY_MOONREY_MARKET_ID,
} from './ids.ts';
import {
  EVIDENCE_KIND_EXCHANGE,
  PRICE_LABEL,
  type MarketFamily,
  type MarketState,
  type ReconciliationOutcome,
} from './taxonomy.ts';
import type {
  BookEvent,
  Candle,
  ClearingInstruction,
  DigitalOrder,
  ExchangeAccount,
  ExchangeHold,
  ExchangeListing,
  ExchangeMarket,
  ExchangeOutcome,
  FeeSchedule,
  HaltRecord,
  ImmutableTrade,
  ListingDecision,
  MarketDataSnapshot,
  ReconciliationReport,
  SettlementRecord,
} from './types.ts';

export type ExchangeCatalog = {
  readonly customers: { get(id: Customer['id']): Customer | undefined };
  readonly products: { get(id: Product['id']): Product | undefined };
  readonly legalEntities: { get(id: LegalEntity['id']): LegalEntity | undefined };
};

const COIN_PRECISION = 6;

export class SunReyExchangeService {
  private readonly kernel: ComplianceKernel;
  private readonly issuer: AuthorityIssuer;
  private readonly evidence: EvidenceVault;
  private readonly events: DomainEventLog;
  private readonly clock: Clock;
  private readonly identity: IdentityAuthorityPort;
  private readonly catalog: ExchangeCatalog;
  private readonly coin: CoinPort;
  private readonly fiat: FiatPort;
  private readonly informationMarket: InformationMarketPort | null;
  private readonly chain: ChainAnchorPort | null;
  private readonly store = new ExchangeStore();
  readonly product: ExchangeProductPlatform;
  readonly universal: UniversalExchangeEngine;
  readonly instruments: ProductizedInstrumentRegistry = new ProductizedInstrumentRegistry();
  readonly sequencer = new MatchingSequencer();
  private readonly persistence: ExchangeCorePersistencePort;
  private feeScheduleState: ProductizedFeeSchedule = productizeFeeSchedule({
    scheduleId: SIMULATION_FEE_SCHEDULE_ID,
    version: 1,
    makerFeeMinor: 0n,
    takerFeeMinor: 0n,
    listingFeeMinor: 0n,
    computeFeeMinor: 0n,
    commercialPermanence: 'SIMULATION_CONFIGURATION',
  });
  private readonly rateWindows = new Map<string, RateWindow>();
  private readonly priceBands = new Map<string, PriceBand>();
  private readonly circuitBreakers = new Map<string, CircuitBreaker>();
  get feeSchedule(): FeeSchedule {
    return this.feeScheduleState;
  }

  constructor(input: {
    readonly kernel: ComplianceKernel;
    readonly issuer: AuthorityIssuer;
    readonly evidence: EvidenceVault;
    readonly events: DomainEventLog;
    readonly clock: Clock;
    readonly identity: IdentityAuthorityPort;
    readonly catalog: ExchangeCatalog;
    readonly coin: CoinPort;
    readonly fiat: FiatPort;
    readonly informationMarket?: InformationMarketPort;
    readonly chain?: ChainAnchorPort;
    readonly consent?: ConsentPort;
    readonly cleanRoom?: CleanRoomPort;
    readonly oracle?: OraclePort;
    readonly productive?: ProductiveGraphPort;
    readonly machines?: MachineCapabilityPort;
    readonly persistence?: ExchangeCorePersistencePort;
    readonly feeSchedule?: FeeSchedule;
  }) {
    if (LIVE_EXCHANGE_ENABLED !== false || LIVE_CRYPTO_ENABLED !== false) {
      throw new Error('live exchange and live crypto paths are forbidden');
    }
    this.kernel = input.kernel;
    this.issuer = input.issuer;
    this.evidence = input.evidence;
    this.events = input.events;
    this.clock = input.clock;
    this.identity = input.identity;
    this.catalog = input.catalog;
    this.coin = input.coin;
    this.fiat = input.fiat;
    this.informationMarket = input.informationMarket ?? null;
    this.chain = input.chain ?? null;
    this.product = new ExchangeProductPlatform({
      application: { kind: 'APPLICATION_PORT', coin: this.coin, fiat: this.fiat },
    });
    this.persistence = input.persistence ?? new InMemoryExchangeCorePersistence();
    if (input.feeSchedule) {
      this.feeScheduleState = productizeFeeSchedule(input.feeSchedule, {
        ...(input.feeSchedule.makerBps !== undefined ? { makerBps: input.feeSchedule.makerBps } : {}),
        ...(input.feeSchedule.takerBps !== undefined ? { takerBps: input.feeSchedule.takerBps } : {}),
      });
    }
    this.seedSimulationRegistry();
    this.universal = new UniversalExchangeEngine(
      this.store,
      input.consent ?? new InMemoryConsentPort(),
      input.cleanRoom ?? new InMemoryCleanRoomPort(),
      input.oracle ?? new InMemoryOraclePort(),
      input.productive ?? new InMemoryProductiveGraphPort(),
      input.machines ?? new InMemoryMachineCapabilityPort(),
      () => this.clock.now(),
    );
  }

  openExchangeAccount(input: {
    readonly actorId: string;
    readonly customerId: CustomerId;
    readonly identityId: string;
    readonly jurisdiction: Jurisdiction;
    readonly custodyAccountId: string;
    readonly cashAccountId: string;
    readonly marketPermissions?: readonly MarketFamily[];
  }): ExchangeOutcome<ExchangeAccount> {
    const accountId = newExchangeAccountId();
    const intent = this.intent(input.actorId, ACTION_TYPES.OPEN_EXCHANGE_ACCOUNT, {
      accountId,
      customerId: input.customerId,
    });
    const gated = this.authorizeIntent(intent, input.customerId);
    if (gated.outcome !== 'ALLOWED') {
      return gated.result;
    }
    const account: ExchangeAccount = Object.freeze({
      accountId,
      customerId: input.customerId,
      identityId: input.identityId,
      legalEntityId: 'le_solstice_uk_ltd',
      jurisdiction: input.jurisdiction,
      custodyAccountId: input.custodyAccountId,
      cashAccountId: input.cashAccountId,
      marketPermissions: input.marketPermissions ?? ([
        'DIGITAL_ASSET',
        'INFORMATION_ASSET',
        'HUMAN_INFORMATION_RIGHT',
        'INTELLIGENCE_COMPUTE',
        'PRODUCTIVE_CAPACITY',
      ] as const),
      status: 'ACTIVE_SIMULATION',
      createdAt: this.clock.now(),
    });
    this.store.putExchangeAccount(account);
    this.emit('ExchangeAccountCreated', account.accountId, { accountId: account.accountId });
    this.seal('account.created', { accountId: account.accountId, intentId: intent.id });
    return { outcome: 'OK', value: account, decision: gated.decision };
  }

  placeDigitalOrder(input: {
    readonly actorId: string;
    readonly customerId: CustomerId;
    readonly exchangeAccountId: ExchangeAccountId;
    readonly marketId: ExchangeMarketId;
    readonly side: 'BUY' | 'SELL';
    readonly orderType: 'LIMIT' | 'MARKET' | 'IOC' | 'FOK' | 'POST_ONLY';
    readonly quantity: AssetQuantity;
    readonly limitPrice?: ExchangePrice;
    readonly clientIdempotencyKey: string;
    readonly timeInForce?: 'GTC' | 'IOC';
    readonly protectionPrice?: ExchangePrice;
    readonly feeOverride?: unknown;
    readonly agentGenerated?: boolean;
    readonly agentMandateValid?: boolean;
  }): ExchangeOutcome<DigitalOrder> {
    const existingId = this.store.ordersByIdempotency.get(input.clientIdempotencyKey);
    if (existingId) {
      const existing = this.store.order(existingId);
      if (existing) {
        return { outcome: 'OK', value: existing };
      }
    }
    const account = this.store.account(input.exchangeAccountId);
    if (!account) {
      return this.rejectOrder('UNKNOWN_ACCOUNT', 'exchange account not found', input.clientIdempotencyKey);
    }
    if (account.customerId !== input.customerId) {
      return this.rejectOrder('OWNERSHIP_MISMATCH', 'actor does not own the exchange account', input.clientIdempotencyKey);
    }
    const refused = this.refuseDigitalOrderPlacement(input, account);
    if (refused) {
      return refused;
    }
    const market = this.store.markets.get(input.marketId);
    if (!market || market.family !== 'DIGITAL_ASSET') {
      return { outcome: 'REJECTED', code: 'FAMILY_MISMATCH', message: 'digital-asset orders require a DIGITAL_ASSET market' };
    }
    const intent = this.intent(input.actorId, ACTION_TYPES.PLACE_EXCHANGE_ORDER, {
      accountId: account.cashAccountId,
      orderId: input.clientIdempotencyKey,
      side: input.side,
      quantity: input.quantity,
    });
    const gated = this.authorizeIntent(intent, input.customerId);
    if (gated.outcome !== 'ALLOWED') {
      return gated.result;
    }
    const reserved = this.reserveForOrder(account, market, input.side, input.quantity, input.limitPrice ?? input.protectionPrice ?? null);
    if (!reserved.ok) {
      return { outcome: 'REJECTED', code: reserved.error.code, message: reserved.error.message, decision: gated.decision };
    }
    const order: DigitalOrder = Object.freeze({
      orderId: reserved.value.orderId,
      version: 1 as DigitalOrder['version'],
      exchangeAccountId: account.accountId,
      beneficialParticipantId: account.customerId,
      marketId: market.marketId,
      family: 'DIGITAL_ASSET',
      side: input.side,
      orderType: input.orderType,
      quantity: input.quantity,
      remaining: input.quantity,
      limitPrice: input.limitPrice ?? input.protectionPrice ?? null,
      createdAt: this.clock.now(),
      timeInForce:
        input.timeInForce ??
        (input.orderType === 'IOC' || input.orderType === 'FOK' || input.orderType === 'POST_ONLY'
          ? input.orderType
          : 'GTC'),
      status: 'OPEN',
      clientIdempotencyKey: input.clientIdempotencyKey,
      authorizationRef: gated.decision.executionAuthority?.authorityId ?? intent.id,
      holdId: reserved.value.hold.holdId,
      coinHoldId: reserved.value.hold.coinHoldId,
      sourceAccountId: input.side === 'SELL' ? account.custodyAccountId : account.cashAccountId,
      sequence: this.store.nextOrderSequence(),
      filledQuantity: AssetQuantity.zero(input.quantity.assetId),
      complianceRef: gated.decision.evidenceRecordId ?? intent.id,
      feeContext: {
        scheduleId: this.feeScheduleState.scheduleId,
        makerBps: this.feeScheduleState.makerBps,
        takerBps: this.feeScheduleState.takerBps,
        clientOverrideForbidden: true as const,
      },
    });
    this.store.putOrder(order);
    this.store.putHold(reserved.value.hold);
    this.recordBook({ sequence: order.sequence, kind: 'ACCEPT', orderId: order.orderId, at: this.clock.now() });
    this.emit('ExchangeOrderAccepted', order.orderId, { orderId: order.orderId, status: order.status });
    this.persistCore();
    this.emit('ExchangeOrderOpened', order.orderId, { orderId: order.orderId });
    this.seal('order.opened', {
      orderId: order.orderId,
      intentId: intent.id,
      holdId: reserved.value.hold.holdId,
      marketId: market.marketId,
    });
    this.matchAndSettle(order, input.actorId, input.customerId);
    return { outcome: 'OK', value: this.store.order(order.orderId) ?? order, decision: gated.decision };
  }

  private refuseDigitalOrderPlacement(
    input: {
      readonly customerId: CustomerId;
      readonly exchangeAccountId: ExchangeAccountId;
      readonly marketId: ExchangeMarketId;
      readonly side: 'BUY' | 'SELL';
      readonly orderType: 'LIMIT' | 'MARKET' | 'IOC' | 'FOK' | 'POST_ONLY';
      readonly quantity: AssetQuantity;
      readonly limitPrice?: ExchangePrice;
      readonly clientIdempotencyKey: string;
      readonly protectionPrice?: ExchangePrice;
      readonly feeOverride?: unknown;
      readonly agentGenerated?: boolean;
      readonly agentMandateValid?: boolean;
    },
    account: ExchangeAccount,
  ): ExchangeOutcome<DigitalOrder> | null {
    const feeGate = rejectClientFeeOverride({ feeOverride: input.feeOverride });
    if (!feeGate.ok) {
      return this.rejectOrder('CLIENT_FEE_OVERRIDE_FORBIDDEN', 'frontend cannot specify a fee', input.clientIdempotencyKey);
    }
    if (account.status !== 'ACTIVE_SIMULATION') {
      return this.rejectOrder('RESTRICTED_PARTICIPANT', `account status ${account.status}`, input.clientIdempotencyKey);
    }
    if (this.isHalted(input.marketId, account.accountId, input.quantity.assetId)) {
      return { outcome: 'REJECTED', code: 'MARKET_HALTED', message: 'halt is active' };
    }
    if (this.controlActive('NEW_ORDERS', input.marketId) || this.controlActive('NEW_ORDERS', 'GLOBAL')) {
      return { outcome: 'REJECTED', code: 'NEW_ORDERS_DISABLED', message: 'new-order kill switch is active' };
    }
    const market = this.store.markets.get(input.marketId);
    if (!market || market.family !== 'DIGITAL_ASSET') {
      return { outcome: 'REJECTED', code: 'FAMILY_MISMATCH', message: 'digital-asset orders require a DIGITAL_ASSET market' };
    }
    if (this.controlActive('CANCEL_ONLY', market.marketId)) {
      return this.rejectOrder('MARKET_HALTED', `market state ${market.state}`, input.clientIdempotencyKey);
    }
    if (market.state === 'CLOSE_ONLY') {
      return this.rejectOrder('MARKET_CLOSE_ONLY', 'market is close-only; new orders are refused', input.clientIdempotencyKey);
    }
    if (market.state === 'SUSPENDED') {
      return this.rejectOrder('MARKET_SUSPENDED', 'instrument is suspended', input.clientIdempotencyKey);
    }
    if (market.state !== 'OPEN' && market.state !== 'AUCTION') {
      return this.rejectOrder('MARKET_HALTED', `market state ${market.state}`, input.clientIdempotencyKey);
    }
    const listing = this.store.listings.get(market.baseListingId);
    if (!listing || listing.status !== 'SIMULATION_LISTED') {
      return { outcome: 'REJECTED', code: 'ASSET_SUSPENDED', message: 'listing is not SIMULATION_LISTED' };
    }
    if (!input.quantity.isPositive()) {
      return { outcome: 'REJECTED', code: 'INVALID_QUANTITY', message: 'quantity must be positive' };
    }
    if (input.quantity.scaledUnits % 10n ** BigInt(listing.precision) !== 0n && listing.precision === 0) {
      return { outcome: 'REJECTED', code: 'INVALID_PRECISION', message: 'quantity precision rejected' };
    }
    if (input.quantity.assetId !== market.baseAssetId) {
      return { outcome: 'REJECTED', code: 'INVALID_PRECISION', message: 'quantity asset does not match listing' };
    }
    if (listing.minQuantity && input.quantity.scaledUnits < listing.minQuantity.scaledUnits) {
      return { outcome: 'REJECTED', code: 'INVALID_QUANTITY', message: 'below minimum listing quantity' };
    }
    if (listing.maxQuantity && input.quantity.scaledUnits > listing.maxQuantity.scaledUnits) {
      return { outcome: 'REJECTED', code: 'INVALID_QUANTITY', message: 'above maximum listing quantity' };
    }
    if ((input.orderType === 'LIMIT' || input.orderType === 'IOC' || input.orderType === 'FOK' || input.orderType === 'POST_ONLY') && !input.limitPrice) {
      return this.rejectOrder('INVALID_PRICE', 'governed order requires a price', input.clientIdempotencyKey);
    }
    if (input.limitPrice && input.limitPrice.priceUnits <= 0n) {
      return this.rejectOrder('INVALID_PRICE', 'price must be positive', input.clientIdempotencyKey);
    }
    const instrument = this.instruments.forMarket(market.marketId);
    const band = this.priceBands.get(market.marketId);
    const rateKey = `${account.accountId}:${market.marketId}`;
    const rateWindow = recordOrderRate(this.rateWindows.get(rateKey) ?? { orders: 0, windowStartedMs: 0, maxOrders: 1_000 }, Date.parse(this.clock.now()));
    this.rateWindows.set(rateKey, rateWindow);
    const preTrade = validatePreTrade({
      actorAuthenticated: true,
      actorOwnsAccount: account.customerId === input.customerId,
      account,
      customer: this.catalog.customers.get(input.customerId),
      instrument,
      side: input.side,
      orderType: input.orderType,
      quantity: input.quantity,
      limitPrice: input.limitPrice ?? input.protectionPrice ?? null,
      feeSchedule: this.feeScheduleState,
      ...(input.feeOverride !== undefined ? { feeOverride: input.feeOverride } : {}),
      ...(input.agentGenerated !== undefined ? { agentGenerated: input.agentGenerated } : {}),
      ...(input.agentMandateValid !== undefined ? { agentMandateValid: input.agentMandateValid } : {}),
      priceBandOk: input.limitPrice && band ? priceWithinBand(input.limitPrice.priceUnits, band) : true,
      rateLimitOk: rateAllows(rateWindow),
    });
    if (!preTrade.ok) {
      return this.rejectOrder(preTrade.code, preTrade.message, input.clientIdempotencyKey);
    }
    const blocked = controlBlocksNewOrders({
      status: instrument?.status ?? mapMarketStateToProductized(market.state),
      halts: this.store.halts,
      marketId: market.marketId,
      accountId: account.accountId,
      assetId: input.quantity.assetId,
      circuitActive: this.circuitBreakers.get(market.marketId)?.active === true,
    });
    if (blocked.blocked) {
      return this.rejectOrder(blocked.code ?? 'MARKET_HALTED', 'market control refused the order', input.clientIdempotencyKey);
    }
    if (input.orderType === 'MARKET') {
      const protection = this.protectMarketOrder(market, input.side, input.quantity, input.protectionPrice);
      if (!protection.ok) {
        return { outcome: 'REJECTED', code: protection.error.code, message: protection.error.message };
      }
    }
    return null;
  }

  cancelDigitalOrder(input: {
    readonly actorId: string;
    readonly customerId: CustomerId;
    readonly orderId: OrderId;
    readonly clientIdempotencyKey: string;
  }): ExchangeOutcome<DigitalOrder> {
    const order = this.store.order(input.orderId);
    if (!order) {
      return { outcome: 'REJECTED', code: 'UNKNOWN_ORDER', message: 'order not found' };
    }
    const owner = this.store.account(order.exchangeAccountId);
    if (owner && owner.customerId !== input.customerId) {
      return { outcome: 'REJECTED', code: 'OWNERSHIP_MISMATCH', message: 'actor does not own the order' };
    }
    if (order.status === 'CANCELLED' || order.status === 'FILLED') {
      return { outcome: 'OK', value: order };
    }
    if (order.status !== 'OPEN' && order.status !== 'PARTIALLY_FILLED' && order.status !== 'CANCEL_PENDING') {
      return { outcome: 'REJECTED', code: 'NOT_CANCELLABLE', message: `status ${order.status}` };
    }
    const race = this.sequencer.requestCancel(order.orderId);
    if (race.deferred) {
      const pending: DigitalOrder = Object.freeze({
        ...order,
        status: 'CANCEL_PENDING',
        version: (order.version + 1) as DigitalOrder['version'],
      });
      this.store.putOrder(pending);
      this.persistCore();
      return { outcome: 'OK', value: pending };
    }
    const intent = this.intent(input.actorId, ACTION_TYPES.CANCEL_EXCHANGE_ORDER, {
      accountId: order.sourceAccountId,
      orderId: order.orderId,
    });
    const gated = this.authorizeIntent(intent, input.customerId);
    if (gated.outcome !== 'ALLOWED') {
      return gated.result;
    }
    this.releaseHold(order);
    const cancelled: DigitalOrder = Object.freeze({
      ...order,
      status: 'CANCELLED',
      version: (order.version + 1) as DigitalOrder['version'],
    });
    this.store.putOrder(cancelled);
    this.recordBook({
      sequence: this.store.nextOrderSequence(),
      kind: 'CANCEL',
      orderId: cancelled.orderId,
      at: this.clock.now(),
    });
    this.emit('ExchangeOrderCancelled', cancelled.orderId, { orderId: cancelled.orderId });
    this.seal('order.cancelled', { orderId: cancelled.orderId, intentId: intent.id });
    this.refreshMarketData(cancelled.marketId);
    this.persistCore();
    return { outcome: 'OK', value: cancelled, decision: gated.decision };
  }

  halt(input: {
    readonly actorId: string;
    readonly customerId: CustomerId;
    readonly scope: HaltRecord['scope'];
    readonly targetId: string;
    readonly reason: string;
  }): ExchangeOutcome<HaltRecord> {
    const intent = this.intent(input.actorId, ACTION_TYPES.HALT_EXCHANGE, {
      accountId: input.targetId,
      scope: input.scope,
    });
    const gated = this.authorizeIntent(intent, input.customerId);
    if (gated.outcome !== 'ALLOWED') {
      return gated.result;
    }
    const record: HaltRecord = Object.freeze({
      scope: input.scope,
      targetId: input.targetId,
      active: true,
      reason: input.reason,
    });
    this.store.halts.push(record);
    if (input.scope === 'MARKET') {
      const market = this.store.markets.get(input.targetId);
      if (market) {
        this.store.putMarket({ ...market, state: 'HALTED' });
        this.instruments.setStatus(market.marketId, 'HALTED');
      }
    }
    if (input.scope === 'CANCEL_ONLY') {
      const market = this.store.markets.get(input.targetId);
      if (market) {
        this.store.putMarket({ ...market, state: 'CANCEL_ONLY' });
      }
    }
    this.emit('ExchangeMarketHalted', input.targetId, { scope: input.scope, targetId: input.targetId });
    this.seal('market.halted', { ...record, intentId: intent.id });
    this.persistCore();
    return { outcome: 'OK', value: record, decision: gated.decision };
  }

  setExchangeControl(input: {
    readonly actorId: string;
    readonly customerId: CustomerId;
    readonly scope: HaltRecord['scope'];
    readonly targetId: string;
    readonly reason: string;
    readonly actorKind: 'HUMAN_OPERATOR' | 'AGENT' | 'AI';
    readonly active: boolean;
  }): ExchangeOutcome<HaltRecord> {
    if (input.actorKind !== 'HUMAN_OPERATOR') {
      return { outcome: 'REJECTED', code: 'AI_CANNOT_DISABLE_CONTROLS', message: 'AI cannot change exchange kill switches' };
    }
    if (input.active) {
      return this.halt({
        actorId: input.actorId,
        customerId: input.customerId,
        scope: input.scope,
        targetId: input.targetId,
        reason: input.reason,
      });
    }
    const intent = this.intent(input.actorId, ACTION_TYPES.SET_EXCHANGE_CONTROL, {
      accountId: input.targetId,
      scope: input.scope,
    });
    const gated = this.authorizeIntent(intent, input.customerId);
    if (gated.outcome !== 'ALLOWED') {
      return gated.result;
    }
    for (let i = 0; i < this.store.halts.length; i += 1) {
      const halt = this.store.halts[i]!;
      if (halt.active && halt.scope === input.scope && halt.targetId === input.targetId) {
        this.store.halts[i] = Object.freeze({ ...halt, active: false, reason: input.reason });
      }
    }
    if (input.scope === 'MARKET' || input.scope === 'CANCEL_ONLY') {
      const market = this.store.markets.get(input.targetId);
      if (market) {
        this.store.putMarket({ ...market, state: 'OPEN' });
      }
    }
    const record: HaltRecord = Object.freeze({
      scope: input.scope,
      targetId: input.targetId,
      active: false,
      reason: input.reason,
    });
    this.emit('ExchangeMarketResumed', input.targetId, { scope: input.scope, targetId: input.targetId });
    return { outcome: 'OK', value: record, decision: gated.decision };
  }

  decideListing(input: {
    readonly actorId: string;
    readonly customerId: CustomerId;
    readonly listingId: string;
    readonly status: ExchangeListing['status'];
    readonly actorKind: 'HUMAN_OPERATOR' | 'AGENT' | 'AI';
  }): ExchangeOutcome<ListingDecision> {
    if (input.actorKind !== 'HUMAN_OPERATOR') {
      return { outcome: 'REJECTED', code: 'AI_CANNOT_APPROVE_LISTING', message: 'AI cannot approve listings' };
    }
    if ((input.status as string) === 'LIVE_APPROVED') {
      return { outcome: 'REJECTED', code: 'LIVE_APPROVED_FORBIDDEN', message: 'LIVE_APPROVED is not a permitted listing state' };
    }
    const listing = this.store.listings.get(input.listingId);
    if (!listing) {
      return { outcome: 'REJECTED', code: 'UNKNOWN_LISTING', message: 'listing not found' };
    }
    const intent = this.intent(input.actorId, ACTION_TYPES.DECIDE_ASSET_LISTING, {
      accountId: input.listingId,
      listingId: input.listingId,
      status: input.status,
    });
    const gated = this.authorizeIntent(intent, input.customerId);
    if (gated.outcome !== 'ALLOWED') {
      return gated.result;
    }
    const nextVersion = (listing.listingVersion + 1) as ExchangeListing['listingVersion'];
    const next: ExchangeListing = Object.freeze({
      ...listing,
      listingVersion: nextVersion,
      status: input.status,
      legalReviewState: input.status === 'SIMULATION_LISTED' ? 'RESEARCH_REQUIRED' : listing.legalReviewState,
    });
    this.store.putListing(next);
    const decision: ListingDecision = Object.freeze({
      listingId: next.listingId,
      listingVersion: next.listingVersion,
      status: next.status,
      legalReviewState: next.legalReviewState,
      rdtDisposition: 'RESEARCH_REQUIRED',
      actorKind: 'HUMAN_OPERATOR',
      liveApproved: false,
    });
    this.store.listingDecisions.push(decision);
    this.emit('ExchangeListingDecided', next.listingId, {
      listingId: next.listingId,
      listingVersion: String(next.listingVersion),
      status: next.status,
    });
    this.seal('listing.decided', { listingId: next.listingId, version: next.listingVersion, liveApproved: false });
    return { outcome: 'OK', value: decision, decision: gated.decision };
  }

  applyAuthorizedRestriction(input: {
    readonly actorId: string;
    readonly customerId: CustomerId;
    readonly accountId: ExchangeAccountId;
    readonly status: ExchangeAccount['status'];
    readonly actorKind: 'HUMAN_OPERATOR' | 'AGENT' | 'AI';
    readonly caseId: string;
  }): ExchangeOutcome<ExchangeAccount> {
    if (input.actorKind !== 'HUMAN_OPERATOR') {
      return { outcome: 'REJECTED', code: 'AI_CANNOT_PUNISH', message: 'AI cannot restrict a participant' };
    }
    const intent = this.intent(input.actorId, ACTION_TYPES.RESTRICT_EXCHANGE_PARTICIPANT, {
      accountId: input.accountId,
      status: input.status,
    });
    const gated = this.authorizeIntent(intent, input.customerId);
    if (gated.outcome !== 'ALLOWED') {
      return gated.result;
    }
    const account = this.store.account(input.accountId);
    if (!account) {
      return { outcome: 'REJECTED', code: 'UNKNOWN_ACCOUNT', message: 'exchange account not found' };
    }
    const next = Object.freeze({ ...account, status: input.status });
    this.store.putExchangeAccount(next);
    this.seal('participant.restricted', { accountId: input.accountId, caseId: input.caseId, intentId: intent.id });
    return { outcome: 'OK', value: next, decision: gated.decision };
  }

  resumeMarket(marketId: ExchangeMarketId, state: MarketState = 'OPEN'): void {
    const market = this.store.markets.get(marketId);
    if (market) {
      this.store.putMarket({ ...market, state });
      this.instruments.setStatus(marketId, mapMarketStateToProductized(state));
    }
    for (let i = 0; i < this.store.halts.length; i += 1) {
      const halt = this.store.halts[i]!;
      if (halt.active && halt.scope === 'MARKET' && halt.targetId === marketId) {
        this.store.halts[i] = Object.freeze({ ...halt, active: false, reason: 'resume' });
      }
    }
    this.store.halts.push(Object.freeze({ scope: 'MARKET', targetId: marketId, active: false, reason: 'resume' }));
    this.emit('ExchangeMarketResumed', marketId, { marketId });
  }

  restrictParticipant(accountId: ExchangeAccountId, status: ExchangeAccount['status']): void {
    const account = this.store.account(accountId);
    if (account) {
      this.store.putExchangeAccount({ ...account, status });
    }
  }

  suspendListing(listingId: string): void {
    const listing = this.store.listings.get(listingId);
    if (listing) {
      this.store.putListing({ ...listing, status: 'SUSPENDED' });
      const market = [...this.store.markets.values()].find((row) => row.baseListingId === listing.listingId);
      if (market) {
        this.instruments.setStatus(market.marketId, 'SUSPENDED');
      }
    }
  }

  marketData(marketId: ExchangeMarketId): MarketDataSnapshot {
    return this.store.marketData.get(marketId) ?? this.refreshMarketData(marketId);
  }

  candles(marketId: ExchangeMarketId): Candle | null {
    const trades = [...this.store.trades.values()].filter((trade) => trade.marketId === marketId);
    if (trades.length === 0) {
      return null;
    }
    const first = trades[0]!;
    let high = first.price;
    let low = first.price;
    let volume = AssetQuantity.zero(first.quantity.assetId);
    for (const trade of trades) {
      if (comparePrice(trade.price, high) > 0) {
        high = trade.price;
      }
      if (comparePrice(trade.price, low) < 0) {
        low = trade.price;
      }
      volume = volume.plus(trade.quantity);
    }
    return Object.freeze({
      marketId,
      open: first.price,
      high,
      low,
      close: trades[trades.length - 1]!.price,
      volume,
      label: PRICE_LABEL,
    });
  }

  replayBook(marketId: ExchangeMarketId): { readonly bids: DigitalOrder[]; readonly asks: DigitalOrder[] } {
    return sortBook(this.store.openOrders(marketId));
  }

  trades(marketId: ExchangeMarketId): readonly ImmutableTrade[] {
    return [...this.store.trades.values()].filter((trade) => trade.marketId === marketId);
  }

  reconcile(): ReconciliationReport {
    const notes: string[] = [];
    let outcome: ReconciliationOutcome = 'MATCHED';
    const sequences = [...this.store.sequenceByMarket.values()];
    const events = this.store.bookEvents.map((event) => event.sequence).sort((a, b) => a - b);
    if (events.length > 0 && events[0] !== 1) {
      outcome = 'MARKET_DATA_SEQUENCE_GAP';
      notes.push('book event sequence does not start at 1');
    }
    for (let i = 1; i < events.length; i += 1) {
      if (events[i]! !== events[i - 1]! + 1 && events[i] === events[i - 1]) {
        continue;
      }
    }
    for (const trade of this.store.trades.values()) {
      if (!this.store.settlementsByTrade.has(trade.tradeId)) {
        outcome = 'TRADE_SETTLEMENT_MISMATCH';
        notes.push(`trade ${trade.tradeId} has no settlement`);
      }
    }
    for (const order of this.store.orders.values()) {
      if ((order.status === 'OPEN' || order.status === 'PARTIALLY_FILLED') && !order.holdId) {
        outcome = 'ORDER_HOLD_MISMATCH';
        notes.push(`open order ${order.orderId} has no hold`);
      }
    }
    void sequences;
    const report: ReconciliationReport = Object.freeze({
      reconciliationId: newReconciliationId(),
      outcome,
      notes,
      createdAt: this.clock.now(),
      autoCorrected: false,
    });
    this.store.reconciliations.push(report);
    if (outcome !== 'MATCHED') {
      this.emit('ExchangeReconciliationMismatch', report.reconciliationId, { outcome, notes });
    }
    this.seal('reconciliation', { outcome, autoCorrected: false });
    return report;
  }

  acceptComputeContract(input: {
    readonly actorId: string;
    readonly listingId: string;
    readonly sponsorCustomerId: string;
  }): ExchangeOutcome<{ rawRows: false; receiptId: string; contributionId: string; settled: boolean }> {
    const listing = this.store.listings.get(input.listingId);
    if (!listing || listing.family === 'DIGITAL_ASSET') {
      return { outcome: 'REJECTED', code: 'FAMILY_MISMATCH', message: 'compute contracts are not digital-asset orders' };
    }
    if (!this.informationMarket) {
      return { outcome: 'REJECTED', code: 'INFORMATION_MARKET_REQUIRED', message: 'information market port is required' };
    }
    const executed = this.informationMarket.executeApprovedCompute({
      listingId: input.listingId,
      requesterActorId: input.actorId,
      sponsorCustomerId: input.sponsorCustomerId,
    });
    if (!executed.ok) {
      return { outcome: 'REJECTED', code: executed.error.code, message: executed.error.message };
    }
    this.seal('compute.contract', {
      listingId: input.listingId,
      receiptId: executed.value.receiptId,
      rawRows: false,
    });
    return { outcome: 'OK', value: executed.value };
  }

  markets(): readonly ExchangeMarket[] {
    return [...this.store.markets.values()];
  }
  listUniversalInstruments() {
    return this.universal.instruments.list();
  }
  auctions() {
    return [...this.store.auctions.values()];
  }
  contracts() {
    return {
      compute: [...this.store.computeContracts.values()],
      capacity: [...this.store.capacityContracts.values()],
      information: [...this.store.informationContracts.values()],
    };
  }
  familyMarketData(marketId: ExchangeMarketId) {
    return this.universal.familyData(marketId);
  }
  exchangeDisputes() {
    return this.universal.disputes();
  }

  getAccount(id: ExchangeAccountId): ExchangeAccount | undefined {
    return this.store.account(id);
  }
  getOrder(id: OrderId): DigitalOrder | undefined {
    return this.store.order(id);
  }
  getTrade(id: TradeId): ImmutableTrade | undefined {
    return this.store.trade(id);
  }
  getMarket(id: ExchangeMarketId): ExchangeMarket | undefined {
    return this.store.markets.get(id);
  }
  listings(): readonly ExchangeListing[] {
    return [...this.store.listings.values()];
  }
  listingDecisions(): readonly ListingDecision[] {
    return [...this.store.listingDecisions];
  }
  activeControls(): readonly HaltRecord[] {
    return this.store.halts.filter((halt) => halt.active);
  }
  bookEvents(): readonly BookEvent[] {
    return [...this.store.bookEvents];
  }

  productizedInstruments() {
    return this.instruments.list();
  }

  configureFeeSchedule(schedule: FeeSchedule, extras?: { readonly makerBps?: bigint; readonly takerBps?: bigint }): ProductizedFeeSchedule {
    this.feeScheduleState = productizeFeeSchedule(schedule, extras);
    this.persistCore();
    return this.feeScheduleState;
  }

  setPriceBand(band: PriceBand): void {
    this.priceBands.set(String(band.marketId), band);
  }

  setCircuitBreaker(breaker: CircuitBreaker): void {
    this.circuitBreakers.set(String(breaker.marketId), breaker);
  }

  setAuthoritativeMarketState(marketId: ExchangeMarketId, state: MarketState): void {
    const market = this.store.markets.get(marketId);
    if (market) {
      this.store.putMarket({ ...market, state });
      this.instruments.setStatus(marketId, mapMarketStateToProductized(state));
      this.persistCore();
    }
  }

  exportCoreSnapshot(): ExchangeCoreSnapshot {
    return captureExchangeCore({
      store: this.store,
      instruments: this.instruments.list(),
      feeSchedule: this.feeScheduleState,
    });
  }

  restoreCoreSnapshot(snapshot: ExchangeCoreSnapshot): void {
    hydrateExchangeStore(snapshot, this.store);
    for (const instrument of snapshot.instruments) {
      this.instruments.put(instrument);
    }
    this.feeScheduleState = snapshot.feeSchedule;
    this.refreshMarketData(SUNREY_COIN_USD_MARKET_ID);
  }

  persistCore(): void {
    this.persistence.save(this.exportCoreSnapshot());
  }

  recoverFromPersistence(): boolean {
    const loaded = this.persistence.load();
    if (!loaded) {
      return false;
    }
    this.restoreCoreSnapshot(loaded);
    return true;
  }

  replayMarket(marketId: ExchangeMarketId) {
    const accepted = [...this.store.orders.values()]
      .filter((order) => order.marketId === marketId)
      .sort((a, b) => a.sequence - b.sequence);
    return replayAcceptedOrders({
      accepted,
      feeSchedule: this.feeScheduleState,
      quoteCurrency: 'USD',
      selfTrade: this.store.markets.get(marketId)?.selfTradePolicy ?? 'CANCEL_INCOMING',
    });
  }

  assessFeesForQuote(quote: import('../../money/src/money.ts').Money) {
    return assessTradeFees({ schedule: this.feeScheduleState, quote });
  }

  private matchAndSettle(incoming: DigitalOrder, actorId: string, customerId: CustomerId): void {
    const market = this.store.markets.get(incoming.marketId);
    if (!market || market.state !== 'OPEN') {
      return;
    }
    this.sequencer.beginMatch(incoming.orderId);
    const resting = this.store.openOrders(incoming.marketId).filter((order) => order.orderId !== incoming.orderId);
    const result = matchIncoming(incoming, resting, { selfTrade: market.selfTradePolicy });
    if (result.rejectIncoming) {
      this.releaseHold(incoming);
      this.store.putOrder({ ...incoming, status: 'REJECTED', version: (incoming.version + 1) as DigitalOrder['version'] });
      return;
    }
    for (const restingId of result.cancelledRestingIds) {
      const restingOrder = this.store.order(restingId);
      if (!restingOrder) {
        continue;
      }
      this.releaseHold(restingOrder);
      this.store.putOrder({
        ...restingOrder,
        status: 'CANCELLED',
        version: (restingOrder.version + 1) as DigitalOrder['version'],
      });
    }
    let taker = incoming;
    for (const match of result.matches) {
      const trade = toTrade(
        match,
        this.store.nextMarketSequence(incoming.marketId),
        this.clock.now(),
        this.feeSchedule,
        'USD',
      );
      this.store.putTrade(trade);
      this.emit('ExchangeTradeMatched', trade.tradeId, {
        tradeId: trade.tradeId,
        priceLabel: PRICE_LABEL,
        quantity: trade.quantity.scaledUnits.toString(),
      });
      const seller = match.maker.side === 'SELL' ? match.maker : taker;
      const buyer = match.maker.side === 'BUY' ? match.maker : taker;
      const sellerAccount = this.store.account(seller.exchangeAccountId);
      const buyerAccount = this.store.account(buyer.exchangeAccountId);
      const recorded = this.product.recordFill({
        trade,
        buyerAccountId: buyer.exchangeAccountId,
        sellerAccountId: seller.exchangeAccountId,
        buyerParticipantId: buyer.beneficialParticipantId,
        sellerParticipantId: seller.beneficialParticipantId,
        buyerCashAccountId: buyerAccount?.cashAccountId ?? buyer.sourceAccountId,
        sellerCashAccountId: sellerAccount?.cashAccountId ?? seller.sourceAccountId,
        makerHoldId: match.maker.holdId,
        takerHoldId: taker.holdId,
        quoteRail: 'APPLICATION_PORT',
        baseRail: 'APPLICATION_PORT',
        at: this.clock.now(),
      });
      this.emit('ExchangeFillCreated', trade.tradeId, {
        tradeId: trade.tradeId,
        makerOrderId: trade.makerOrderId,
        takerOrderId: trade.takerOrderId,
      });
      const breaker = this.circuitBreakers.get(incoming.marketId);
      if (breaker) {
        const tripped = tripCircuitBreaker(trade.price.priceUnits, breaker);
        this.circuitBreakers.set(incoming.marketId, tripped);
        if (tripped.active) {
          this.store.putMarket({ ...market, state: 'HALTED' });
          this.instruments.setStatus(incoming.marketId, 'HALTED');
          this.emit('ExchangeMarketHalted', incoming.marketId, { marketId: incoming.marketId, reason: tripped.reason });
          this.seal('market.circuit_breaker', { marketId: incoming.marketId, reason: tripped.reason });
        }
      }
      const settled = this.settleTrade(trade, match.maker, taker, actorId, customerId);
      if (settled.outcome !== 'OK') {
        this.product.attachOutcome({
          obligationId: recorded.obligation.obligationId,
          at: this.clock.now(),
          state: 'FAILED',
          failureCode: 'LEDGER_FAILURE',
        });
        this.emit('ExchangeReconciliationMismatch', trade.tradeId, { reason: settled.outcome === 'REJECTED' ? settled.code : 'KERNEL' });
        continue;
      }
      this.product.attachOutcome({
        obligationId: recorded.obligation.obligationId,
        at: this.clock.now(),
        state: 'SETTLED',
        refs: {
          ledger: {
            cashJournalId: settled.value.cashJournalId,
            feeJournalId: settled.value.feeJournalId,
            reservationJournalId: null,
          },
        },
      });
      const makerFilled = applyFill(this.store.order(match.maker.orderId) ?? match.maker, match.quantity);
      taker = applyFill(this.store.order(taker.orderId) ?? taker, match.quantity);
      this.store.putOrder(makerFilled);
      this.store.putOrder(taker);
      this.emitStatus(makerFilled);
      this.emitStatus(taker);
      this.recordBook({
        sequence: this.store.nextOrderSequence(),
        kind: 'TRADE',
        tradeId: trade.tradeId,
        at: this.clock.now(),
      });
    }
    const latest = this.store.order(incoming.orderId);
    if (latest) {
      const cancelRemainder =
        (latest.timeInForce === 'IOC' || latest.orderType === 'MARKET') && latest.status !== 'FILLED';
      if (cancelRemainder) {
        this.releaseHold(latest);
        const cancelled: DigitalOrder = Object.freeze({
          ...latest,
          status: 'CANCELLED',
          version: (latest.version + 1) as DigitalOrder['version'],
        });
        this.store.putOrder(cancelled);
        this.recordBook({
          sequence: this.store.nextOrderSequence(),
          kind: 'CANCEL',
          orderId: cancelled.orderId,
          at: this.clock.now(),
        });
        this.emit('ExchangeOrderCancelled', cancelled.orderId, {
          orderId: cancelled.orderId,
          reason: latest.orderType === 'MARKET' ? 'MARKET_UNFILLED' : 'IOC',
        });
      } else if (latest.status === 'FILLED') {
        this.releaseHold(latest);
      }
    }
    const pendingCancel = this.sequencer.endMatch(incoming.orderId);
    const afterMatch = this.store.order(incoming.orderId);
    if (pendingCancel && afterMatch && (afterMatch.status === 'OPEN' || afterMatch.status === 'PARTIALLY_FILLED' || afterMatch.status === 'CANCEL_PENDING')) {
      this.releaseHold(afterMatch);
      this.store.putOrder({
        ...afterMatch,
        status: 'CANCELLED',
        version: (afterMatch.version + 1) as DigitalOrder['version'],
      });
      this.emit('ExchangeOrderCancelled', afterMatch.orderId, { orderId: afterMatch.orderId, reason: 'CANCEL_FILL_RACE' });
    }
    this.refreshMarketData(incoming.marketId);
    this.persistCore();
  }

  private settleTrade(
    trade: ImmutableTrade,
    maker: DigitalOrder,
    taker: DigitalOrder,
    actorId: string,
    customerId: CustomerId,
  ): ExchangeOutcome<SettlementRecord> {
    if (this.store.settlementsByTrade.has(trade.tradeId)) {
      const existing = this.store.settlements.get(this.store.settlementsByTrade.get(trade.tradeId)!);
      if (existing) {
        return { outcome: 'OK', value: existing };
      }
    }
    const seller = maker.side === 'SELL' ? maker : taker;
    const buyer = maker.side === 'BUY' ? maker : taker;
    const sellerAccount = this.store.account(seller.exchangeAccountId);
    const buyerAccount = this.store.account(buyer.exchangeAccountId);
    if (!sellerAccount || !buyerAccount) {
      return { outcome: 'REJECTED', code: 'UNKNOWN_ACCOUNT', message: 'missing exchange account' };
    }
    const sellerHold = seller.holdId ? this.store.holds.get(seller.holdId) : undefined;
    const buyerHold = buyer.holdId ? this.store.holds.get(buyer.holdId) : undefined;
    if (!sellerHold || !buyerHold) {
      return { outcome: 'REJECTED', code: 'ORDER_HOLD_MISMATCH', message: 'holds missing' };
    }
    const intent = this.intent(actorId, ACTION_TYPES.SETTLE_EXCHANGE_TRADE, {
      accountId: buyerAccount.cashAccountId,
      tradeId: trade.tradeId,
    });
    const gated = this.authorizeIntent(intent, customerId);
    if (gated.outcome !== 'ALLOWED') {
      return gated.result;
    }
    const clearing: ClearingInstruction = Object.freeze({
      clearingId: newClearingInstructionId(),
      tradeId: trade.tradeId,
      baseDelivery: trade.quantity,
      quoteDelivery: trade.quoteAmount,
      makerFee: trade.makerFee,
      takerFee: trade.takerFee,
      makerHoldId: maker.holdId!,
      takerHoldId: taker.holdId!,
    });
    this.store.putClearing(clearing);
    const capturedSeller = this.captureAssetHold(sellerHold, trade.quantity);
    const capturedBuyer = this.captureFiatHold(buyerHold, trade.quoteAmount);
    if (!capturedSeller.ok || !capturedBuyer.ok) {
      return { outcome: 'REJECTED', code: 'ORDER_HOLD_MISMATCH', message: 'hold capture failed' };
    }
    const coinMove = this.coin.transfer(
      actorId,
      sellerAccount.customerId,
      sellerAccount.customerId,
      buyerAccount.customerId,
      trade.quantity,
    );
    if (!coinMove.ok) {
      return { outcome: 'REJECTED', code: coinMove.error.code, message: coinMove.error.message };
    }
    const cashMove = this.fiat.transfer(
      actorId,
      buyerAccount.cashAccountId,
      sellerAccount.cashAccountId,
      trade.quoteAmount,
      `exchange.settle.cash.${trade.tradeId}`,
    );
    if (!cashMove.ok) {
      return { outcome: 'REJECTED', code: cashMove.error.code, message: cashMove.error.message };
    }
    let feeJournalId: string | null = null;
    const feeTotal = trade.makerFee.plus(trade.takerFee);
    if (feeTotal.minorUnits > 0n) {
      const fee = this.fiat.postFee(
        actorId,
        buyerAccount.cashAccountId,
        EXCHANGE_FEE_BOOK,
        feeTotal,
        `exchange.settle.fee.${trade.tradeId}`,
      );
      if (fee.ok) {
        feeJournalId = fee.value.journalId;
      }
    }
    const record: SettlementRecord = Object.freeze({
      settlementId: newSettlementId(),
      tradeId: trade.tradeId,
      clearingId: clearing.clearingId,
      coinJournalId: coinMove.value.journalId,
      cashJournalId: cashMove.value.journalId,
      feeJournalId,
      settledAt: this.clock.now(),
      atomic: true,
    });
    this.store.putSettlement(record);
    this.chain?.requestSettlementAnchor({
      tradeId: trade.tradeId,
      settlementId: record.settlementId,
      listingVersion: '1',
    });
    this.emit('ExchangeTradeSettled', record.settlementId, {
      settlementId: record.settlementId,
      tradeId: trade.tradeId,
    });
    this.seal('trade.settled', {
      tradeId: trade.tradeId,
      settlementId: record.settlementId,
      coinJournalId: record.coinJournalId,
      cashJournalId: record.cashJournalId,
      listingVersion: 1,
    });
    return { outcome: 'OK', value: record, decision: gated.decision };
  }

  private reserveForOrder(
    account: ExchangeAccount,
    market: ExchangeMarket,
    side: 'BUY' | 'SELL',
    quantity: AssetQuantity,
    limitPrice: ExchangePrice | null,
  ): Result<{ orderId: DigitalOrder['orderId']; hold: ExchangeHold }, { code: string; message: string }> {
    const orderId = newOrderId();
    const holdId = newExchangeHoldId();
    if (side === 'SELL') {
      const available = this.coin.position(account.customerId).available;
      if (available.scaledUnits < quantity.scaledUnits) {
        return err({ code: 'INSUFFICIENT_ASSET', message: 'sell exceeds owned available coin' });
      }
      const placed = this.coin.placeHold(account.custodyAccountId, quantity);
      if (!placed.ok) {
        return err(placed.error);
      }
      return ok({
        orderId,
        hold: Object.freeze({
          holdId,
          orderId,
          exchangeAccountId: account.accountId,
          assetKind: 'BASE_ASSET',
          fiatAmount: null,
          remainingFiat: null,
          assetAmount: quantity,
          remainingAsset: quantity,
          coinHoldId: placed.value.holdId,
          state: 'ACTIVE',
        }),
      });
    }
    if (!limitPrice) {
      return err({ code: 'INVALID_PRICE', message: 'buy reservation requires a limit or protection price' });
    }
    const quote = quoteMoney(limitPrice, quantity, 'USD');
    const feeBuffer = expectedTakerFeeBuffer(this.feeScheduleState, quote);
    const reserved = quote.plus(feeBuffer);
    const available = this.fiat.available(account.cashAccountId);
    if (available.minorUnits < reserved.minorUnits) {
      return err({ code: 'INSUFFICIENT_FUNDS', message: 'buy exceeds available cash plus fee buffer' });
    }
    const hold = this.fiat.reserve(account.cashAccountId, reserved, `exchange.hold.${orderId}`);
    if (!hold.ok) {
      return err(hold.error);
    }
    void market;
    return ok({
      orderId,
      hold: Object.freeze({
        holdId,
        orderId,
        exchangeAccountId: account.accountId,
        assetKind: 'QUOTE_FIAT',
        fiatAmount: reserved,
        remainingFiat: reserved,
        assetAmount: null,
        remainingAsset: null,
        coinHoldId: hold.value.holdId,
        state: 'ACTIVE',
      }),
    });
  }

  private captureAssetHold(hold: ExchangeHold, quantity: AssetQuantity): Result<ExchangeHold, { code: string; message: string }> {
    if (!hold.remainingAsset || !hold.coinHoldId) {
      return err({ code: 'ORDER_HOLD_MISMATCH', message: 'asset hold missing' });
    }
    const remaining = hold.remainingAsset.minus(quantity);
    if (remaining.isNegative()) {
      return err({ code: 'ORDER_HOLD_MISMATCH', message: 'capture exceeds asset hold' });
    }
    this.coin.releaseHold(hold.coinHoldId);
    let nextCoinHold: string | null = null;
    if (remaining.isPositive()) {
      const account = this.store.account(hold.exchangeAccountId);
      if (account) {
        const replaced = this.coin.placeHold(account.custodyAccountId, remaining);
        if (replaced.ok) {
          nextCoinHold = replaced.value.holdId;
        }
      }
    }
    const next: ExchangeHold = Object.freeze({
      ...hold,
      remainingAsset: remaining,
      coinHoldId: nextCoinHold,
      state: remaining.isZero() ? 'CAPTURED' : 'PARTIAL',
    });
    this.store.putHold(next);
    return ok(next);
  }

  private captureFiatHold(hold: ExchangeHold, amount: Money): Result<ExchangeHold, { code: string; message: string }> {
    if (!hold.remainingFiat || !hold.coinHoldId) {
      return err({ code: 'ORDER_HOLD_MISMATCH', message: 'fiat hold missing' });
    }
    const remaining = hold.remainingFiat.minus(amount);
    if (remaining.minorUnits < 0n) {
      return err({ code: 'ORDER_HOLD_MISMATCH', message: 'capture exceeds fiat hold' });
    }
    const captured = this.fiat.capture(hold.coinHoldId, amount);
    if (!captured.ok) {
      return err(captured.error);
    }
    const next: ExchangeHold = Object.freeze({
      ...hold,
      remainingFiat: remaining,
      state: remaining.minorUnits === 0n ? 'CAPTURED' : 'PARTIAL',
    });
    this.store.putHold(next);
    return ok(next);
  }

  private releaseHold(order: DigitalOrder): void {
    if (!order.holdId) {
      return;
    }
    const hold = this.store.holds.get(order.holdId);
    if (!hold || hold.state === 'RELEASED' || hold.state === 'CAPTURED') {
      return;
    }
    if (hold.coinHoldId) {
      if (hold.assetKind === 'BASE_ASSET') {
        this.coin.releaseHold(hold.coinHoldId);
      } else {
        this.fiat.release(hold.coinHoldId);
      }
    }
    this.store.putHold({ ...hold, state: 'RELEASED', remainingAsset: hold.assetAmount ? AssetQuantity.zero(hold.assetAmount.assetId) : null, remainingFiat: hold.fiatAmount ? Money.fromMinorUnits(0n, hold.fiatAmount.currency) : null });
  }

  private protectMarketOrder(
    market: ExchangeMarket,
    side: 'BUY' | 'SELL',
    quantity: AssetQuantity,
    protectionPrice: ExchangePrice | undefined,
  ): Result<true, { code: string; message: string }> {
    const book = sortBook(this.store.openOrders(market.marketId));
    const opposite = side === 'BUY' ? book.asks : book.bids;
    if (opposite.length === 0) {
      return err({ code: 'MARKET_ORDER_UNSAFE', message: 'no book liquidity for MARKET order' });
    }
    const best = opposite[0]!.limitPrice!;
    if (market.maxSlippageUnits !== null && protectionPrice) {
      const slip = side === 'BUY' ? protectionPrice.priceUnits - best.priceUnits : best.priceUnits - protectionPrice.priceUnits;
      if (slip > market.maxSlippageUnits) {
        return err({ code: 'SLIPPAGE_BREACH', message: 'MARKET order exceeds slippage collar' });
      }
    } else if (!protectionPrice) {
      return err({ code: 'MARKET_ORDER_UNSAFE', message: 'MARKET requires a protection price' });
    }
    if (market.maxNotionalMinor !== null && protectionPrice) {
      const notional = quoteMoney(protectionPrice, quantity, 'USD').minorUnits;
      if (notional > market.maxNotionalMinor) {
        return err({ code: 'SLIPPAGE_BREACH', message: 'MARKET order exceeds maximum notional' });
      }
    }
    return ok(true);
  }

  private isHalted(marketId: ExchangeMarketId, accountId: ExchangeAccountId, assetId: string): boolean {
    return this.store.halts.some(
      (halt) =>
        halt.active &&
        (halt.scope === 'GLOBAL' ||
          (halt.scope === 'MARKET' && halt.targetId === marketId) ||
          (halt.scope === 'PARTICIPANT' && halt.targetId === accountId) ||
          (halt.scope === 'ASSET' && halt.targetId === assetId)),
    );
  }

  private controlActive(scope: HaltRecord['scope'], targetId: string): boolean {
    return this.store.halts.some((halt) => halt.active && halt.scope === scope && (halt.targetId === targetId || halt.targetId === 'GLOBAL'));
  }

  private refreshMarketData(marketId: ExchangeMarketId): MarketDataSnapshot {
    const book = sortBook(this.store.openOrders(marketId));
    const trades = [...this.store.trades.values()].filter((trade) => trade.marketId === marketId);
    const last = trades[trades.length - 1] ?? null;
    let volume = AssetQuantity.zero(SUNREY_COIN_ASSET_ID);
    for (const trade of trades) {
      volume = volume.plus(trade.quantity);
    }
    const snapshot: MarketDataSnapshot = Object.freeze({
      marketId,
      sequence: (this.store.sequenceByMarket.get(marketId) ?? 0) as MarketDataSnapshot['sequence'],
      bestBid: book.bids[0]?.limitPrice ?? null,
      bestAsk: book.asks[0]?.limitPrice ?? null,
      lastTrade: last,
      lastPriceLabel: last ? PRICE_LABEL : 'UNAVAILABLE',
      volume,
      depth: {
        bids: book.bids.slice(0, 10).map((order) => ({ price: order.limitPrice!, quantity: order.remaining })),
        asks: book.asks.slice(0, 10).map((order) => ({ price: order.limitPrice!, quantity: order.remaining })),
      },
    });
    this.store.marketData.set(marketId, snapshot);
    return snapshot;
  }

  private emitStatus(order: DigitalOrder): void {
    if (order.status === 'PARTIALLY_FILLED') {
      this.emit('ExchangeOrderPartiallyFilled', order.orderId, { orderId: order.orderId, remaining: order.remaining.scaledUnits.toString() });
    }
    if (order.status === 'FILLED') {
      this.emit('ExchangeOrderFilled', order.orderId, { orderId: order.orderId });
    }
  }

  private recordBook(event: BookEvent): void {
    this.store.bookEvents.push(Object.freeze(event));
  }

  private seedSimulationRegistry(): void {
    const coinListing: ExchangeListing = Object.freeze({
      listingId: asListingId('listing:sunrey-coin'),
      listingVersion: 1 as ExchangeListing['listingVersion'],
      family: 'DIGITAL_ASSET',
      underlyingRef: SUNREY_COIN_ASSET_ID,
      settlementModel: 'DIGITAL_ASSET_DVP',
      jurisdictionEligibility: ['GB' as Jurisdiction],
      legalReviewState: 'RESEARCH_REQUIRED',
      enabledCapabilities: ['LIMIT', 'MARKET', 'CANCEL'],
      riskClassification: 'SIMULATION_ONLY',
      minQuantity: AssetQuantity.fromScaledUnits(1_000_000n, SUNREY_COIN_ASSET_ID),
      maxQuantity: AssetQuantity.fromScaledUnits(1_000_000_000_000n, SUNREY_COIN_ASSET_ID),
      precision: COIN_PRECISION,
      status: 'SIMULATION_LISTED',
      tokenClassificationClaim: 'NONE',
    });
    const cashListing: ExchangeListing = Object.freeze({
      listingId: asListingId('listing:simulation-usd-cash'),
      listingVersion: 1 as ExchangeListing['listingVersion'],
      family: 'DIGITAL_ASSET',
      underlyingRef: SIMULATION_USD_CASH_ASSET_ID,
      settlementModel: 'DIGITAL_ASSET_DVP',
      jurisdictionEligibility: ['GB' as Jurisdiction],
      legalReviewState: 'RESEARCH_REQUIRED',
      enabledCapabilities: ['SETTLE_FIAT'],
      riskClassification: 'SIMULATION_ONLY',
      minQuantity: null,
      maxQuantity: null,
      precision: 2,
      status: 'SIMULATION_LISTED',
      tokenClassificationClaim: 'NONE',
    });
    const computeListing: ExchangeListing = Object.freeze({
      listingId: AGGREGATE_RESEARCH_LISTING_ID,
      listingVersion: 1 as ExchangeListing['listingVersion'],
      family: 'INTELLIGENCE_COMPUTE',
      underlyingRef: 'information-market:aggregate-consumer-research-cohort',
      settlementModel: 'COMPUTE_CONTRACT',
      jurisdictionEligibility: ['GB' as Jurisdiction],
      legalReviewState: 'RESEARCH_REQUIRED',
      enabledCapabilities: ['REQUEST', 'OFFER', 'ACCEPTANCE', 'CONTRACT'],
      riskClassification: 'SIMULATION_ONLY',
      minQuantity: null,
      maxQuantity: null,
      precision: 0,
      status: 'SIMULATION_LISTED',
      tokenClassificationClaim: 'NONE',
    });
    const moonreyListing: ExchangeListing = Object.freeze({
      listingId: asListingId('listing:moonrey-coin'),
      listingVersion: 1 as ExchangeListing['listingVersion'],
      family: 'DIGITAL_ASSET',
      underlyingRef: MOONREY_COIN_ASSET_ID,
      settlementModel: 'NATIVE_ASSET_DVP',
      jurisdictionEligibility: ['GB' as Jurisdiction],
      legalReviewState: 'RESEARCH_REQUIRED',
      enabledCapabilities: ['LIMIT', 'IOC', 'FOK', 'POST_ONLY'],
      riskClassification: 'SIMULATION_ONLY',
      minQuantity: AssetQuantity.fromScaledUnits(1n, MOONREY_COIN_ASSET_ID),
      maxQuantity: AssetQuantity.fromScaledUnits(1_000_000_000_000n, MOONREY_COIN_ASSET_ID),
      precision: 0,
      status: 'SIMULATION_LISTED',
      tokenClassificationClaim: 'NONE',
    });
    const infoRightListing: ExchangeListing = Object.freeze({
      listingId: asListingId('listing:information-right'),
      listingVersion: 1 as ExchangeListing['listingVersion'],
      family: 'HUMAN_INFORMATION_RIGHT',
      underlyingRef: 'cohort:consent-qualified-sim',
      settlementModel: 'DELIVERY_VERSUS_RIGHT',
      jurisdictionEligibility: ['GB' as Jurisdiction],
      legalReviewState: 'RESEARCH_REQUIRED',
      enabledCapabilities: ['LIMIT'],
      riskClassification: 'SIMULATION_ONLY',
      minQuantity: null,
      maxQuantity: null,
      precision: 0,
      status: 'SIMULATION_LISTED',
      tokenClassificationClaim: 'NONE',
    });
    const capacityListing: ExchangeListing = Object.freeze({
      listingId: asListingId('listing:manufacturing-capacity'),
      listingVersion: 1 as ExchangeListing['listingVersion'],
      family: 'PRODUCTIVE_CAPACITY',
      underlyingRef: 'object:factory-line-1',
      settlementModel: 'CAPACITY_ESCROW_ORACLE',
      jurisdictionEligibility: ['GB' as Jurisdiction],
      legalReviewState: 'RESEARCH_REQUIRED',
      enabledCapabilities: ['LIMIT'],
      riskClassification: 'SIMULATION_ONLY',
      minQuantity: null,
      maxQuantity: null,
      precision: 0,
      status: 'SIMULATION_LISTED',
      tokenClassificationClaim: 'NONE',
    });
    this.store.putListing(coinListing);
    this.store.putListing(cashListing);
    this.store.putListing(computeListing);
    this.store.putListing(moonreyListing);
    this.store.putListing(infoRightListing);
    this.store.putListing(capacityListing);
    this.store.putMarket(
      Object.freeze({
        marketId: SUNREY_COIN_USD_MARKET_ID,
        family: 'DIGITAL_ASSET',
        bookId: 'book:sunrey-coin-usd' as ExchangeMarket['bookId'],
        baseListingId: coinListing.listingId,
        quoteListingId: cashListing.listingId,
        baseAssetId: SUNREY_COIN_ASSET_ID,
        quoteAssetId: 'USD',
        quoteKind: 'FIAT_MONEY',
        state: 'OPEN',
        selfTradePolicy: 'CANCEL_INCOMING',
        feeScheduleId: SIMULATION_FEE_SCHEDULE_ID,
        maxSlippageUnits: 50n,
        maxNotionalMinor: 1_000_000n,
      }),
    );
    this.store.putMarket(
      Object.freeze({
        marketId: SUNREY_MOONREY_MARKET_ID,
        family: 'DIGITAL_ASSET',
        bookId: 'book:sunrey-moonrey' as ExchangeMarket['bookId'],
        baseListingId: coinListing.listingId,
        quoteListingId: moonreyListing.listingId,
        baseAssetId: SUNREY_COIN_ASSET_ID,
        quoteAssetId: MOONREY_COIN_ASSET_ID,
        quoteKind: 'ASSET',
        state: 'OPEN',
        selfTradePolicy: 'CANCEL_INCOMING',
        feeScheduleId: SIMULATION_FEE_SCHEDULE_ID,
        maxSlippageUnits: 50n,
        maxNotionalMinor: null,
      }),
    );
    this.store.putMarket(
      Object.freeze({
        marketId: GPU_COMPUTE_MARKET_ID,
        family: 'INTELLIGENCE_COMPUTE',
        bookId: 'book:gpu-compute' as ExchangeMarket['bookId'],
        baseListingId: computeListing.listingId,
        quoteListingId: moonreyListing.listingId,
        baseAssetId: 'GPU_SECOND',
        quoteAssetId: MOONREY_COIN_ASSET_ID,
        quoteKind: 'ASSET',
        state: 'OPEN',
        selfTradePolicy: 'PREVENT',
        feeScheduleId: SIMULATION_FEE_SCHEDULE_ID,
        maxSlippageUnits: null,
        maxNotionalMinor: null,
      }),
    );
    this.store.putMarket(
      Object.freeze({
        marketId: MANUFACTURING_CAPACITY_MARKET_ID,
        family: 'PRODUCTIVE_CAPACITY',
        bookId: 'book:manufacturing' as ExchangeMarket['bookId'],
        baseListingId: capacityListing.listingId,
        quoteListingId: moonreyListing.listingId,
        baseAssetId: 'MANUFACTURED_UNIT',
        quoteAssetId: MOONREY_COIN_ASSET_ID,
        quoteKind: 'ASSET',
        state: 'OPEN',
        selfTradePolicy: 'PREVENT',
        feeScheduleId: SIMULATION_FEE_SCHEDULE_ID,
        maxSlippageUnits: null,
        maxNotionalMinor: null,
      }),
    );
    this.store.putMarket(
      Object.freeze({
        marketId: INFORMATION_RIGHT_MARKET_ID,
        family: 'HUMAN_INFORMATION_RIGHT',
        bookId: 'book:information-right' as ExchangeMarket['bookId'],
        baseListingId: infoRightListing.listingId,
        quoteListingId: moonreyListing.listingId,
        baseAssetId: 'authorized_computation',
        quoteAssetId: MOONREY_COIN_ASSET_ID,
        quoteKind: 'ASSET',
        state: 'OPEN',
        selfTradePolicy: 'PREVENT',
        feeScheduleId: SIMULATION_FEE_SCHEDULE_ID,
        maxSlippageUnits: null,
        maxNotionalMinor: null,
      }),
    );
    this.seedProductizedInstruments();
  }

  private seedProductizedInstruments(): void {
    for (const market of this.store.markets.values()) {
      const listing = this.store.listings.get(market.baseListingId);
      this.instruments.put(
        productizedInstrumentFromMarket({
          market,
          listing,
          feeSchedule: this.feeScheduleState,
        }),
      );
    }
  }

  private rejectOrder(code: string, message: string, correlationId: string): ExchangeOutcome<never> {
    this.emit('ExchangeOrderRejected', correlationId, { code, message, correlationId });
    this.seal('order.rejected', { code, message, correlationId });
    return { outcome: 'REJECTED', code, message };
  }

  private intent(actorId: string, actionType: string, payload: Record<string, unknown>): ActionIntent {
    return {
      id: asIntentId(`intent_${randomUUID()}`),
      actionType,
      payload,
      idempotencyKey: `exchange.${actionType}.${payload.orderId ?? payload.tradeId ?? payload.accountId ?? randomUUID()}`,
      actorId,
      requestedAt: this.clock.now(),
      purpose: 'CUSTOMER_DIGITAL_ASSET',
    };
  }

  private authorizeIntent(
    intent: ActionIntent,
    customerId: Customer['id'],
  ):
    | { readonly outcome: 'ALLOWED'; readonly decision: AuthorizationDecision; readonly authority: ExecutionAuthority }
    | { readonly outcome: 'REFUSED'; readonly result: ExchangeOutcome<never> } {
    const customer = this.catalog.customers.get(customerId);
    const product = this.catalog.products.get('prod_digital_usd_gb' as Product['id']);
    const legalEntity = product ? this.catalog.legalEntities.get(product.legalEntityId) : undefined;
    const resolved = this.identity.resolveActorContext(intent.actorId);
    const facts: KernelFacts = {
      actor: {
        id: intent.actorId,
        capabilities: resolved.ok ? actionTypesFromCapabilities(resolved.value.authorizedCapabilities) : [],
      },
      identity: this.identity.identityFactsFor(intent.actorId),
      ...(customer ? { customer } : {}),
      ...(legalEntity ? { legalEntity } : {}),
      ...(product ? { product, jurisdiction: product.jurisdiction } : {}),
    };
    const decision = this.kernel.submit(intent, facts);
    this.emit('KernelDecisionRecorded', intent.id, {
      intentId: intent.id,
      actionType: intent.actionType,
      status: decision.status,
    });
    if (decision.status !== 'ALLOW') {
      this.seal(`${intent.actionType}_KERNEL_REFUSED`, { intentId: intent.id, status: decision.status });
      return { outcome: 'REFUSED', result: { outcome: 'KERNEL_REFUSED', decision } };
    }
    const structural = validateIntentStructure(intent, {
      products: { get: (id) => this.catalog.products.get(id), list: () => [] },
      legalEntities: this.catalog.legalEntities,
      accounts: { get: () => undefined },
    });
    if (!isOk(structural)) {
      return {
        outcome: 'REFUSED',
        result: { outcome: 'REJECTED', code: structural.error.code, message: structural.error.message, decision },
      };
    }
    if (!decision.executionAuthority) {
      return {
        outcome: 'REFUSED',
        result: { outcome: 'REJECTED', code: 'MISSING_EXECUTION_AUTHORITY', message: 'ALLOW without authority', decision },
      };
    }
    const verified = this.issuer.verify(
      decision.executionAuthority,
      {
        actionType: intent.actionType,
        accountId: String((intent.payload as { accountId?: string }).accountId ?? intent.id),
        intentId: intent.id,
      },
      this.clock,
    );
    if (!isOk(verified)) {
      return {
        outcome: 'REFUSED',
        result: { outcome: 'REJECTED', code: verified.error.code, message: verified.error.message, decision },
      };
    }
    return { outcome: 'ALLOWED', decision, authority: verified.value };
  }

  private emit(eventType: string, aggregateId: string, payload: Record<string, unknown>): void {
    this.events.append({
      eventType: eventType as never,
      schemaVersion: 1,
      occurredAt: this.clock.now(),
      payload,
    } as never);
    void aggregateId;
  }

  private seal(kind: string, payload: Record<string, unknown>): void {
    this.evidence.seal(`${EVIDENCE_KIND_EXCHANGE}:${kind}`, payload);
  }
}

export { exchangePrice };
export { asExchangeAccountId };
