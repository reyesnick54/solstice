import {
  asAccountId,
  asActionIntentId,
  asActorId,
  asCurrencyCode,
  asIdempotencyKey,
  asPaymentId,
  asUtcInstant,
  applyFxRate,
  createAccount,
  createProspect,
  err,
  freezeBeneficiary,
  formatRational,
  ok,
  type Account,
  type AccountId,
  type Actor,
  type Beneficiary,
  type BeneficiaryDraft,
  type CreateProspectInput,
  type Customer,
  type CustomerId,
  type IdempotencyKey,
  type Result,
  type UtcInstant,
  Money,
} from '@solstice/domain';
import {
  ComplianceKernel,
  freezeIntent as freezeKernelIntent,
  type ActionIntent as KernelIntent,
  type KernelAuthorization,
  type KernelDecision,
} from '@solstice/kernel';
import {
  commitJournal,
  JournalStore,
  LedgerBooks,
  type Journal,
  type PaymentRecord,
} from '@solstice/ledger';
import { compareQuotes, sourceAmountForDestination } from './fx/router.ts';
import { quoteAllSources, quoteFingerprint, type SimulatedFxQuote } from './fx/quotes.ts';
import { createSimulatedRails, type RailId } from './rails/index.ts';
import { routingFingerprint, scoreRoutes, type RoutingDecision } from './routing/engine.ts';
import type { RailInstruction } from './rails/types.ts';
import type { DomesticRail } from './rails/domestic.ts';
import type { SepaLikeRail } from './rails/sepa.ts';
import type { SwiftLikeRail } from './rails/swift.ts';
import type { InstantRail } from './rails/instant.ts';

export type SubmissionOk = {
  readonly decision: KernelDecision;
  readonly customer?: Customer;
  readonly account?: Account;
  readonly beneficiary?: Beneficiary;
  readonly payment?: PaymentRecord;
  readonly journals: readonly Journal[];
  readonly routing?: RoutingDecision;
  readonly quotes?: readonly SimulatedFxQuote[];
  readonly costAvoided?: Money;
};

export type SubmissionErr =
  | { readonly code: 'KERNEL_REFUSED'; readonly decision: KernelDecision }
  | { readonly code: 'KERNEL_ERROR'; readonly message: string }
  | { readonly code: 'NOT_FOUND'; readonly what: string }
  | { readonly code: 'NO_ROUTE' }
  | { readonly code: 'UNBALANCED' }
  | { readonly code: 'INSUFFICIENT_FUNDS' }
  | { readonly code: 'IDEMPOTENT_REPLAY'; readonly payment: PaymentRecord };

export class SolsticeSystem {
  readonly kernel = new ComplianceKernel();
  readonly books = new LedgerBooks(new JournalStore());
  readonly rails = createSimulatedRails();
  readonly fxSeed: string;
  readonly now: UtcInstant;
  #seq = 0;

  constructor(fxSeed = 'solstice-sim-seed-v1', now = asUtcInstant('2026-08-13T15:00:00.000Z')) {
    this.fxSeed = fxSeed;
    this.now = now;
  }

  nextId(prefix: string): string {
    this.#seq += 1;
    return `${prefix}_${this.#seq.toString().padStart(4, '0')}`;
  }

  houseAccount(currency: string, kind: 'nostro' | 'rail', railId?: RailId): AccountId {
    if (kind === 'nostro') {
      return asAccountId(`house_${currency}_nostro`);
    }
    return asAccountId(`house_${railId}_${currency}`);
  }

  bootstrap(): void {
    const currencies = ['USD', 'EUR', 'GBP'] as const;
    const railIds: RailId[] = ['domestic', 'sepa_like', 'swift_like', 'instant'];
    const actor: Actor = { type: 'SYSTEM', id: asActorId('system') };
    for (const currency of currencies) {
      const nostro = this.openAccount({
        accountId: this.houseAccount(currency, 'nostro'),
        ownerCustomerId: 'HOUSE',
        currency,
        accountClass: 'house_nostro',
        actor,
      });
      if (!nostro.ok) {
        throw new Error(`bootstrap nostro ${currency} failed`);
      }
      for (const railId of railIds) {
        const rail = this.openAccount({
          accountId: this.houseAccount(currency, 'rail', railId),
          ownerCustomerId: 'HOUSE',
          currency,
          accountClass: 'rail_clearing',
          actor,
        });
        if (!rail.ok) {
          throw new Error(`bootstrap rail ${railId} ${currency} failed`);
        }
      }
    }
  }

  createCustomer(input: CreateProspectInput, actor: Actor): Result<SubmissionOk, SubmissionErr> {
    const intent = freezeKernelIntent({
      id: asActionIntentId(this.nextId('int')),
      kind: 'CREATE_CUSTOMER',
      actor,
      payload: input,
      idempotencyKey: asIdempotencyKey(`cust_${input.id}`),
      occurredAt: this.now,
      sourceJurisdiction: input.jurisdiction,
    });
    const evaluated = this.kernel.evaluate(intent);
    if (!evaluated.ok) {
      return err({ code: 'KERNEL_ERROR', message: evaluated.error.message });
    }
    if (evaluated.value.outcome !== 'AUTHORIZED') {
      return err({ code: 'KERNEL_REFUSED', decision: evaluated.value });
    }
    const customer = this.books.putCustomer(evaluated.value.authorization, createProspect(input));
    return ok({ decision: evaluated.value, customer, journals: [] });
  }

  openAccount(input: {
    accountId: AccountId;
    ownerCustomerId: CustomerId | 'HOUSE';
    currency: string;
    accountClass: string;
    actor: Actor;
  }): Result<SubmissionOk, SubmissionErr> {
    const intent = freezeKernelIntent({
      id: asActionIntentId(this.nextId('int')),
      kind: 'OPEN_ACCOUNT',
      actor: input.actor,
      payload: {
        accountId: input.accountId,
        ownerCustomerId: input.ownerCustomerId,
        currency: input.currency,
        accountClass: input.accountClass,
      },
      idempotencyKey: asIdempotencyKey(`acct_${input.accountId}`),
      occurredAt: this.now,
      sourceJurisdiction: 'US',
    });
    const evaluated = this.kernel.evaluate(intent);
    if (!evaluated.ok) return err({ code: 'KERNEL_ERROR', message: evaluated.error.message });
    if (evaluated.value.outcome !== 'AUTHORIZED') {
      return err({ code: 'KERNEL_REFUSED', decision: evaluated.value });
    }
    const account = this.books.putAccount(
      evaluated.value.authorization,
      createAccount({
        id: input.accountId,
        ownerCustomerId: input.ownerCustomerId,
        accountClass: input.accountClass as Account['accountClass'],
        currency: asCurrencyCode(input.currency),
        openedAt: this.now,
      }),
    );
    return ok({ decision: evaluated.value, account, journals: [] });
  }

  seedCredit(accountId: AccountId, amount: Money, actor: Actor): Result<SubmissionOk, SubmissionErr> {
    const intent = freezeKernelIntent({
      id: asActionIntentId(this.nextId('int')),
      kind: 'SEED_CREDIT',
      actor,
      payload: { accountId, amount, memo: 'simulation seed' },
      idempotencyKey: asIdempotencyKey(`seed_${accountId}_${amount.minorUnits}`),
      occurredAt: this.now,
      sourceJurisdiction: 'US',
    });
    const evaluated = this.kernel.evaluate(intent);
    if (!evaluated.ok) return err({ code: 'KERNEL_ERROR', message: evaluated.error.message });
    if (evaluated.value.outcome !== 'AUTHORIZED') {
      return err({ code: 'KERNEL_REFUSED', decision: evaluated.value });
    }
    const house = this.houseAccount(amount.currency, 'nostro');
    const posted = commitJournal(this.books.journals, evaluated.value.authorization, {
      intentId: intent.id,
      memo: 'simulation seed',
      postedAt: this.now,
      lines: [
        { accountId, direction: 'DEBIT', amount },
        { accountId: house, direction: 'CREDIT', amount },
      ],
    });
    if (!posted.ok) return err({ code: 'UNBALANCED' });
    return ok({ decision: evaluated.value, journals: [posted.value] });
  }

  addBeneficiary(draft: BeneficiaryDraft, actor: Actor): Result<SubmissionOk, SubmissionErr> {
    const intent = freezeKernelIntent({
      id: asActionIntentId(this.nextId('int')),
      kind: 'ADD_BENEFICIARY',
      actor,
      payload: draft,
      idempotencyKey: asIdempotencyKey(`ben_${draft.id}`),
      occurredAt: this.now,
      sourceJurisdiction: 'US',
      destinationJurisdiction: draft.country,
    });
    const evaluated = this.kernel.evaluate(intent);
    if (!evaluated.ok) return err({ code: 'KERNEL_ERROR', message: evaluated.error.message });
    if (evaluated.value.outcome !== 'AUTHORIZED') {
      return err({ code: 'KERNEL_REFUSED', decision: evaluated.value });
    }
    const beneficiary = this.books.putBeneficiary(
      evaluated.value.authorization,
      freezeBeneficiary({
        ...draft,
        currency: asCurrencyCode(String(draft.currency)),
        verificationState: 'VERIFIED',
        version: 0,
        createdAt: this.now,
        updatedAt: this.now,
      }),
    );
    return ok({ decision: evaluated.value, beneficiary, journals: [] });
  }

  sendPayment(input: {
    readonly customerId: CustomerId;
    readonly beneficiaryId: Beneficiary['id'];
    readonly instructedAmount: Money;
    readonly instructedSide: 'SOURCE' | 'DESTINATION';
    readonly purpose: string;
    readonly idempotencyKey: IdempotencyKey;
    readonly actor: Actor;
    readonly screeningOverride?: {
      readonly senderName?: string;
      readonly receiverName?: string;
      readonly beneficialOwnerName?: string;
      readonly destinationCountry?: string;
    };
    readonly failSettlement?: boolean;
  }): Result<SubmissionOk, SubmissionErr> {
    const existing = this.books.findPaymentByIdempotency(input.idempotencyKey);
    if (existing) {
      return err({ code: 'IDEMPOTENT_REPLAY', payment: existing });
    }

    const customer = this.books.getCustomer(input.customerId);
    if (!customer) return err({ code: 'NOT_FOUND', what: 'customer' });
    const beneficiary = this.books.getBeneficiary(input.beneficiaryId);
    if (!beneficiary) return err({ code: 'NOT_FOUND', what: 'beneficiary' });

    const destCurrency = beneficiary.currency;
    const sourceAccount = this.books
      .listAccountsForCustomer(input.customerId)
      .find((account) => account.accountClass === 'deposits' && account.currency === 'USD')
      ?? this.books.listAccountsForCustomer(input.customerId).find((account) => account.accountClass === 'deposits');
    if (!sourceAccount) return err({ code: 'NOT_FOUND', what: 'source account' });

    const destAccount =
      this.books
        .listAccountsForCustomer(input.customerId)
        .find((account) => account.accountClass === 'deposits' && account.currency === destCurrency) ?? sourceAccount;

    const screening = {
      senderName: input.screeningOverride?.senderName ?? `customer:${customer.id}`,
      receiverName: input.screeningOverride?.receiverName ?? beneficiary.name,
      beneficialOwnerName: input.screeningOverride?.beneficialOwnerName ?? beneficiary.name,
      destinationCountry: input.screeningOverride?.destinationCountry ?? beneficiary.country,
    };

    const intent = freezeKernelIntent({
      id: asActionIntentId(this.nextId('int')),
      kind: 'SEND_PAYMENT',
      actor: input.actor,
      payload: {
        sourceCustomerId: input.customerId,
        beneficiaryId: input.beneficiaryId,
        instructedAmount: input.instructedAmount,
        instructedSide: input.instructedSide,
        purpose: input.purpose,
        screening,
      },
      idempotencyKey: input.idempotencyKey,
      occurredAt: this.now,
      sourceJurisdiction: customer.jurisdiction,
      destinationJurisdiction: beneficiary.country,
    });

    const evaluated = this.kernel.evaluate(intent);
    if (!evaluated.ok) return err({ code: 'KERNEL_ERROR', message: evaluated.error.message });
    if (evaluated.value.outcome !== 'SCREENED') {
      return err({ code: 'KERNEL_REFUSED', decision: evaluated.value });
    }

    const sameCurrency = sourceAccount.currency === destCurrency;
    const quotes = sameCurrency
      ? []
      : quoteAllSources(
          { from: sourceAccount.currency, to: destCurrency },
          this.fxSeed,
          this.now,
        );
    const compared = sameCurrency ? [] : compareQuotes(Money.fromDecimalString('100.00', sourceAccount.currency), quotes);
    const bestFx = compared[0]?.quote;

    let destinationAmount: Money;
    let sourceAmount: Money;
    if (input.instructedSide === 'DESTINATION') {
      destinationAmount = input.instructedAmount;
      sourceAmount = sameCurrency
        ? destinationAmount
        : sourceAmountForDestination(destinationAmount, bestFx ?? { from: sourceAccount.currency, to: destCurrency, rate: { numerator: 1n, denominator: 1n } });
    } else {
      sourceAmount = input.instructedAmount;
      destinationAmount = sameCurrency
        ? sourceAmount
        : applyQuote(sourceAmount, bestFx);
    }

    const railInstruction: RailInstruction = {
      paymentId: `pay_${intent.id}`,
      sourceCountry: customer.jurisdiction,
      destinationCountry: beneficiary.country,
      currency: destCurrency,
      amount: destinationAmount,
      debtorName: screening.senderName,
      creditorName: beneficiary.name,
      ...(beneficiary.institution.iban === undefined
        ? {}
        : { creditorIban: beneficiary.institution.iban }),
      ...(beneficiary.institution.bic === undefined
        ? {}
        : { creditorBic: beneficiary.institution.bic }),
    };

    const routing = scoreRoutes({
      rails: Object.values(this.rails),
      instruction: railInstruction,
      sourceCurrency: sourceAccount.currency,
      fxQuote: bestFx,
      fxQuotes: quotes,
      corridorPermitted: true,
    });

    if (!routing.chosen) {
      this.kernel.vault.seal(
        { kind: 'payment.no_route', intentId: intent.id, routing },
        this.now,
      );
      return err({ code: 'NO_ROUTE' });
    }

    const execution = this.kernel.grantExecutionAuthority(intent, evaluated.value, {
      routeFingerprint: routingFingerprint(routing),
      quoteFingerprint: quotes.length === 0 ? 'same-currency' : quoteFingerprint(quotes),
    });
    if (!execution.ok || !('outcome' in execution.value) || execution.value.outcome !== 'AUTHORIZED') {
      return err({ code: 'KERNEL_ERROR', message: 'execution authority refused' });
    }
    const auth = execution.value.authorization;

    const position = this.books.positionForAccount(sourceAccount.id);
    if (!position.ok || position.value.minorUnits < sourceAmount.minorUnits) {
      return err({ code: 'INSUFFICIENT_FUNDS' });
    }

    const paymentId = `pay_${intent.id}`;
    let payment = this.books.putPayment(auth, {
      id: paymentId,
      intentId: intent.id,
      customerId: input.customerId,
      beneficiaryId: input.beneficiaryId,
      state: 'INITIATED',
      version: 0,
      instructedAmount: input.instructedAmount,
      sourceAmount,
      destinationAmount,
      railId: routing.chosen.railId,
      routeId: routing.chosen.railId,
      idempotencyKey: input.idempotencyKey,
      events: [
        {
          version: 0,
          from: 'NONE',
          to: 'INITIATED',
          at: this.now,
          evidenceId: evaluated.value.evidence.id,
        },
      ],
    });

    const screenEv = this.kernel.vault.seal({ kind: 'payment.screening', paymentId, posture: evaluated.value.posture }, this.now);
    const screened = this.books.transitionPayment(auth, payment.id, 'SCREENING', this.now, screenEv.id);
    if (!screened.ok) return err({ code: 'KERNEL_ERROR', message: 'illegal payment transition' });
    payment = screened.value;

    const routeEv = this.kernel.vault.seal(
      { kind: 'payment.routed', paymentId, routing, chosen: routing.chosen.railId },
      this.now,
    );
    const routed = this.books.transitionPayment(auth, payment.id, 'ROUTED', this.now, routeEv.id);
    if (!routed.ok) return err({ code: 'KERNEL_ERROR', message: 'illegal payment transition' });
    payment = routed.value;

    const journals: Journal[] = [];
    const fxFee = bestFx?.fee ?? Money.zero(sourceAccount.currency);
    const railFeeSource = routing.chosen.totalFeeSource.subtract(fxFee);

    if (!sameCurrency && bestFx) {
      const fxPosted = commitJournal(this.books.journals, auth, {
        intentId: intent.id,
        memo: `FX ${sourceAccount.currency}→${destCurrency} at ${formatRational(bestFx.rate)}`,
        postedAt: this.now,
        fx: {
          from: bestFx.from,
          to: bestFx.to,
          rate: bestFx.rate,
          timestamp: bestFx.timestamp,
        },
        lines: [
          { accountId: sourceAccount.id, direction: 'CREDIT', amount: sourceAmount },
          { accountId: this.houseAccount(sourceAccount.currency, 'nostro'), direction: 'DEBIT', amount: sourceAmount },
          { accountId: destAccount.id, direction: 'DEBIT', amount: destinationAmount },
          { accountId: this.houseAccount(destCurrency, 'nostro'), direction: 'CREDIT', amount: destinationAmount },
        ],
      });
      if (!fxPosted.ok) return err({ code: 'UNBALANCED' });
      journals.push(fxPosted.value);
    }

    const payAmount = sameCurrency ? sourceAmount : destinationAmount;
    const payAccount = sameCurrency ? sourceAccount : destAccount;
    const railAccount = this.houseAccount(payAmount.currency, 'rail', routing.chosen.railId);
    const payPosted = commitJournal(this.books.journals, auth, {
      intentId: intent.id,
      memo: `SEND_PAYMENT ${routing.chosen.railId}`,
      postedAt: this.now,
      lines: [
        { accountId: payAccount.id, direction: 'CREDIT', amount: payAmount },
        { accountId: railAccount, direction: 'DEBIT', amount: payAmount },
      ],
    });
    if (!payPosted.ok) return err({ code: 'UNBALANCED' });
    journals.push(payPosted.value);

    if (!fxFee.isZero) {
      const feePosted = commitJournal(this.books.journals, auth, {
        intentId: intent.id,
        memo: 'FX fee',
        postedAt: this.now,
        lines: [
          { accountId: sourceAccount.id, direction: 'CREDIT', amount: fxFee },
          { accountId: this.houseAccount(sourceAccount.currency, 'nostro'), direction: 'DEBIT', amount: fxFee },
        ],
      });
      if (!feePosted.ok) return err({ code: 'UNBALANCED' });
      journals.push(feePosted.value);
    }

    const settlingEv = this.kernel.vault.seal({ kind: 'payment.settling', paymentId }, this.now);
    const settling = this.books.transitionPayment(auth, payment.id, 'SETTLING', this.now, settlingEv.id);
    if (!settling.ok) return err({ code: 'KERNEL_ERROR', message: 'illegal payment transition' });
    payment = settling.value;

    const rail = this.rails[routing.chosen.railId];
    const executed = rail.execute(railInstruction);
    if (!executed.accepted || input.failSettlement) {
      return this.failAndReturn(auth, intent, payment, journals, payAccount, railAccount, payAmount, sourceAccount, destAccount, sourceAmount, destinationAmount, sameCurrency, bestFx);
    }

    if ('settle' in rail && typeof (rail as DomesticRail).settle === 'function') {
      (rail as DomesticRail | SepaLikeRail | SwiftLikeRail | InstantRail).settle(executed.railReference);
    }

    const settledEv = this.kernel.vault.seal(
      { kind: 'payment.settled', paymentId, railReference: executed.railReference },
      this.now,
    );
    const settled = this.books.transitionPayment(auth, payment.id, 'SETTLED', this.now, settledEv.id);
    if (!settled.ok) return err({ code: 'KERNEL_ERROR', message: 'illegal payment transition' });
    payment = settled.value;

    const costAvoided = this.recordSavings(input.customerId, payment.id, routing, quotes, sourceAccount.currency);

    return ok({
      decision: execution.value,
      payment,
      journals,
      routing,
      quotes,
      ...(costAvoided === undefined ? {} : { costAvoided }),
    });
  }

  private failAndReturn(
    auth: KernelAuthorization,
    intent: KernelIntent,
    payment: PaymentRecord,
    journals: Journal[],
    payAccount: Account,
    railAccount: AccountId,
    payAmount: Money,
    sourceAccount: Account,
    destAccount: Account,
    sourceAmount: Money,
    destinationAmount: Money,
    sameCurrency: boolean,
    bestFx: SimulatedFxQuote | undefined,
  ): Result<SubmissionOk, SubmissionErr> {
    const failEv = this.kernel.vault.seal({ kind: 'payment.failed', paymentId: payment.id }, this.now);
    const failed = this.books.transitionPayment(auth, payment.id, 'FAILED', this.now, failEv.id);
    if (!failed.ok) return err({ code: 'KERNEL_ERROR', message: 'illegal payment transition' });

    const compensateIntent = freezeKernelIntent({
      id: asActionIntentId(this.nextId('int')),
      kind: 'COMPENSATE_PAYMENT',
      actor: { type: 'SYSTEM', id: asActorId('system') },
      payload: { paymentId: asPaymentId(payment.id), reason: 'simulated rail failure' },
      idempotencyKey: asIdempotencyKey(`comp_${payment.id}`),
      occurredAt: this.now,
      sourceJurisdiction: 'US',
    });
    const screened = this.kernel.evaluate(compensateIntent);
    if (!screened.ok || screened.value.outcome !== 'SCREENED') {
      return err({ code: 'KERNEL_ERROR', message: 'compensate screening failed' });
    }
    const granted = this.kernel.grantExecutionAuthority(compensateIntent, screened.value, {
      routeFingerprint: 'compensate',
      quoteFingerprint: 'compensate',
    });
    if (!granted.ok || granted.value.outcome !== 'AUTHORIZED') {
      return err({ code: 'KERNEL_ERROR', message: 'compensate authority failed' });
    }
    const compAuth = granted.value.authorization;

    const originalPay = journals.find((journal) => journal.memo.startsWith('SEND_PAYMENT'));
    const reversePay = commitJournal(this.books.journals, compAuth, {
      intentId: compensateIntent.id,
      memo: 'compensate SEND_PAYMENT',
      postedAt: this.now,
      ...(originalPay === undefined ? {} : { compensatesJournalId: originalPay.id }),
      lines: [
        { accountId: payAccount.id, direction: 'DEBIT', amount: payAmount },
        { accountId: railAccount, direction: 'CREDIT', amount: payAmount },
      ],
    });
    if (!reversePay.ok) return err({ code: 'UNBALANCED' });
    journals.push(reversePay.value);

    if (!sameCurrency && bestFx) {
      const originalFx = journals.find((journal) => journal.fx !== undefined);
      const reverseFx = commitJournal(this.books.journals, compAuth, {
        intentId: compensateIntent.id,
        memo: 'compensate FX',
        postedAt: this.now,
        ...(originalFx === undefined ? {} : { compensatesJournalId: originalFx.id }),
        ...(originalFx?.fx === undefined ? {} : { fx: originalFx.fx }),
        lines: [
          { accountId: sourceAccount.id, direction: 'DEBIT', amount: sourceAmount },
          { accountId: this.houseAccount(sourceAccount.currency, 'nostro'), direction: 'CREDIT', amount: sourceAmount },
          { accountId: destAccount.id, direction: 'CREDIT', amount: destinationAmount },
          { accountId: this.houseAccount(destinationAmount.currency, 'nostro'), direction: 'DEBIT', amount: destinationAmount },
        ],
      });
      if (!reverseFx.ok) return err({ code: 'UNBALANCED' });
      journals.push(reverseFx.value);
      if (!bestFx.fee.isZero) {
        const originalFee = journals.find((journal) => journal.memo === 'FX fee');
        const reverseFee = commitJournal(this.books.journals, compAuth, {
          intentId: compensateIntent.id,
          memo: 'compensate FX fee',
          postedAt: this.now,
          ...(originalFee === undefined ? {} : { compensatesJournalId: originalFee.id }),
          lines: [
            { accountId: sourceAccount.id, direction: 'DEBIT', amount: bestFx.fee },
            {
              accountId: this.houseAccount(sourceAccount.currency, 'nostro'),
              direction: 'CREDIT',
              amount: bestFx.fee,
            },
          ],
        });
        if (!reverseFee.ok) return err({ code: 'UNBALANCED' });
        journals.push(reverseFee.value);
      }
    }

    const retEv = this.kernel.vault.seal({ kind: 'payment.returned', paymentId: payment.id }, this.now);
    const returned = this.books.transitionPayment(compAuth, payment.id, 'RETURNED', this.now, retEv.id);
    if (!returned.ok) return err({ code: 'KERNEL_ERROR', message: 'illegal payment transition' });

    return ok({
      decision: granted.value,
      payment: returned.value,
      journals,
    });
  }

  private recordSavings(
    customerId: CustomerId,
    paymentId: string,
    routing: RoutingDecision,
    quotes: readonly SimulatedFxQuote[],
    sourceCurrency: string,
  ): Money | undefined {
    const chosen = routing.chosen;
    if (!chosen) return undefined;
    const swift = routing.ranked.find((row) => row.railId === 'swift_like') ?? routing.excluded.find((row) => row.railId === 'swift_like');
    const baselineFee = chosen.totalFeeSource;
    let baseline = baselineFee;
    if (swift && 'totalFeeSource' in swift) {
      baseline = swift.totalFeeSource;
    } else if (swift) {
      baseline = Money.of(2500n, sourceCurrency);
    }
    const widest = quotes.find((quote) => quote.source === 'SIM_MKT');
    const best = quotes.find((quote) => quote.source === chosen.fxQuote?.source);
    if (widest && best && widest.fee.currency === best.fee.currency) {
      const extra = widest.fee.subtract(best.fee);
      if (extra.isPositive) {
        baseline = baseline.add(extra);
      }
    }
    const saved = baseline.subtract(chosen.totalFeeSource);
    if (!saved.isPositive) {
      return undefined;
    }

    const intent = freezeKernelIntent({
      id: asActionIntentId(this.nextId('int')),
      kind: 'RECORD_COST_AVOIDED',
      actor: { type: 'SYSTEM', id: asActorId('system') },
      payload: {
        customerId,
        baselineCost: baseline,
        actualCost: chosen.totalFeeSource,
        paymentId: asPaymentId(paymentId),
      },
      idempotencyKey: asIdempotencyKey(`avoid_${paymentId}`),
      occurredAt: this.now,
      sourceJurisdiction: 'US',
    });
    const evaluated = this.kernel.evaluate(intent);
    if (!evaluated.ok || evaluated.value.outcome !== 'AUTHORIZED') {
      return undefined;
    }
    this.books.recordCostAvoided(evaluated.value.authorization, {
      customerId,
      paymentId,
      baselineCost: baseline,
      actualCost: chosen.totalFeeSource,
      saved,
      kind: 'COST_AVOIDED',
      recordedAt: this.now,
      authorizationHash: evaluated.value.authorization.permitHash,
    });
    return saved;
  }

  reconcile(paymentId: string): { readonly matched: boolean; readonly detail: string } {
    const payment = this.books.getPayment(paymentId);
    if (!payment) {
      return { matched: false, detail: 'payment not found' };
    }
    if (payment.state === 'SETTLED' || payment.state === 'RETURNED' || payment.state === 'FAILED') {
      return { matched: true, detail: `ledger state ${payment.state} is terminal` };
    }
    return { matched: true, detail: `ledger state ${payment.state}` };
  }
}

function applyQuote(amount: Money, quote: SimulatedFxQuote | undefined): Money {
  if (!quote) {
    return amount;
  }
  return applyFxRate(amount, {
    from: quote.from,
    to: quote.to,
    rate: quote.rate,
    timestamp: quote.timestamp,
  });
}
