import { addMs, type Clock } from '../../config/src/clock.ts';
import { ENVIRONMENT, LIVE_TRADING_ENABLED } from '../../config/src/flags.ts';
import type { Account } from '../../domain/src/account.ts';
import type { Customer } from '../../domain/src/customer.ts';
import { isOk } from '../../domain/src/result.ts';
import type { EvidenceVault } from '../../evidence/src/vault.ts';
import type { DomainEventLog } from '../../events/src/events.ts';
import { actionTypesFromCapabilities, type IdentityAuthorityPort } from '../../identity/src/index.ts';
import type { ComplianceKernel } from '../../kernel/src/kernel.ts';
import type { KernelFacts } from '../../kernel/src/proofs.ts';
import { GrowthAttributionLedger } from '../../ledger/src/growth.ts';
import type { Ledger } from '../../ledger/src/journal.ts';
import { Money } from '../../money/src/money.ts';
import type { ActionIntent } from '../../permissions/src/action-intent.ts';
import type {
  CancelPaperOrderIntent,
  CreatePaperOrderIntent,
  FundBrokerageCashIntent,
  OpenInvestmentAccountIntent,
  ProcessCorporateActionIntent,
  SettleInvestmentIntent,
  WithdrawBrokerageCashIntent,
} from '../../permissions/src/action-types.ts';
import type { AuthorizationDecision } from '../../permissions/src/decision.ts';
import type { AuthorityIssuer, ExecutionAuthority } from '../../permissions/src/execution-authority.ts';
import { validateIntentStructure, type StructuralCatalog } from '../../permissions/src/structural.ts';
import { deriveAllocation } from './allocation.ts';
import { PaperBrokerProvider, type BrokerExecutionProvider } from './broker-port.ts';
import { freezeCorporateAction } from './corporate-action.ts';
import { evaluateInvestmentEligibility } from './eligibility.ts';
import { freezePaperFill } from './fill.ts';
import {
  asCorporateActionId,
  asInvestmentAccountId,
  asLotId,
  asPaperOrderId,
  asReconciliationId,
  asSettlementId,
  asValuationId,
  type InvestmentAccountId,
  type InstrumentId,
} from './ids.ts';
import type { Instrument } from './instrument.ts';
import {
  brokerageToFundingBridge,
  brokerageToPendingBridge,
  demandToBrokerageBridge,
  investmentClearingId,
  investmentFeeCollectorId,
  postInvestmentJournal,
  savingsToBrokerageBridge,
} from './journals.ts';
import { consumeLotsFifo, openLot, splitAdjustLots, type PositionLot } from './lot.ts';
import { SimulatedMarketDataProvider, type MarketDataProvider } from './market-data.ts';
import { freezePaperOrder, transitionPaperOrder } from './order.ts';
import { realizedFromSale, unrealizedFromValuation } from './pnl.ts';
import {
  realizedFactsFromPnL,
  simulationPeveConsumer,
  simulationRdtPort,
  type InvestmentPegPublisher,
  type InvestmentRegulatoryPort,
  type PeveInvestmentConsumer,
  type PeveInvestmentView,
} from './ports.ts';
import { positionFromLots, type PortfolioPosition } from './position.ts';
import { notionalMoney } from './price.ts';
import { freezeInvestmentAccountProfile, type InvestmentAccountProfile } from './profile.ts';
import {
  quantityFromScaledString,
  subtractQuantity,
  wholeShares,
  zeroQuantity,
} from './quantity.ts';
import { freezeReconciliation, type InvestmentReconciliation } from './reconciliation.ts';
import { ModelRegistry, seedCanonicalRiskModel } from '../../model-registry/src/registry.ts';
import { defaultSimulationBudget, RiskEngine } from '../../risk/src/engine.ts';
import { asPortfolioRiskSnapshotId } from '../../risk/src/ids.ts';
import type { ProposedPaperTrade, RiskDecision } from '../../risk/src/types.ts';
import { paperOnlyRiskControl, type InvestmentRiskControlPort } from './risk-port.ts';
import { seedSimulationInstruments } from './seed.ts';
import { freezeSettlement } from './settlement.ts';
import { InvestmentStore } from './store.ts';
import {
  assertPaperOnly,
  LIVE_INVESTMENT_EXECUTION,
  type ReconciliationResult,
} from './types.ts';
import { freezeValuationSnapshot, type PortfolioValuationSnapshot, type ValuedPosition } from './valuation.ts';

export type InvestmentCatalogPorts = {
  readonly customers: { get(id: Customer['id']): Customer | undefined };
  readonly accounts: {
    get(id: Account['id']): Account | undefined;
    list(): readonly Account[];
  };
  readonly products: StructuralCatalog['products'];
  readonly legalEntities: StructuralCatalog['legalEntities'];
};

export type InvestmentsServiceOutcome<T> =
  | { readonly outcome: 'OK'; readonly value: T; readonly decision: AuthorizationDecision; readonly replay?: boolean }
  | { readonly outcome: 'KERNEL_REFUSED'; readonly decision: AuthorizationDecision }
  | {
      readonly outcome: 'REJECTED';
      readonly code: string;
      readonly message: string;
      readonly decision: AuthorizationDecision | null;
    };

export class InvestmentsService {
  private readonly kernel: ComplianceKernel;
  private readonly issuer: AuthorityIssuer;
  private readonly evidence: EvidenceVault;
  private readonly events: DomainEventLog;
  private readonly clock: Clock;
  private readonly catalog: InvestmentCatalogPorts;
  private readonly identity: IdentityAuthorityPort;
  private readonly ledger: Ledger;
  private readonly growth: GrowthAttributionLedger;
  readonly store: InvestmentStore;
  readonly market: MarketDataProvider;
  readonly broker: BrokerExecutionProvider;
  readonly risk: InvestmentRiskControlPort;
  riskEngine: RiskEngine | undefined;
  lastRiskDecision: RiskDecision | null = null;
  readonly rdt: InvestmentRegulatoryPort;
  readonly peve: PeveInvestmentConsumer;
  private readonly peg: InvestmentPegPublisher | undefined;
  private readonly simulatedMarket: SimulatedMarketDataProvider | undefined;

  constructor(
    kernel: ComplianceKernel,
    issuer: AuthorityIssuer,
    evidence: EvidenceVault,
    events: DomainEventLog,
    clock: Clock,
    catalog: InvestmentCatalogPorts,
    identity: IdentityAuthorityPort,
    ledger: Ledger,
    options: {
      readonly store?: InvestmentStore;
      readonly market?: MarketDataProvider;
      readonly broker?: BrokerExecutionProvider;
      readonly risk?: InvestmentRiskControlPort;
      readonly riskEngine?: RiskEngine;
      readonly rdt?: InvestmentRegulatoryPort;
      readonly peve?: PeveInvestmentConsumer;
      readonly peg?: InvestmentPegPublisher;
      readonly growth?: GrowthAttributionLedger;
      readonly seedInstruments?: boolean;
    } = {},
  ) {
    assertPaperOnly();
    this.kernel = kernel;
    this.issuer = issuer;
    this.evidence = evidence;
    this.events = events;
    this.clock = clock;
    this.catalog = catalog;
    this.identity = identity;
    this.ledger = ledger;
    this.growth = options.growth ?? new GrowthAttributionLedger();
    this.store = options.store ?? new InvestmentStore();
    if (options.seedInstruments !== false) {
      for (const instrument of seedSimulationInstruments()) {
        this.store.putInstrument(instrument);
      }
    }
    const seeded = this.store.listInstruments()[0];
    this.simulatedMarket =
      options.market instanceof SimulatedMarketDataProvider
        ? options.market
        : new SimulatedMarketDataProvider(
            seeded
              ? [
                  {
                    instrumentId: seeded.instrumentId,
                    minorUnits: 10_000n,
                    currency: seeded.currency,
                    marketId: seeded.marketId,
                  },
                ]
              : [],
          );
    this.market = options.market ?? this.simulatedMarket;
    this.broker = options.broker ?? new PaperBrokerProvider();
    this.risk = options.risk ?? paperOnlyRiskControl;
    this.riskEngine = options.riskEngine;
    this.rdt = options.rdt ?? simulationRdtPort;
    this.peve = options.peve ?? simulationPeveConsumer;
    this.peg = options.peg;
  }

  setSimulatedPrice(instrumentId: InstrumentId, minorUnits: bigint, currency: string): void {
    if (!this.simulatedMarket) {
      throw new Error('simulated market is not available');
    }
    const result = this.simulatedMarket.setPrice(instrumentId, minorUnits, currency);
    if (!result.ok) {
      throw new Error(result.error.message);
    }
  }

  openInvestmentAccount(
    intent: OpenInvestmentAccountIntent,
  ): InvestmentsServiceOutcome<InvestmentAccountProfile> {
    const existing = this.store.getProfile(asInvestmentAccountId(intent.payload.investmentAccountId));
    if (existing && intent.idempotencyKey) {
      const replayed = existing;
      if (replayed) {
        return { outcome: 'OK', value: replayed, decision: this.emptyDecision(intent.actionType, intent.id), replay: true };
      }
    }
    const gated = this.gate(intent);
    if (gated.outcome !== 'ALLOWED') {
      return gated.result;
    }
    const eligibility = this.eligibilityFor(intent);
    if (eligibility.status !== 'ELIGIBLE_SIMULATION') {
      return this.reject(gated.decision, 'INELIGIBLE', eligibility.reasons.join('; '));
    }
    const brokerage = this.catalog.accounts.get(intent.payload.brokerageCashAccountId);
    const securities = this.catalog.accounts.get(intent.payload.securitiesAccountId);
    const pending = this.catalog.accounts.get(intent.payload.pendingSettlementAccountId);
    if (!brokerage || brokerage.accountClass !== 'BROKERAGE_CASH') {
      return this.reject(gated.decision, 'INVALID_ACCOUNT', 'brokerage cash must be a canonical BROKERAGE_CASH account');
    }
    if (!securities || securities.accountClass !== 'SECURITIES') {
      return this.reject(gated.decision, 'INVALID_ACCOUNT', 'securities must be a canonical SECURITIES account');
    }
    if (!pending || pending.accountClass !== 'PENDING_SETTLEMENT') {
      return this.reject(gated.decision, 'INVALID_ACCOUNT', 'pending settlement must be a canonical PENDING_SETTLEMENT account');
    }
    if (brokerage.status === 'FROZEN' || securities.status === 'FROZEN') {
      return this.reject(gated.decision, 'FROZEN_ACCOUNT', 'frozen accounts cannot open an investment profile');
    }
    const profile = freezeInvestmentAccountProfile({
      investmentAccountId: asInvestmentAccountId(intent.payload.investmentAccountId),
      customerId: intent.payload.customerId,
      brokerageCashAccountId: intent.payload.brokerageCashAccountId,
      securitiesAccountId: intent.payload.securitiesAccountId,
      pendingSettlementAccountId: intent.payload.pendingSettlementAccountId,
      productId: intent.payload.productId,
      legalEntityId: intent.payload.legalEntityId,
      baseCurrency: intent.payload.currency,
      status: 'ACTIVE',
      createdAt: this.clock.now(),
      environment: 'simulation',
      liveState: false,
    });
    this.store.putProfile(profile);
    this.peg?.publishOwnership(profile);
    this.emit('InvestmentAccountOpened', profile.investmentAccountId, {
      investmentAccountId: profile.investmentAccountId,
      customerId: profile.customerId,
      brokerageCashAccountId: profile.brokerageCashAccountId,
      securitiesAccountId: profile.securitiesAccountId,
    });
    this.evidence.seal('INVESTMENT_ACCOUNT_OPENED', {
      intentId: intent.id,
      authorityId: gated.authority.authorityId,
      investmentAccountId: profile.investmentAccountId,
      decisionId: gated.decision.evidenceRecordId,
    });
    return { outcome: 'OK', value: profile, decision: gated.decision };
  }

  fundBrokerageCash(intent: FundBrokerageCashIntent): InvestmentsServiceOutcome<{ readonly journalId: string }> {
    const replay = this.store.fundingJournalId(intent.idempotencyKey);
    if (replay) {
      return {
        outcome: 'OK',
        value: { journalId: replay },
        decision: this.emptyDecision(intent.actionType, intent.id),
        replay: true,
      };
    }
    const gated = this.gate(intent);
    if (gated.outcome !== 'ALLOWED') {
      return gated.result;
    }
    const dest = this.catalog.accounts.get(intent.payload.accountId);
    const source = this.catalog.accounts.get(intent.payload.sourceAccountId);
    if (!dest || dest.accountClass !== 'BROKERAGE_CASH') {
      return this.reject(gated.decision, 'INVALID_ACCOUNT', 'destination must be BROKERAGE_CASH');
    }
    if (!source || (source.accountClass !== 'DEMAND_DEPOSIT' && source.accountClass !== 'SAVINGS_DEPOSIT')) {
      return this.reject(gated.decision, 'INVALID_ACCOUNT', 'source must be a deposit account');
    }
    if (dest.status === 'FROZEN' || source.status === 'FROZEN') {
      return this.reject(gated.decision, 'FROZEN_ACCOUNT', 'frozen accounts cannot fund brokerage cash');
    }
    if (source.currency !== dest.currency || source.currency !== intent.payload.amount.currency) {
      return this.reject(gated.decision, 'CURRENCY_MISMATCH', 'funding currency must match both accounts');
    }
    const available = this.cashBalance(source.id, source.currency);
    if (available.cmp(intent.payload.amount) < 0) {
      return this.reject(gated.decision, 'INSUFFICIENT_FUNDS', 'insufficient deposit cash for funding');
    }
    const bridge = source.accountClass === 'SAVINGS_DEPOSIT' ? savingsToBrokerageBridge() : demandToBrokerageBridge();
    const journal = postInvestmentJournal(this.ledger, {
      idempotencyKey: intent.idempotencyKey,
      executionAuthority: gated.authority,
      actionType: intent.actionType,
      memo: 'FUND_BROKERAGE_CASH',
      debitAccountId: source.id,
      creditAccountId: dest.id,
      amount: intent.payload.amount,
      classBridge: bridge,
    });
    this.growth.skipPrincipalMovement('PRINCIPAL_TRANSFER_IS_NOT_ECONOMIC_IMPROVEMENT');
    this.store.rememberFunding(intent.idempotencyKey, journal.id);
    this.emit('InvestmentCashFunded', dest.id, {
      journalId: journal.id,
      amountMinorUnits: intent.payload.amount.minorUnits.toString(),
      currency: intent.payload.amount.currency,
    });
    this.evidence.seal('INVESTMENT_CASH_FUNDED', {
      intentId: intent.id,
      authorityId: gated.authority.authorityId,
      journalId: journal.id,
    });
    return { outcome: 'OK', value: { journalId: journal.id }, decision: gated.decision };
  }

  withdrawBrokerageCash(intent: WithdrawBrokerageCashIntent): InvestmentsServiceOutcome<{ readonly journalId: string }> {
    const replay = this.store.fundingJournalId(intent.idempotencyKey);
    if (replay) {
      return {
        outcome: 'OK',
        value: { journalId: replay },
        decision: this.emptyDecision(intent.actionType, intent.id),
        replay: true,
      };
    }
    const gated = this.gate(intent);
    if (gated.outcome !== 'ALLOWED') {
      return gated.result;
    }
    const source = this.catalog.accounts.get(intent.payload.accountId);
    const dest = this.catalog.accounts.get(intent.payload.destinationAccountId);
    if (!source || source.accountClass !== 'BROKERAGE_CASH') {
      return this.reject(gated.decision, 'INVALID_ACCOUNT', 'source must be BROKERAGE_CASH');
    }
    if (!dest || (dest.accountClass !== 'DEMAND_DEPOSIT' && dest.accountClass !== 'SAVINGS_DEPOSIT')) {
      return this.reject(gated.decision, 'INVALID_ACCOUNT', 'destination must be a deposit account');
    }
    const available = this.availableBrokerageCash(source.id, source.currency);
    if (available.cmp(intent.payload.amount) < 0) {
      return this.reject(gated.decision, 'INSUFFICIENT_BROKERAGE_CASH', 'insufficient settled brokerage cash');
    }
    const bridge = dest.accountClass === 'SAVINGS_DEPOSIT' ? savingsToBrokerageBridge() : demandToBrokerageBridge();
    const journal = postInvestmentJournal(this.ledger, {
      idempotencyKey: intent.idempotencyKey,
      executionAuthority: gated.authority,
      actionType: intent.actionType,
      memo: 'WITHDRAW_BROKERAGE_CASH',
      debitAccountId: source.id,
      creditAccountId: dest.id,
      amount: intent.payload.amount,
      classBridge: bridge,
    });
    this.growth.skipPrincipalMovement('PRINCIPAL_TRANSFER_IS_NOT_ECONOMIC_IMPROVEMENT');
    this.store.rememberFunding(intent.idempotencyKey, journal.id);
    this.emit('InvestmentCashWithdrawn', source.id, { journalId: journal.id });
    return { outcome: 'OK', value: { journalId: journal.id }, decision: gated.decision };
  }

  createPaperOrder(intent: CreatePaperOrderIntent): InvestmentsServiceOutcome<{
    readonly orderId: string;
    readonly fillId: string | null;
    readonly replay?: boolean;
  }> {
    const replayed = this.store.getOrderByIdempotency(intent.idempotencyKey);
    if (replayed) {
      const fill = [...this.store.listFills()].find((row) => row.orderId === replayed.orderId);
      return {
        outcome: 'OK',
        value: { orderId: replayed.orderId, fillId: fill?.fillId ?? null, replay: true },
        decision: this.emptyDecision(intent.actionType, intent.id),
        replay: true,
      };
    }
    if (LIVE_INVESTMENT_EXECUTION !== false || LIVE_TRADING_ENABLED !== false || ENVIRONMENT !== 'simulation') {
      return this.reject(null, 'LIVE_FORBIDDEN', 'live investment execution is forbidden');
    }
    const profile = this.store.getProfile(asInvestmentAccountId(intent.payload.investmentAccountId));
    if (!profile || profile.status !== 'ACTIVE') {
      return this.reject(null, 'PROFILE_INACTIVE', 'investment account is not ACTIVE');
    }
    const instrument = this.store.getInstrument(intent.payload.instrumentId);
    if (!instrument) {
      return this.reject(null, 'UNKNOWN_INSTRUMENT', 'instrument is not in the simulation registry');
    }
    const quantity = quantityFromScaledString(intent.payload.quantityUnits);
    if (!quantity.ok) {
      return this.reject(null, quantity.error.code, quantity.error.message);
    }
    if (quantity.value.units <= 0n) {
      return this.reject(null, 'INVALID_QUANTITY', 'quantity must be greater than zero');
    }
    if (!instrument.fractionalSupported) {
      const whole = wholeShares(quantity.value.units / 100_000_000n);
      if (!whole.ok || whole.value.units !== quantity.value.units) {
        return this.reject(null, 'INVALID_QUANTITY', 'fractional shares are not permitted for this instrument');
      }
    }
    if (intent.payload.side !== 'BUY' && intent.payload.side !== 'SELL') {
      return this.reject(null, 'SHORT_FORBIDDEN', 'only BUY and SELL are permitted');
    }
    const quote = this.market.getQuote(instrument.instrumentId, this.clock.now());
    if (!quote.ok) {
      return this.reject(null, quote.error.code, quote.error.message);
    }
    if (this.market instanceof SimulatedMarketDataProvider && this.market.isStale(quote.value, this.clock.now())) {
      return this.reject(null, 'STALE_QUOTE', 'market quote is stale');
    }
    if (this.market.getMarketStatus(instrument.marketId, this.clock.now()) !== 'OPEN') {
      return this.reject(null, 'MARKET_CLOSED', 'simulated market is not open');
    }
    let limitPrice = null;
    if (intent.payload.orderType === 'LIMIT_SIMULATION') {
      if (!intent.payload.limitPriceMinorUnits) {
        return this.reject(null, 'INVALID_PRICE', 'limit orders require a limit price');
      }
      const limit = {
        minorUnits: BigInt(intent.payload.limitPriceMinorUnits),
        currency: quote.value.price.currency,
      };
      if (intent.payload.side === 'BUY' && quote.value.price.minorUnits > limit.minorUnits) {
        return this.reject(null, 'LIMIT_NOT_MARKETABLE', 'buy limit is below the simulated last price');
      }
      if (intent.payload.side === 'SELL' && quote.value.price.minorUnits < limit.minorUnits) {
        return this.reject(null, 'LIMIT_NOT_MARKETABLE', 'sell limit is above the simulated last price');
      }
      limitPrice = limit;
    }
    const fee = Money.fromMinorUnits(BigInt(intent.payload.feeMinorUnits ?? '0'), instrument.currency);
    const notional = notionalMoney(quantity.value, quote.value.price);
    if (!notional.ok) {
      return this.reject(null, notional.error.code, notional.error.message);
    }
    if (intent.payload.side === 'BUY') {
      const cash = this.availableBrokerageCash(profile.brokerageCashAccountId, profile.baseCurrency);
      const needed = notional.value.plus(fee);
      if (cash.cmp(needed) < 0) {
        return this.reject(null, 'INSUFFICIENT_BROKERAGE_CASH', 'insufficient brokerage cash for buy plus fee');
      }
    } else {
      const position = this.store.getPosition(profile.investmentAccountId, instrument.instrumentId);
      const available = position?.availableQuantity ?? zeroQuantity();
      if (available.units < quantity.value.units) {
        return this.reject(null, 'SELL_EXCEEDS_POSITION', 'sell quantity exceeds owned settled position');
      }
    }
    const actor = this.identity.resolveActorContext(intent.actorId);
    if (!actor.ok) {
      const gatedUnauthorized = this.gate(intent, { amount: notional.value });
      if (gatedUnauthorized.outcome !== 'ALLOWED') {
        return gatedUnauthorized.result;
      }
      return this.reject(gatedUnauthorized.decision, 'RISK_ENGINE_UNAVAILABLE', 'pre-trade risk engine could not be initialized');
    }
    const engine = this.ensureRiskEngine(intent.actorId);
    if (!engine) {
      return this.reject(null, 'RISK_ENGINE_UNAVAILABLE', 'pre-trade risk engine could not be initialized');
    }
    const proposed = this.proposedTrade(
      intent.payload.orderId,
      instrument,
      quantity.value.units,
      intent.payload.side,
      notional.value.minorUnits,
      fee.minorUnits,
      quote.value.price.minorUnits,
    );
    const risk = this.risk.evaluatePaperOrder({
      order: {
        side: intent.payload.side,
        orderType: intent.payload.orderType,
        simulation: true,
      },
      proposed,
      assess: () =>
        engine.assessPreTrade({
          snapshot: this.portfolioRiskSnapshot(profile.investmentAccountId),
          proposed,
          budget:
            engine.store.listBudgets().find((row) => row.portfolioId === profile.investmentAccountId) ??
            defaultSimulationBudget({
              subjectId: profile.customerId,
              portfolioId: profile.investmentAccountId,
              reviewBy: this.clock.now(),
            }),
        }),
    });
    this.lastRiskDecision = risk.assessment ?? null;
    if (!risk.permitted) {
      this.evidence.seal('RISK_PRETRADE_BLOCK', {
        intentId: intent.id,
        orderId: intent.payload.orderId,
        status: risk.status,
        reason: risk.reason,
        assessmentId: risk.assessment?.assessmentId ?? null,
        triggered: risk.assessment?.triggeredLimits ?? [],
        posted: false,
      });
      return this.reject(null, risk.status, risk.reason);
    }
    const gated = this.gate(intent, {
      amount: notional.value,
      ...(risk.kernelFacts ? { investmentRisk: risk.kernelFacts } : {}),
    });
    if (gated.outcome !== 'ALLOWED') {
      return gated.result;
    }
    const draft = freezePaperOrder({
      orderId: asPaperOrderId(intent.payload.orderId),
      investmentAccountId: profile.investmentAccountId,
      instrumentId: instrument.instrumentId,
      side: intent.payload.side,
      quantity: quantity.value,
      filledQuantity: zeroQuantity(),
      orderType: intent.payload.orderType,
      limitPrice,
      createdAt: this.clock.now(),
      expiresAt: null,
      status: 'PENDING_AUTHORIZATION',
      source: 'CUSTOMER',
      idempotencyKey: intent.idempotencyKey,
      intentId: intent.id,
      simulation: true,
    });
    const accepted = transitionPaperOrder(draft, 'ACCEPTED');
    const submitted = this.broker.submitPaperOrder(accepted);
    if (!submitted.ok) {
      return this.reject(gated.decision, submitted.error.code, submitted.error.message);
    }
    this.store.putOrder(accepted);
    this.emit('InvestmentOrderCreated', accepted.orderId, { orderId: accepted.orderId, side: accepted.side });
    this.emit('InvestmentOrderAccepted', accepted.orderId, { orderId: accepted.orderId });
    const fillResult = this.broker.produceDeterministicFill({
      order: accepted,
      price: quote.value.price,
      fee,
      filledAt: this.clock.now(),
    });
    if (!fillResult.ok) {
      return this.reject(gated.decision, fillResult.error.code, fillResult.error.message);
    }
    const applied = this.applyFill(profile, accepted, fillResult.value, gated.authority, intent.actionType);
    if (applied.outcome !== 'OK') {
      return applied;
    }
    this.evidence.seal('INVESTMENT_PAPER_ORDER', {
      intentId: intent.id,
      authorityId: gated.authority.authorityId,
      orderId: accepted.orderId,
      fillId: fillResult.value.fillId,
      journalId: applied.value.cashJournalId,
      riskAssessmentId: this.lastRiskDecision?.assessmentId ?? null,
    });
    engine.captureSnapshot(this.portfolioRiskSnapshot(profile.investmentAccountId));
    return {
      outcome: 'OK',
      value: { orderId: accepted.orderId, fillId: fillResult.value.fillId },
      decision: gated.decision,
    };
  }

  cancelPaperOrder(intent: CancelPaperOrderIntent): InvestmentsServiceOutcome<{ readonly orderId: string }> {
    const existing = this.store.getOrder(intent.payload.orderId);
    if (existing?.status === 'CANCELLED') {
      return { outcome: 'OK', value: { orderId: existing.orderId }, decision: this.emptyDecision(intent.actionType, intent.id), replay: true };
    }
    const gated = this.gate(intent);
    if (gated.outcome !== 'ALLOWED') {
      return gated.result;
    }
    if (!existing) {
      return this.reject(gated.decision, 'ORDER_NOT_FOUND', 'paper order does not exist');
    }
    if (existing.status === 'FILLED') {
      return this.reject(gated.decision, 'CANNOT_CANCEL', 'filled orders cannot be cancelled');
    }
    const cancelled = transitionPaperOrder(existing, 'CANCELLED');
    const brokered = this.broker.cancelPaperOrder(cancelled);
    if (!brokered.ok) {
      return this.reject(gated.decision, brokered.error.code, brokered.error.message);
    }
    this.store.putOrder(cancelled);
    this.emit('InvestmentOrderCancelled', cancelled.orderId, { orderId: cancelled.orderId });
    return { outcome: 'OK', value: { orderId: cancelled.orderId }, decision: gated.decision };
  }

  ingestDuplicateFill(providerFillRef: string): InvestmentsServiceOutcome<{ readonly fillId: string; readonly replay: true }> {
    const existing = this.store.getFillByProviderRef(providerFillRef);
    if (!existing) {
      return {
        outcome: 'REJECTED',
        code: 'MISSING_FILL',
        message: 'duplicate fill callback has no original fill',
        decision: null,
      };
    }
    return {
      outcome: 'OK',
      value: { fillId: existing.fillId, replay: true },
      decision: this.emptyDecision('CREATE_PAPER_ORDER', existing.orderId),
      replay: true,
    };
  }

  settleInvestment(intent: SettleInvestmentIntent): InvestmentsServiceOutcome<{ readonly settlementId: string }> {
    const existing = this.store.getSettlement(intent.payload.settlementId);
    if (existing?.state === 'SETTLED') {
      return {
        outcome: 'OK',
        value: { settlementId: existing.settlementId },
        decision: this.emptyDecision(intent.actionType, intent.id),
        replay: true,
      };
    }
    const gated = this.gate(intent);
    if (gated.outcome !== 'ALLOWED') {
      return gated.result;
    }
    if (!existing) {
      return this.reject(gated.decision, 'SETTLEMENT_NOT_FOUND', 'settlement record is missing');
    }
    const profile = this.store.getProfile(existing.investmentAccountId);
    if (!profile) {
      return this.reject(gated.decision, 'PROFILE_INACTIVE', 'investment account is missing');
    }
    const journal = this.postSettlementJournal(profile, existing, gated.authority, intent.actionType, intent.idempotencyKey);
    const settled = freezeSettlement({
      ...existing,
      state: 'SETTLED',
      settledAt: this.clock.now(),
      settlementJournalId: journal.id,
    });
    this.store.putSettlement(settled);
    const fill = this.store.getFill(existing.fillId);
    if (fill) {
      this.refreshPosition(profile, fill.instrumentId, fill.quantity, existing.side, true);
    }
    this.emit('InvestmentSettlementCompleted', settled.settlementId, { settlementId: settled.settlementId });
    return { outcome: 'OK', value: { settlementId: settled.settlementId }, decision: gated.decision };
  }

  processCorporateAction(intent: ProcessCorporateActionIntent): InvestmentsServiceOutcome<{ readonly corporateActionId: string }> {
    const replayed = this.store.getCorporateAction(intent.payload.corporateActionId);
    if (replayed?.processedAt) {
      return {
        outcome: 'OK',
        value: { corporateActionId: replayed.corporateActionId },
        decision: this.emptyDecision(intent.actionType, intent.id),
        replay: true,
      };
    }
    const gated = this.gate(intent);
    if (gated.outcome !== 'ALLOWED') {
      return gated.result;
    }
    const profile = this.store.getProfile(asInvestmentAccountId(intent.payload.investmentAccountId));
    if (!profile) {
      return this.reject(gated.decision, 'PROFILE_INACTIVE', 'investment account is missing');
    }
    const instrument = this.store.getInstrument(intent.payload.instrumentId);
    if (!instrument) {
      return this.reject(gated.decision, 'UNKNOWN_INSTRUMENT', 'unknown instrument');
    }
    if (intent.payload.kind === 'DIVIDEND') {
      const amount = Money.fromMinorUnits(BigInt(intent.payload.cashMinorUnits ?? '0'), profile.baseCurrency);
      const position = this.store.getPosition(profile.investmentAccountId, instrument.instrumentId);
      if (!position || position.settledQuantity.units <= 0n) {
        return this.reject(gated.decision, 'NOT_ELIGIBLE', 'no settled position is eligible for the dividend');
      }
      const journal = postInvestmentJournal(this.ledger, {
        idempotencyKey: intent.idempotencyKey,
        executionAuthority: gated.authority,
        actionType: intent.actionType,
        memo: 'SIMULATION_DIVIDEND',
        debitAccountId: investmentClearingId(profile.baseCurrency),
        creditAccountId: profile.brokerageCashAccountId,
        amount,
        classBridge: brokerageToFundingBridge(),
      });
      const action = freezeCorporateAction({
        corporateActionId: asCorporateActionId(intent.payload.corporateActionId),
        kind: 'DIVIDEND',
        instrumentId: instrument.instrumentId,
        investmentAccountId: profile.investmentAccountId,
        recordRef: intent.payload.recordRef,
        cashAmount: amount,
        currency: profile.baseCurrency,
        splitNumerator: null,
        splitDenominator: null,
        paymentAt: this.clock.now(),
        processedAt: this.clock.now(),
        cashJournalId: journal.id,
        simulation: true,
      });
      this.store.putCorporateAction(action);
      this.emit('InvestmentDividendReceived', action.corporateActionId, {
        corporateActionId: action.corporateActionId,
        journalId: journal.id,
      });
      return { outcome: 'OK', value: { corporateActionId: action.corporateActionId }, decision: gated.decision };
    }
    const numerator = BigInt(intent.payload.splitNumerator ?? '0');
    const denominator = BigInt(intent.payload.splitDenominator ?? '0');
    const lots = this.store.getLots(profile.investmentAccountId, instrument.instrumentId);
    const adjusted = splitAdjustLots(lots, numerator, denominator);
    if (!adjusted.ok) {
      return this.reject(gated.decision, adjusted.error.code, adjusted.error.message);
    }
    this.store.replaceLots(profile.investmentAccountId, instrument.instrumentId, adjusted.value);
    const settled = this.store.getPosition(profile.investmentAccountId, instrument.instrumentId);
    const nextSettledUnits = settled
      ? (settled.settledQuantity.units * numerator) / denominator
      : 0n;
    this.store.putPosition(
      positionFromLots(
        profile.investmentAccountId,
        instrument.instrumentId,
        adjusted.value,
        { units: nextSettledUnits, scale: 8 },
        this.clock.now(),
        profile.baseCurrency,
      ),
    );
    const action = freezeCorporateAction({
      corporateActionId: asCorporateActionId(intent.payload.corporateActionId),
      kind: 'SPLIT',
      instrumentId: instrument.instrumentId,
      investmentAccountId: profile.investmentAccountId,
      recordRef: intent.payload.recordRef,
      cashAmount: null,
      currency: profile.baseCurrency,
      splitNumerator: numerator,
      splitDenominator: denominator,
      paymentAt: this.clock.now(),
      processedAt: this.clock.now(),
      cashJournalId: null,
      simulation: true,
    });
    this.store.putCorporateAction(action);
    return { outcome: 'OK', value: { corporateActionId: action.corporateActionId }, decision: gated.decision };
  }

  valuePortfolio(investmentAccountId: InvestmentAccountId): PortfolioValuationSnapshot {
    const profile = this.store.getProfile(investmentAccountId);
    if (!profile) {
      throw new Error('investment account is missing');
    }
    const positions = this.store.listPositions(investmentAccountId);
    const valued: ValuedPosition[] = [];
    let marketValue = Money.zero(profile.baseCurrency);
    let cost = Money.zero(profile.baseCurrency);
    for (const position of positions) {
      if (position.quantity.units === 0n) {
        continue;
      }
      const quote = this.market.getValuationPrice(position.instrumentId, this.clock.now());
      if (!quote.ok) {
        throw new Error(quote.error.message);
      }
      const mv = notionalMoney(position.quantity, quote.value.price);
      if (!mv.ok) {
        throw new Error(mv.error.message);
      }
      const unrealized = unrealizedFromValuation({
        instrumentId: position.instrumentId,
        marketValue: mv.value,
        remainingCost: position.remainingCost,
      });
      valued.push({
        instrumentId: position.instrumentId,
        quantity: position.quantity,
        price: quote.value.price,
        priceSource: 'SIMULATED_DETERMINISTIC',
        marketValue: mv.value,
        remainingCost: position.remainingCost,
        unrealized,
      });
      marketValue = marketValue.plus(mv.value);
      cost = cost.plus(position.remainingCost);
    }
    const cash = this.cashBalance(profile.brokerageCashAccountId, profile.baseCurrency);
    const snapshot = freezeValuationSnapshot({
      valuationId: asValuationId(`val_${investmentAccountId}_${this.clock.now()}`),
      investmentAccountId,
      asOf: this.clock.now(),
      currency: profile.baseCurrency,
      positions: valued,
      marketValue,
      costBasis: cost,
      unrealized: marketValue.minus(cost),
      cash,
      priceSource: 'SIMULATED_DETERMINISTIC',
      fxValuationContext: null,
    });
    this.store.putValuation(snapshot);
    this.peg?.publishValuation(snapshot);
    return snapshot;
  }

  allocation(investmentAccountId: InvestmentAccountId) {
    const snapshot = this.store.latestValuation(investmentAccountId) ?? this.valuePortfolio(investmentAccountId);
    const instruments = new Map(this.store.listInstruments().map((row) => [row.instrumentId, row] as const));
    return deriveAllocation(snapshot, instruments);
  }

  consumePeve(investmentAccountId: InvestmentAccountId): PeveInvestmentView {
    const snapshot = this.store.latestValuation(investmentAccountId) ?? this.valuePortfolio(investmentAccountId);
    const realized = this.store.listRealized().reduce(
      (sum, row) => sum.plus(row.realized),
      Money.zero(snapshot.currency),
    );
    const fees = this.store.listRealized().reduce((sum, row) => sum.plus(row.fees), Money.zero(snapshot.currency));
    return this.peve.consume({
      investmentAccountId,
      portfolioValue: snapshot.marketValue.plus(snapshot.cash),
      realizedOutcome: realized,
      fees,
      cashYield: Money.zero(snapshot.currency),
      unrealized: snapshot.positions[0]?.unrealized ?? null,
      principalMovement: Money.zero(snapshot.currency),
    });
  }

  reconcile(investmentAccountId: InvestmentAccountId): InvestmentReconciliation {
    const profile = this.store.getProfile(investmentAccountId);
    if (!profile) {
      throw new Error('investment account is missing');
    }
    const findings: string[] = [];
    let result: ReconciliationResult = 'MATCHED';
    for (const fill of this.store.listFills()) {
      const order = this.store.getOrder(fill.orderId);
      if (!order) {
        findings.push(`MISSING_INTERNAL fill ${fill.fillId}`);
        result = 'MISSING_INTERNAL';
      }
      const settlement = this.store.getSettlementByFill(fill.fillId);
      if (!settlement) {
        findings.push(`MISSING_FILL settlement for ${fill.fillId}`);
        result = result === 'MATCHED' ? 'MISSING_FILL' : 'INVESTIGATION_REQUIRED';
      }
    }
    for (const position of this.store.listPositions(investmentAccountId)) {
      const lots = this.store.getLots(investmentAccountId, position.instrumentId);
      const lotQty = lots.reduce((sum, lot) => sum + lot.remainingQuantity.units, 0n);
      if (lotQty !== position.quantity.units) {
        findings.push(`POSITION_MISMATCH ${position.instrumentId}`);
        result = 'POSITION_MISMATCH';
      }
    }
    const cash = this.cashBalance(profile.brokerageCashAccountId, profile.baseCurrency);
    if (cash.minorUnits < 0n) {
      findings.push('CASH_MISMATCH negative brokerage cash');
      result = 'CASH_MISMATCH';
    }
    for (const settlement of this.store.listSettlements(investmentAccountId)) {
      const fill = this.store.getFill(settlement.fillId);
      if (fill && fill.grossNotional.minorUnits !== settlement.cashAmount.minorUnits) {
        findings.push(`CASH_MISMATCH settlement ${settlement.settlementId} does not match fill notional`);
        result = 'CASH_MISMATCH';
      }
    }
    const row = freezeReconciliation({
      reconciliationId: asReconciliationId(`rec_${investmentAccountId}_${this.clock.now()}`),
      investmentAccountId,
      result,
      findings,
      cashLedger: cash,
      cashInternal: cash,
      autoAdjusted: false,
      createdAt: this.clock.now(),
    });
    this.store.putReconciliation(row);
    if (result !== 'MATCHED') {
      this.emit('InvestmentReconciliationMismatch', row.reconciliationId, {
        reconciliationId: row.reconciliationId,
        result,
        findings,
      });
    }
    return row;
  }

  refuseAgentBrokerCall(): InvestmentsServiceOutcome<never> {
    return {
      outcome: 'REJECTED',
      code: 'AGENT_CANNOT_TRADE',
      message: 'Personal Economy Agent cannot submit paper or live orders or call the broker',
      decision: null,
    };
  }

  refuseGrowthAutoExecution(): InvestmentsServiceOutcome<never> {
    return {
      outcome: 'REJECTED',
      code: 'GROWTH_CANNOT_AUTO_TRADE',
      message: 'Growth Orchestrator cannot auto-submit paper orders; user confirmation and Kernel are required',
      decision: null,
    };
  }

  private applyFill(
    profile: InvestmentAccountProfile,
    order: ReturnType<typeof freezePaperOrder>,
    fill: ReturnType<typeof freezePaperFill>,
    authority: ExecutionAuthority,
    actionType: string,
  ): InvestmentsServiceOutcome<{ readonly cashJournalId: string }> {
    const duplicate = this.store.getFillByProviderRef(fill.providerFillRef);
    if (duplicate) {
      return {
        outcome: 'OK',
        value: { cashJournalId: this.store.getSettlementByFill(duplicate.fillId)?.cashJournalId ?? duplicate.fillId },
        decision: this.emptyDecision(actionType, order.intentId),
        replay: true,
      };
    }
    this.store.putFill(fill);
    const filled = transitionPaperOrder({ ...order, filledQuantity: fill.quantity, status: 'ACCEPTED' }, 'FILLED');
    this.store.putOrder(filled);
    this.emit('InvestmentOrderFilled', filled.orderId, { orderId: filled.orderId, fillId: fill.fillId });
    let lots = [...this.store.getLots(profile.investmentAccountId, fill.instrumentId)];
    if (fill.side === 'BUY') {
      const lot = openLot({
        lotId: asLotId(`lot_${fill.fillId}`),
        instrumentId: fill.instrumentId,
        acquiredAt: fill.filledAt,
        quantity: fill.quantity,
        unitCost: fill.price,
        sourceFillId: fill.fillId,
      });
      if (!lot.ok) {
        return this.reject(null, lot.error.code, lot.error.message);
      }
      lots = [...lots, lot.value];
    } else {
      const consumed = consumeLotsFifo(lots, fill.quantity);
      if (!consumed.ok) {
        return this.reject(null, consumed.error.code, consumed.error.message);
      }
      lots = [...consumed.value.remaining];
      const realized = realizedFromSale({
        instrumentId: fill.instrumentId,
        quantity: fill.quantity,
        proceeds: fill.grossNotional,
        fees: fill.explicitFee,
        consumed: consumed.value.consumed,
      });
      this.store.recordRealized(realized);
    }
    this.store.replaceLots(profile.investmentAccountId, fill.instrumentId, lots);
    const cashJournal = this.postTradeCash(profile, fill, authority, actionType);
    if (fill.explicitFee.minorUnits > 0n) {
      postInvestmentJournal(this.ledger, {
        idempotencyKey: `${authority.idempotencyKey}:fee`,
        executionAuthority: authority,
        actionType,
        memo: 'INVESTMENT_EXPLICIT_FEE',
        debitAccountId: profile.brokerageCashAccountId,
        creditAccountId: investmentFeeCollectorId(profile.baseCurrency),
        amount: fill.explicitFee,
        classBridge: brokerageToFundingBridge(),
      });
    }
    const delay = 0n;
    const settlement = freezeSettlement({
      settlementId: asSettlementId(`set_${fill.fillId}`),
      fillId: fill.fillId,
      investmentAccountId: profile.investmentAccountId,
      side: fill.side,
      quantity: fill.quantity,
      cashAmount: fill.grossNotional,
      feeAmount: fill.explicitFee,
      state: delay === 0n ? 'SETTLED' : 'PENDING_SETTLEMENT',
      tradeAt: fill.filledAt,
      settleAfter: addMs(fill.filledAt, delay),
      settledAt: delay === 0n ? fill.filledAt : null,
      cashJournalId: cashJournal.id,
      settlementJournalId: delay === 0n ? cashJournal.id : null,
      settlementDelayDays: delay,
    });
    this.store.putSettlement(settlement);
    this.refreshPosition(profile, fill.instrumentId, fill.quantity, fill.side, delay === 0n);
    const position = this.store.getPosition(profile.investmentAccountId, fill.instrumentId);
    if (position) {
      const instrument = this.store.getInstrument(fill.instrumentId);
      this.peg?.publishPosition(position, instrument?.displayName ?? fill.instrumentId, this.clock.now());
      this.emit('InvestmentPositionChanged', profile.investmentAccountId, {
        customerId: profile.customerId,
        investmentAccountId: profile.investmentAccountId,
        instrumentId: fill.instrumentId,
        quantityUnits: position.quantity.units.toString(),
      });
    }
    return { outcome: 'OK', value: { cashJournalId: cashJournal.id }, decision: this.emptyDecision(actionType, order.intentId) };
  }

  private postTradeCash(
    profile: InvestmentAccountProfile,
    fill: ReturnType<typeof freezePaperFill>,
    authority: ExecutionAuthority,
    actionType: string,
  ) {
    if (fill.side === 'BUY') {
      return postInvestmentJournal(this.ledger, {
        idempotencyKey: `${authority.idempotencyKey}:cash`,
        executionAuthority: authority,
        actionType,
        memo: 'PAPER_BUY_CASH',
        debitAccountId: profile.brokerageCashAccountId,
        creditAccountId: investmentClearingId(profile.baseCurrency),
        amount: fill.grossNotional,
        classBridge: brokerageToFundingBridge(),
      });
    }
    return postInvestmentJournal(this.ledger, {
      idempotencyKey: `${authority.idempotencyKey}:cash`,
      executionAuthority: authority,
      actionType,
      memo: 'PAPER_SELL_PROCEEDS',
      debitAccountId: investmentClearingId(profile.baseCurrency),
      creditAccountId: profile.brokerageCashAccountId,
      amount: fill.grossNotional,
      classBridge: brokerageToFundingBridge(),
    });
  }

  private postSettlementJournal(
    profile: InvestmentAccountProfile,
    settlement: ReturnType<typeof freezeSettlement>,
    authority: ExecutionAuthority,
    actionType: string,
    idempotencyKey: string,
  ) {
    if (settlement.side === 'BUY') {
      return postInvestmentJournal(this.ledger, {
        idempotencyKey,
        executionAuthority: authority,
        actionType,
        memo: 'INVESTMENT_SETTLE_BUY',
        debitAccountId: profile.pendingSettlementAccountId,
        creditAccountId: investmentClearingId(profile.baseCurrency),
        amount: settlement.cashAmount,
        classBridge: brokerageToPendingBridge(),
      });
    }
    return postInvestmentJournal(this.ledger, {
      idempotencyKey,
      executionAuthority: authority,
      actionType,
      memo: 'INVESTMENT_SETTLE_SELL',
      debitAccountId: profile.pendingSettlementAccountId,
      creditAccountId: profile.brokerageCashAccountId,
      amount: settlement.cashAmount,
      classBridge: brokerageToPendingBridge(),
    });
  }

  private refreshPosition(
    profile: InvestmentAccountProfile,
    instrumentId: InstrumentId,
    _delta: ReturnType<typeof zeroQuantity>,
    _side: 'BUY' | 'SELL',
    settled: boolean,
  ): void {
    const lots = this.store.getLots(profile.investmentAccountId, instrumentId);
    const previous = this.store.getPosition(profile.investmentAccountId, instrumentId);
    const quantity = lots.reduce((sum, lot) => sum + lot.remainingQuantity.units, 0n);
    const settledQty = settled
      ? { units: quantity, scale: 8 as const }
      : (previous?.settledQuantity ?? zeroQuantity());
    this.store.putPosition(
      positionFromLots(
        profile.investmentAccountId,
        instrumentId,
        lots,
        settledQty,
        this.clock.now(),
        profile.baseCurrency,
      ),
    );
  }

  private cashBalance(accountId: string, currency: string): Money {
    const postings = this.ledger.listPostingsForAccount(accountId);
    let credits = Money.zero(currency);
    let debits = Money.zero(currency);
    for (const posting of postings) {
      if (posting.direction === 'CREDIT') {
        credits = credits.plus(posting.amount);
      } else {
        debits = debits.plus(posting.amount);
      }
    }
    return credits.minus(debits);
  }

  private availableBrokerageCash(accountId: string, currency: string): Money {
    return this.cashBalance(accountId, currency);
  }

  private eligibilityFor(intent: OpenInvestmentAccountIntent) {
    const customer = this.catalog.customers.get(intent.payload.customerId);
    const product = this.catalog.products.get(intent.payload.productId);
    const legalEntity = this.catalog.legalEntities.get(intent.payload.legalEntityId);
    const brokerage = this.catalog.accounts.get(intent.payload.brokerageCashAccountId);
    const securities = this.catalog.accounts.get(intent.payload.securitiesAccountId);
    const rdt = this.rdt.evaluate({
      actionType: 'OPEN_INVESTMENT_ACCOUNT',
      productId: intent.payload.productId,
      jurisdiction: intent.payload.jurisdiction,
    });
    const investmentClass =
      product?.accountClass === 'BROKERAGE_CASH' || product?.accountClass === 'SECURITIES';
    return evaluateInvestmentEligibility({
      customer,
      identityVerified: customer?.verification.kycState === 'VERIFIED',
      identityUsable: customer?.status === 'ACTIVE',
      jurisdiction: intent.payload.jurisdiction,
      legalEntity,
      product,
      brokerageCash: brokerage,
      securities,
      investmentCapabilityEnabled: Boolean(product && legalEntity && investmentClass),
      rdtStatus: rdt.legalStatus,
    });
  }

  private gate(
    intent: ActionIntent,
    extras: {
      readonly amount?: Money;
      readonly investmentRisk?: {
        readonly assessmentId: string;
        readonly outcome: 'ALLOW_SIMULATION' | 'REQUIRE_REVIEW' | 'BLOCK' | 'INSUFFICIENT_DATA';
        readonly triggeredLimitIds: readonly string[];
        readonly modelId: string;
        readonly modelVersion: string;
        readonly generatedAt: string;
      };
    } = {},
  ):
    | { readonly outcome: 'ALLOWED'; readonly decision: AuthorizationDecision; readonly authority: ExecutionAuthority }
    | { readonly outcome: 'REFUSED'; readonly result: InvestmentsServiceOutcome<never> } {
    const account = this.catalog.accounts.get((intent.payload as { accountId?: Account['id'] }).accountId as Account['id']);
    const customer = account ? this.catalog.customers.get(account.ownerId) : undefined;
    const resolved = this.identity.resolveActorContext(intent.actorId);
    const product = account ? this.catalog.products.get(account.productId) : undefined;
    const legalEntity = account ? this.catalog.legalEntities.get(account.legalEntityId) : undefined;
    const facts: KernelFacts = {
      actor: {
        id: intent.actorId,
        capabilities: resolved.ok ? actionTypesFromCapabilities(resolved.value.authorizedCapabilities) : [],
      },
      identity: this.identity.identityFactsFor(intent.actorId),
      ...(customer ? { customer } : {}),
      ...(legalEntity ? { legalEntity } : {}),
      ...(product ? { product } : {}),
      ...(account ? { sourceAccount: account, jurisdiction: account.jurisdiction } : {}),
      ...((intent.payload as { amount?: Money }).amount ? { amount: (intent.payload as { amount: Money }).amount } : {}),
      ...(extras.amount ? { amount: extras.amount } : {}),
      ...(extras.investmentRisk ? { investmentRisk: extras.investmentRisk } : {}),
    };
    const decision = this.kernel.submit(intent, facts);
    this.emit('KernelDecisionRecorded', intent.id, {
      intentId: intent.id,
      actionType: intent.actionType,
      status: decision.status,
      evidenceRecordId: decision.evidenceRecordId,
      executionAuthorityId: decision.executionAuthority?.authorityId ?? null,
    });
    if (decision.status !== 'ALLOW') {
      this.evidence.seal(`${intent.actionType}_KERNEL_REFUSED`, {
        intentId: intent.id,
        status: decision.status,
        posted: false,
      });
      return { outcome: 'REFUSED', result: { outcome: 'KERNEL_REFUSED', decision } };
    }
    const structural = validateIntentStructure(intent, {
      products: this.catalog.products,
      legalEntities: this.catalog.legalEntities,
      accounts: this.catalog.accounts,
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

  private reject(
    decision: AuthorizationDecision | null,
    code: string,
    message: string,
  ): InvestmentsServiceOutcome<never> {
    return { outcome: 'REJECTED', code, message, decision };
  }

  private emptyDecision(actionType: string, intentId: string): AuthorizationDecision {
    return Object.freeze({
      intentId,
      actionType,
      status: 'ALLOW',
      decidedAt: this.clock.now(),
      proofs: Object.freeze([]),
      evidenceRecordId: 'replay',
      executionAuthority: null,
    }) as AuthorizationDecision;
  }

  private ensureRiskEngine(actorId: string): RiskEngine | undefined {
    if (this.riskEngine) {
      return this.riskEngine;
    }
    const resolved = this.identity.resolveActorContext(actorId);
    if (!resolved.ok) {
      return undefined;
    }
    const registry = new ModelRegistry();
    const seeded = seedCanonicalRiskModel(registry, resolved.value, this.clock.now());
    if (!seeded.ok) {
      return undefined;
    }
    this.riskEngine = new RiskEngine({
      clock: this.clock,
      registry,
      events: this.events,
      evidence: this.evidence,
    });
    this.events.append({
      eventType: 'ModelRegistered',
      schemaVersion: 1,
      occurredAt: this.clock.now(),
      payload: {
        modelId: seeded.value.modelId,
        version: seeded.value.version,
        type: seeded.value.type,
        lifecycle: seeded.value.lifecycle,
        simulationOnly: true,
        liveApproved: false,
      },
      aggregateType: 'model',
      aggregateId: seeded.value.modelId,
    } as never);
    this.events.append({
      eventType: 'ModelApprovedForSimulation',
      schemaVersion: 1,
      occurredAt: this.clock.now(),
      payload: {
        modelId: seeded.value.modelId,
        version: seeded.value.version,
        actorId,
        simulationOnly: true,
        liveApproved: false,
      },
      aggregateType: 'model',
      aggregateId: seeded.value.modelId,
    } as never);
    return this.riskEngine;
  }

  private proposedTrade(
    orderId: string,
    instrument: Instrument,
    quantityUnits: bigint,
    side: 'BUY' | 'SELL',
    notionalMinor: bigint,
    feeMinor: bigint,
    priceMinor: bigint,
  ): ProposedPaperTrade {
    return Object.freeze({
      proposalRef: orderId,
      instrumentId: instrument.instrumentId,
      instrumentType: instrument.instrumentType,
      currency: instrument.currency,
      side,
      quantityUnits,
      quantityScale: 8,
      priceMinor,
      notionalMinor,
      feeMinor,
      liquidityClass: 'HIGH',
    });
  }

  portfolioRiskSnapshot(investmentAccountId: InvestmentAccountId) {
    const profile = this.store.getProfile(investmentAccountId);
    if (!profile) {
      throw new Error('investment account is missing');
    }
    const cash = this.availableBrokerageCash(profile.brokerageCashAccountId, profile.baseCurrency);
    const positions = this.store.listPositions(investmentAccountId).flatMap((row) => {
      const quote = this.market.getValuationPrice(row.instrumentId, this.clock.now());
      const instrument = this.store.getInstrument(row.instrumentId);
      if (!quote.ok || !instrument || row.quantity.units === 0n) {
        return [];
      }
      const notional = notionalMoney(row.quantity, quote.value.price);
      if (!notional.ok) {
        return [];
      }
      const stale =
        this.market instanceof SimulatedMarketDataProvider && this.market.isStale(quote.value, this.clock.now());
      return [
        Object.freeze({
          instrumentId: row.instrumentId,
          instrumentType: instrument.instrumentType,
          currency: instrument.currency,
          quantityUnits: row.quantity.units,
          marketValueMinor: notional.value.minorUnits,
          priceMinor: quote.value.price.minorUnits,
          priceTimestamp: quote.value.quotedAt,
          priceQuality: stale ? ('STALE' as const) : ('CURRENT' as const),
          liquidityClass: 'HIGH' as const,
          sourceRef: `investment:${row.instrumentId}`,
        }),
      ];
    });
    const valuations = this.store.listValuations().filter((row) => row.investmentAccountId === investmentAccountId);
    return Object.freeze({
      snapshotId: asPortfolioRiskSnapshotId(`prs_${investmentAccountId}`.replace(/[^a-z0-9_]/gi, '').slice(0, 28) || 'prs_portfolio'),
      portfolioId: profile.investmentAccountId,
      subjectId: profile.customerId,
      asOf: this.clock.now(),
      currency: profile.baseCurrency,
      positions: Object.freeze(positions),
      brokerageCashMinor: cash.minorUnits,
      unsettledCashMinor: 0n,
      pendingOrderNotionalMinor: 0n,
      realizedPnlMinor: this.store.listRealized().reduce((sum, row) => sum + row.realized.minorUnits, 0n),
      unrealizedPnlMinor: 0n,
      observations: Object.freeze(
        valuations.map((row) =>
          Object.freeze({
            at: row.asOf,
            portfolioMarketValueMinor: row.marketValue.plus(row.cash).minorUnits,
            currency: row.currency,
          }),
        ),
      ),
      sourceRefs: Object.freeze(['investments.store', profile.investmentAccountId]),
      simulationOnly: true as const,
    });
  }

  private emit(eventType: string, aggregateId: string, payload: Record<string, unknown>): void {
    this.events.append({
      eventType: eventType as never,
      schemaVersion: 1,
      occurredAt: this.clock.now(),
      payload,
      aggregateType: eventType.startsWith('Investment') ? 'investment' : 'intent',
      aggregateId,
    } as never);
  }
}
