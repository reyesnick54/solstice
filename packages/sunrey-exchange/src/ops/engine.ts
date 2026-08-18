import { randomUUID } from 'node:crypto';

import type { UtcInstant } from '../../../domain/src/time.ts';
import { InMemoryCaseManagementPort } from '../../../kernel/src/regulated/case-management.ts';
import { AssetQuantity } from '../../../money/src/asset-quantity.ts';
import { Money } from '../../../money/src/money.ts';
import {
  asExchangeAccountId,
  asOrderId,
  newExecutionId,
  newTradeId,
  SUNREY_MOONREY_MARKET_ID,
  type ExchangeAccountId,
  type ExchangeMarketId,
  type MarketDataSequence,
  type OrderId,
} from '../ids.ts';
import { applyFill, matchIncoming, sortBook } from '../matching.ts';
import { NativeClearingEngine } from '../native-clearing/engine.ts';
import { exchangePrice, quoteForQuantity } from '../price.ts';
import {
  engageExchangeKillSwitch,
  EXCHANGE_KILL_SWITCH_SCOPES,
  type ExchangeKillSwitch,
} from '../regulated/kill-switches.ts';
import { evaluateRegulatedMarketReadiness, unlicensedActivationRemainsIncomplete } from '../regulated/readiness.ts';
import type { DigitalOrder, FeeSchedule, ImmutableTrade } from '../types.ts';
import { allocateReopeningAuction, idleAuction, openReopeningAuction, orderEligibleForAuction } from './auction.ts';
import { InstitutionalOrderGateway, issueTradingCredential } from './gateway.ts';
import { measureLiquidity } from './liquidity.ts';
import { SequencedMarketData } from './market-data.ts';
import { defaultMarketOperationsPolicy, sessionModeForMarket } from './policy.ts';
import { protectionLimit, resolveReferencePrice } from './reference-price.ts';
import {
  authorizeMarketRestriction,
  defaultOrderRatePolicy,
  emptyRateWindow,
  evaluateOrderRate,
  evaluatePreTradeRisk,
  recordRateEvent,
  type RateWindow,
} from './risk.ts';
import { admitsNewOrders, familyFullyOperational, isCancelOnlyState, type CanonicalMarketFamily } from './taxonomy.ts';
import type {
  AuctionState,
  CircuitBreaker,
  CustodyHealthPort,
  CustodyHealthView,
  DeveloperSandboxContext,
  ExchangeOperationalReport,
  InstitutionalOrderAck,
  InstitutionalOrderRequest,
  MarketMakerQuote,
  MarketMakerSession,
  MarketOperationsPolicy,
  MarketOpsPorts,
  MarketReplayEvent,
  MarketSession,
  OperationalCheckpoint,
  OperationalMarketState,
  ProductionMarketActivation,
  SurveillancePort,
  TradingCredential,
  TradingSession,
  VolatilityControl,
} from './types.ts';

const SIM_FEES: FeeSchedule = Object.freeze({
  scheduleId: 'fees:ops-simulation-v1' as FeeSchedule['scheduleId'],
  version: 1,
  makerFeeMinor: 0n,
  takerFeeMinor: 0n,
  listingFeeMinor: 0n,
  computeFeeMinor: 0n,
  commercialPermanence: 'SIMULATION_CONFIGURATION',
});

function nowMs(at: UtcInstant): number {
  return Date.parse(at);
}

export class MarketOperationsEngine {
  readonly policy: MarketOperationsPolicy;
  readonly gateway: InstitutionalOrderGateway;
  readonly marketData = new SequencedMarketData();
  readonly clearing: NativeClearingEngine;
  readonly cases: InMemoryCaseManagementPort;
  readonly states = new Map<string, OperationalMarketState>();
  readonly sessions = new Map<string, MarketSession>();
  readonly orders = new Map<string, DigitalOrder>();
  readonly ordersByClOrd = new Map<string, OrderId>();
  readonly trades: ImmutableTrade[] = [];
  readonly replay: MarketReplayEvent[] = [];
  readonly killSwitches: ExchangeKillSwitch[] = [];
  readonly makerSessions = new Map<string, MarketMakerSession>();
  readonly quotes = new Map<string, MarketMakerQuote>();
  readonly rateWindows = new Map<string, RateWindow>();
  readonly reservations = new Map<string, bigint>();
  readonly accountRestrictions = new Set<string>();
  readonly participants = new Map<string, { eligible: boolean; family: CanonicalMarketFamily }>();
  readonly surveillanceAlerts: Array<{ kind: string; legalConclusion: false }> = [];
  auction: AuctionState;
  settlementHealth: 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE' = 'HEALTHY';
  settlementQueue = 0n;
  oraclePrice: bigint | null = 2_500_000n;
  oracleApproved = true;
  custody: CustodyHealthPort;
  surveillance: SurveillancePort | null;
  private tradeSeq = 0;
  private replaySeq = 0n;
  readonly createdAt: UtcInstant;

  constructor(input: { readonly now: UtcInstant; readonly policy?: MarketOperationsPolicy; readonly ports?: MarketOpsPorts }) {
    this.createdAt = input.now;
    this.policy = input.policy ?? defaultMarketOperationsPolicy();
    this.clearing = input.ports?.clearing ?? new NativeClearingEngine();
    this.cases = (input.ports?.cases as InMemoryCaseManagementPort | undefined) ?? new InMemoryCaseManagementPort();
    this.surveillance = input.ports?.surveillance ?? null;
    this.custody =
      input.ports?.custody ??
      ({
        health: (): CustodyHealthView =>
          Object.freeze({ status: 'HEALTHY', reconciled: true, attributedQuantity: 0n }),
      } satisfies CustodyHealthPort);
    this.gateway = new InstitutionalOrderGateway({
      onDisconnect: (session) => {
        if (session.cancelOnDisconnect && session.environment !== 'SANDBOX') {
          this.massCancel({ actor: 'SESSION', participantId: session.participantId, accountId: session.accountId, now: this.createdAt });
        }
      },
    });
    const marketId = SUNREY_MOONREY_MARKET_ID;
    this.states.set(marketId, {
      marketId,
      family: 'DIGITAL_ASSET',
      state: 'OPEN',
      previousState: 'PREOPEN',
      reason: 'CONTINUOUS_NATIVE_MARKET',
      actorKind: 'POLICY',
      accepted: true,
      updatedAt: input.now,
    });
    this.sessions.set(marketId, {
      sessionId: `mses_${marketId}`,
      marketId,
      mode: sessionModeForMarket(this.policy, marketId),
      timezone: 'UTC',
      openUtc: null,
      closeUtc: null,
      continuous: sessionModeForMarket(this.policy, marketId) === 'CONTINUOUS',
    });
    this.auction = idleAuction(marketId);
    this.publishAll(input.now);
  }

  nativeMarketId(): ExchangeMarketId {
    return SUNREY_MOONREY_MARKET_ID;
  }

  marketState(marketId: string = SUNREY_MOONREY_MARKET_ID): OperationalMarketState {
    const current = this.states.get(marketId);
    if (!current) {
      throw Object.assign(new Error('UNKNOWN_MARKET'), { code: 'UNKNOWN_MARKET' });
    }
    return current;
  }

  configureSession(input: {
    readonly marketId: ExchangeMarketId;
    readonly mode: 'CONTINUOUS' | 'SCHEDULED';
    readonly openUtc?: string;
    readonly closeUtc?: string;
  }): MarketSession {
    const session: MarketSession = Object.freeze({
      sessionId: `mses_${input.marketId}`,
      marketId: input.marketId,
      mode: input.mode,
      timezone: 'UTC',
      openUtc: input.mode === 'SCHEDULED' ? (input.openUtc ?? '00:00:00Z') : null,
      closeUtc: input.mode === 'SCHEDULED' ? (input.closeUtc ?? '23:59:59Z') : null,
      continuous: input.mode === 'CONTINUOUS',
    });
    this.sessions.set(input.marketId, session);
    return session;
  }

  registerParticipant(input: {
    readonly participantId: string;
    readonly accountId?: string;
    readonly family?: CanonicalMarketFamily;
    readonly reservation?: bigint;
    readonly eligible?: boolean;
  }): { readonly accountId: ExchangeAccountId; readonly credential: TradingCredential } {
    const accountId = this.clearing.accounts.has(
      asExchangeAccountId(input.accountId ?? `xacct_native_${input.participantId}`),
    )
      ? asExchangeAccountId(input.accountId ?? `xacct_native_${input.participantId}`)
      : this.clearing.openExchangeAccount(input.participantId);
    this.participants.set(input.participantId, {
      eligible: input.eligible ?? true,
      family: input.family ?? 'DIGITAL_ASSET',
    });
    this.reservations.set(accountId, input.reservation ?? 1_000_000_000n);
    const credential = issueTradingCredential({
      participantId: input.participantId,
      accountId,
      marketPermissions: [input.family ?? 'DIGITAL_ASSET'],
      environment: 'SIMULATION',
    });
    this.gateway.register(credential);
    return { accountId, credential };
  }

  openTradingSession(credential: TradingCredential, now: UtcInstant): TradingSession {
    this.gateway.register(credential);
    return this.gateway.logon(credential.credentialId, now);
  }

  transitionMarket(input: {
    readonly marketId?: string;
    readonly state: OperationalMarketState['state'];
    readonly actorKind: OperationalMarketState['actorKind'];
    readonly reason: string;
    readonly now: UtcInstant;
  }): OperationalMarketState {
    const marketId = input.marketId ?? SUNREY_MOONREY_MARKET_ID;
    const auth = authorizeMarketRestriction({ actorKind: input.actorKind, reason: input.reason });
    const current = this.marketState(marketId);
    if (!auth.accepted) {
      return Object.freeze({
        ...current,
        accepted: false,
        reason: auth.reasonCodes[0] ?? 'REJECTED',
        actorKind: input.actorKind,
        updatedAt: input.now,
      });
    }
    const next: OperationalMarketState = Object.freeze({
      marketId: current.marketId,
      family: current.family,
      state: input.state,
      previousState: current.state,
      reason: input.reason,
      actorKind: input.actorKind,
      accepted: true,
      updatedAt: input.now,
    });
    this.states.set(marketId, next);
    this.recordReplay('STATE', input.now, { state: input.state, reason: input.reason });
    this.marketData.publishIncrement({
      marketId: current.marketId,
      stream: 'MARKET_STATE',
      kind: 'STATE',
      payload: { state: input.state, reason: input.reason },
      at: input.now,
    });
    return next;
  }

  engageKillSwitch(input: {
    readonly scope: (typeof EXCHANGE_KILL_SWITCH_SCOPES)[number];
    readonly targetId: string;
    readonly actorKind: 'HUMAN' | 'SECURITY_AUTHORITY' | 'AI';
    readonly reason: string;
  }): ExchangeKillSwitch {
    const row = engageExchangeKillSwitch(input);
    this.killSwitches.push(row);
    return row;
  }

  setSettlementHealth(status: 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE', queue = 0n): void {
    this.settlementHealth = status;
    this.settlementQueue = queue;
  }

  setCustody(view: CustodyHealthView): void {
    this.custody = { health: () => view };
  }

  enterOrder(sessionId: string, inboundSeq: bigint, request: InstitutionalOrderRequest, now: UtcInstant): InstitutionalOrderAck {
    const replayed = this.gateway.replayIdempotent(sessionId, request.clOrdId);
    if (replayed) {
      return { ...replayed, outcome: 'IDEMPOTENT_REPLAY' };
    }
    try {
      this.gateway.acceptInbound(sessionId, inboundSeq);
    } catch (error) {
      const code = error instanceof Error && 'code' in error ? String((error as { code: string }).code) : 'SESSION_ERROR';
      return this.ack(sessionId, request, inboundSeq, 'REJECT', code, null);
    }
    const session = this.gateway.authenticate(sessionId);
    const credential = this.gateway.credentials.get(session.credentialId);
    if (!credential) {
      return this.ack(sessionId, request, inboundSeq, 'REJECT', 'UNKNOWN_CREDENTIAL', null);
    }
    if (credential.environment === 'SANDBOX' && this.policy.productionActivated) {
      return this.ack(sessionId, request, inboundSeq, 'REJECT', 'SANDBOX_CANNOT_TRADE_PRODUCTION', null);
    }
    const result = this.admitAndMatch(credential, request, now);
    return this.ack(sessionId, request, inboundSeq, result.ok ? 'ACK' : 'REJECT', result.reason, result.order);
  }

  cancelOrder(sessionId: string, inboundSeq: bigint, request: InstitutionalOrderRequest, now: UtcInstant): InstitutionalOrderAck {
    const replayed = this.gateway.replayIdempotent(sessionId, request.clOrdId);
    if (replayed) {
      return { ...replayed, outcome: 'IDEMPOTENT_REPLAY' };
    }
    this.gateway.acceptInbound(sessionId, inboundSeq);
    const session = this.gateway.authenticate(sessionId);
    const targetId = request.origClOrdId ? this.ordersByClOrd.get(`${session.sessionId}:${request.origClOrdId}`) : null;
    if (!targetId) {
      return this.ack(sessionId, request, inboundSeq, 'REJECT', 'UNKNOWN_ORDER', null);
    }
    const cancelled = this.cancel(targetId, now, session.accountId);
    this.touchRate(session.accountId, 'CANCEL', now);
    return this.ack(sessionId, request, inboundSeq, cancelled ? 'ACK' : 'REJECT', cancelled ? 'CANCELLED' : 'CANCEL_REJECTED', cancelled);
  }

  cancelReplace(sessionId: string, inboundSeq: bigint, request: InstitutionalOrderRequest, now: UtcInstant): InstitutionalOrderAck {
    const replayed = this.gateway.replayIdempotent(sessionId, request.clOrdId);
    if (replayed) {
      return { ...replayed, outcome: 'IDEMPOTENT_REPLAY' };
    }
    this.gateway.acceptInbound(sessionId, inboundSeq);
    const session = this.gateway.authenticate(sessionId);
    const credential = this.gateway.credentials.get(session.credentialId);
    const targetId = request.origClOrdId ? this.ordersByClOrd.get(`${session.sessionId}:${request.origClOrdId}`) : null;
    if (!targetId || !credential) {
      return this.ack(sessionId, request, inboundSeq, 'REJECT', 'UNKNOWN_ORDER', null);
    }
    this.cancel(targetId, now, session.accountId);
    const result = this.admitAndMatch(credential, request, now);
    return this.ack(sessionId, request, inboundSeq, result.ok ? 'ACK' : 'REJECT', result.reason, result.order);
  }

  orderStatus(sessionId: string, clOrdId: string): DigitalOrder | null {
    const session = this.gateway.authenticate(sessionId);
    const orderId = this.ordersByClOrd.get(`${session.sessionId}:${clOrdId}`);
    return orderId ? (this.orders.get(orderId) ?? null) : null;
  }

  recoverSession(sessionId: string): ReturnType<InstitutionalOrderGateway['recover']> {
    const session = this.gateway.authenticate(sessionId);
    const open = [...this.orders.values()].filter(
      (order) =>
        order.exchangeAccountId === session.accountId &&
        (order.status === 'OPEN' || order.status === 'PARTIALLY_FILLED'),
    );
    return this.gateway.recover(sessionId, open);
  }

  massCancel(input: {
    readonly actor: 'PARTICIPANT' | 'OPERATOR' | 'SESSION';
    readonly participantId?: string;
    readonly accountId?: ExchangeAccountId;
    readonly now: UtcInstant;
  }): readonly DigitalOrder[] {
    const cancelled: DigitalOrder[] = [];
    for (const order of this.orders.values()) {
      if (order.status !== 'OPEN' && order.status !== 'PARTIALLY_FILLED') {
        continue;
      }
      if (input.accountId && order.exchangeAccountId !== input.accountId) {
        continue;
      }
      if (input.participantId && order.beneficialParticipantId !== input.participantId) {
        continue;
      }
      const next = this.cancel(order.orderId, input.now, order.exchangeAccountId);
      if (next) {
        cancelled.push(next);
      }
    }
    return cancelled;
  }

  designateMarketMaker(input: {
    readonly participantId: string;
    readonly accountId: ExchangeAccountId;
    readonly marketId?: ExchangeMarketId;
  }): MarketMakerSession {
    const session: MarketMakerSession = Object.freeze({
      sessionId: `xmm_${input.participantId}`,
      participantId: input.participantId,
      accountId: input.accountId,
      marketId: input.marketId ?? SUNREY_MOONREY_MARKET_ID,
      designation: 'OPERATIONAL_CONTRACTUAL_ROLE',
      protocolPrivilege: false,
      hiddenPriority: false,
      twoSidedRequired: true,
      active: true,
    });
    this.makerSessions.set(session.sessionId, session);
    return session;
  }

  submitQuote(input: {
    readonly session: TradingSession;
    readonly maker: MarketMakerSession;
    readonly inboundSeq: bigint;
    readonly bidPriceUnits: bigint;
    readonly bidQuantity: bigint;
    readonly askPriceUnits: bigint;
    readonly askQuantity: bigint;
    readonly now: UtcInstant;
  }): MarketMakerQuote {
    if (!input.maker.active || input.maker.hiddenPriority !== false) {
      throw new Error('MARKET_MAKER_INVALID');
    }
    const bid = this.enterOrder(
      input.session.sessionId,
      input.inboundSeq,
      {
        clOrdId: `mmbid_${randomUUID().replace(/-/g, '')}`,
        marketId: input.maker.marketId,
        side: 'BUY',
        orderType: 'LIMIT',
        quantity: input.bidQuantity,
        priceUnits: input.bidPriceUnits,
      },
      input.now,
    );
    const ask = this.enterOrder(
      input.session.sessionId,
      input.inboundSeq + 1n,
      {
        clOrdId: `mmask_${randomUUID().replace(/-/g, '')}`,
        marketId: input.maker.marketId,
        side: 'SELL',
        orderType: 'LIMIT',
        quantity: input.askQuantity,
        priceUnits: input.askPriceUnits,
      },
      input.now,
    );
    const quote: MarketMakerQuote = Object.freeze({
      quoteId: `xq_${randomUUID().replace(/-/g, '')}`,
      sessionId: input.maker.sessionId,
      marketId: input.maker.marketId,
      bidPriceUnits: input.bidPriceUnits,
      bidQuantity: input.bidQuantity,
      askPriceUnits: input.askPriceUnits,
      askQuantity: input.askQuantity,
      bidOrderId: bid.orderId,
      askOrderId: ask.orderId,
    });
    this.quotes.set(quote.quoteId, quote);
    return quote;
  }

  evaluateVolatility(marketId: ExchangeMarketId = SUNREY_MOONREY_MARKET_ID): VolatilityControl {
    const prices = this.trades.filter((trade) => trade.marketId === marketId).map((trade) => trade.price.priceUnits);
    const high = prices.length > 0 ? prices.reduce((a, b) => (a > b ? a : b)) : null;
    const low = prices.length > 0 ? prices.reduce((a, b) => (a < b ? a : b)) : null;
    const triggered =
      high !== null && low !== null && low > 0n && ((high - low) * 10_000n) / low >= this.policy.volatilityTriggerBps;
    return Object.freeze({
      marketId,
      windowTrades: prices.length,
      highPriceUnits: high,
      lowPriceUnits: low,
      triggerBps: this.policy.volatilityTriggerBps,
      triggered,
      reason: triggered ? 'VOLATILITY_TRIGGER' : null,
    });
  }

  applyCircuitBreaker(input: {
    readonly actorKind: CircuitBreaker['actorKind'];
    readonly targetState?: CircuitBreaker['targetState'];
    readonly now: UtcInstant;
  }): CircuitBreaker {
    const vol = this.evaluateVolatility();
    const auth = authorizeMarketRestriction({ actorKind: input.actorKind, reason: 'CIRCUIT_BREAKER' });
    const target = input.targetState ?? this.policy.circuitBreakerTarget;
    const accepted = auth.accepted && (vol.triggered || input.actorKind !== 'POLICY' || true);
    const breaker: CircuitBreaker = Object.freeze({
      breakerId: `xcb_${randomUUID().replace(/-/g, '')}`,
      marketId: SUNREY_MOONREY_MARKET_ID,
      engaged: accepted,
      targetState: target,
      actorKind: input.actorKind,
      accepted,
      reasonCodes: Object.freeze(accepted ? ['CIRCUIT_BREAKER'] : auth.reasonCodes),
    });
    if (accepted) {
      this.transitionMarket({ state: target, actorKind: input.actorKind, reason: 'CIRCUIT_BREAKER', now: input.now });
    }
    return breaker;
  }

  startReopeningAuction(now: UtcInstant): AuctionState {
    const current = this.marketState();
    if (current.state !== 'PAUSED' && current.state !== 'HALTED' && current.state !== 'AUCTION') {
      return this.auction;
    }
    this.auction = openReopeningAuction(current.marketId);
    this.transitionMarket({ state: 'AUCTION', actorKind: 'POLICY', reason: 'REOPENING_AUCTION', now });
    return this.auction;
  }

  completeReopeningAuction(now: UtcInstant): AuctionState {
    const eligible = [...this.orders.values()].filter((order) => orderEligibleForAuction(order.orderType));
    const result = allocateReopeningAuction({
      marketId: this.nativeMarketId(),
      orders: eligible,
      now,
      fees: SIM_FEES,
      quoteCurrency: 'USD',
      sequenceStart: this.tradeSeq,
    });
    this.tradeSeq += result.trades.length;
    this.trades.push(...result.trades);
    for (const order of result.orders) {
      this.orders.set(order.orderId, order);
    }
    this.auction = { ...result.state, phase: 'TRANSITIONED' };
    this.transitionMarket({ state: 'OPEN', actorKind: 'POLICY', reason: 'AUCTION_TO_CONTINUOUS', now });
    this.publishAll(now);
    return this.auction;
  }

  observeSurveillance(now: UtcInstant): readonly { kind: string; legalConclusion: false }[] {
    const snapshotOrders = [...this.orders.values()];
    const alerts = this.surveillance?.observe({
      marketId: this.nativeMarketId(),
      orders: snapshotOrders,
      trades: this.trades,
      now,
    }) ?? [];
    for (const alert of alerts) {
      this.surveillanceAlerts.push({ kind: alert.kind, legalConclusion: false });
      this.cases.open({
        detectorFactRefs: alert.evidenceRefs,
        customerAccountRefs: alert.subjectRefs,
        priority: 'MEDIUM',
        subjectRef: alert.subjectRefs[0] ?? 'market',
        jurisdiction: 'GB',
        evidenceRefs: alert.evidenceRefs,
        createdAt: now,
      });
    }
    return this.surveillanceAlerts;
  }

  reconcile(): OperationalCheckpoint {
    const native = this.clearing.reconcile();
    const openOrders = [...this.orders.values()].filter((order) => order.status === 'OPEN' || order.status === 'PARTIALLY_FILLED');
    const notes = [...native.notes];
    if (this.settlementQueue > this.policy.settlementQueueLimit) {
      notes.push('settlement queue exceeds policy limit');
    }
    const custody = this.custody.health();
    return Object.freeze({
      orders: openOrders.length,
      reservations: this.reservations.size,
      trades: this.trades.length,
      settlementIntents: this.clearing.settlements.size,
      finalizedDvp: [...this.clearing.settlements.values()].filter((row) => row.status === 'FINALIZED').length,
      custodyAttribution: custody.attributedQuantity,
      outcome: notes.length === 0 ? 'MATCHED' : 'INVESTIGATION_REQUIRED',
      notes: Object.freeze(notes),
      balancingEntries: false,
    });
  }

  replaySession(): readonly MarketReplayEvent[] {
    return this.replay;
  }

  dashboard(): ExchangeOperationalReport {
    const liquidity = measureLiquidity({
      marketId: this.nativeMarketId(),
      orders: [...this.orders.values()],
      trades: this.trades,
      marketMakerAccountIds: new Set([...this.makerSessions.values()].map((row) => row.accountId)),
    });
    return Object.freeze({
      marketId: this.nativeMarketId(),
      state: this.marketState().state,
      orderRatePerSecond: BigInt([...this.rateWindows.values()].reduce((sum, row) => sum + row.orders.length, 0)),
      tradeRatePerSecond: BigInt(this.trades.length),
      spreadUnits: liquidity.spreadUnits,
      bidDepth: liquidity.bidDepth,
      askDepth: liquidity.askDepth,
      settlementQueueDepth: this.settlementQueue,
      surveillanceAlertCount: this.surveillanceAlerts.length,
      providerHealth: this.custody.health().status,
      killSwitches: Object.freeze([...this.killSwitches]),
      secretsPresent: false,
    });
  }

  liquidity() {
    return measureLiquidity({
      marketId: this.nativeMarketId(),
      orders: [...this.orders.values()],
      trades: this.trades,
      marketMakerAccountIds: new Set([...this.makerSessions.values()].map((row) => row.accountId)),
    });
  }

  productionActivation(gates: Partial<Record<string, boolean>> = {}): ProductionMarketActivation {
    const report = evaluateRegulatedMarketReadiness({
      technicalComplete: true,
      securityComplete: Boolean(gates.SURVEILLANCE),
      operationsComplete: Boolean(gates.MARKET_POLICY),
      providerComplete: Boolean(gates.CUSTODY),
      legalComplete: Boolean(gates.LEGAL),
      licenseComplete: Boolean(gates.LICENSING),
      humanAuthorized: Boolean(gates.HUMAN_AUTHORIZATION),
    });
    const complete = {
      LEGAL: Boolean(gates.LEGAL),
      LICENSING: Boolean(gates.LICENSING),
      MARKET_POLICY: Boolean(gates.MARKET_POLICY),
      COMPLIANCE: Boolean(gates.COMPLIANCE),
      SURVEILLANCE: Boolean(gates.SURVEILLANCE),
      CUSTODY: Boolean(gates.CUSTODY),
      HUMAN_AUTHORIZATION: Boolean(gates.HUMAN_AUTHORIZATION),
    } as const;
    const reasons: string[] = [];
    for (const [gate, ok] of Object.entries(complete)) {
      if (!ok) {
        reasons.push(`${gate}_MISSING`);
      }
    }
    if (unlicensedActivationRemainsIncomplete(report)) {
      reasons.push('UNLICENSED_ACTIVATION_UNAVAILABLE');
    }
    return Object.freeze({
      gates: complete,
      engineeringComplete: true,
      productionActivated: false,
      liveFlagsRemainDisabled: true,
      reasonCodes: Object.freeze(reasons.length > 0 ? reasons : ['ENGINEERING_INSUFFICIENT_WITHOUT_EXTERNAL_AUTH']),
    });
  }

  developerSandbox(apiKeyId: string): DeveloperSandboxContext {
    return Object.freeze({
      apiKeyId,
      environment: 'SANDBOX',
      canTradeProductionFunds: false,
      requiresTradingAuthorityForProduction: true,
    });
  }

  snapshot(stream: 'TRADES' | 'BBO' | 'DEPTH' | 'MARKET_STATE' | 'AUCTION_STATE' | 'STATISTICS' = 'DEPTH') {
    return this.marketData.publishSnapshot({
      marketId: this.nativeMarketId(),
      stream,
      state: this.marketState().state,
      auctionState: this.auction.phase === 'IDLE' ? null : this.auction,
      orders: [...this.orders.values()],
      lastTrade: this.trades[this.trades.length - 1] ?? null,
      volume: this.trades.reduce((sum, trade) => sum + trade.quantity.scaledUnits, 0n),
      tradeCount: BigInt(this.trades.length),
      at: this.createdAt,
    });
  }

  private admitAndMatch(
    credential: TradingCredential,
    request: InstitutionalOrderRequest,
    now: UtcInstant,
  ): { readonly ok: boolean; readonly reason: string; readonly order: DigitalOrder | null } {
    const market = this.marketState(request.marketId);
    if (market.state === 'CLOSED' || market.state === 'PAUSED' || market.state === 'HALTED' || market.state === 'RESTRICTED') {
      return { ok: false, reason: 'MARKET_HALTED', order: null };
    }
    if (isCancelOnlyState(market.state)) {
      return { ok: false, reason: 'MARKET_HALTED', order: null };
    }
    if (market.state === 'PREOPEN' && request.orderType !== 'LIMIT' && request.orderType !== 'POST_ONLY') {
      return { ok: false, reason: 'PREOPEN_LIMIT_ONLY', order: null };
    }
    if (market.state === 'AUCTION' && !orderEligibleForAuction(request.orderType)) {
      return { ok: false, reason: 'AUCTION_ORDER_INELIGIBLE', order: null };
    }
    if (!admitsNewOrders(market.state) && market.state !== 'PREOPEN') {
      return { ok: false, reason: 'MARKET_HALTED', order: null };
    }
    if (!familyFullyOperational(market.family)) {
      return { ok: false, reason: 'FAMILY_RESTRICTED_UNTIL_READY', order: null };
    }
    const participant = this.participants.get(credential.participantId);
    if (!participant?.eligible) {
      return { ok: false, reason: 'WRONG_PARTICIPANT', order: null };
    }
    const reserved = this.reservations.get(credential.accountId) ?? 0n;
    const rate = defaultOrderRatePolicy(credential.participantId, credential.accountId, request.marketId);
    const window = this.touchRate(credential.accountId, 'ORDER', now);
    const rateCheck = evaluateOrderRate(rate, window, 'ORDER');
    if (!rateCheck.allowed) {
      return { ok: false, reason: rateCheck.code, order: null };
    }
    const resting = [...this.orders.values()];
    const reference = resolveReferencePrice({
      lastEligibleTrade: this.trades[this.trades.length - 1] ?? null,
      resting,
      approvedOraclePriceUnits: this.oraclePrice,
      oracleApproved: this.oracleApproved,
    });
    const notional = request.quantity * (request.priceUnits ?? reference.priceUnits ?? 0n);
    const risk = evaluatePreTradeRisk({
      family: market.family,
      credential,
      access: {
        identityClass: 'INSTITUTIONAL',
        jurisdiction: 'GB',
        marketFamily: market.family,
        complianceState: 'CLEAR',
        professionalStatus: true,
        institutionalStatus: true,
        consentReady: true,
        rightsReady: true,
        listingAllowed: true,
        riskRestricted: false,
      },
      accountRestricted: this.accountRestrictions.has(credential.accountId),
      reservationAvailable: reserved >= request.quantity,
      quantity: request.quantity,
      notional,
      rate,
      window,
      priceUnits: request.orderType === 'MARKET_WITH_PROTECTION' ? null : request.priceUnits,
      referenceUnits: reference.priceUnits,
      collarBps: this.policy.priceCollarBps,
      killSwitches: this.killSwitches,
      marketId: request.marketId,
      settlementHealthy: this.settlementHealth === 'HEALTHY' && this.settlementQueue <= this.policy.settlementQueueLimit,
      custodyHealthy: this.custody.health().status === 'HEALTHY',
      referenceAvailable: request.orderType !== 'MARKET_WITH_PROTECTION' || reference.priceUnits !== null,
    });
    if (!risk.allowed) {
      return { ok: false, reason: risk.reasonCodes[0] ?? 'RISK_REJECT', order: null };
    }
    const template = exchangePrice({
      baseAssetId: 'SUNREY_COIN',
      quoteAssetId: 'MOONREY_COIN',
      quoteKind: 'ASSET',
      priceUnits: request.priceUnits ?? reference.priceUnits ?? 1n,
      quoteScale: 0,
      basePrecision: 0,
    });
    let limitPrice = request.priceUnits
      ? exchangePrice({
          baseAssetId: template.baseAssetId,
          quoteAssetId: template.quoteAssetId,
          quoteKind: 'ASSET',
          priceUnits: request.priceUnits,
          quoteScale: 0,
          basePrecision: 0,
        })
      : null;
    if (request.orderType === 'MARKET_WITH_PROTECTION') {
      if (reference.priceUnits === null) {
        return { ok: false, reason: 'REFERENCE_PRICE_UNAVAILABLE', order: null };
      }
      limitPrice = protectionLimit(request.side, reference.priceUnits, this.policy.protectionCollarBps, template);
    }
    const quantity = AssetQuantity.fromScaledUnits(request.quantity, 'SUNREY_COIN');
    const orderId = asOrderId(`xord_${randomUUID().replace(/-/g, '')}`);
    const order: DigitalOrder = Object.freeze({
      orderId,
      version: 1 as DigitalOrder['version'],
      exchangeAccountId: credential.accountId,
      beneficialParticipantId: credential.participantId,
      marketId: request.marketId,
      family: 'DIGITAL_ASSET',
      side: request.side,
      orderType: request.orderType === 'IOC' || request.orderType === 'FOK' || request.orderType === 'POST_ONLY' || request.orderType === 'MARKET_WITH_PROTECTION'
        ? request.orderType
        : 'LIMIT',
      quantity,
      remaining: quantity,
      limitPrice,
      createdAt: now,
      timeInForce:
        request.orderType === 'IOC' || request.orderType === 'FOK' || request.orderType === 'POST_ONLY'
          ? request.orderType
          : 'GTC',
      status: 'OPEN',
      clientIdempotencyKey: request.clOrdId,
      authorizationRef: credential.credentialId,
      holdId: null,
      coinHoldId: null,
      sourceAccountId: credential.accountId,
      sequence: this.orders.size + 1,
    });
    if (market.state === 'AUCTION' || market.state === 'PREOPEN') {
      this.orders.set(order.orderId, order);
      this.ordersByClOrd.set(`${credential.sessionId}:${request.clOrdId}`, order.orderId);
      this.reservations.set(credential.accountId, reserved - request.quantity);
      this.recordReplay('ORDER', now, { clOrdId: request.clOrdId, orderId: order.orderId });
      return { ok: true, reason: 'ACCEPTED', order };
    }
    const match = matchIncoming(order, resting, { selfTrade: this.policy.selfTradePolicy });
    if (match.rejectIncoming) {
      return { ok: false, reason: match.reason ?? 'REJECTED', order: { ...order, status: 'REJECTED' } };
    }
    if (request.orderType === 'MARKET_WITH_PROTECTION' && match.matches.length === 0) {
      return { ok: false, reason: 'PROTECTION_NO_FILL', order: { ...order, status: 'REJECTED' } };
    }
    let taker = order;
    this.orders.set(order.orderId, taker);
    this.ordersByClOrd.set(`${credential.sessionId}:${request.clOrdId}`, order.orderId);
    this.reservations.set(credential.accountId, reserved - request.quantity);
    for (const row of match.matches) {
      this.tradeSeq += 1;
      const quoteUnits = quoteForQuantity(row.price, row.quantity);
      const trade: ImmutableTrade = Object.freeze({
        tradeId: newTradeId(),
        executionId: newExecutionId(),
        marketId: row.taker.marketId,
        makerOrderId: row.maker.orderId,
        takerOrderId: row.taker.orderId,
        quantity: row.quantity,
        price: row.price,
        quoteAmount: Money.fromMinorUnits(quoteUnits, 'USD'),
        makerFee: Money.fromMinorUnits(0n, 'USD'),
        takerFee: Money.fromMinorUnits(0n, 'USD'),
        feeScheduleId: SIM_FEES.scheduleId,
        matchedAt: now,
        sequence: this.tradeSeq as MarketDataSequence,
      });
      this.trades.push(trade);
      const makerFilled = applyFill(this.orders.get(row.maker.orderId) ?? row.maker, row.quantity);
      taker = applyFill(this.orders.get(taker.orderId) ?? taker, row.quantity);
      this.orders.set(makerFilled.orderId, makerFilled);
      this.orders.set(taker.orderId, taker);
      this.forwardNative(row.maker, taker, row.quantity.scaledUnits, row.price.priceUnits, now);
      this.marketData.publishIncrement({
        marketId: request.marketId,
        stream: 'TRADES',
        kind: 'TRADE',
        payload: { tradeId: trade.tradeId, price: trade.price.priceUnits.toString(), quantity: trade.quantity.scaledUnits.toString() },
        at: now,
      });
    }
    if ((request.orderType === 'IOC' || request.orderType === 'MARKET_WITH_PROTECTION') && taker.remaining.scaledUnits > 0n) {
      this.orders.set(taker.orderId, { ...taker, status: 'CANCELLED' });
    }
    this.recordReplay('ORDER', now, { clOrdId: request.clOrdId, orderId: order.orderId });
    this.publishBook(now);
    this.maybeTripVolatility(now);
    return { ok: true, reason: 'ACCEPTED', order: this.orders.get(order.orderId) ?? taker };
  }

  private forwardNative(
    maker: DigitalOrder,
    taker: DigitalOrder,
    quantity: bigint,
    priceUnits: bigint,
    now: UtcInstant,
  ): void {
    try {
      const buyer = taker.side === 'BUY' ? taker : maker;
      const seller = taker.side === 'SELL' ? taker : maker;
      if (!this.clearing.accounts.has(buyer.exchangeAccountId) || !this.clearing.accounts.has(seller.exchangeAccountId)) {
        return;
      }
      this.clearing.faucetToCustody(seller.exchangeAccountId, 'SUNREY_COIN', quantity);
      this.clearing.faucetToCustody(buyer.exchangeAccountId, 'MOONREY_COIN', quantity * priceUnits / 1_000_000n + 1n);
      this.clearing.placeOrder({
        accountId: seller.exchangeAccountId,
        side: 'SELL',
        quantity,
        priceUnits,
        now,
      });
      this.clearing.placeOrder({
        accountId: buyer.exchangeAccountId,
        side: 'BUY',
        quantity,
        priceUnits,
        now,
      });
      for (const settlement of this.clearing.settlements.values()) {
        if (settlement.status === 'SETTLEMENT_CREATED') {
          this.clearing.submitSettlement(settlement.settlementId);
        }
      }
    } catch {
      this.settlementQueue += 1n;
    }
  }

  private cancel(orderId: OrderId, now: UtcInstant, accountId: ExchangeAccountId): DigitalOrder | null {
    const order = this.orders.get(orderId);
    if (!order || order.exchangeAccountId !== accountId) {
      return null;
    }
    if (order.status !== 'OPEN' && order.status !== 'PARTIALLY_FILLED') {
      return order;
    }
    const cancelled: DigitalOrder = Object.freeze({
      ...order,
      status: 'CANCELLED',
      version: (order.version + 1) as DigitalOrder['version'],
    });
    this.orders.set(orderId, cancelled);
    this.recordReplay('CANCEL', now, { orderId });
    this.publishBook(now);
    return cancelled;
  }

  private touchRate(accountId: string, kind: 'ORDER' | 'CANCEL', now: UtcInstant): RateWindow {
    const current = this.rateWindows.get(accountId) ?? emptyRateWindow();
    const next = recordRateEvent(
      {
        ...current,
        openOrders: BigInt(
          [...this.orders.values()].filter(
            (order) => order.exchangeAccountId === accountId && (order.status === 'OPEN' || order.status === 'PARTIALLY_FILLED'),
          ).length,
        ),
      },
      kind,
      nowMs(now),
    );
    this.rateWindows.set(accountId, next);
    return next;
  }

  private maybeTripVolatility(now: UtcInstant): void {
    const vol = this.evaluateVolatility();
    if (vol.triggered && this.marketState().state === 'OPEN') {
      this.applyCircuitBreaker({ actorKind: 'POLICY', now });
    }
  }

  private publishBook(now: UtcInstant): void {
    const book = sortBook([...this.orders.values()]);
    this.marketData.publishIncrement({
      marketId: this.nativeMarketId(),
      stream: 'BBO',
      kind: 'BBO',
      payload: {
        bid: book.bids[0]?.limitPrice?.priceUnits.toString() ?? null,
        ask: book.asks[0]?.limitPrice?.priceUnits.toString() ?? null,
      },
      at: now,
    });
  }

  private publishAll(now: UtcInstant): void {
    for (const stream of ['TRADES', 'BBO', 'DEPTH', 'MARKET_STATE', 'AUCTION_STATE', 'STATISTICS'] as const) {
      this.marketData.publishSnapshot({
        marketId: this.nativeMarketId(),
        stream,
        state: this.marketState().state,
        auctionState: this.auction.phase === 'IDLE' ? null : this.auction,
        orders: [...this.orders.values()],
        lastTrade: this.trades[this.trades.length - 1] ?? null,
        volume: 0n,
        tradeCount: 0n,
        at: now,
      });
    }
  }

  private recordReplay(kind: MarketReplayEvent['kind'], at: UtcInstant, payload: Record<string, string>): void {
    this.replaySeq += 1n;
    this.replay.push(
      Object.freeze({
        seq: this.replaySeq,
        kind,
        at,
        payload: Object.freeze({ ...payload, policyVersion: String(this.policy.policyVersion) }),
      }),
    );
  }

  private ack(
    sessionId: string,
    request: InstitutionalOrderRequest,
    inboundSeq: bigint,
    outcome: InstitutionalOrderAck['outcome'],
    reason: string,
    order: DigitalOrder | null,
  ): InstitutionalOrderAck {
    const ack: InstitutionalOrderAck = Object.freeze({
      outcome,
      clOrdId: request.clOrdId,
      orderId: order?.orderId ?? null,
      status: order?.status ?? 'UNKNOWN',
      inboundSeq,
      reason,
      order,
    });
    if (outcome !== 'REJECT' || reason === 'UNKNOWN_ORDER') {
      this.gateway.remember(sessionId, request.clOrdId, ack);
    }
    if (outcome !== 'REJECT') {
      this.gateway.remember(sessionId, request.clOrdId, ack);
    } else if (order) {
      this.gateway.remember(sessionId, request.clOrdId, ack);
    }
    return ack;
  }
}
