import type { Clock } from '../../config/src/clock.ts';
import type { Account } from '../../domain/src/account.ts';
import { asCurrencyCode } from '../../domain/src/currency.ts';
import type { Customer } from '../../domain/src/customer.ts';
import { isErr, isOk } from '../../domain/src/result.ts';
import type { EvidenceVault } from '../../evidence/src/vault.ts';
import type { DomainEventLog } from '../../events/src/events.ts';
import { actionTypesFromCapabilities, type IdentityAuthorityPort } from '../../identity/src/index.ts';
import type { ComplianceKernel } from '../../kernel/src/kernel.ts';
import type { KernelFacts } from '../../kernel/src/proofs.ts';
import type { Ledger } from '../../ledger/src/journal.ts';
import type { Journal } from '../../ledger/src/types.ts';
import { Money } from '../../money/src/money.ts';
import type {
  AcceptFxQuoteIntent,
  AcceptInboundPaymentIntent,
  CancelPaymentIntent,
  CreateBeneficiaryIntent,
  CreateFxQuoteIntent,
  InitiatePaymentIntent,
} from '../../permissions/src/action-types.ts';
import type { AuthorizationDecision } from '../../permissions/src/decision.ts';
import type { AuthorityIssuer, ExecutionAuthority } from '../../permissions/src/execution-authority.ts';
import { validateIntentStructure, type StructuralCatalog } from '../../permissions/src/structural.ts';
import {
  captureFeePlan,
  capturePrincipalPlan,
  destinationFxPlan,
  feeIncomePlan,
  inboundPendingPlan,
  inboundSettlePlan,
  releasePlan,
  reservePlan,
  returnDestinationFxPlan,
  returnDestinationSettlePlan,
  returnPrincipalPlan,
  returnSourceFxPlan,
  settlePlan,
  SIMULATION_RETURN_POLICY,
  sourceFxPlan,
  type PaymentJournalPlan,
} from './accounting.ts';
import { freezeBeneficiary, isUsableBeneficiary, type Beneficiary } from './beneficiary.ts';
import {
  SimulationBeneficiaryValidator,
  type BeneficiaryValidationPort,
} from './beneficiary-validation.ts';
import {
  corridorIsSimulationEnabled,
  findCorridor,
  findCorridorByPair,
  type PaymentCorridor,
} from './corridor.ts';
import { quoteCanExecute, quoteIsExpired, withQuoteStatus, type FxQuote } from './fx-quote.ts';
import { SimulationFxProvider, type FxLiquidityProvider } from './fx-provider.ts';
import { asHoldId, asPaymentId, asSettlementRef, type PaymentId } from './ids.ts';
import { postPaymentJournal } from './journals.ts';
import { freezePayment, transitionPayment, type PaymentOrder } from './payment.ts';
import { reconcilePayment, type ProviderSettlementReport, type ReconciliationResult } from './reconciliation.ts';
import { disclosureFromQuote, type PaymentDisclosure } from './responses.ts';
import { selectRoute, simulationRoutesFor, type PaymentRoute } from './route.ts';
import type { TreasuryAdvisor, TreasuryRouteAdvice } from './treasury-port.ts';
import { beneficiaryStatusFromScreening, SimulationScreeningAdapter, type ScreeningPort } from './screening.ts';
import { type SettlementOutcome, type SimulatedSettlementRail } from './settlement.ts';
import { PaymentStore } from './store.ts';
import { registerPaymentTreasuryBooks } from './treasury.ts';
import { createSimulationRailNetwork, type RailNetwork } from './rail-network.ts';
import { createRailSubmission, providerIdempotencyKeyFor, withSubmissionStatus } from './rail-submission.ts';
import { decideRetry } from './rail-retry.ts';
import { reconcileRail } from './rail-reconciliation.ts';
import { buildSettlementReport } from './rail-settlement-report.ts';
import { freezeInbound, type InboundRailPayment } from './rail-inbound.ts';
import { freezeReturn } from './rail-returns.ts';
import { hashCallbackBody, type IncomingProviderCallback } from './rail-webhook.ts';
import { asInboundPaymentId, asOpaqueAccountRef, asProviderId, emptyRailReferences } from './rail-ids.ts';
import type { RailClass } from './rail-types.ts';

export type PaymentCatalogPorts = {
  readonly customers: { get(id: Customer['id']): Customer | undefined };
  readonly accounts: {
    get(id: Account['id']): Account | undefined;
    list(): readonly Account[];
  };
  readonly products: StructuralCatalog['products'];
  readonly legalEntities: StructuralCatalog['legalEntities'];
};

export type PaymentsServiceOutcome<T> =
  | { readonly outcome: 'OK'; readonly value: T; readonly decision: AuthorizationDecision; readonly replay?: boolean }
  | { readonly outcome: 'KERNEL_REFUSED'; readonly decision: AuthorizationDecision }
  | {
      readonly outcome: 'REJECTED';
      readonly code: string;
      readonly message: string;
      readonly decision: AuthorizationDecision | null;
      readonly evidenceId?: string;
    };

export class PaymentsService {
  private readonly kernel: ComplianceKernel;
  private readonly issuer: AuthorityIssuer;
  private readonly ledger: Ledger;
  private readonly evidence: EvidenceVault;
  private readonly events: DomainEventLog;
  private readonly clock: Clock;
  private readonly catalog: PaymentCatalogPorts;
  private readonly identity: IdentityAuthorityPort;
  private readonly store: PaymentStore;
  private readonly validator: BeneficiaryValidationPort;
  private readonly screening: ScreeningPort;
  private readonly fx: FxLiquidityProvider;
  readonly rail: SimulatedSettlementRail & {
    setMode?(paymentId: string, mode: import('./rail-adapters.ts').SimulatedAdapterMode | import('./settlement.ts').RailMode): void;
  };
  readonly railNetwork: RailNetwork;
  private readonly treasury: TreasuryAdvisor | undefined;
  private readonly authorities = new Map<string, ExecutionAuthority>();
  private providerAvailable = true;
  private routesForceUnavailable = false;

  constructor(
    kernel: ComplianceKernel,
    issuer: AuthorityIssuer,
    ledger: Ledger,
    evidence: EvidenceVault,
    events: DomainEventLog,
    clock: Clock,
    catalog: PaymentCatalogPorts,
    identity: IdentityAuthorityPort,
    options: {
      readonly store?: PaymentStore;
      readonly validator?: BeneficiaryValidationPort;
      readonly screening?: ScreeningPort;
      readonly fx?: FxLiquidityProvider;
      readonly rail?: SimulatedSettlementRail;
      readonly railNetwork?: RailNetwork;
      readonly treasury?: TreasuryAdvisor;
    } = {},
  ) {
    this.kernel = kernel;
    this.issuer = issuer;
    this.ledger = ledger;
    this.evidence = evidence;
    this.events = events;
    this.clock = clock;
    this.catalog = catalog;
    this.identity = identity;
    this.store = options.store ?? new PaymentStore();
    this.validator = options.validator ?? new SimulationBeneficiaryValidator();
    this.screening = options.screening ?? new SimulationScreeningAdapter();
    this.fx = options.fx ?? new SimulationFxProvider(clock);
    this.railNetwork = options.railNetwork ?? createSimulationRailNetwork(() => this.clock.now());
    this.rail = options.rail ?? this.railNetwork.asSettlementRail();
    this.treasury = options.treasury;
    registerPaymentTreasuryBooks(ledger.accounts);
  }

  getStore(): PaymentStore {
    return this.store;
  }

  setProviderAvailable(value: boolean): void {
    this.providerAvailable = value;
  }

  setRoutesForceUnavailable(value: boolean): void {
    this.routesForceUnavailable = value;
  }

  disclosure(quoteId: string, paymentId?: string): PaymentDisclosure | undefined {
    const quote = this.store.getQuote(quoteId);
    if (!quote) {
      return undefined;
    }
    const payment = paymentId ? this.store.getPayment(paymentId) : undefined;
    const route = payment?.routeId
      ? simulationRoutesFor(quote.corridorId, quote.fee).find((row) => row.routeId === payment.routeId)
      : undefined;
    return disclosureFromQuote(quote, payment, route);
  }

  createBeneficiary(intent: CreateBeneficiaryIntent): PaymentsServiceOutcome<Beneficiary> {
    const existing = this.store.getBeneficiary(intent.payload.beneficiaryId);
    if (existing) {
      return this.replayOk(existing, intent.actionType, intent.id);
    }
    const account = this.catalog.accounts.get(intent.payload.accountId);
    const customer = this.catalog.customers.get(intent.payload.ownerId);
    const validated = this.validator.validate(intent.payload, intent.payload.ownerId);
    if (isErr(validated)) {
      return this.reject(intent.actionType, intent.id, null, validated.error.code, validated.error.message);
    }
    const hit = this.screening.screen({
      legalName: intent.payload.legalName,
      destinationCountry: intent.payload.destinationCountry,
      coordinateRef: validated.value.coordinateRef,
      kind: intent.payload.kind,
    });
    const gated = this.gate(intent, account, customer, {
      screening: {
        sanctionsHit: hit.sanctionsHit,
        pepHit: hit.pepHit,
        fraudHold: hit.fraudHold,
        screeningRef: hit.screeningRef,
      },
    });
    if (gated.outcome !== 'ALLOWED') {
      return gated.result;
    }
    const status = beneficiaryStatusFromScreening(hit);
    const beneficiary = freezeBeneficiary({
      beneficiaryId: intent.payload.beneficiaryId as Beneficiary['beneficiaryId'],
      ownerId: intent.payload.ownerId,
      kind: intent.payload.kind,
      destinationCountry: intent.payload.destinationCountry,
      currency: intent.payload.currency,
      legalName: intent.payload.legalName,
      accountCoordinate: validated.value,
      screeningStatus: hit.status,
      screeningRef: hit.screeningRef,
      status,
      createdAt: this.clock.now(),
    });
    this.store.saveBeneficiary(beneficiary);
    this.emit('BeneficiaryCreated', 'beneficiary', beneficiary.beneficiaryId, intent.id, gated.decision, {
      beneficiaryId: beneficiary.beneficiaryId,
      ownerId: beneficiary.ownerId,
      destinationCountry: beneficiary.destinationCountry,
      currency: beneficiary.currency,
      status: beneficiary.status,
      screeningRef: beneficiary.screeningRef,
      coordinateHint: beneficiary.accountCoordinate.displayHint,
    });
    this.evidence.seal('BENEFICIARY_CREATED', {
      intentId: intent.id,
      beneficiaryId: beneficiary.beneficiaryId,
      screeningRef: beneficiary.screeningRef,
      status: beneficiary.status,
      coordinateRef: beneficiary.accountCoordinate.coordinateRef,
    });
    return { outcome: 'OK', value: beneficiary, decision: gated.decision };
  }

  createQuote(intent: CreateFxQuoteIntent): PaymentsServiceOutcome<FxQuote> {
    const existing = this.store.getQuote(intent.payload.quoteId);
    if (existing) {
      return this.replayOk(existing, intent.actionType, intent.id);
    }
    const account = this.catalog.accounts.get(intent.payload.accountId);
    const customer = account ? this.catalog.customers.get(account.ownerId) : undefined;
    const corridor = findCorridor(intent.payload.corridorId);
    const gated = this.gate(intent, account, customer, {
      corridorId: intent.payload.corridorId,
      corridorSimulationEnabled: corridor ? corridorIsSimulationEnabled(corridor) : false,
    });
    if (gated.outcome !== 'ALLOWED') {
      return gated.result;
    }
    if (!corridor || !corridorIsSimulationEnabled(corridor)) {
      return this.reject(
        intent.actionType,
        intent.id,
        gated.decision,
        'UNSUPPORTED_CORRIDOR',
        'corridor is not simulation-enabled',
      );
    }
    if (
      corridor.sourceCurrency !== intent.payload.baseCurrency ||
      corridor.destinationCurrency !== intent.payload.quoteCurrency
    ) {
      return this.reject(intent.actionType, intent.id, gated.decision, 'UNSUPPORTED_CURRENCY', 'quote currencies do not match corridor');
    }
    const quote = this.fx.quote({
      quoteId: intent.payload.quoteId as FxQuote['quoteId'],
      baseCurrency: intent.payload.baseCurrency,
      quoteCurrency: intent.payload.quoteCurrency,
      ...(intent.payload.sourceAmount ? { sourceAmount: intent.payload.sourceAmount } : {}),
      ...(intent.payload.destinationAmount ? { destinationAmount: intent.payload.destinationAmount } : {}),
      corridorId: corridor.corridorId,
      legalEntityId: corridor.servingLegalEntityId,
      now: this.clock.now(),
    });
    this.store.saveQuote(quote);
    this.emit('FxQuoteCreated', 'fx_quote', quote.quoteId, intent.id, gated.decision, {
      quoteId: quote.quoteId,
      baseCurrency: quote.baseCurrency,
      quoteCurrency: quote.quoteCurrency,
      sourceMinorUnits: quote.sourceAmount.minorUnits.toString(),
      destinationMinorUnits: quote.destinationAmount.minorUnits.toString(),
      feeMinorUnits: quote.fee.minorUnits.toString(),
      customerRate: `${quote.customerRate.numerator.toString()}/${quote.customerRate.denominator.toString()}`,
      rateSource: quote.rateSource,
      expiresAt: quote.expiresAt,
    });
    this.evidence.seal('FX_QUOTE_CREATED', {
      intentId: intent.id,
      quoteId: quote.quoteId,
      pricingVersion: quote.pricingVersion,
      rateSource: quote.rateSource,
    });
    return { outcome: 'OK', value: quote, decision: gated.decision };
  }

  acceptQuote(intent: AcceptFxQuoteIntent): PaymentsServiceOutcome<FxQuote> {
    const quote = this.store.getQuote(intent.payload.quoteId);
    const account = this.catalog.accounts.get(intent.payload.accountId);
    const customer = account ? this.catalog.customers.get(account.ownerId) : undefined;
    const gated = this.gate(intent, account, customer);
    if (gated.outcome !== 'ALLOWED') {
      return gated.result;
    }
    if (!quote) {
      return this.reject(intent.actionType, intent.id, gated.decision, 'QUOTE_NOT_FOUND', 'quote does not exist');
    }
    if (this.store.acceptedIntentFor(quote.quoteId)) {
      return { outcome: 'OK', value: quote, decision: gated.decision, replay: true };
    }
    if (quoteIsExpired(quote, this.clock.now())) {
      this.store.saveQuote(withQuoteStatus(quote, 'EXPIRED'));
      this.emit('FxQuoteExpired', 'fx_quote', quote.quoteId, intent.id, gated.decision, {
        quoteId: quote.quoteId,
        expiresAt: quote.expiresAt,
      });
      return this.reject(intent.actionType, intent.id, gated.decision, 'QUOTE_EXPIRED', 'expired quote cannot execute');
    }
    const accepted = withQuoteStatus(quote, 'ACCEPTED');
    this.store.saveQuote(accepted);
    this.store.markQuoteAccepted(accepted.quoteId, intent.id);
    this.emit('FxQuoteAccepted', 'fx_quote', accepted.quoteId, intent.id, gated.decision, {
      quoteId: accepted.quoteId,
      customerRate: `${accepted.customerRate.numerator.toString()}/${accepted.customerRate.denominator.toString()}`,
    });
    this.evidence.seal('FX_QUOTE_ACCEPTED', { intentId: intent.id, quoteId: accepted.quoteId });
    return { outcome: 'OK', value: accepted, decision: gated.decision };
  }

  initiatePayment(intent: InitiatePaymentIntent): PaymentsServiceOutcome<PaymentOrder> {
    const replayed = this.store.getPaymentByIdempotency(intent.idempotencyKey);
    if (replayed) {
      return { outcome: 'OK', value: replayed, decision: this.emptyDecision(intent.actionType, intent.id), replay: true };
    }
    const account = this.catalog.accounts.get(intent.payload.sourceAccountId);
    const customer = account ? this.catalog.customers.get(account.ownerId) : undefined;
    const beneficiary = this.store.getBeneficiary(intent.payload.beneficiaryId);
    const quote = this.store.getQuote(intent.payload.quoteId);
    const corridor = quote
      ? findCorridor(quote.corridorId)
      : findCorridorByPair(
          account?.jurisdiction ?? '',
          beneficiary?.destinationCountry ?? '',
          intent.payload.sourceAmount.currency,
          beneficiary?.currency ?? '',
        );
    const hit = beneficiary
      ? this.screening.screen({
          legalName: beneficiary.legalName,
          destinationCountry: beneficiary.destinationCountry,
          coordinateRef: beneficiary.accountCoordinate.coordinateRef,
          kind: beneficiary.kind,
        })
      : undefined;
    const gated = this.gate(intent, account, customer, {
      screening: hit
        ? {
            sanctionsHit: hit.sanctionsHit,
            pepHit: hit.pepHit,
            fraudHold: hit.fraudHold,
            screeningRef: hit.screeningRef,
          }
        : { sanctionsHit: false, pepHit: false, fraudHold: false, screeningRef: 'scr_none' },
      ...(corridor ? { corridorId: corridor.corridorId } : {}),
      corridorSimulationEnabled: corridor ? corridorIsSimulationEnabled(corridor) : false,
      ...(beneficiary ? { beneficiaryStatus: beneficiary.status } : {}),
      amount: quote?.amountDebited ?? intent.payload.sourceAmount,
    });
    if (gated.outcome !== 'ALLOWED') {
      const refused = gated.result.decision;
      if (refused?.status === 'REQUIRE_MANUAL_REVIEW' && hit?.fraudHold) {
        const held = this.draftPayment(intent, account, customer, quote, corridor, 'HELD');
        if (held) {
          this.store.savePayment(held);
          this.emit('PaymentHeld', 'payment', held.paymentId, intent.id, refused, {
            paymentId: held.paymentId,
            reason: 'FRAUD_HOLD',
          });
        }
      }
      return gated.result;
    }
    const pre = this.precheckInitiate(intent, account, customer, beneficiary, quote, corridor, hit?.sanctionsHit === true);
    if (pre) {
      return this.reject(intent.actionType, intent.id, gated.decision, pre.code, pre.message);
    }
    const authority = gated.authority!;
    this.authorities.set(intent.payload.paymentId, authority);
    const payment = this.draftPayment(intent, account, customer, quote, corridor, 'READY')!;
    this.store.savePayment(payment);
    this.emit('PaymentInitiated', 'payment', payment.paymentId, intent.id, gated.decision, {
      paymentId: payment.paymentId,
      quoteId: payment.quoteId,
      beneficiaryId: payment.beneficiaryId,
      sourceMinorUnits: payment.sourceAmount.minorUnits.toString(),
      destinationMinorUnits: payment.quotedDestinationAmount.minorUnits.toString(),
    });

    const reserved = this.reserve(payment, authority, account!);
    if (reserved.outcome !== 'OK') {
      return reserved;
    }
    let current = reserved.value;

    const stale = this.revalidateBeforeSubmit(intent, account, customer, beneficiary, quote, corridor, hit?.sanctionsHit === true, { fundsAlreadyReserved: true });
    if (stale) {
      current = this.releaseAndFail(current, authority, account!, stale.code, gated.decision);
      return this.reject(intent.actionType, intent.id, gated.decision, stale.code, stale.message);
    }

    const routes = this.routesForceUnavailable
      ? []
      : this.railNetwork.routesFor(current.corridorId, current.fee);
    const constraints = {
      corridor: corridor!,
      beneficiary: beneficiary!,
      sanctionsHit: hit?.sanctionsHit === true,
      amount: current.sourceAmount,
      maxAmount: Money.fromMinorUnits(100_000_000n, current.sourceCurrency),
      providerAvailable: this.providerAvailable,
    };
    const selection = this.treasury
      ? this.treasury.selectForPayment(routes, constraints, {
          requiredLiquidity: current.quotedDestinationAmount,
          destinationCountry: beneficiary!.destinationCountry,
          sourceJurisdiction: account!.jurisdiction,
          destinationJurisdiction: beneficiary!.destinationCountry,
          sourceCurrency: current.sourceCurrency,
          destinationCurrency: current.destinationCurrency,
          acceptedQuoteRequired: true,
          quoteAccepted: quote?.status === 'ACCEPTED',
          customerAccountActive: account!.status === 'OPEN',
          securityHold: false,
        })
      : selectRoute(routes, constraints);
    if (this.treasury) {
      this.treasury.rememberDecision(current.paymentId, (selection as TreasuryRouteAdvice).explanation);
    }
    if (!selection.chosen) {
      current = this.releaseAndFail(current, authority, account!, 'ROUTE_UNAVAILABLE', gated.decision);
      return { outcome: 'REJECTED', code: 'ROUTE_UNAVAILABLE', message: 'no compliant route', decision: gated.decision };
    }
    if (this.treasury) {
      const reservedLiquidity = this.treasury.reserveForPayment({
        paymentId: current.paymentId,
        corridorId: current.corridorId,
        provider: selection.chosen.provider,
        requiredLiquidity: current.quotedDestinationAmount,
        authority,
        idempotencyKey: `tres_${intent.idempotencyKey}`,
      });
      if (!reservedLiquidity.ok) {
        current = this.releaseAndFail(current, authority, account!, reservedLiquidity.code, gated.decision);
        return {
          outcome: 'REJECTED',
          code: reservedLiquidity.code,
          message: reservedLiquidity.message,
          decision: gated.decision,
        };
      }
    }
    current = this.mustTransition(current, 'SUBMITTED', { routeId: selection.chosen.routeId });
    this.store.savePayment(current);
    this.emit('PaymentSubmitted', 'payment', current.paymentId, intent.id, gated.decision, {
      paymentId: current.paymentId,
      routeId: selection.chosen.routeId,
    });

    const submission = createRailSubmission(
      {
        paymentId: current.paymentId,
        provider: selection.chosen.provider as never,
        rail: selection.chosen.rail as RailClass,
        amount: current.quotedDestinationAmount,
        currency: current.destinationCurrency,
        sourceReference: account!.id,
        destinationReference: beneficiary!.accountCoordinate.coordinateRef,
        beneficiaryReference: beneficiary!.beneficiaryId,
        purposeReference: current.purposeReference,
        idempotencyKey: providerIdempotencyKeyFor(current.paymentId, intent.idempotencyKey),
        correlationId: intent.id,
        requestedSettlement: { settlementClass: 'CORRESPONDENT', requestedAt: null },
      },
      this.clock.now(),
    );
    this.railNetwork.store.saveSubmission(submission);
    this.emit('RailSubmissionCreated', 'rail', submission.railSubmissionId, intent.id, gated.decision, {
      paymentId: current.paymentId,
      railSubmissionId: submission.railSubmissionId,
      provider: submission.provider,
      rail: submission.rail,
    });

    const submitResult = this.railNetwork.submit({
      authorityId: authority.authorityId,
      actionType: 'INITIATE_PAYMENT',
      submission,
    });
    this.railNetwork.store.saveSubmission(
      withSubmissionStatus(submission, submitResult.status, {
        executionUnknown: submitResult.status === 'SUBMISSION_UNKNOWN',
        references: submitResult.references,
        rejectionClass: submitResult.rejectionClass,
      }),
    );
    if (
      submitResult.status === 'ACCEPTED' ||
      submitResult.status === 'PENDING' ||
      submitResult.status === 'PROCESSING' ||
      submitResult.status === 'SETTLED'
    ) {
      this.emit('RailSubmissionAccepted', 'rail', submission.railSubmissionId, intent.id, gated.decision, {
        paymentId: current.paymentId,
        railSubmissionId: submission.railSubmissionId,
        provider: submission.provider,
        rail: submission.rail,
      });
    }
    const settlement = this.railNetwork.toSettlementOutcome(submitResult, {
      paymentId: current.paymentId,
      idempotencyKey: submission.idempotencyKey,
      destinationCountry: beneficiary!.destinationCountry,
      destinationCurrency: current.destinationCurrency,
      destinationAmountMinorUnits: current.quotedDestinationAmount.minorUnits.toString(),
      routeId: selection.chosen.routeId,
    });
    return this.applySettlement(current, authority, account!, quote!, settlement, gated.decision, selection.chosen);
  }

  cancelPayment(intent: CancelPaymentIntent): PaymentsServiceOutcome<PaymentOrder> {
    const payment = this.store.getPayment(intent.payload.paymentId);
    const account = this.catalog.accounts.get(intent.payload.accountId);
    const customer = account ? this.catalog.customers.get(account.ownerId) : undefined;
    const gated = this.gate(intent, account, customer);
    if (gated.outcome !== 'ALLOWED') {
      return gated.result;
    }
    if (!payment) {
      return this.reject(intent.actionType, intent.id, gated.decision, 'PAYMENT_NOT_FOUND', 'payment does not exist');
    }
    if (payment.status === 'CANCELLED') {
      return { outcome: 'OK', value: payment, decision: gated.decision, replay: true };
    }
    if (payment.status === 'SETTLED' || payment.status === 'RETURNED') {
      return this.reject(intent.actionType, intent.id, gated.decision, 'PAYMENT_NOT_CANCELLABLE', 'settled payment cannot cancel');
    }
    if (payment.status === 'SUBMISSION_UNKNOWN') {
      return this.reject(
        intent.actionType,
        intent.id,
        gated.decision,
        'CANCELLATION_NOT_SUPPORTED',
        'unknown submission must be queried before cancellation',
      );
    }
    const submission = this.railNetwork.store.getByPayment(payment.paymentId);
    const capability = submission
      ? this.railNetwork.registry.findFor(submission.rail, submission.provider)
      : undefined;
    if (capability && !capability.cancellationSupported && (payment.status === 'SUBMITTED' || payment.status === 'PROCESSING')) {
      return this.reject(
        intent.actionType,
        intent.id,
        gated.decision,
        'CANCELLATION_NOT_SUPPORTED',
        'rail capability does not support cancellation',
      );
    }
    const authority = gated.authority!;
    let current = payment;
    if (payment.status === 'FUNDS_RESERVED' || payment.status === 'SUBMITTED' || payment.status === 'READY') {
      if (payment.holdId && account) {
        const journal = postPaymentJournal(
          this.ledger,
          authority,
          intent.actionType,
          releasePlan(account.id, payment.amountDebited),
        );
        current = this.mustTransition(payment, 'CANCELLED', {
          journalIds: [...payment.journalIds, journal.id],
          holdId: null,
        });
      } else {
        current = this.mustTransition(payment, 'CANCELLED', {});
      }
    } else {
      current = this.mustTransition(payment, 'CANCELLED', {});
    }
    this.store.savePayment(current);
    this.treasury?.onPaymentFailed(current.paymentId, authority, 'CANCELLED');
    this.emit('PaymentCancelled', 'payment', current.paymentId, intent.id, gated.decision, {
      paymentId: current.paymentId,
    });
    return { outcome: 'OK', value: current, decision: gated.decision };
  }

  completeSettlement(paymentId: PaymentId): PaymentsServiceOutcome<PaymentOrder> {
    const payment = this.store.getPayment(paymentId);
    if (!payment) {
      return { outcome: 'REJECTED', code: 'PAYMENT_NOT_FOUND', message: 'payment does not exist', decision: null };
    }
    const authority = this.authorities.get(paymentId);
    const account = this.catalog.accounts.get(payment.sourceAccountId);
    const quote = this.store.getQuote(payment.quoteId);
    if (!authority || !account || !quote) {
      return { outcome: 'REJECTED', code: 'MISSING_AUTHORITY', message: 'cannot complete without stored authority', decision: null };
    }
    const raw = this.rail.complete(paymentId);
    const settlement =
      raw.kind === 'SUCCESS' && raw.providerAmountMinorUnits === '0'
        ? {
            ...raw,
            providerAmountMinorUnits: payment.quotedDestinationAmount.minorUnits.toString(),
            providerCurrency: payment.destinationCurrency,
          }
        : raw;
    return this.applySettlement(payment, authority, account, quote, settlement, this.emptyDecision('INITIATE_PAYMENT', payment.paymentId), null);
  }

  simulateReturn(paymentId: PaymentId): PaymentsServiceOutcome<PaymentOrder> {
    const payment = this.store.getPayment(paymentId);
    if (!payment || payment.status !== 'SETTLED') {
      return { outcome: 'REJECTED', code: 'PAYMENT_NOT_RETURNABLE', message: 'only settled payments can return', decision: null };
    }
    const authority = this.authorities.get(paymentId);
    const account = this.catalog.accounts.get(payment.sourceAccountId);
    if (!authority || !account) {
      return { outcome: 'REJECTED', code: 'MISSING_AUTHORITY', message: 'cannot return without stored authority', decision: null };
    }
    const journals = this.postPlans(authority, 'INITIATE_PAYMENT', [
      returnDestinationSettlePlan(payment.quotedDestinationAmount),
      returnDestinationFxPlan(payment.quotedDestinationAmount),
      returnSourceFxPlan(payment.sourceAmount),
      returnPrincipalPlan(account.id, payment.sourceAmount),
    ]);
    const returned = this.mustTransition(payment, 'RETURNED', {
      journalIds: [...payment.journalIds, ...journals.map((j) => j.id)],
    });
    this.store.savePayment(returned);
    const submission = this.railNetwork.store.getByPayment(paymentId);
    this.railNetwork.store.saveReturn(
      freezeReturn({
        paymentId,
        originalSubmissionId: submission?.railSubmissionId ?? (`rsub_${paymentId}` as never),
        reason: 'PROVIDER_UNSPECIFIED',
        amount: payment.quotedDestinationAmount,
        references: submission?.references ?? emptyRailReferences(),
        occurredAt: this.clock.now(),
      }),
    );
    this.evidence.seal('PAYMENT_RETURNED', {
      paymentId,
      policy: SIMULATION_RETURN_POLICY,
      journalIds: returned.journalIds,
    });
    this.emit('PaymentReturned', 'payment', paymentId, payment.paymentId, this.emptyDecision('INITIATE_PAYMENT', payment.paymentId), {
      paymentId,
      policy: SIMULATION_RETURN_POLICY,
    });
    this.emit('RailPaymentReturned', 'rail', paymentId, payment.paymentId, this.emptyDecision('INITIATE_PAYMENT', payment.paymentId), {
      paymentId,
      policy: SIMULATION_RETURN_POLICY,
    });
    this.railNetwork.metrics.recordReturned();
    return { outcome: 'OK', value: returned, decision: this.emptyDecision('INITIATE_PAYMENT', payment.paymentId) };
  }

  injectMismatchedReport(paymentId: string, report: ProviderSettlementReport): ReconciliationResult {
    const payment = this.store.getPayment(paymentId);
    if (!payment) {
      throw new Error('payment not found');
    }
    const result = reconcilePayment(payment, this.ledger.listJournals(), report);
    this.store.saveReconciliation(result);
    return result;
  }

  retryUnknownSubmission(paymentId: PaymentId): PaymentsServiceOutcome<PaymentOrder> {
    const payment = this.store.getPayment(paymentId);
    if (!payment) {
      return { outcome: 'REJECTED', code: 'PAYMENT_NOT_FOUND', message: 'payment does not exist', decision: null };
    }
    const submission = this.railNetwork.store.getByPayment(paymentId);
    const decision = decideRetry('SUBMIT', submission?.status ?? null, {
      executionUnknown: payment.status === 'SUBMISSION_UNKNOWN' || submission?.executionUnknown === true,
    });
    if (!decision.allowed) {
      return {
        outcome: 'REJECTED',
        code: 'DO_NOT_RETRY_WITHOUT_QUERY',
        message: decision.reason,
        decision: null,
      };
    }
    return { outcome: 'REJECTED', code: 'RETRY_NOT_REQUIRED', message: 'submission is safe only after query', decision: null };
  }

  queryUnknownSubmission(paymentId: PaymentId): PaymentsServiceOutcome<PaymentOrder> {
    const payment = this.store.getPayment(paymentId);
    if (!payment) {
      return { outcome: 'REJECTED', code: 'PAYMENT_NOT_FOUND', message: 'payment does not exist', decision: null };
    }
    const submission = this.railNetwork.store.getByPayment(paymentId);
    if (!submission) {
      return { outcome: 'REJECTED', code: 'SUBMISSION_NOT_FOUND', message: 'no rail submission to query', decision: null };
    }
    const queried = this.railNetwork.query({
      paymentId,
      idempotencyKey: submission.idempotencyKey,
      providerPaymentId: submission.references.providerPaymentId,
    });
    if (!queried.found) {
      return { outcome: 'OK', value: payment, decision: this.emptyDecision('INITIATE_PAYMENT', payment.paymentId) };
    }
    if (queried.status === 'SETTLED' || queried.status === 'PENDING' || queried.status === 'PROCESSING' || queried.status === 'ACCEPTED') {
      return this.completeSettlement(paymentId);
    }
    if (queried.status === 'REJECTED') {
      const authority = this.authorities.get(paymentId);
      const account = this.catalog.accounts.get(payment.sourceAccountId);
      if (!authority || !account) {
        return { outcome: 'REJECTED', code: 'MISSING_AUTHORITY', message: 'cannot fail without stored authority', decision: null };
      }
      const failed = this.releaseAndFail(payment, authority, account, 'provider_rejection_after_query', this.emptyDecision('INITIATE_PAYMENT', payment.paymentId));
      void failed;
      return { outcome: 'REJECTED', code: 'PROVIDER_REJECTION', message: 'provider rejected after query', decision: null };
    }
    return { outcome: 'OK', value: payment, decision: this.emptyDecision('INITIATE_PAYMENT', payment.paymentId) };
  }

  applyProviderCallback(callback: IncomingProviderCallback): PaymentsServiceOutcome<PaymentOrder> {
    const ingested = this.railNetwork.callbacks.ingest(callback);
    if (ingested.outcome !== 'ACCEPTED') {
      return { outcome: 'REJECTED', code: ingested.code, message: ingested.message, decision: null };
    }
    if (ingested.duplicate) {
      const existing = this.store.getPayment(ingested.update.paymentId);
      if (!existing) {
        return { outcome: 'REJECTED', code: 'PAYMENT_NOT_FOUND', message: 'payment does not exist', decision: null };
      }
      return { outcome: 'OK', value: existing, decision: this.emptyDecision('INITIATE_PAYMENT', existing.paymentId), replay: true };
    }
    const payment = this.store.getPayment(ingested.update.paymentId);
    if (!payment) {
      return { outcome: 'REJECTED', code: 'PAYMENT_NOT_FOUND', message: 'payment does not exist', decision: null };
    }
    if (ingested.update.status === 'SETTLED' || ingested.update.status === 'PROCESSING' || ingested.update.status === 'ACCEPTED') {
      if (payment.status === 'PROCESSING' || payment.status === 'SUBMISSION_UNKNOWN' || payment.status === 'SUBMITTED') {
        return this.completeSettlement(payment.paymentId);
      }
    }
    if (ingested.update.status === 'RETURNED' && payment.status === 'SETTLED') {
      return this.simulateReturn(payment.paymentId);
    }
    return { outcome: 'OK', value: payment, decision: this.emptyDecision('INITIATE_PAYMENT', payment.paymentId) };
  }

  reconcileAgainstRail(paymentId: string, report: ProviderSettlementReport | null = null): ReturnType<typeof reconcileRail> {
    const payment = this.store.getPayment(paymentId) ?? null;
    const submission = this.railNetwork.store.getByPayment(paymentId) ?? null;
    const result = reconcileRail(payment, submission, this.ledger.listJournals(), report);
    this.railNetwork.store.saveReconciliation(result);
    if (result.status !== 'MATCHED' && result.status !== 'PENDING') {
      this.railNetwork.metrics.recordReconciliationMismatch();
      this.emit('RailReconciliationMismatch', 'rail', paymentId, paymentId, this.emptyDecision('INITIATE_PAYMENT', paymentId), {
        paymentId,
        status: result.status,
        mismatches: result.mismatches,
      });
    }
    return result;
  }

  acceptInboundPayment(intent: AcceptInboundPaymentIntent): PaymentsServiceOutcome<InboundRailPayment> {
    const existing = this.railNetwork.store.getInbound(intent.payload.inboundId);
    if (existing && existing.status === 'SETTLED') {
      return this.replayOk(existing, intent.actionType, intent.id);
    }
    const account = this.catalog.accounts.get(intent.payload.accountId);
    const customer = account ? this.catalog.customers.get(account.ownerId) : undefined;
    const hit = this.screening.screen({
      legalName: intent.payload.sourceDisplayName,
      destinationCountry: account?.jurisdiction ?? '',
      coordinateRef: intent.payload.destinationReference,
      kind: 'PERSON',
    });
    const gated = this.gate(intent, account, customer, {
      screening: {
        sanctionsHit: hit.sanctionsHit,
        pepHit: hit.pepHit,
        fraudHold: hit.fraudHold,
        screeningRef: hit.screeningRef,
      },
      amount: intent.payload.amount,
    });
    if (gated.outcome !== 'ALLOWED') {
      return gated.result;
    }
    if (!account || account.status !== 'OPEN') {
      return this.reject(intent.actionType, intent.id, gated.decision, 'ACCOUNT_NOT_OPEN', 'inbound destination is not an open account');
    }
    if (hit.sanctionsHit) {
      return this.reject(intent.actionType, intent.id, gated.decision, 'SANCTIONED_COUNTERPARTY', 'inbound source failed screening');
    }
    const pending = freezeInbound({
      inboundId: asInboundPaymentId(intent.payload.inboundId),
      provider: asProviderId(intent.payload.provider),
      rail: intent.payload.rail as RailClass,
      amount: intent.payload.amount,
      currency: asCurrencyCode(intent.payload.amount.currency),
      destinationAccountId: account.id,
      destinationCustomerId: customer?.id ?? null,
      destinationReference: asOpaqueAccountRef(intent.payload.destinationReference),
      sourceReference: asOpaqueAccountRef(intent.payload.sourceReference),
      purposeReference: intent.payload.purposeReference,
      references: emptyRailReferences(),
      status: 'PENDING_SETTLEMENT',
      screeningRef: hit.screeningRef,
      journalIds: [],
      receivedAt: this.clock.now(),
      payloadHash: hashCallbackBody(intent.payload.inboundId),
    });
    const journals = this.postPlans(gated.authority!, intent.actionType, [
      inboundPendingPlan(intent.payload.amount),
      inboundSettlePlan(account.id, intent.payload.amount),
    ]);
    const settled = freezeInbound({
      ...pending,
      status: 'SETTLED',
      journalIds: journals.map((row) => row.id),
    });
    this.railNetwork.store.saveInbound(settled);
    this.evidence.seal('INBOUND_PAYMENT_SETTLED', {
      inboundId: settled.inboundId,
      accountId: account.id,
      authorityId: gated.authority!.authorityId,
      journalIds: settled.journalIds,
      provider: settled.provider,
      rail: settled.rail,
    });
    this.emit('RailPaymentSettled', 'rail', settled.inboundId, intent.id, gated.decision, {
      inboundId: settled.inboundId,
      paymentId: settled.inboundId,
      direction: 'INBOUND',
    });
    return { outcome: 'OK', value: settled, decision: gated.decision };
  }

  signProviderCallback(callback: Omit<IncomingProviderCallback, 'signature'>): IncomingProviderCallback {
    return this.railNetwork.signCallback(callback);
  }

  private applySettlement(
    payment: PaymentOrder,
    authority: ExecutionAuthority,
    account: Account,
    quote: FxQuote,
    settlement: SettlementOutcome,
    decision: AuthorizationDecision,
    route: PaymentRoute | null,
  ): PaymentsServiceOutcome<PaymentOrder> {
    if (settlement.kind === 'FAIL_BEFORE_SUBMIT') {
      const failed = this.releaseAndFail(payment, authority, account, settlement.reason, decision);
      this.emit('RailPaymentRejected', 'rail', failed.paymentId, decision.intentId, decision, {
        paymentId: failed.paymentId,
        rejectionClass: 'PRE_SUBMISSION_REJECTION',
      });
      return { outcome: 'REJECTED', code: 'SETTLEMENT_FAILED', message: settlement.reason, decision };
    }
    if (settlement.kind === 'FAIL_AFTER_SUBMIT') {
      const failed = this.releaseAndFail(payment, authority, account, settlement.reason, decision);
      this.emit('PaymentFailed', 'payment', failed.paymentId, decision.intentId, decision, {
        paymentId: failed.paymentId,
        reason: settlement.reason,
        phase: 'AFTER_SUBMIT',
      });
      this.emit('RailPaymentRejected', 'rail', failed.paymentId, decision.intentId, decision, {
        paymentId: failed.paymentId,
        rejectionClass: 'PROVIDER_REJECTION',
      });
      return { outcome: 'REJECTED', code: 'SETTLEMENT_FAILED', message: settlement.reason, decision };
    }
    if (settlement.kind === 'SUBMISSION_UNKNOWN') {
      this.treasury?.onSubmissionUnknown(payment.paymentId);
      const unknown = this.mustTransition(payment, 'SUBMISSION_UNKNOWN', { settlementRef: settlement.settlementRef });
      this.store.savePayment(unknown);
      const existing = this.railNetwork.store.getByPayment(unknown.paymentId);
      if (existing) {
        this.railNetwork.store.saveSubmission(withSubmissionStatus(existing, 'SUBMISSION_UNKNOWN', { executionUnknown: true }));
      }
      this.emit('RailSubmissionUnknown', 'rail', unknown.paymentId, decision.intentId, decision, {
        paymentId: unknown.paymentId,
        settlementRef: unknown.settlementRef,
      });
      this.evidence.seal('RAIL_SUBMISSION_UNKNOWN', {
        paymentId: unknown.paymentId,
        routeId: unknown.routeId,
        provider: route?.provider ?? null,
        authorityId: authority.authorityId,
        settlementRef: unknown.settlementRef,
      });
      this.railNetwork.metrics.recordUnknown();
      return { outcome: 'OK', value: unknown, decision };
    }
    if (settlement.kind === 'PENDING') {
      const pending = this.mustTransition(payment, 'PROCESSING', { settlementRef: settlement.settlementRef });
      this.store.savePayment(pending);
      const existing = this.railNetwork.store.getByPayment(pending.paymentId);
      if (existing) {
        this.railNetwork.store.saveSubmission(withSubmissionStatus(existing, 'PENDING', {
          references: { ...existing.references, settlementReference: settlement.settlementRef as never },
        }));
      }
      this.emit('RailPaymentProcessing', 'rail', pending.paymentId, decision.intentId, decision, {
        paymentId: pending.paymentId,
        settlementRef: pending.settlementRef,
      });
      return { outcome: 'OK', value: pending, decision };
    }
    const journals = this.postPlans(authority, 'INITIATE_PAYMENT', [
      capturePrincipalPlan(quote.sourceAmount),
      captureFeePlan(quote.fee),
      feeIncomePlan(quote.fee),
      sourceFxPlan(quote.sourceAmount),
      destinationFxPlan(quote.destinationAmount),
      settlePlan(quote.destinationAmount),
    ]);
    const settled = this.mustTransition(payment, settlement.kind === 'RETURNED' ? 'SETTLED' : 'SETTLED', {
      settlementRef: settlement.settlementRef,
      journalIds: [...payment.journalIds, ...journals.map((j) => j.id)],
      routeId: route?.routeId ?? payment.routeId,
    });
    this.store.savePayment(settled);
    const report: ProviderSettlementReport = {
      paymentId: settled.paymentId,
      settlementRef: settlement.settlementRef,
      destinationAmountMinorUnits:
        settlement.kind === 'SUCCESS' || settlement.kind === 'RETURNED'
          ? settlement.providerAmountMinorUnits
          : settled.quotedDestinationAmount.minorUnits.toString(),
      destinationCurrency: settled.destinationCurrency,
      sourceAmountMinorUnits: settled.sourceAmount.minorUnits.toString(),
      sourceCurrency: settled.sourceCurrency,
    };
    const recon = reconcilePayment(settled, this.ledger.listJournals(), report);
    this.store.saveReconciliation(recon);
    this.emit('PaymentSettled', 'payment', settled.paymentId, decision.intentId, decision, {
      paymentId: settled.paymentId,
      settlementRef: settled.settlementRef,
      destinationMinorUnits: settled.quotedDestinationAmount.minorUnits.toString(),
      reconciliation: recon.status,
    });
    this.evidence.seal('PAYMENT_SETTLED', {
      intentId: decision.intentId,
      paymentId: settled.paymentId,
      quoteId: settled.quoteId,
      routeId: settled.routeId,
      provider: route?.provider ?? null,
      rail: route?.rail ?? null,
      authorityId: authority.authorityId,
      journalIds: settled.journalIds,
      settlementRef: settled.settlementRef,
      reconciliation: recon.status,
    });
    this.emit('RailPaymentSettled', 'rail', settled.paymentId, decision.intentId, decision, {
      paymentId: settled.paymentId,
      settlementRef: settled.settlementRef,
      reconciliation: recon.status,
    });
    const existing = this.railNetwork.store.getByPayment(settled.paymentId);
    if (existing) {
      this.railNetwork.store.saveSubmission(withSubmissionStatus(existing, 'SETTLED', {
        references: { ...existing.references, settlementReference: settled.settlementRef as never },
      }));
    }
    const settlementReport = buildSettlementReport({
      provider: route?.provider ?? existing?.provider ?? 'SIMULATED_PROVIDER_GCC',
      settledAt: this.clock.now(),
      currency: settled.destinationCurrency,
      payments: [
        {
          paymentId: settled.paymentId,
          settlementReference: settled.settlementRef as never,
          amount: settled.quotedDestinationAmount,
          fee: Money.zero(settled.destinationCurrency),
        },
      ],
    });
    this.railNetwork.store.saveReport(settlementReport);
    this.treasury?.onPaymentSettled(settled.paymentId, authority);
    if (settlement.kind === 'RETURNED') {
      return this.simulateReturn(settled.paymentId);
    }
    return { outcome: 'OK', value: settled, decision };
  }

  private reserve(
    payment: PaymentOrder,
    authority: ExecutionAuthority,
    account: Account,
  ): PaymentsServiceOutcome<PaymentOrder> {
    const journal = postPaymentJournal(
      this.ledger,
      authority,
      'INITIATE_PAYMENT',
      reservePlan(account.id, payment.amountDebited),
    );
    const reserved = this.mustTransition(payment, 'FUNDS_RESERVED', {
      holdId: asHoldId(`hold_${payment.paymentId}`),
      journalIds: [...payment.journalIds, journal.id],
    });
    this.store.savePayment(reserved);
    this.emit('PaymentHeld', 'payment', reserved.paymentId, authority.intentId, this.emptyDecision('INITIATE_PAYMENT', authority.intentId), {
      paymentId: reserved.paymentId,
      holdId: reserved.holdId,
      phase: 'FUNDS_RESERVED',
    });
    return { outcome: 'OK', value: reserved, decision: this.emptyDecision('INITIATE_PAYMENT', authority.intentId) };
  }

  private releaseAndFail(
    payment: PaymentOrder,
    authority: ExecutionAuthority,
    account: Account,
    reason: string,
    decision: AuthorizationDecision,
  ): PaymentOrder {
    const journal = postPaymentJournal(
      this.ledger,
      authority,
      'INITIATE_PAYMENT',
      releasePlan(account.id, payment.amountDebited),
    );
    const failed = this.mustTransition(payment, 'FAILED', {
      journalIds: [...payment.journalIds, journal.id],
      holdId: null,
    });
    this.store.savePayment(failed);
    this.treasury?.onPaymentFailed(failed.paymentId, authority, reason);
    this.emit('PaymentFailed', 'payment', failed.paymentId, decision.intentId, decision, {
      paymentId: failed.paymentId,
      reason,
    });
    return failed;
  }

  private postPlans(
    authority: ExecutionAuthority,
    actionType: string,
    plans: readonly PaymentJournalPlan[],
  ): Journal[] {
    return plans.map((plan) => postPaymentJournal(this.ledger, authority, actionType, plan));
  }

  private revalidateBeforeSubmit(
    intent: InitiatePaymentIntent,
    account: Account | undefined,
    customer: Customer | undefined,
    beneficiary: Beneficiary | undefined,
    quote: FxQuote | undefined,
    corridor: PaymentCorridor | undefined,
    sanctionsHit: boolean,
    options: { readonly fundsAlreadyReserved?: boolean } = {},
  ): { code: string; message: string } | null {
    return this.precheckInitiate(intent, account, customer, beneficiary, quote, corridor, sanctionsHit, options);
  }

  private precheckInitiate(
    intent: InitiatePaymentIntent,
    account: Account | undefined,
    customer: Customer | undefined,
    beneficiary: Beneficiary | undefined,
    quote: FxQuote | undefined,
    corridor: PaymentCorridor | undefined,
    sanctionsHit: boolean,
    options: { readonly fundsAlreadyReserved?: boolean } = {},
  ): { code: string; message: string } | null {
    if (!account) {
      return { code: 'ACCOUNT_NOT_FOUND', message: 'source account does not exist' };
    }
    if (account.status === 'FROZEN') {
      return { code: 'ACCOUNT_FROZEN', message: 'source account is frozen' };
    }
    if (account.status !== 'OPEN') {
      return { code: 'ACCOUNT_NOT_OPEN', message: 'source account is not OPEN' };
    }
    if (!customer) {
      return { code: 'CUSTOMER_NOT_FOUND', message: 'customer does not exist' };
    }
    if (!beneficiary) {
      return { code: 'BENEFICIARY_NOT_FOUND', message: 'beneficiary does not exist' };
    }
    if (beneficiary.ownerId !== customer.id) {
      return { code: 'BENEFICIARY_OWNERSHIP_MISMATCH', message: 'beneficiary is not owned by this customer' };
    }
    if (!isUsableBeneficiary(beneficiary)) {
      return { code: 'BENEFICIARY_NOT_USABLE', message: `beneficiary status ${beneficiary.status} is not usable` };
    }
    if (sanctionsHit) {
      return { code: 'SANCTIONED_BENEFICIARY', message: 'beneficiary screening is sanctioned' };
    }
    if (!quote) {
      return { code: 'QUOTE_NOT_FOUND', message: 'quote does not exist' };
    }
    if (quoteIsExpired(quote, this.clock.now()) || !quoteCanExecute(quote, this.clock.now())) {
      return { code: 'QUOTE_EXPIRED', message: 'expired or unaccepted quote cannot execute' };
    }
    if (!quote.sourceAmount.equals(intent.payload.sourceAmount)) {
      return { code: 'QUOTE_AMOUNT_MISMATCH', message: 'payment amount does not match accepted quote' };
    }
    if (!corridor || !corridorIsSimulationEnabled(corridor)) {
      return { code: 'UNSUPPORTED_CORRIDOR', message: 'corridor is not simulation-enabled' };
    }
    if (account.currency !== quote.baseCurrency) {
      return { code: 'UNSUPPORTED_CURRENCY', message: 'source account currency does not match quote' };
    }
    if (!options.fundsAlreadyReserved) {
      const available = this.availableFunds(account);
      if (available.cmp(quote.amountDebited) < 0) {
        return { code: 'INSUFFICIENT_FUNDS', message: 'available funds are below amount debited' };
      }
    }
    return null;
  }

  private availableFunds(account: Account): Money {
    const postings = this.ledger.listPostingsForAccount(account.id);
    let credits = Money.zero(account.currency);
    let debits = Money.zero(account.currency);
    for (const posting of postings) {
      if (posting.amount.currency !== account.currency) {
        continue;
      }
      if (posting.direction === 'CREDIT') {
        credits = credits.plus(posting.amount);
      } else {
        debits = debits.plus(posting.amount);
      }
    }
    return credits.minus(debits);
  }

  private draftPayment(
    intent: InitiatePaymentIntent,
    account: Account | undefined,
    customer: Customer | undefined,
    quote: FxQuote | undefined,
    corridor: PaymentCorridor | undefined,
    status: PaymentOrder['status'],
  ): PaymentOrder | null {
    if (!account || !customer || !quote || !corridor) {
      return null;
    }
    const now = this.clock.now();
    return freezePayment({
      paymentId: asPaymentId(intent.payload.paymentId),
      customerId: customer.id,
      sourceAccountId: account.id,
      beneficiaryId: intent.payload.beneficiaryId as PaymentOrder['beneficiaryId'],
      sourceCurrency: quote.baseCurrency,
      destinationCurrency: quote.quoteCurrency,
      sourceAmount: quote.sourceAmount,
      quotedDestinationAmount: quote.destinationAmount,
      fee: quote.fee,
      amountDebited: quote.amountDebited,
      quoteId: quote.quoteId,
      purposeReference: intent.payload.purposeReference,
      corridorId: corridor.corridorId,
      routeId: null,
      holdId: null,
      settlementRef: null,
      status,
      idempotencyKey: intent.idempotencyKey,
      createdAt: now,
      updatedAt: now,
      journalIds: [],
      evidenceIds: [],
    });
  }

  private mustTransition(
    payment: PaymentOrder,
    to: PaymentOrder['status'],
    patch: Parameters<typeof transitionPayment>[3],
  ): PaymentOrder {
    const next = transitionPayment(payment, to, this.clock.now(), patch);
    if (isErr(next)) {
      throw new Error(`${next.error.code}: ${next.error.from} -> ${next.error.to}`);
    }
    return next.value;
  }

  private gate(
    intent: CreateBeneficiaryIntent | CreateFxQuoteIntent | AcceptFxQuoteIntent | InitiatePaymentIntent | CancelPaymentIntent | AcceptInboundPaymentIntent,
    account: Account | undefined,
    customer: Customer | undefined,
    extra: Partial<KernelFacts> = {},
  ):
    | { readonly outcome: 'ALLOWED'; readonly decision: AuthorizationDecision; readonly authority: ExecutionAuthority }
    | { readonly outcome: 'REFUSED'; readonly result: PaymentsServiceOutcome<never> } {
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
      ...(account ? { sourceAccount: account, jurisdiction: account.jurisdiction } : customer ? { jurisdiction: customer.jurisdiction } : {}),
      ...(extra.amount ? { amount: extra.amount } : 'sourceAmount' in intent.payload && intent.payload.sourceAmount
        ? { amount: intent.payload.sourceAmount }
        : {}),
      ...(extra.screening ? { screening: extra.screening } : {}),
      ...(extra.corridorId ? { corridorId: extra.corridorId } : {}),
      ...(extra.corridorSimulationEnabled !== undefined
        ? { corridorSimulationEnabled: extra.corridorSimulationEnabled }
        : {}),
      ...(extra.beneficiaryStatus ? { beneficiaryStatus: extra.beneficiaryStatus } : {}),
    };
    const decision = this.kernel.submit(intent, facts);
    this.emit('KernelDecisionRecorded', 'kernel', intent.id, intent.id, decision, {
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
    if (isErr(structural)) {
      return {
        outcome: 'REFUSED',
        result: this.reject(intent.actionType, intent.id, decision, structural.error.code, structural.error.message),
      };
    }
    if (!decision.executionAuthority) {
      return {
        outcome: 'REFUSED',
        result: this.reject(intent.actionType, intent.id, decision, 'MISSING_EXECUTION_AUTHORITY', 'ALLOW without authority'),
      };
    }
    const verified = this.issuer.verify(
      decision.executionAuthority,
      {
        actionType: intent.actionType,
        accountId: 'accountId' in intent.payload ? intent.payload.accountId : intent.id,
        intentId: intent.id,
      },
      this.clock,
    );
    if (!isOk(verified)) {
      return {
        outcome: 'REFUSED',
        result: this.reject(intent.actionType, intent.id, decision, verified.error.code, verified.error.message),
      };
    }
    return { outcome: 'ALLOWED', decision, authority: verified.value };
  }

  private reject(
    actionType: string,
    intentId: string,
    decision: AuthorizationDecision | null,
    code: string,
    message: string,
  ): PaymentsServiceOutcome<never> {
    const evidence = this.evidence.seal(`${actionType}_REJECTED`, { intentId, code, message, posted: false });
    return { outcome: 'REJECTED', code, message, decision, evidenceId: evidence.evidenceId };
  }

  private replayOk<T>(value: T, actionType: string, intentId: string): PaymentsServiceOutcome<T> {
    this.evidence.seal(`${actionType}_IDEMPOTENT_REPLAY`, { intentId });
    return { outcome: 'OK', value, decision: this.emptyDecision(actionType, intentId), replay: true };
  }

  private emptyDecision(actionType: string, intentId: string): AuthorizationDecision {
    return {
      status: 'ALLOW',
      intentId,
      actionType,
      proofs: [],
      executionAuthority: null,
      evidenceRecordId: '',
      decidedAt: this.clock.now(),
    };
  }

  private emit(
    eventType: string,
    aggregateType: string,
    aggregateId: string,
    intentId: string,
    decision: AuthorizationDecision,
    payload: Record<string, unknown>,
  ): void {
    this.events.append({
      eventType: eventType as never,
      schemaVersion: 1,
      occurredAt: this.clock.now(),
      intentId,
      correlationId: intentId,
      causationId: decision.evidenceRecordId,
      evidenceId: decision.evidenceRecordId,
      aggregateType,
      aggregateId,
      payload,
    } as never);
  }
}
