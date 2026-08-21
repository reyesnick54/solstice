/**
 * Canonical Payments Platform. Orchestrates beneficiaries, quotes,
 * internal SunRey transfers, and external rail payments.
 *
 * Production money movement stays disabled. Real providers are Phase D.
 */

import { randomUUID } from 'node:crypto';

import { ENVIRONMENT, LIVE_PAYMENTS_ENABLED } from '../../../config/src/flags.ts';
import type { Clock } from '../../../config/src/clock.ts';
import type { Account } from '../../../domain/src/account.ts';
import type { Customer } from '../../../domain/src/customer.ts';
import { isErr, isOk } from '../../../domain/src/result.ts';
import { asUtcInstant, type UtcInstant } from '../../../domain/src/time.ts';
import type { EvidenceVault } from '../../../evidence/src/vault.ts';
import type { DomainEventLog } from '../../../events/src/events.ts';
import {
  InMemoryWorkflowStore,
  WorkflowRuntime,
  type WorkflowStore,
} from '../../../events/src/workflow.ts';
import type { IdentitySession } from '../../../identity/src/auth.ts';
import {
  actionTypesFromCapabilities,
  type IdentityAuthorityPort,
} from '../../../identity/src/index.ts';
import type { ComplianceKernel } from '../../../kernel/src/kernel.ts';
import type { KernelFacts } from '../../../kernel/src/proofs.ts';
import type { Ledger } from '../../../ledger/src/journal.ts';
import { findClassBridge } from '../../../ledger/src/types.ts';
import { asMoney, ledgerAssetKey } from '../../../money/src/ledger-amount.ts';
import { Money } from '../../../money/src/money.ts';
import type {
  AcceptFxQuoteIntent,
  CreateBeneficiaryIntent,
  CreateFxQuoteIntent,
  InitiatePaymentIntent,
  InternalTransferIntent,
} from '../../../permissions/src/action-types.ts';
import { ACTION_TYPES } from '../../../permissions/src/action-types.ts';
import { asIntentId } from '../../../permissions/src/action-intent.ts';
import type { AuthorizationDecision } from '../../../permissions/src/decision.ts';
import type { AuthorityIssuer, ExecutionAuthority } from '../../../permissions/src/execution-authority.ts';
import { validateIntentStructure } from '../../../permissions/src/structural.ts';
import { internalTransferPlan } from '../accounting.ts';
import type { Beneficiary } from '../beneficiary.ts';
import { destinationTypeFromScheme, ledgerDestinationType } from './destination.ts';
import { postPaymentJournal } from '../journals.ts';
import { asPaymentId, asQuoteId, type PaymentId, type QuoteId } from '../ids.ts';
import type { PaymentCatalogPorts, PaymentsService, PaymentsServiceOutcome } from '../service.ts';
import {
  DEFAULT_BENEFICIARY_SECURITY_POLICY,
  evaluateBeneficiarySecurity,
  rejectClientVerificationMark,
  type BeneficiarySecurityPolicy,
  type DeviceRiskLevel,
} from './beneficiary-security.ts';
import { evaluatePaymentComplianceHooks } from './compliance.ts';
import { SimulationScreeningAdapter } from '../screening.ts';
import { admitInboundNotice, inboundMustNotCredit, type InboundFundingNotice } from './inbound.ts';
import { DEFAULT_PAYMENT_LIMITS, evaluatePaymentLimits, type PaymentLimitsPolicy } from './limits.ts';
import {
  assertLifecycleTransition,
  lifecycleFromRailStatus,
  type PaymentLifecycleStatus,
} from './lifecycle.ts';
import { disposePaymentFailure, type PaymentFailureClass } from './failures.ts';
import { LedgerFundsReservation, type FundsReservationPort } from './funds-reservation.ts';
import {
  freezePaymentIntent,
  paymentTypeForDestination,
  type PaymentIntent,
  type PaymentType,
  type RailPreference,
} from './payment-intent.ts';
import {
  freezeQuotePreview,
  INTERNAL_QUOTE_TTL_MS,
  type PaymentQuotePreview,
} from './quote-preview.ts';
import type { Payment as PaymentResource, PaymentApproval as ApprovalResource, PaymentQuote, Recipient } from './resources.ts';
import { SimulationPaymentRouter } from './routing.ts';
import { SimulationOnlyPaymentProvider } from './simulated-provider.ts';
import { PaymentPlatformStore, type PaymentApproval } from './store.ts';
import { defaultPaymentWorkflowHandlers, PAYMENT_WORKFLOW_TYPE, paymentOutboundWorkflow } from './workflow.ts';
import { rateLabel } from '../fx-rate.ts';

export type PaymentPlatformOutcome<T> =
  | { readonly outcome: 'OK'; readonly value: T; readonly replay?: boolean }
  | {
      readonly outcome: 'STEP_UP_REQUIRED';
      readonly needed: string;
      readonly current: string;
      readonly paymentId?: string;
    }
  | { readonly outcome: 'AWAITING_APPROVAL'; readonly value: T }
  | { readonly outcome: 'KERNEL_REFUSED'; readonly decision: AuthorizationDecision }
  | { readonly outcome: 'REJECTED'; readonly code: string; readonly message: string };

export type PaymentPlatformPorts = {
  readonly kernel: ComplianceKernel;
  readonly issuer: AuthorityIssuer;
  readonly ledger: Ledger;
  readonly evidence: EvidenceVault;
  readonly events: DomainEventLog;
  readonly clock: Clock;
  readonly catalog: PaymentCatalogPorts;
  readonly identity: IdentityAuthorityPort;
  readonly sessionFor?: (actorId: string) => IdentitySession | null;
  readonly deviceRiskFor?: (actorId: string) => DeviceRiskLevel;
  readonly store?: PaymentPlatformStore;
  readonly reservations?: FundsReservationPort;
  readonly securityPolicy?: BeneficiarySecurityPolicy;
  readonly limits?: PaymentLimitsPolicy;
  readonly workflowStore?: WorkflowStore;
  readonly requireApproval?: boolean;
};

export class PaymentPlatform {
  private readonly payments: PaymentsService;
  private readonly ports: PaymentPlatformPorts;
  readonly store: PaymentPlatformStore;
  readonly reservations: FundsReservationPort;
  readonly provider: SimulationOnlyPaymentProvider;
  readonly router = SimulationPaymentRouter;
  readonly workflows: WorkflowRuntime;
  readonly productionEnabled = false as const;

  constructor(payments: PaymentsService, ports: PaymentPlatformPorts) {
    if (ENVIRONMENT !== 'simulation' || LIVE_PAYMENTS_ENABLED) {
      throw new Error('PaymentPlatform cannot enable production money movement');
    }
    this.payments = payments;
    this.ports = ports;
    this.store = ports.store ?? new PaymentPlatformStore();
    this.reservations = ports.reservations ?? new LedgerFundsReservation(ports.ledger);
    this.provider = new SimulationOnlyPaymentProvider();
    const workflowStore = ports.workflowStore ?? new InMemoryWorkflowStore();
    this.workflows = new WorkflowRuntime(workflowStore, {
      now: () => ports.clock.now(),
      nowMs: () => Date.parse(ports.clock.now()),
    });
    this.workflows.register(paymentOutboundWorkflow(defaultPaymentWorkflowHandlers()));
  }

  listRecipients(ownerId: string): readonly Recipient[] {
    return this.payments.getStore().listBeneficiaries(ownerId).map((row) => this.toRecipient(row, ownerId));
  }

  getRecipient(ownerId: string, id: string): PaymentPlatformOutcome<Recipient> {
    const row = this.payments.getStore().getBeneficiary(id);
    if (!row) {
      return this.reject('NOT_FOUND', 'recipient does not exist');
    }
    if (row.ownerId !== ownerId) {
      return this.reject('CROSS_USER_DENIED', 'beneficiary is not owned by this customer');
    }
    return { outcome: 'OK', value: this.toRecipient(row, ownerId) };
  }

  createRecipient(input: {
    readonly actorId: string;
    readonly ownerId: string;
    readonly accountId: string;
    readonly kind: 'PERSON' | 'BUSINESS';
    readonly destinationCountry: string;
    readonly currency: string;
    readonly legalName: string;
    readonly accountCoordinate: { readonly scheme: string; readonly value: string };
    readonly relationship?: string;
    readonly purpose?: string;
    readonly clientBody?: unknown;
    readonly idempotencyKey: string;
    readonly beneficiaryId?: string;
  }): PaymentPlatformOutcome<Recipient> {
    if (rejectClientVerificationMark(input.clientBody)) {
      this.ports.evidence.seal('BENEFICIARY_CLIENT_VERIFICATION_REJECTED', {
        ownerId: input.ownerId,
        actorId: input.actorId,
      });
    }
    if (input.ownerId !== this.ownerOfActor(input.actorId)) {
      return this.reject('CROSS_USER_DENIED', 'cannot create a beneficiary for another customer');
    }
    const security = evaluateBeneficiarySecurity(
      {
        ownerId: input.ownerId,
        actorId: input.actorId,
        session: this.ports.sessionFor?.(input.actorId) ?? null,
        deviceRisk: this.ports.deviceRiskFor?.(input.actorId) ?? this.riskFromSession(input.actorId),
        now: this.ports.clock.now(),
        recentCreates: this.store.createdTimesFor(input.ownerId),
      },
      this.ports.securityPolicy ?? DEFAULT_BENEFICIARY_SECURITY_POLICY,
    );
    if (security.outcome === 'UNAUTHENTICATED') {
      return this.reject('UNAUTHENTICATED', 'authentication is required to add a beneficiary');
    }
    if (security.outcome === 'STEP_UP_REQUIRED') {
      this.ports.evidence.seal('BENEFICIARY_STEP_UP_REQUIRED', {
        ownerId: input.ownerId,
        needed: security.needed,
      });
      return { outcome: 'STEP_UP_REQUIRED', needed: security.needed, current: security.current };
    }
    if (security.outcome === 'DEVICE_RISK_BLOCKED') {
      return this.reject('DEVICE_RISK', `device risk ${security.deviceRisk} blocks beneficiary changes`);
    }
    if (security.outcome === 'COOLDOWN') {
      return this.reject('COOLDOWN', `beneficiary cooldown has ${security.retryAfterMs}ms remaining`);
    }
    if (security.outcome === 'FREQUENCY_EXCEEDED') {
      return this.reject('FREQUENCY', `beneficiary ${security.window} limit ${security.limit} exceeded`);
    }
    const intent: CreateBeneficiaryIntent = {
      id: asIntentId(`ben_${input.idempotencyKey}`),
      actionType: ACTION_TYPES.CREATE_BENEFICIARY,
      idempotencyKey: input.idempotencyKey,
      actorId: input.actorId,
      requestedAt: this.ports.clock.now(),
      purpose: 'CUSTOMER_CROSS_BORDER_PAYMENT',
      payload: {
        beneficiaryId: input.beneficiaryId ?? `ben_${randomUUID()}`,
        ownerId: input.ownerId as Beneficiary['ownerId'],
        accountId: input.accountId as CreateBeneficiaryIntent['payload']['accountId'],
        kind: input.kind,
        destinationCountry: input.destinationCountry,
        currency: input.currency as CreateBeneficiaryIntent['payload']['currency'],
        legalName: input.legalName,
        accountCoordinate: input.accountCoordinate,
      },
    };
    const created = this.payments.createBeneficiary(intent);
    if (created.outcome !== 'OK') {
      return this.fromPayments(created);
    }
    this.store.recordBeneficiaryCreated(input.ownerId, created.value.createdAt);
    this.ports.evidence.seal('BENEFICIARY_SECURITY_PASSED', {
      beneficiaryId: created.value.beneficiaryId,
      ownerId: input.ownerId,
    });
    return { outcome: 'OK', value: this.toRecipient(created.value, input.ownerId), replay: created.replay };
  }

  quote(input: {
    readonly actorId: string;
    readonly ownerId: string;
    readonly sourceAccountId: string;
    readonly beneficiaryId?: string;
    readonly destinationAccountId?: string;
    readonly amountMinorUnits: string;
    readonly currency: string;
    readonly railPreference?: RailPreference;
    readonly purpose?: string;
    readonly quoteId?: string;
  }): PaymentPlatformOutcome<PaymentQuote> {
    const source = this.ports.catalog.accounts.get(input.sourceAccountId as Account['id']);
    if (!source || source.ownerId !== input.ownerId) {
      return this.reject('RESOURCE_NOT_OWNED', 'source account is not owned by this customer');
    }
    const amount = Money.fromMinorUnits(BigInt(input.amountMinorUnits), input.currency);
    const destinationAccountId = input.destinationAccountId;
    const beneficiary = input.beneficiaryId
      ? this.payments.getStore().getBeneficiary(input.beneficiaryId)
      : undefined;
    if (input.beneficiaryId && beneficiary && beneficiary.ownerId !== input.ownerId) {
      return this.reject('CROSS_USER_DENIED', 'beneficiary is not owned by this customer');
    }
    const destType = this.resolveDestinationType(source, destinationAccountId, beneficiary);
    const rail = input.railPreference ?? (destType === 'OWN_ACCOUNT' || destType === 'SUNREY_USER' ? 'LEDGER_INTERNAL' : 'UNSPECIFIED');
    const paymentType = paymentTypeForDestination(destType, rail);
    const now = this.ports.clock.now();
    const expiresAt = asUtcInstant(new Date(Date.parse(now) + INTERNAL_QUOTE_TTL_MS).toISOString());
    const compliance = evaluatePaymentComplianceHooks({
      screening: new SimulationScreeningAdapter(),
      subject: {
        legalName: beneficiary?.legalName ?? 'internal',
        destinationCountry: beneficiary?.destinationCountry ?? source.jurisdiction,
        coordinateRef: beneficiary?.accountCoordinate.coordinateRef ?? 'internal',
        kind: beneficiary?.kind ?? 'PERSON',
      },
      purpose: input.purpose ?? 'transfer',
      sourceJurisdiction: source.jurisdiction,
      destinationCountry: beneficiary?.destinationCountry ?? source.jurisdiction,
    });
    const blocked = compliance.some((row) => row.state === 'SIMULATION_BLOCK');
    const review = compliance.some((row) => row.state === 'SIMULATION_REVIEW');

    if (rail === 'LEDGER_INTERNAL' || destType === 'OWN_ACCOUNT' || destType === 'SUNREY_USER') {
      const destAmount = destinationAccountId
        ? this.requireSameCurrency(source, destinationAccountId, amount)
        : beneficiary
          ? beneficiary.currency === amount.currency
            ? amount
            : null
          : amount;
      const preview = freezeQuotePreview({
        quoteId: asQuoteId(input.quoteId ?? `pq_${randomUUID()}`),
        sourceAccountId: source.id,
        sourceAmount: amount,
        destinationAmount: destAmount,
        currency: amount.currency,
        destinationCurrency: destAmount?.currency ?? amount.currency,
        fees: Object.freeze([]),
        amountDebited: amount,
        fx: null,
        estimatedRoute: {
          railPreference: 'LEDGER_INTERNAL',
          paymentType,
          corridorId: null,
          providerIndependent: true,
        },
        estimatedDeliveryClass: 'LEDGER_INSTANT',
        settlementTimePromise: null,
        requiredApprovals: this.ports.requireApproval ? ['CUSTOMER_CONFIRMATION'] : ['NONE'],
        complianceState: blocked ? 'BLOCKED' : review ? 'REVIEW_REQUIRED' : 'CLEAR_SIMULATION',
        expiresAt,
        createdAt: now,
        productionMoneyMovement: false,
      });
      this.store.saveQuote(preview);
      return { outcome: 'OK', value: this.toQuoteResource(preview) };
    }

    const corridorId = `${source.jurisdiction}-${beneficiary?.destinationCountry ?? 'SA'}-${amount.currency}-${beneficiary?.currency ?? 'SAR'}`;
    const fxIntent: CreateFxQuoteIntent = {
      id: asIntentId(`q_${input.quoteId ?? randomUUID()}`),
      actionType: ACTION_TYPES.CREATE_FX_QUOTE,
      idempotencyKey: `q_${input.quoteId ?? randomUUID()}`,
      actorId: input.actorId,
      requestedAt: now,
      purpose: 'CUSTOMER_FX',
      payload: {
        quoteId: input.quoteId ?? `quote_${randomUUID()}`,
        accountId: source.id,
        baseCurrency: amount.currency as CreateFxQuoteIntent['payload']['baseCurrency'],
        quoteCurrency: (beneficiary?.currency ?? amount.currency) as CreateFxQuoteIntent['payload']['quoteCurrency'],
        sourceAmount: amount,
        corridorId,
      },
    };
    const quoted = this.payments.createQuote(fxIntent);
    if (quoted.outcome !== 'OK') {
      return this.fromPayments(quoted);
    }
    const preview = freezeQuotePreview({
      quoteId: quoted.value.quoteId,
      sourceAccountId: source.id,
      sourceAmount: quoted.value.sourceAmount,
      destinationAmount: quoted.value.destinationAmount,
      currency: quoted.value.sourceAmount.currency,
      destinationCurrency: quoted.value.destinationAmount.currency,
      fees: Object.freeze([
        { code: 'RAIL_FEE', amount: quoted.value.fee, description: 'simulation rail fee' },
      ]),
      amountDebited: quoted.value.amountDebited,
      fx: {
        rateLabel: rateLabel(quoted.value.customerRate),
        rateSource: quoted.value.rateSource,
        reference: quoted.value.quoteId,
      },
      estimatedRoute: {
        railPreference: rail,
        paymentType,
        corridorId: quoted.value.corridorId,
        providerIndependent: true,
      },
      estimatedDeliveryClass: 'UNKNOWN_UNTIL_PROVIDER',
      settlementTimePromise: null,
      requiredApprovals: this.ports.requireApproval ? ['CUSTOMER_CONFIRMATION'] : ['NONE'],
      complianceState: blocked ? 'BLOCKED' : review ? 'REVIEW_REQUIRED' : 'CLEAR_SIMULATION',
      expiresAt: quoted.value.expiresAt,
      createdAt: quoted.value.createdAt,
      productionMoneyMovement: false,
    });
    this.store.saveQuote(preview);
    return { outcome: 'OK', value: this.toQuoteResource(preview) };
  }

  createPayment(input: {
    readonly actorId: string;
    readonly ownerId: string;
    readonly sourceAccountId: string;
    readonly beneficiaryId?: string;
    readonly destinationAccountId?: string;
    readonly amountMinorUnits: string;
    readonly currency: string;
    readonly quoteId?: string;
    readonly purpose?: string;
    readonly reference?: string;
    readonly railPreference?: RailPreference;
    readonly idempotencyKey: string;
    readonly paymentId?: string;
    readonly approveNow?: boolean;
    readonly stepUpSatisfied?: boolean;
  }): PaymentPlatformOutcome<PaymentResource> {
    const replayed = this.store.getIntentByIdempotency(input.idempotencyKey);
    if (replayed) {
      if (replayed.status === 'AWAITING_STEP_UP_AUTH' && input.stepUpSatisfied === true) {
        const sourceAccount = this.ports.catalog.accounts.get(replayed.sourceAccountId);
        const replayBeneficiary = replayed.beneficiaryId
          ? this.payments.getStore().getBeneficiary(replayed.beneficiaryId)
          : undefined;
        if (!sourceAccount) {
          return this.reject('ACCOUNT_NOT_FOUND', 'source account missing');
        }
        const nextStatus = this.ports.requireApproval ? 'AWAITING_APPROVAL' : 'AUTHORIZED';
        const advanced = this.transition(replayed, nextStatus);
        if (advanced.status === 'AWAITING_APPROVAL') {
          const approval = this.createApproval(advanced);
          return {
            outcome: 'AWAITING_APPROVAL',
            value: this.toPaymentResource({ ...advanced, policy: { ...advanced.policy, approvalId: approval.approvalId } }),
          };
        }
        return this.execute(advanced, input.actorId, sourceAccount, replayBeneficiary);
      }
      if (replayed.status === 'AWAITING_APPROVAL') {
        return { outcome: 'AWAITING_APPROVAL', value: this.toPaymentResource(replayed) };
      }
      if (replayed.status === 'AWAITING_STEP_UP_AUTH') {
        return {
          outcome: 'STEP_UP_REQUIRED',
          needed: 'STRONG',
          current: 'STANDARD',
          paymentId: replayed.paymentId,
        };
      }
      return { outcome: 'OK', value: this.toPaymentResource(replayed), replay: true };
    }
    const source = this.ports.catalog.accounts.get(input.sourceAccountId as Account['id']);
    if (!source || source.ownerId !== input.ownerId) {
      return this.reject('RESOURCE_NOT_OWNED', 'source account is not owned by this customer');
    }
    const amount = Money.fromMinorUnits(BigInt(input.amountMinorUnits), input.currency);
    const quote = input.quoteId ? this.store.getQuote(input.quoteId) : undefined;
    if (input.quoteId && !quote) {
      return this.reject('QUOTE_NOT_FOUND', 'quote does not exist');
    }
    if (quote && Date.parse(quote.expiresAt) <= Date.parse(this.ports.clock.now())) {
      return this.reject('QUOTE_EXPIRED', 'quote has expired');
    }
    const beneficiary = input.beneficiaryId
      ? this.payments.getStore().getBeneficiary(input.beneficiaryId)
      : undefined;
    if (input.beneficiaryId && !beneficiary) {
      return this.reject('BENEFICIARY_NOT_FOUND', 'beneficiary does not exist');
    }
    if (beneficiary && beneficiary.ownerId !== input.ownerId) {
      return this.reject('CROSS_USER_DENIED', 'beneficiary is not owned by this customer');
    }
    const destType = this.resolveDestinationType(source, input.destinationAccountId, beneficiary);
    const rail = input.railPreference ?? quote?.estimatedRoute.railPreference ?? (destType === 'OWN_ACCOUNT' || destType === 'SUNREY_USER' ? 'LEDGER_INTERNAL' : 'UNSPECIFIED');
    const paymentType = paymentTypeForDestination(destType, rail);
    const limit = evaluatePaymentLimits(
      {
        amount,
        at: this.ports.clock.now(),
        currency: amount.currency,
        rail,
        paymentType,
        jurisdiction: source.jurisdiction,
        riskClass: 'STANDARD',
      },
      this.store.usageFor(input.ownerId),
      this.ports.limits ?? DEFAULT_PAYMENT_LIMITS,
    );
    if (limit.outcome !== 'ALLOW') {
      return this.reject('LIMIT_EXCEEDED', `${limit.window} payment limit exceeded`);
    }
    const session = this.ports.sessionFor?.(input.actorId) ?? null;
    const security = evaluateBeneficiarySecurity(
      {
        ownerId: input.ownerId,
        actorId: input.actorId,
        session,
        deviceRisk: this.ports.deviceRiskFor?.(input.actorId) ?? this.riskFromSession(input.actorId),
        now: this.ports.clock.now(),
        recentCreates: [],
      },
      this.ports.securityPolicy ?? DEFAULT_BENEFICIARY_SECURITY_POLICY,
    );
    const paymentId = asPaymentId(input.paymentId ?? `pay_${randomUUID()}`);
    let status: PaymentLifecycleStatus = 'QUOTED';
    if (security.outcome === 'STEP_UP_REQUIRED' && input.stepUpSatisfied !== true) {
      status = 'AWAITING_STEP_UP_AUTH';
    } else if (this.ports.requireApproval && input.approveNow !== true) {
      status = 'AWAITING_APPROVAL';
    }
    const intent = this.draftIntent({
      paymentId,
      ownerId: input.ownerId,
      source,
      beneficiary,
      destinationAccountId: input.destinationAccountId ?? null,
      destType,
      amount,
      quote,
      paymentType,
      rail,
      purpose: input.purpose ?? 'customer transfer',
      reference: input.reference ?? input.idempotencyKey,
      idempotencyKey: input.idempotencyKey,
      status,
    });
    this.store.saveIntent(intent);
    void this.workflows.start({
      workflowType: PAYMENT_WORKFLOW_TYPE,
      workflowId: `wf_${paymentId}`,
      context: {
        paymentId,
        stepUpRequired: status === 'AWAITING_STEP_UP_AUTH' ? 'true' : 'false',
        approvalRequired: status === 'AWAITING_APPROVAL' ? 'true' : 'false',
      },
    });
    if (status === 'AWAITING_STEP_UP_AUTH') {
      return {
        outcome: 'STEP_UP_REQUIRED',
        needed: security.outcome === 'STEP_UP_REQUIRED' ? security.needed : 'STRONG',
        current: security.outcome === 'STEP_UP_REQUIRED' ? security.current : 'STANDARD',
        paymentId,
      };
    }
    if (status === 'AWAITING_APPROVAL') {
      const approval = this.createApproval(intent);
      return { outcome: 'AWAITING_APPROVAL', value: this.toPaymentResource({ ...intent, policy: { ...intent.policy, approvalId: approval.approvalId } }) };
    }
    return this.execute(intent, input.actorId, source, beneficiary);
  }

  approvePayment(input: {
    readonly actorId: string;
    readonly ownerId: string;
    readonly paymentId: string;
    readonly approvalId?: string;
  }): PaymentPlatformOutcome<PaymentResource> {
    const intent = this.store.getIntent(input.paymentId);
    if (!intent) {
      return this.reject('NOT_FOUND', 'payment does not exist');
    }
    if (intent.payerId !== input.ownerId) {
      return this.reject('RESOURCE_NOT_OWNED', 'payment is not owned by this customer');
    }
    const approval = input.approvalId
      ? this.store.getApproval(input.approvalId)
      : this.store.approvalForPayment(input.paymentId);
    if (!approval || approval.customerId !== input.ownerId) {
      return this.reject('APPROVAL_NOT_FOUND', 'payment approval does not exist');
    }
    if (approval.status === 'APPROVED' && (intent.status === 'SETTLED' || intent.status === 'SUBMITTED')) {
      return { outcome: 'OK', value: this.toPaymentResource(intent), replay: true };
    }
    const nextApproval: PaymentApproval = Object.freeze({
      ...approval,
      status: 'APPROVED',
      decidedAt: this.ports.clock.now(),
    });
    this.store.saveApproval(nextApproval);
    const source = this.ports.catalog.accounts.get(intent.sourceAccountId);
    const beneficiary = intent.beneficiaryId
      ? this.payments.getStore().getBeneficiary(intent.beneficiaryId)
      : undefined;
    if (!source) {
      return this.reject('ACCOUNT_NOT_FOUND', 'source account missing');
    }
    const authorized = this.transition(intent, 'AUTHORIZED');
    return this.execute(authorized, input.actorId, source, beneficiary);
  }

  getPayment(ownerId: string, paymentId: string): PaymentPlatformOutcome<PaymentResource> {
    const intent = this.store.getIntent(paymentId);
    if (!intent) {
      return this.reject('NOT_FOUND', 'payment does not exist');
    }
    if (intent.payerId !== ownerId) {
      return this.reject('RESOURCE_NOT_OWNED', 'payment is not owned by this customer');
    }
    return { outcome: 'OK', value: this.toPaymentResource(intent) };
  }

  listPayments(ownerId: string): readonly PaymentResource[] {
    return this.store.listIntents(ownerId).map((row) => this.toPaymentResource(row));
  }

  applyFailure(paymentId: string, failureClass: PaymentFailureClass): PaymentPlatformOutcome<PaymentResource> {
    const intent = this.store.getIntent(paymentId);
    if (!intent) {
      return this.reject('NOT_FOUND', 'payment does not exist');
    }
    const digest = `${paymentId}:${failureClass}:${intent.status}`;
    if (this.store.seenCallback(digest) && (failureClass === 'DUPLICATE_CALLBACK' || failureClass === 'LATE_CALLBACK')) {
      return { outcome: 'OK', value: this.toPaymentResource(intent), replay: true };
    }
    this.store.rememberCallback(digest);
    const disposition = disposePaymentFailure({ current: intent.status, failureClass });
    if (disposition.nextStatus === 'IGNORE') {
      return { outcome: 'OK', value: this.toPaymentResource(intent), replay: true };
    }
    const next = this.transition(intent, disposition.nextStatus);
    this.store.saveIntent(next);
    return { outcome: 'OK', value: this.toPaymentResource(next) };
  }

  admitInbound(notice: Parameters<typeof admitInboundNotice>[0]): InboundFundingNotice {
    const admitted = admitInboundNotice(notice);
    this.store.saveInbound(admitted);
    if (inboundMustNotCredit(admitted)) {
      this.ports.evidence.seal('INBOUND_UNVERIFIED_REJECTED', {
        noticeId: admitted.noticeId,
        credited: false,
      });
    }
    return admitted;
  }

  async recoverWorkflow(workflowId: string): Promise<string> {
    const resumed = await this.workflows.resume(workflowId, { recovered: 'true' });
    return resumed.state;
  }

  /**
   * Kernel-gated same-currency ledger transfer. Registered mutator.
   */
  transferInternal(
    intent: InternalTransferIntent | InitiatePaymentIntent,
    destinationAccountId?: string,
  ): PaymentsServiceOutcome<PaymentIntent> {
    const replayed = this.store.getIntentByIdempotency(intent.idempotencyKey);
    if (replayed && (replayed.status === 'SETTLED' || replayed.journalIds.length > 0)) {
      return { outcome: 'OK', value: replayed, decision: this.emptyDecision(intent.actionType, intent.id), replay: true };
    }
    const existingDraft = replayed;
    const sourceId =
      'sourceAccountId' in intent.payload ? intent.payload.sourceAccountId : intent.payload.accountId;
    const destId =
      destinationAccountId ??
      ('destinationAccountId' in intent.payload ? intent.payload.destinationAccountId : undefined);
    if (!destId) {
      return {
        outcome: 'REJECTED',
        code: 'DESTINATION_REQUIRED',
        message: 'destination account is required',
        decision: null,
      };
    }
    const source = this.ports.catalog.accounts.get(sourceId as Account['id']);
    const dest = this.ports.catalog.accounts.get(destId as Account['id']);
    const customer = source ? this.ports.catalog.customers.get(source.ownerId) : undefined;
    const amount =
      'amount' in intent.payload ? intent.payload.amount : (intent.payload as InitiatePaymentIntent).payload.sourceAmount;
    const gated = this.gate(intent, source, customer, { amount });
    if (gated.outcome !== 'ALLOWED') {
      return gated.result;
    }
    if (!source || !dest) {
      return this.paymentsReject(intent, gated.decision, 'ACCOUNT_NOT_FOUND', 'account does not exist');
    }
    if (source.currency !== dest.currency || source.currency !== amount.currency) {
      return this.paymentsReject(intent, gated.decision, 'CURRENCY_MISMATCH', 'transfer must preserve currency');
    }
    if (source.id === dest.id) {
      return this.paymentsReject(intent, gated.decision, 'SAME_ACCOUNT', 'source and destination must differ');
    }
    const available = this.availableFunds(source);
    if (available.cmp(amount) < 0) {
      return this.paymentsReject(intent, gated.decision, 'INSUFFICIENT_FUNDS', 'transfer exceeds available source balance');
    }
    const bridge =
      source.accountClass === dest.accountClass
        ? undefined
        : findClassBridge(source.accountClass, dest.accountClass);
    if (source.accountClass !== dest.accountClass && !bridge) {
      return this.paymentsReject(
        intent,
        gated.decision,
        'CLASS_BRIDGE_UNDEFINED',
        'no disclosed class bridge is defined',
      );
    }
    const journal = postPaymentJournal(
      this.ports.ledger,
      gated.authority,
      intent.actionType,
      internalTransferPlan(source.id, dest.id, amount, bridge),
    );
    const paymentId = existingDraft?.paymentId ?? asPaymentId(`pay_${intent.idempotencyKey}`);
    const now = this.ports.clock.now();
    const record = freezePaymentIntent({
      ...(existingDraft ?? {
        payerId: source.ownerId,
        sourceAccountId: source.id,
        beneficiaryId: null,
        destination: { type: source.ownerId === dest.ownerId ? 'OWN_ACCOUNT' : 'SUNREY_USER', accountId: dest.id, displayHint: dest.id.slice(-4) },
        amount,
        currency: amount.currency,
        destinationAmount: amount,
        paymentType: source.ownerId === dest.ownerId ? 'ACCOUNT_TO_ACCOUNT' : 'SUNREY_TO_SUNREY',
        railPreference: 'LEDGER_INTERNAL',
        purpose: 'internal transfer',
        reference: intent.idempotencyKey,
        fees: [],
        fx: null,
        createdAt: now,
        expiresAt: null,
        providerReference: null,
        idempotencyKey: intent.idempotencyKey,
        holdId: null,
        quoteId: null,
        railOrderId: null,
      }),
      paymentId,
      payerId: source.ownerId,
      sourceAccountId: source.id,
      beneficiaryId: null,
      destination: { type: source.ownerId === dest.ownerId ? 'OWN_ACCOUNT' : 'SUNREY_USER', accountId: dest.id, displayHint: dest.id.slice(-4) },
      amount,
      currency: amount.currency,
      destinationAmount: amount,
      paymentType: source.ownerId === dest.ownerId ? 'ACCOUNT_TO_ACCOUNT' : 'SUNREY_TO_SUNREY',
      railPreference: 'LEDGER_INTERNAL',
      purpose: 'internal transfer',
      reference: intent.idempotencyKey,
      fees: [],
      fx: null,
      status: 'SETTLED',
      createdAt: now,
      updatedAt: now,
      expiresAt: null,
      providerReference: null,
      idempotencyKey: intent.idempotencyKey,
      policy: {
        kernelEvidenceId: gated.decision.evidenceRecordId,
        screeningRef: null,
        limitsPolicyId: (this.ports.limits ?? DEFAULT_PAYMENT_LIMITS).policyId,
        approvalId: null,
        workflowId: null,
      },
      journalIds: [journal.id],
      evidenceIds: [gated.decision.evidenceRecordId],
      holdId: null,
      quoteId: null,
      railOrderId: null,
    });
    this.store.saveIntent(record);
    this.store.recordUsage(source.ownerId, {
      amount,
      at: now,
      currency: amount.currency,
      rail: 'LEDGER_INTERNAL',
      paymentType: record.paymentType,
      jurisdiction: source.jurisdiction,
      riskClass: 'STANDARD',
    });
    this.ports.events.append({
      eventType: 'PaymentSettled',
      schemaVersion: 1,
      occurredAt: now,
      intentId: intent.id,
      correlationId: intent.id,
      causationId: gated.decision.evidenceRecordId,
      evidenceId: gated.decision.evidenceRecordId,
      aggregateType: 'payment',
      aggregateId: paymentId,
      payload: {
        paymentId,
        sourceAccountId: source.id,
        destinationAccountId: dest.id,
        journalId: journal.id,
      },
    } as never);
    this.ports.evidence.seal('INTERNAL_TRANSFER_SETTLED', {
      intentId: intent.id,
      journalId: journal.id,
      paymentId,
    });
    return { outcome: 'OK', value: record, decision: gated.decision };
  }

  private execute(
    intent: PaymentIntent,
    actorId: string,
    source: Account,
    beneficiary: Beneficiary | undefined,
  ): PaymentPlatformOutcome<PaymentResource> {
    if (intent.railPreference === 'LEDGER_INTERNAL' || intent.destination.type === 'OWN_ACCOUNT' || intent.destination.type === 'SUNREY_USER') {
      const destId = intent.destination.accountId ?? this.sunReyAccountFrom(beneficiary);
      if (!destId) {
        return this.reject('DESTINATION_REQUIRED', 'SunRey destination account is required');
      }
      const sameOwner = this.ports.catalog.accounts.get(destId as Account['id'])?.ownerId === source.ownerId;
      const transferIntent = sameOwner
        ? this.internalIntent(actorId, source.id, destId, intent)
        : this.initiateIntent(actorId, source.id, destId, intent, beneficiary);
      const posted = this.transferInternal(transferIntent, destId);
      if (posted.outcome !== 'OK') {
        return this.fromPayments(posted);
      }
      return { outcome: 'OK', value: this.toPaymentResource(posted.value), replay: posted.replay };
    }
    if (!beneficiary || !intent.quoteId) {
      return this.reject('QUOTE_REQUIRED', 'external payment requires a beneficiary and quote');
    }
    const accept: AcceptFxQuoteIntent = {
      id: asIntentId(`acc_${intent.paymentId}`),
      actionType: ACTION_TYPES.ACCEPT_FX_QUOTE,
      idempotencyKey: `acc_${intent.idempotencyKey}`,
      actorId,
      requestedAt: this.ports.clock.now(),
      purpose: 'CUSTOMER_FX',
      payload: { quoteId: intent.quoteId, accountId: source.id },
    };
    const accepted = this.payments.acceptQuote(accept);
    if (accepted.outcome !== 'OK') {
      return this.fromPayments(accepted);
    }
    const pay: InitiatePaymentIntent = {
      id: asIntentId(`pay_${intent.paymentId}`),
      actionType: ACTION_TYPES.INITIATE_PAYMENT,
      idempotencyKey: intent.idempotencyKey,
      actorId,
      requestedAt: this.ports.clock.now(),
      purpose: 'CUSTOMER_CROSS_BORDER_PAYMENT',
      payload: {
        paymentId: intent.paymentId,
        accountId: source.id,
        sourceAccountId: source.id,
        beneficiaryId: beneficiary.beneficiaryId,
        quoteId: intent.quoteId,
        sourceAmount: intent.amount,
        purposeReference: intent.purpose,
      },
    };
    const initiated = this.payments.initiatePayment(pay);
    if (initiated.outcome !== 'OK') {
      return this.fromPayments(initiated);
    }
    const mapped = this.transition(intent, lifecycleFromRailStatus(initiated.value.status), {
      railOrderId: initiated.value.paymentId,
      providerReference: initiated.value.settlementRef,
      journalIds: initiated.value.journalIds,
      holdId: initiated.value.holdId,
      policy: { ...intent.policy, kernelEvidenceId: initiated.decision.evidenceRecordId },
    });
    this.store.saveIntent(mapped);
    return { outcome: 'OK', value: this.toPaymentResource(mapped), replay: initiated.replay };
  }

  private draftIntent(input: {
    readonly paymentId: PaymentId;
    readonly ownerId: string;
    readonly source: Account;
    readonly beneficiary?: Beneficiary;
    readonly destinationAccountId: string | null;
    readonly destType: PaymentIntent['destination']['type'];
    readonly amount: Money;
    readonly quote?: PaymentQuotePreview;
    readonly paymentType: PaymentType;
    readonly rail: RailPreference;
    readonly purpose: string;
    readonly reference: string;
    readonly idempotencyKey: string;
    readonly status: PaymentLifecycleStatus;
  }): PaymentIntent {
    const now = this.ports.clock.now();
    return freezePaymentIntent({
      paymentId: input.paymentId,
      payerId: input.ownerId as PaymentIntent['payerId'],
      sourceAccountId: input.source.id,
      beneficiaryId: input.beneficiary?.beneficiaryId ?? null,
      destination: {
        type: input.destType,
        accountId: (input.destinationAccountId ?? this.sunReyAccountFrom(input.beneficiary)) as PaymentIntent['destination']['accountId'],
        displayHint: input.beneficiary?.accountCoordinate.displayHint ?? (input.destinationAccountId ?? '').slice(-4),
      },
      amount: input.amount,
      currency: input.amount.currency,
      destinationAmount: input.quote?.destinationAmount ?? input.amount,
      paymentType: input.paymentType,
      railPreference: input.rail,
      purpose: input.purpose,
      reference: input.reference,
      fees: input.quote?.fees ?? [],
      fx: input.quote?.fx
        ? { quoteId: input.quote.quoteId, rateLabel: input.quote.fx.rateLabel, rateSource: input.quote.fx.rateSource, pricingVersion: 'simulation' }
        : null,
      status: input.status,
      createdAt: now,
      updatedAt: now,
      expiresAt: input.quote?.expiresAt ?? null,
      providerReference: null,
      idempotencyKey: input.idempotencyKey,
      policy: {
        kernelEvidenceId: null,
        screeningRef: input.beneficiary?.screeningRef ?? null,
        limitsPolicyId: (this.ports.limits ?? DEFAULT_PAYMENT_LIMITS).policyId,
        approvalId: null,
        workflowId: `wf_${input.paymentId}`,
      },
      journalIds: [],
      evidenceIds: [],
      holdId: null,
      quoteId: input.quote?.quoteId ?? null,
      railOrderId: null,
    });
  }

  private transition(
    intent: PaymentIntent,
    to: PaymentLifecycleStatus,
    patch: Partial<PaymentIntent> = {},
  ): PaymentIntent {
    const allowed = assertLifecycleTransition(intent.paymentId, intent.status, to);
    if (isErr(allowed)) {
      throw new Error(`${allowed.error.code}: ${allowed.error.from} -> ${allowed.error.to}`);
    }
    const next = freezePaymentIntent({
      ...intent,
      ...patch,
      status: to,
      updatedAt: this.ports.clock.now(),
    });
    this.store.saveIntent(next);
    return next;
  }

  private createApproval(intent: PaymentIntent): PaymentApproval {
    const approval: PaymentApproval = Object.freeze({
      approvalId: `apr_${intent.paymentId}`,
      paymentId: intent.paymentId,
      customerId: intent.payerId,
      status: 'PENDING',
      createdAt: this.ports.clock.now(),
      decidedAt: null,
    });
    this.store.saveApproval(approval);
    this.store.saveIntent(
      freezePaymentIntent({
        ...intent,
        policy: { ...intent.policy, approvalId: approval.approvalId },
      }),
    );
    return approval;
  }

  private gate(
    intent: InternalTransferIntent | InitiatePaymentIntent,
    account: Account | undefined,
    customer: Customer | undefined,
    extra: Partial<KernelFacts> = {},
  ):
    | { readonly outcome: 'ALLOWED'; readonly decision: AuthorizationDecision; readonly authority: ExecutionAuthority }
    | { readonly outcome: 'REFUSED'; readonly result: PaymentsServiceOutcome<never> } {
    const resolved = this.ports.identity.resolveActorContext(intent.actorId);
    const product = account ? this.ports.catalog.products.get(account.productId) : undefined;
    const legalEntity = account ? this.ports.catalog.legalEntities.get(account.legalEntityId) : undefined;
    const facts: KernelFacts = {
      actor: {
        id: intent.actorId,
        capabilities: resolved.ok ? actionTypesFromCapabilities(resolved.value.authorizedCapabilities) : [],
      },
      identity: this.ports.identity.identityFactsFor(intent.actorId),
      ...(customer ? { customer } : {}),
      ...(legalEntity ? { legalEntity } : {}),
      ...(product ? { product } : {}),
      ...(account ? { sourceAccount: account, jurisdiction: account.jurisdiction } : {}),
      ...extra,
    };
    const decision = this.ports.kernel.submit(intent, facts);
    this.ports.events.append({
      eventType: 'KernelDecisionRecorded',
      schemaVersion: 1,
      occurredAt: this.ports.clock.now(),
      intentId: intent.id,
      correlationId: intent.id,
      causationId: decision.evidenceRecordId,
      evidenceId: decision.evidenceRecordId,
      aggregateType: 'kernel',
      aggregateId: intent.id,
      payload: { intentId: intent.id, actionType: intent.actionType, status: decision.status },
    } as never);
    if (decision.status !== 'ALLOW') {
      this.ports.evidence.seal(`${intent.actionType}_KERNEL_REFUSED`, {
        intentId: intent.id,
        status: decision.status,
        posted: false,
      });
      return { outcome: 'REFUSED', result: { outcome: 'KERNEL_REFUSED', decision } };
    }
    const structural = validateIntentStructure(intent, {
      products: this.ports.catalog.products,
      legalEntities: this.ports.catalog.legalEntities,
      accounts: this.ports.catalog.accounts,
    });
    if (isErr(structural)) {
      return {
        outcome: 'REFUSED',
        result: this.paymentsReject(intent, decision, structural.error.code, structural.error.message),
      };
    }
    if (!decision.executionAuthority) {
      return {
        outcome: 'REFUSED',
        result: this.paymentsReject(intent, decision, 'MISSING_EXECUTION_AUTHORITY', 'ALLOW without authority'),
      };
    }
    const accountId =
      'sourceAccountId' in intent.payload ? intent.payload.sourceAccountId : intent.payload.accountId;
    const verified = this.ports.issuer.verify(
      decision.executionAuthority,
      { actionType: intent.actionType, accountId, intentId: intent.id },
      this.ports.clock,
    );
    if (!isOk(verified)) {
      return {
        outcome: 'REFUSED',
        result: this.paymentsReject(intent, decision, verified.error.code, verified.error.message),
      };
    }
    return { outcome: 'ALLOWED', decision, authority: verified.value };
  }

  private availableFunds(account: Account): Money {
    const postings = this.ports.ledger.listPostingsForAccount(account.id);
    let credits = Money.zero(account.currency);
    let debits = Money.zero(account.currency);
    for (const posting of postings) {
      if (ledgerAssetKey(posting.amount) !== account.currency) {
        continue;
      }
      if (posting.direction === 'CREDIT') {
        credits = credits.plus(asMoney(posting.amount));
      } else {
        debits = debits.plus(asMoney(posting.amount));
      }
    }
    return credits.minus(debits);
  }

  private internalIntent(
    actorId: string,
    sourceId: string,
    destId: string,
    intent: PaymentIntent,
  ): InternalTransferIntent {
    return {
      id: asIntentId(`int_${intent.paymentId}`),
      actionType: ACTION_TYPES.INTERNAL_TRANSFER,
      idempotencyKey: intent.idempotencyKey,
      actorId,
      requestedAt: this.ports.clock.now(),
      purpose: 'CUSTOMER_TRANSFER',
      payload: {
        sourceAccountId: sourceId as InternalTransferIntent['payload']['sourceAccountId'],
        destinationAccountId: destId as InternalTransferIntent['payload']['destinationAccountId'],
        amount: intent.amount,
      },
    };
  }

  private initiateIntent(
    actorId: string,
    sourceId: string,
    destId: string,
    intent: PaymentIntent,
    beneficiary: Beneficiary | undefined,
  ): InitiatePaymentIntent {
    return {
      id: asIntentId(`pay_${intent.paymentId}`),
      actionType: ACTION_TYPES.INITIATE_PAYMENT,
      idempotencyKey: intent.idempotencyKey,
      actorId,
      requestedAt: this.ports.clock.now(),
      purpose: 'CUSTOMER_CROSS_BORDER_PAYMENT',
      payload: {
        paymentId: intent.paymentId,
        accountId: sourceId as InitiatePaymentIntent['payload']['accountId'],
        sourceAccountId: sourceId as InitiatePaymentIntent['payload']['sourceAccountId'],
        beneficiaryId: beneficiary?.beneficiaryId ?? destId,
        quoteId: intent.quoteId ?? `internal_${intent.paymentId}`,
        sourceAmount: intent.amount,
        purposeReference: intent.purpose,
      },
    };
  }

  private sunReyAccountFrom(beneficiary: Beneficiary | undefined): string | null {
    if (!beneficiary || beneficiary.accountCoordinate.scheme !== 'SUNREY_ACCOUNT') {
      return null;
    }
    const hinted = beneficiary.accountCoordinate.displayHint;
    return this.ports.catalog.accounts.get(hinted as Account['id'])?.id ?? hinted;
  }

  private resolveDestinationType(
    source: Account,
    destinationAccountId: string | undefined,
    beneficiary: Beneficiary | undefined,
  ): PaymentIntent['destination']['type'] {
    if (destinationAccountId) {
      const dest = this.ports.catalog.accounts.get(destinationAccountId as Account['id']);
      return ledgerDestinationType(dest?.ownerId === source.ownerId);
    }
    return destinationTypeFromScheme(
      beneficiary?.accountCoordinate.scheme ?? 'SUNREY_ACCOUNT',
      source.jurisdiction,
      beneficiary?.destinationCountry ?? source.jurisdiction,
    );
  }

  private requireSameCurrency(source: Account, destId: string, amount: Money): Money | null {
    const dest = this.ports.catalog.accounts.get(destId as Account['id']);
    if (!dest || dest.currency !== source.currency || dest.currency !== amount.currency) {
      return null;
    }
    return amount;
  }

  private ownerOfActor(actorId: string): string | null {
    const facts = this.ports.identity.identityFactsFor(actorId);
    return facts.customerId ?? null;
  }

  private riskFromSession(actorId: string): DeviceRiskLevel {
    const session = this.ports.sessionFor?.(actorId);
    if (!session) {
      return 'STANDARD';
    }
    if (session.riskState === 'BLOCKED') {
      return 'BLOCKED';
    }
    if (session.riskState === 'ELEVATED') {
      return 'ELEVATED';
    }
    return 'LOW';
  }

  private toRecipient(row: Beneficiary, ownerCountry: string): Recipient {
    return Object.freeze({
      id: row.beneficiaryId,
      ownerId: row.ownerId,
      displayName: row.legalName,
      destinationType: destinationTypeFromScheme(row.accountCoordinate.scheme, ownerCountry, row.destinationCountry),
      country: row.destinationCountry,
      currency: row.currency,
      displayHint: row.accountCoordinate.displayHint,
      relationship: null,
      purpose: null,
      verificationStatus: row.status,
      screeningStatus: row.screeningStatus,
      createdAt: row.createdAt,
    });
  }

  private toQuoteResource(quote: PaymentQuotePreview): PaymentQuote {
    return Object.freeze({
      quoteId: quote.quoteId,
      sourceAmount: moneyOf(quote.sourceAmount),
      destinationAmount: quote.destinationAmount ? moneyOf(quote.destinationAmount) : null,
      currency: quote.currency,
      fees: quote.fees.map((fee) =>
        Object.freeze({ code: fee.code, amount: moneyOf(fee.amount), description: fee.description }),
      ),
      amountDebited: moneyOf(quote.amountDebited),
      fx: quote.fx,
      estimatedRoute: {
        railPreference: quote.estimatedRoute.railPreference,
        paymentType: quote.estimatedRoute.paymentType,
        corridorId: quote.estimatedRoute.corridorId,
      },
      estimatedDeliveryClass: quote.estimatedDeliveryClass,
      settlementTimePromise: null,
      requiredApprovals: quote.requiredApprovals,
      complianceState: quote.complianceState,
      expiresAt: quote.expiresAt,
      productionMoneyMovement: false,
    });
  }

  private toPaymentResource(intent: PaymentIntent): PaymentResource {
    return Object.freeze({
      paymentId: intent.paymentId,
      payerId: intent.payerId,
      sourceAccountId: intent.sourceAccountId,
      beneficiaryId: intent.beneficiaryId,
      destination: intent.destination,
      amount: moneyOf(intent.amount),
      destinationAmount: moneyOf(intent.destinationAmount),
      currency: intent.currency,
      paymentType: intent.paymentType,
      railPreference: intent.railPreference,
      purpose: intent.purpose,
      reference: intent.reference,
      fees: intent.fees.map((fee) =>
        Object.freeze({ code: fee.code, amount: moneyOf(fee.amount), description: fee.description }),
      ),
      fx: intent.fx
        ? { rateLabel: intent.fx.rateLabel, rateSource: intent.fx.rateSource, reference: intent.fx.quoteId }
        : null,
      status: intent.status,
      createdAt: intent.createdAt,
      expiresAt: intent.expiresAt,
      providerReference: intent.providerReference,
      idempotencyKey: intent.idempotencyKey,
      approvalId: intent.policy.approvalId,
      workflowId: intent.policy.workflowId,
      productionMoneyMovement: false,
    });
  }

  private fromPayments<T>(result: PaymentsServiceOutcome<T>): PaymentPlatformOutcome<never> {
    if (result.outcome === 'KERNEL_REFUSED') {
      return { outcome: 'KERNEL_REFUSED', decision: result.decision };
    }
    return this.reject(result.code, result.message);
  }

  private reject(code: string, message: string): PaymentPlatformOutcome<never> {
    return { outcome: 'REJECTED', code, message };
  }

  private paymentsReject(
    intent: { readonly actionType: string; readonly id: string },
    decision: AuthorizationDecision | null,
    code: string,
    message: string,
  ): PaymentsServiceOutcome<never> {
    const evidence = this.ports.evidence.seal(`${intent.actionType}_REJECTED`, {
      intentId: intent.id,
      code,
      message,
      posted: false,
    });
    return { outcome: 'REJECTED', code, message, decision, evidenceId: evidence.evidenceId };
  }

  private emptyDecision(actionType: string, intentId: string): AuthorizationDecision {
    return {
      status: 'ALLOW',
      intentId,
      actionType,
      proofs: [],
      executionAuthority: null,
      evidenceRecordId: '',
      decidedAt: this.ports.clock.now(),
    };
  }
}

function moneyOf(amount: Money): { readonly minorUnits: string; readonly currency: string } {
  return Object.freeze({ minorUnits: amount.minorUnits.toString(), currency: amount.currency });
}
