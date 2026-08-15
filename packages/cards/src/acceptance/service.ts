import { addMs, type Clock } from '../../../config/src/clock.ts';
import type { Account } from '../../../domain/src/account.ts';
import type { Customer } from '../../../domain/src/customer.ts';
import { asJurisdiction } from '../../../domain/src/jurisdiction.ts';
import { isErr, isOk } from '../../../domain/src/result.ts';
import type { EvidenceVault } from '../../../evidence/src/vault.ts';
import type { DomainEventLog } from '../../../events/src/events.ts';
import { actionTypesFromCapabilities, type IdentityService } from '../../../identity/src/index.ts';
import { asBusinessIdentityId } from '../../../identity/src/ids.ts';
import type { ComplianceKernel } from '../../../kernel/src/kernel.ts';
import type { KernelFacts } from '../../../kernel/src/proofs.ts';
import type { Ledger } from '../../../ledger/src/journal.ts';
import { Money } from '../../../money/src/money.ts';
import { asIntentId } from '../../../permissions/src/action-intent.ts';
import {
  ACTION_TYPES,
  type CardIntent,
  type CreateAcceptanceSessionIntent,
  type RegisterAcceptanceDeviceIntent,
  type SettleAcceptancePaymentIntent,
  type StartAcceptancePaymentIntent,
} from '../../../permissions/src/action-types.ts';
import type { AuthorizationDecision } from '../../../permissions/src/decision.ts';
import type { AuthorityIssuer, ExecutionAuthority } from '../../../permissions/src/execution-authority.ts';
import { validateIntentStructure, type StructuralCatalog } from '../../../permissions/src/structural.ts';
import { newSecurityToken } from '../../../security/src/random.ts';
import { secretRef, type SecretProvider } from '../../../security/src/secrets.ts';
import { postCardJournal } from '../journals.ts';
import {
  InMemoryAcceptanceCallbackReplayStore,
  verifyAcceptanceCallback,
  type AcceptanceCallbackEnvelope,
  type AcceptanceCallbackReplayStore,
} from './callback.ts';
import { deviceCanTransact, freezeAcceptanceDevice, transitionAcceptanceDevice, type AcceptanceDevice } from './device.ts';
import { evaluateMerchantEligibility } from './eligibility.ts';
import {
  asAcceptanceDeviceId,
  asAcceptancePaymentId,
  asAcceptanceSessionId,
  asMerchantId,
} from './ids.ts';
import { freezeMerchant, type MerchantAcceptance } from './merchant.ts';
import { freezeMerchantPayment, type MerchantPayment } from './payment.ts';
import type { TapToPayAcceptanceProvider } from './port.ts';
import {
  reconcileAcceptancePayment,
  type AcceptanceProviderReport,
  type AcceptanceReconciliationResult,
} from './reconciliation.ts';
import { freezeAcceptanceSession, sessionIsUsable, type AcceptanceSession } from './session.ts';
import { acquiringFeePlan, merchantCreditPlan } from './settlement.ts';
import { SimulatedTapToPayAdapter } from './simulated.ts';
import { AcceptanceStore } from './store.ts';
import { registerAcceptanceTreasuryBooks } from './treasury.ts';

const ACCEPTANCE_SECRET = secretRef('simulation', 'acceptance-provider-callback');
const SESSION_TTL_MS = 15n * 60n * 1000n;

export type AcceptanceServiceOutcome<T> =
  | { readonly outcome: 'OK'; readonly value: T; readonly decision: AuthorizationDecision; readonly replay?: boolean }
  | { readonly outcome: 'KERNEL_REFUSED'; readonly decision: AuthorizationDecision }
  | {
      readonly outcome: 'REJECTED';
      readonly code: string;
      readonly message: string;
      readonly decision: AuthorizationDecision | null;
      readonly evidenceId?: string;
    };

export type AcceptanceCatalogPorts = {
  readonly customers: { get(id: Customer['id']): Customer | undefined };
  readonly accounts: {
    get(id: Account['id']): Account | undefined;
  };
  readonly products: StructuralCatalog['products'];
  readonly legalEntities: StructuralCatalog['legalEntities'];
};

export class AcceptanceService {
  private readonly kernel: ComplianceKernel;
  private readonly issuer: AuthorityIssuer;
  private readonly ledger: Ledger;
  private readonly evidence: EvidenceVault;
  private readonly events: DomainEventLog;
  private readonly clock: Clock;
  private readonly catalog: AcceptanceCatalogPorts;
  private readonly identity: IdentityService;
  private readonly secrets: SecretProvider;
  readonly store: AcceptanceStore;
  readonly provider: TapToPayAcceptanceProvider;
  private readonly replay: AcceptanceCallbackReplayStore;
  private readonly expectedProviderId: string;
  private readonly operationsActorId: string;
  private readonly feeMinor: bigint;

  constructor(input: {
    readonly kernel: ComplianceKernel;
    readonly issuer: AuthorityIssuer;
    readonly ledger: Ledger;
    readonly evidence: EvidenceVault;
    readonly events: DomainEventLog;
    readonly clock: Clock;
    readonly catalog: AcceptanceCatalogPorts;
    readonly identity: IdentityService;
    readonly secrets: SecretProvider;
    readonly store?: AcceptanceStore;
    readonly provider?: TapToPayAcceptanceProvider;
    readonly replay?: AcceptanceCallbackReplayStore;
    readonly expectedProviderId?: string;
    readonly operationsActorId: string;
    readonly feeMinor?: bigint;
  }) {
    this.kernel = input.kernel;
    this.issuer = input.issuer;
    this.ledger = input.ledger;
    this.evidence = input.evidence;
    this.events = input.events;
    this.clock = input.clock;
    this.catalog = input.catalog;
    this.identity = input.identity;
    this.secrets = input.secrets;
    this.store = input.store ?? new AcceptanceStore();
    this.provider = input.provider ?? new SimulatedTapToPayAdapter();
    this.replay = input.replay ?? new InMemoryAcceptanceCallbackReplayStore();
    this.expectedProviderId = input.expectedProviderId ?? 'sim-softpos-provider';
    this.operationsActorId = input.operationsActorId;
    this.feeMinor = input.feeMinor ?? 0n;
    registerAcceptanceTreasuryBooks(this.ledger.accounts);
  }

  registerMerchant(input: {
    readonly merchantId: string;
    readonly businessIdentityId: string;
    readonly settlementAccountId: Account['id'];
    readonly jurisdiction: string;
  }): MerchantAcceptance {
    const merchant = freezeMerchant({
      merchantId: asMerchantId(input.merchantId),
      businessIdentityId: asBusinessIdentityId(input.businessIdentityId),
      status: 'ACTIVE',
      settlementAccountId: input.settlementAccountId,
      jurisdiction: asJurisdiction(input.jurisdiction),
      acceptanceCapabilities: ['CONTACTLESS_SOFTPOS'],
      acquiringLicenseClaim: 'NONE',
      createdAt: this.clock.now(),
    });
    this.store.saveMerchant(merchant);
    return merchant;
  }

  registerDevice(intent: RegisterAcceptanceDeviceIntent): AcceptanceServiceOutcome<AcceptanceDevice> {
    const merchant = this.store.getMerchant(intent.payload.merchantId);
    const account = this.catalog.accounts.get(intent.payload.accountId);
    const customer = account ? this.catalog.customers.get(account.ownerId) : undefined;
    const eligibility = this.eligibility(merchant, account);
    if (eligibility.outcome !== 'ELIGIBLE') {
      return this.reject(intent.actionType, intent.id, null, 'INELIGIBLE', eligibility.reasons.join(','));
    }
    const gated = this.gate(intent, account, customer);
    if (gated.outcome !== 'ALLOWED') {
      return gated.result;
    }
    const registered = this.provider.registerDevice({
      merchantId: intent.payload.merchantId,
      deviceId: intent.payload.deviceId,
    });
    if (!this.provider.verifyDeviceEligibility(registered.providerDeviceReference)) {
      return this.reject(intent.actionType, intent.id, gated.decision, 'DEVICE_INELIGIBLE', 'provider attestation failed');
    }
    const now = this.clock.now();
    const device = freezeAcceptanceDevice({
      deviceId: asAcceptanceDeviceId(intent.payload.deviceId),
      merchantId: merchant!.merchantId,
      providerDeviceReference: registered.providerDeviceReference,
      identityDeviceId: null,
      status: 'ACTIVE',
      attestationReference: registered.attestationReference,
      registeredAt: now,
      lastSeenAt: now,
    });
    this.store.saveDevice(device);
    this.emit('AcceptanceDeviceRegistered', 'acceptance_device', device.deviceId, intent.id, gated.decision, {
      merchantId: device.merchantId,
      deviceId: device.deviceId,
      status: device.status,
    });
    this.evidence.seal('ACCEPTANCE_DEVICE_REGISTERED', {
      intentId: intent.id,
      merchantId: device.merchantId,
      deviceId: device.deviceId,
      attestationReference: device.attestationReference,
    });
    return { outcome: 'OK', value: device, decision: gated.decision };
  }

  createSession(intent: CreateAcceptanceSessionIntent): AcceptanceServiceOutcome<AcceptanceSession> {
    const merchant = this.store.getMerchant(intent.payload.merchantId);
    const device = this.store.getDevice(intent.payload.deviceId);
    const account = this.catalog.accounts.get(intent.payload.accountId);
    const customer = account ? this.catalog.customers.get(account.ownerId) : undefined;
    const eligibility = this.eligibility(merchant, account);
    if (eligibility.outcome !== 'ELIGIBLE') {
      return this.reject(intent.actionType, intent.id, null, 'INELIGIBLE', eligibility.reasons.join(','));
    }
    if (!device || !deviceCanTransact(device)) {
      return this.reject(intent.actionType, intent.id, null, 'DEVICE_NOT_ACTIVE', 'acceptance device cannot transact');
    }
    const gated = this.gate(intent, account, customer);
    if (gated.outcome !== 'ALLOWED') {
      return gated.result;
    }
    this.provider.createAcceptanceSession({
      merchantId: intent.payload.merchantId,
      deviceId: intent.payload.deviceId,
      currency: intent.payload.currency,
    });
    const now = this.clock.now();
    const session = freezeAcceptanceSession({
      sessionId: asAcceptanceSessionId(intent.payload.sessionId || `asess_${newSecurityToken()}`),
      merchantId: merchant!.merchantId,
      deviceId: device.deviceId,
      provider: this.expectedProviderId,
      currency: intent.payload.currency,
      createdAt: now,
      expiresAt: addMs(now, SESSION_TTL_MS),
    });
    this.store.saveSession(session);
    this.emit('AcceptanceSessionCreated', 'acceptance_session', session.sessionId, intent.id, gated.decision, {
      sessionId: session.sessionId,
      merchantId: session.merchantId,
      deviceId: session.deviceId,
    });
    this.evidence.seal('ACCEPTANCE_SESSION_CREATED', {
      intentId: intent.id,
      sessionId: session.sessionId,
      merchantId: session.merchantId,
      deviceId: session.deviceId,
    });
    return { outcome: 'OK', value: session, decision: gated.decision };
  }

  startPayment(intent: StartAcceptancePaymentIntent): AcceptanceServiceOutcome<MerchantPayment> {
    const existing = this.store.paymentByIdempotency(intent.idempotencyKey);
    if (existing) {
      return this.replayOk(existing, intent.actionType, intent.id);
    }
    const session = this.store.getSession(intent.payload.sessionId);
    if (!session || !sessionIsUsable(session, this.clock.now())) {
      return this.reject(intent.actionType, intent.id, null, 'SESSION_EXPIRED', 'acceptance session is missing or expired');
    }
    const device = this.store.getDevice(session.deviceId);
    if (!device || !deviceCanTransact(device)) {
      return this.reject(intent.actionType, intent.id, null, 'DEVICE_NOT_ACTIVE', 'suspended device cannot transact');
    }
    const merchant = this.store.getMerchant(session.merchantId);
    const account = this.catalog.accounts.get(intent.payload.accountId);
    const customer = account ? this.catalog.customers.get(account.ownerId) : undefined;
    const eligibility = this.eligibility(merchant, account);
    if (eligibility.outcome !== 'ELIGIBLE') {
      return this.reject(intent.actionType, intent.id, null, 'INELIGIBLE', eligibility.reasons.join(','));
    }
    if (intent.payload.amount.currency !== session.currency) {
      return this.reject(intent.actionType, intent.id, null, 'CURRENCY_MISMATCH', 'payment currency does not match session');
    }
    const gated = this.gate(intent, account, customer);
    if (gated.outcome !== 'ALLOWED') {
      return gated.result;
    }
    const started = this.provider.startPayment({
      sessionRef: session.sessionId,
      amount: intent.payload.amount,
      reference: intent.payload.merchantReference,
    });
    const now = this.clock.now();
    const payment = freezeMerchantPayment({
      paymentId: asAcceptancePaymentId(intent.payload.paymentId),
      merchantId: session.merchantId,
      deviceId: session.deviceId,
      sessionId: session.sessionId,
      amount: intent.payload.amount,
      merchantReference: intent.payload.merchantReference,
      providerTransactionRef: started.providerTransactionRef,
      result: started.result,
      state: started.result === 'APPROVED' ? 'PENDING_SETTLEMENT' : started.result === 'DECLINED' ? 'DECLINED' : 'FAILED',
      settlementJournalId: null,
      feeJournalId: null,
      createdAt: now,
      updatedAt: now,
    });
    this.store.savePayment(payment);
    this.store.markPaymentIdempotency(intent.idempotencyKey, payment);
    const eventType = started.result === 'APPROVED' ? 'AcceptancePaymentApproved' : 'AcceptancePaymentDeclined';
    this.emit(eventType, 'acceptance_payment', payment.paymentId, intent.id, gated.decision, {
      paymentId: payment.paymentId,
      merchantId: payment.merchantId,
      deviceId: payment.deviceId,
      amountMinorUnits: payment.amount.minorUnits.toString(),
      currency: payment.amount.currency,
      status: payment.state,
      providerTransactionRef: payment.providerTransactionRef,
    });
    this.evidence.seal(`ACCEPTANCE_PAYMENT_${started.result}`, {
      intentId: intent.id,
      merchantId: payment.merchantId,
      deviceId: payment.deviceId,
      paymentId: payment.paymentId,
      providerTransaction: payment.providerTransactionRef,
    });
    return { outcome: 'OK', value: payment, decision: gated.decision };
  }

  settlePayment(intent: SettleAcceptancePaymentIntent): AcceptanceServiceOutcome<MerchantPayment> {
    const existing = this.store.paymentByIdempotency(intent.idempotencyKey);
    if (existing) {
      return this.replayOk(existing, intent.actionType, intent.id);
    }
    const payment = this.store.getPayment(intent.payload.paymentId);
    const merchant = payment ? this.store.getMerchant(payment.merchantId) : undefined;
    const account = this.catalog.accounts.get(intent.payload.accountId);
    const customer = account ? this.catalog.customers.get(account.ownerId) : undefined;
    const gated = this.gate(intent, account, customer);
    if (gated.outcome !== 'ALLOWED') {
      return gated.result;
    }
    if (!payment || !merchant) {
      return this.reject(intent.actionType, intent.id, gated.decision, 'PAYMENT_NOT_FOUND', 'acceptance payment does not exist');
    }
    if (payment.state === 'SETTLED') {
      return this.replayOk(payment, intent.actionType, intent.id);
    }
    if (payment.state !== 'PENDING_SETTLEMENT' || payment.result !== 'APPROVED') {
      return this.reject(intent.actionType, intent.id, gated.decision, 'NOT_SETTLEABLE', 'payment is not pending settlement');
    }
    const fee = this.feeMinor > 0n ? Money.fromMinorUnits(this.feeMinor, payment.amount.currency) : null;
    const net = fee ? payment.amount.minus(fee) : payment.amount;
    const credit = postCardJournal(
      this.ledger,
      gated.authority,
      intent.actionType,
      merchantCreditPlan(merchant.settlementAccountId, net),
    );
    const feeJournal = fee
      ? postCardJournal(this.ledger, gated.authority, intent.actionType, acquiringFeePlan(fee))
      : null;
    const settled = freezeMerchantPayment({
      ...payment,
      state: 'SETTLED',
      settlementJournalId: credit.id,
      feeJournalId: feeJournal?.id ?? null,
      updatedAt: this.clock.now(),
    });
    this.store.savePayment(settled);
    this.store.markPaymentIdempotency(intent.idempotencyKey, settled);
    const report: AcceptanceProviderReport = {
      paymentId: settled.paymentId,
      providerTransactionRef: settled.providerTransactionRef ?? undefined,
      settlementRef: this.provider.retrieveSettlement(settled.providerTransactionRef!).settlementRef,
      amountMinorUnits: settled.amount.minorUnits.toString(),
      currency: settled.amount.currency,
      journalId: credit.id,
    };
    const reconciliation = reconcileAcceptancePayment({
      subjectId: settled.paymentId,
      payment: settled,
      report,
      journals: this.ledger.listJournals(),
    });
    this.store.saveReconciliation(reconciliation);
    this.emit('AcceptancePaymentSettled', 'acceptance_payment', settled.paymentId, intent.id, gated.decision, {
      paymentId: settled.paymentId,
      merchantId: settled.merchantId,
      journalId: credit.id,
      providerTransactionRef: settled.providerTransactionRef,
      reconciliationStatus: reconciliation.status,
    });
    if (reconciliation.status !== 'MATCHED') {
      this.emit('AcceptanceReconciliationMismatch', 'acceptance_payment', settled.paymentId, intent.id, gated.decision, {
        paymentId: settled.paymentId,
        reconciliationStatus: reconciliation.status,
      });
    }
    this.evidence.seal('ACCEPTANCE_PAYMENT_SETTLED', {
      intentId: intent.id,
      merchantId: settled.merchantId,
      deviceId: settled.deviceId,
      paymentId: settled.paymentId,
      providerTransaction: settled.providerTransactionRef,
      settlement: report.settlementRef,
      journalId: credit.id,
      reconciliation: reconciliation.status,
    });
    return { outcome: 'OK', value: settled, decision: gated.decision };
  }

  ingestAcceptanceCallback(envelope: AcceptanceCallbackEnvelope): AcceptanceServiceOutcome<MerchantPayment> {
    const nowMs = BigInt(Date.parse(this.clock.now()));
    const verified = verifyAcceptanceCallback({
      envelope,
      secrets: this.secrets,
      secretRef: ACCEPTANCE_SECRET,
      nowMs,
      replay: this.replay,
      expectedProviderId: this.expectedProviderId,
    });
    if (!verified.ok) {
      this.evidence.seal('ACCEPTANCE_CALLBACK_REJECTED', {
        code: verified.error.code,
        eventType: envelope.eventType,
        posted: false,
      });
      return this.reject(envelope.eventType, envelope.idempotencyKey, null, verified.error.code, verified.error.message);
    }
    const replayed = this.store.callbackByKey(envelope.idempotencyKey);
    if (replayed) {
      return this.replayOk(replayed, envelope.eventType, asIntentId(`acc_replay_${envelope.idempotencyKey}`));
    }
    const paymentId = typeof envelope.payload.paymentId === 'string' ? envelope.payload.paymentId : '';
    const existingPayment = this.store.getPayment(paymentId);
    const merchantForGate = existingPayment ? this.store.getMerchant(existingPayment.merchantId) : undefined;
    const accountForGate = merchantForGate ? this.catalog.accounts.get(merchantForGate.settlementAccountId) : undefined;
    const customerForGate = accountForGate ? this.catalog.customers.get(accountForGate.ownerId) : undefined;
    const callbackIntent: SettleAcceptancePaymentIntent = {
      id: asIntentId(`acc_cb_${envelope.idempotencyKey}`),
      actionType: ACTION_TYPES.SETTLE_ACCEPTANCE_PAYMENT,
      idempotencyKey: `acc_cb_gate_${envelope.idempotencyKey}`,
      actorId: typeof envelope.payload.actorId === 'string' ? envelope.payload.actorId : this.operationsActorId,
      requestedAt: this.clock.now(),
      purpose: 'MERCHANT_ACCEPTANCE',
      payload: {
        paymentId,
        accountId: accountForGate?.id ?? (paymentId as unknown as Account['id']),
        providerTransactionRef: existingPayment?.providerTransactionRef ?? '',
      },
    };
    const gatedCallback = this.gate(callbackIntent, accountForGate, customerForGate);
    if (gatedCallback.outcome !== 'ALLOWED') {
      return gatedCallback.result;
    }
    const payment = this.store.getPayment(paymentId);
    if (!payment) {
      return this.reject(envelope.eventType, envelope.idempotencyKey, null, 'PAYMENT_NOT_FOUND', 'acceptance payment does not exist');
    }
    if (envelope.eventType === 'SETTLEMENT') {
      const merchant = this.store.getMerchant(payment.merchantId);
      if (!merchant) {
        return this.reject(envelope.eventType, envelope.idempotencyKey, null, 'MERCHANT_NOT_FOUND', 'merchant does not exist');
      }
      const settled = this.settlePayment({
        id: asIntentId(`settle_cb_${envelope.idempotencyKey}`),
        actionType: ACTION_TYPES.SETTLE_ACCEPTANCE_PAYMENT,
        idempotencyKey: `settle_${payment.paymentId}`,
        actorId: envelope.payload.actorId && typeof envelope.payload.actorId === 'string' ? envelope.payload.actorId : this.operationsActorId,
        requestedAt: this.clock.now(),
        purpose: 'MERCHANT_ACCEPTANCE',
        payload: {
          paymentId: payment.paymentId,
          accountId: merchant.settlementAccountId,
          providerTransactionRef: payment.providerTransactionRef ?? '',
        },
      });
      if (settled.outcome === 'OK') {
        this.store.markCallback(envelope.idempotencyKey, settled.value);
      }
      return settled;
    }
    this.store.markCallback(envelope.idempotencyKey, payment);
    return { outcome: 'OK', value: payment, decision: this.emptyDecision(envelope.eventType, envelope.idempotencyKey) };
  }

  suspendDevice(deviceId: string): AcceptanceServiceOutcome<AcceptanceDevice> {
    const device = this.store.getDevice(deviceId);
    if (!device) {
      return this.reject('SUSPEND_DEVICE', deviceId, null, 'DEVICE_NOT_FOUND', 'acceptance device does not exist');
    }
    const next = transitionAcceptanceDevice(device, 'SUSPENDED', this.clock.now());
    if (isErr(next)) {
      return this.reject('SUSPEND_DEVICE', deviceId, null, next.error.code, `${next.error.from} cannot become ${next.error.to}`);
    }
    this.provider.disableDevice(next.value.providerDeviceReference);
    this.store.saveDevice(next.value);
    return { outcome: 'OK', value: next.value, decision: this.emptyDecision('SUSPEND_DEVICE', deviceId) };
  }

  reconcile(subjectId: string, report: AcceptanceProviderReport | null): AcceptanceReconciliationResult {
    const result = reconcileAcceptancePayment({
      subjectId,
      payment: this.store.getPayment(subjectId),
      report,
      journals: this.ledger.listJournals(),
    });
    this.store.saveReconciliation(result);
    return result;
  }

  private eligibility(merchant: MerchantAcceptance | undefined, account: Account | undefined) {
    const business = merchant ? this.identity.getBusiness(merchant.businessIdentityId) : undefined;
    return evaluateMerchantEligibility({
      merchant,
      business,
      settlementAccount: account,
      jurisdictionPermitted: true,
      complianceClear: business?.verificationState === 'PROVIDER_VERIFIED',
      fraudClear: true,
    });
  }

  private gate(
    intent: CardIntent,
    account: Account | undefined,
    customer: Customer | undefined,
  ):
    | { readonly outcome: 'ALLOWED'; readonly decision: AuthorizationDecision; readonly authority: ExecutionAuthority }
    | { readonly outcome: 'REFUSED'; readonly result: AcceptanceServiceOutcome<never> } {
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
      ...(account
        ? { sourceAccount: account, jurisdiction: account.jurisdiction }
        : customer
          ? { jurisdiction: customer.jurisdiction }
          : {}),
      ...('amount' in intent.payload && intent.payload.amount instanceof Money ? { amount: intent.payload.amount } : {}),
    };
    const decision = this.kernel.submit(intent, facts);
    this.emit('KernelDecisionRecorded', 'kernel', intent.id, intent.id, decision, {
      intentId: intent.id,
      actionType: intent.actionType,
      status: decision.status,
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
  ): AcceptanceServiceOutcome<never> {
    const evidence = this.evidence.seal(`${actionType}_REJECTED`, { intentId, code, message, posted: false });
    return { outcome: 'REJECTED', code, message, decision, evidenceId: evidence.evidenceId };
  }

  private replayOk<T>(value: T, actionType: string, intentId: string): AcceptanceServiceOutcome<T> {
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
