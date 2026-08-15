import { addMs, type Clock } from '../../config/src/clock.ts';
import type { Account } from '../../domain/src/account.ts';
import { asCurrencyCode } from '../../domain/src/currency.ts';
import type { Customer } from '../../domain/src/customer.ts';
import { asHoldId, type FundsHold } from '../../domain/src/hold.ts';
import { isErr, isOk } from '../../domain/src/result.ts';
import type { EvidenceVault } from '../../evidence/src/vault.ts';
import type { DomainEventLog } from '../../events/src/events.ts';
import { actionTypesFromCapabilities, type IdentityAuthorityPort } from '../../identity/src/index.ts';
import { evaluateFraud } from '../../kernel/src/compliance/fraud.ts';
import type { ComplianceFacts } from '../../kernel/src/compliance/facts.ts';
import type { ComplianceKernel } from '../../kernel/src/kernel.ts';
import type { KernelFacts } from '../../kernel/src/proofs.ts';
import type { Ledger } from '../../ledger/src/journal.ts';
import type { Journal } from '../../ledger/src/types.ts';
import { Money } from '../../money/src/money.ts';
import { asIntentId } from '../../permissions/src/action-intent.ts';
import {
  ACTION_TYPES,
  type AssessCardFeeIntent,
  type AuthorizeCardPurchaseIntent,
  type CardIntent,
  type ClearCardTransactionIntent,
  type CreateHoldIntent,
  type CaptureHoldIntent,
  type CancelHoldIntent,
  type DecideCardDisputeIntent,
  type OpenCardDisputeIntent,
  type RefundCardTransactionIntent,
  type ReleaseHoldIntent,
  type RequestCardIntent,
} from '../../permissions/src/action-types.ts';
import type { AuthorizationDecision } from '../../permissions/src/decision.ts';
import type { AuthorityIssuer, ExecutionAuthority } from '../../permissions/src/execution-authority.ts';
import { validateIntentStructure, type StructuralCatalog } from '../../permissions/src/structural.ts';
import type { SecretProvider } from '../../security/src/secrets.ts';
import { secretRef } from '../../security/src/secrets.ts';
import {
  customerFeePlan,
  disputeFinalChargebackPlan,
  disputeProvisionalCreditPlan,
  disputeProvisionalReversalPlan,
  feePlan,
  refundPlan,
  settlementDirectPlan,
  settlementReclassPlan,
} from './accounting.ts';
import {
  externalAuthorizationReason,
  freezeAuthorizationRecord,
  freezeAuthorizationRequest,
  type AuthorizationReasonCode,
  type CardAuthorizationRecord,
  type CardAuthorizationRequest,
} from './authorization.ts';
import {
  InMemoryCallbackReplayStore,
  verifyProcessorCallback,
  type CallbackReplayStore,
  type ProcessorCallbackEnvelope,
} from './callback.ts';
import { freezeCard, transitionCard, type Card } from './card.ts';
import { classifyClearing, freezeClearing, type CardClearingRecord } from './clearing.ts';
import { DEFAULT_CARD_CONTROLS, evaluateCardControls, mergeCardControls } from './controls.ts';
import { freezeDispute, transitionDispute, type CardDispute, type DisputeReasonCategory } from './dispute.ts';
import { freezeCardFee, type CardFeeType } from './fees.ts';
import { cardTransactionHistory, type CardHistoryEntry } from './history.ts';
import {
  asCardAuthorizationId,
  asCardClearingId,
  asCardFeeId,
  asCardId,
  asCardRefundId,
  asCardSettlementId,
  asDisputeId,
  asMerchantReference,
  asNetworkTokenReference,
  asProcessorCardReference,
} from './ids.ts';
import { postCardJournal } from './journals.ts';
import { SYNTHETIC_CARD_DISPLAY } from './pci-boundary.ts';
import { findCardProgram } from './program.ts';
import { reconcileCardTransaction, type CardReconciliationResult, type ProcessorCardReport } from './reconciliation.ts';
import { freezeRefund, type CardRefundRecord } from './refund.ts';
import type { CardProcessor } from './processor.ts';
import { SimulatedCardProcessor } from './simulated-processor.ts';
import { CardStore } from './store.ts';
import { freezeNetworkToken } from './token.ts';
import { registerCardTreasuryBooks } from './treasury.ts';

export type CardCatalogPorts = {
  readonly customers: { get(id: Customer['id']): Customer | undefined };
  readonly accounts: {
    get(id: Account['id']): Account | undefined;
    list(): readonly Account[];
  };
  readonly products: StructuralCatalog['products'];
  readonly legalEntities: StructuralCatalog['legalEntities'];
};

export type HoldGatewayOutcome<T> =
  | { readonly outcome: 'COMPLETED'; readonly value: T; readonly replay?: boolean }
  | { readonly outcome: 'KERNEL_REFUSED'; readonly decision: AuthorizationDecision }
  | {
      readonly outcome: 'REJECTED';
      readonly code: string;
      readonly message: string;
      readonly decision: AuthorizationDecision | null;
    };

export type CardHoldGateway = {
  createHold(intent: CreateHoldIntent): Promise<HoldGatewayOutcome<FundsHold>> | HoldGatewayOutcome<FundsHold>;
  releaseHold(intent: ReleaseHoldIntent): HoldGatewayOutcome<FundsHold>;
  captureHold(intent: CaptureHoldIntent): HoldGatewayOutcome<{ hold: FundsHold; journal: Journal }>;
  cancelHold(intent: CancelHoldIntent): HoldGatewayOutcome<FundsHold>;
  projectAvailable(account: Account): { readonly available: Money; readonly settled: Money; readonly held: Money };
};

export type CardsServiceOutcome<T> =
  | { readonly outcome: 'OK'; readonly value: T; readonly decision: AuthorizationDecision; readonly replay?: boolean }
  | { readonly outcome: 'KERNEL_REFUSED'; readonly decision: AuthorizationDecision }
  | {
      readonly outcome: 'REJECTED';
      readonly code: string;
      readonly message: string;
      readonly decision: AuthorizationDecision | null;
      readonly evidenceId?: string;
    };

const PROCESSOR_SECRET = secretRef('simulation', 'card-processor-callback');

export class CardsService {
  private readonly kernel: ComplianceKernel;
  private readonly issuer: AuthorityIssuer;
  private readonly ledger: Ledger;
  private readonly evidence: EvidenceVault;
  private readonly events: DomainEventLog;
  private readonly clock: Clock;
  private readonly catalog: CardCatalogPorts;
  private readonly identity: IdentityAuthorityPort;
  private readonly holds: CardHoldGateway;
  private readonly secrets: SecretProvider;
  readonly processor: CardProcessor;
  readonly store: CardStore;
  private readonly replay: CallbackReplayStore;
  private readonly processorActorId: string;
  private readonly operationsActorId: string;
  private readonly expectedProviderId: string;

  constructor(
    kernel: ComplianceKernel,
    issuer: AuthorityIssuer,
    ledger: Ledger,
    evidence: EvidenceVault,
    events: DomainEventLog,
    clock: Clock,
    catalog: CardCatalogPorts,
    identity: IdentityAuthorityPort,
    holds: CardHoldGateway,
    secrets: SecretProvider,
    options: {
      readonly store?: CardStore;
      readonly processor?: CardProcessor;
      readonly replay?: CallbackReplayStore;
      readonly processorActorId: string;
      readonly operationsActorId: string;
      readonly expectedProviderId?: string;
    },
  ) {
    this.kernel = kernel;
    this.issuer = issuer;
    this.ledger = ledger;
    this.evidence = evidence;
    this.events = events;
    this.clock = clock;
    this.catalog = catalog;
    this.identity = identity;
    this.holds = holds;
    this.secrets = secrets;
    this.store = options.store ?? new CardStore();
    this.processor = options.processor ?? new SimulatedCardProcessor();
    this.replay = options.replay ?? new InMemoryCallbackReplayStore();
    this.processorActorId = options.processorActorId;
    this.operationsActorId = options.operationsActorId;
    this.expectedProviderId = options.expectedProviderId ?? 'sim-card-processor';
    registerCardTreasuryBooks(ledger.accounts);
  }

  requestCard(intent: RequestCardIntent): CardsServiceOutcome<Card> {
    const existing = this.store.cardByIdempotency(intent.idempotencyKey);
    if (existing) {
      return this.replayOk(existing, intent.actionType, intent.id);
    }
    const account = this.catalog.accounts.get(intent.payload.accountId);
    const customer = this.catalog.customers.get(intent.payload.ownerId);
    const program = findCardProgram(intent.payload.programId) ?? this.store.getProgram(intent.payload.programId);
    const gated = this.gate(intent, account, customer);
    if (gated.outcome !== 'ALLOWED') {
      return gated.result;
    }
    if (!program || !program.simulationEnabled || program.liveCapability) {
      return this.reject(intent.actionType, intent.id, gated.decision, 'PROGRAM_DISABLED', 'card program is not simulation-enabled');
    }
    if (!account || account.currency !== program.currency) {
      return this.reject(intent.actionType, intent.id, gated.decision, 'CURRENCY_NOT_SUPPORTED', 'funding account currency does not match program');
    }
    if (account.accountClass !== program.fundingAccountClass) {
      return this.reject(intent.actionType, intent.id, gated.decision, 'POLICY_BLOCK', 'funding account class is not permitted for this program');
    }
    const created = this.processor.createCard({
      cardId: asCardId(intent.payload.cardId),
      formFactor: intent.payload.formFactor,
      programId: program.programId,
    });
    const now = this.clock.now();
    const card = freezeCard({
      cardId: asCardId(intent.payload.cardId),
      customerId: intent.payload.ownerId,
      fundingAccountId: intent.payload.accountId,
      currency: account.currency,
      programId: program.programId,
      processorCardRef: created.processorCardRef,
      formFactor: intent.payload.formFactor,
      status: 'PENDING',
      controls: DEFAULT_CARD_CONTROLS,
      displayHint: SYNTHETIC_CARD_DISPLAY,
      requestedByActorId: intent.actorId,
      createdAt: now,
      activatedAt: null,
      updatedAt: now,
    });
    this.store.saveCard(card);
    this.store.markCardIdempotency(intent.idempotencyKey, card);
    this.store.saveToken(
      freezeNetworkToken({
        tokenRef: asNetworkTokenReference(`sim_ntok_${card.cardId}`),
        cardId: card.cardId,
        tokenRequestor: 'SIMULATION_TOKEN_REQUESTOR',
        deviceRef: null,
        status: 'PENDING',
        assurance: 'SIMULATION_NOT_PROVISIONED',
        createdAt: now,
      }),
    );
    this.emit('CardCreated', 'card', card.cardId, intent.id, gated.decision, {
      cardId: card.cardId,
      customerId: card.customerId,
      programId: card.programId,
      processorCardRef: card.processorCardRef,
      formFactor: card.formFactor,
      status: card.status,
    });
    this.evidence.seal('CARD_CREATED', {
      intentId: intent.id,
      cardId: card.cardId,
      processorCardRef: card.processorCardRef,
      programId: card.programId,
    });
    return { outcome: 'OK', value: card, decision: gated.decision };
  }

  activateCard(intent: CardIntent & { readonly payload: { readonly cardId: string; readonly accountId: Account['id'] } }): CardsServiceOutcome<Card> {
    return this.lifecycle(intent, 'ACTIVE', 'CardActivated', 'CARD_ACTIVATED', (card) => {
      this.processor.activateCard(card.processorCardRef);
    });
  }

  freezeCard(intent: CardIntent & { readonly payload: { readonly cardId: string; readonly accountId: Account['id'] } }): CardsServiceOutcome<Card> {
    return this.lifecycle(intent, 'FROZEN', 'CardFrozen', 'CARD_FROZEN', (card) => {
      this.processor.freezeCard(card.processorCardRef);
    });
  }

  unfreezeCard(intent: CardIntent & { readonly payload: { readonly cardId: string; readonly accountId: Account['id'] } }): CardsServiceOutcome<Card> {
    return this.lifecycle(intent, 'ACTIVE', 'CardUnfrozen', 'CARD_UNFROZEN', (card) => {
      this.processor.unfreezeCard(card.processorCardRef);
    });
  }

  closeCard(intent: CardIntent & { readonly payload: { readonly cardId: string; readonly accountId: Account['id'] } }): CardsServiceOutcome<Card> {
    return this.lifecycle(intent, 'CLOSED', 'CardClosed', 'CARD_CLOSED', (card) => {
      this.processor.closeCard(card.processorCardRef);
    });
  }

  updateControls(intent: CardIntent & { readonly payload: { readonly cardId: string; readonly accountId: Account['id']; readonly controls: Parameters<typeof mergeCardControls>[1] } }): CardsServiceOutcome<Card> {
    const card = this.store.getCard(intent.payload.cardId);
    const account = this.catalog.accounts.get(intent.payload.accountId);
    const customer = account ? this.catalog.customers.get(account.ownerId) : undefined;
    const gated = this.gate(intent, account, customer);
    if (gated.outcome !== 'ALLOWED') {
      return gated.result;
    }
    if (!card) {
      return this.reject(intent.actionType, intent.id, gated.decision, 'CARD_NOT_FOUND', 'card does not exist');
    }
    const updated = freezeCard({
      ...card,
      controls: mergeCardControls(card.controls, intent.payload.controls),
      updatedAt: this.clock.now(),
    });
    this.store.saveCard(updated);
    this.evidence.seal('CARD_CONTROLS_UPDATED', { intentId: intent.id, cardId: updated.cardId });
    return { outcome: 'OK', value: updated, decision: gated.decision };
  }

  async ingestAuthorizationCallback(
    envelope: ProcessorCallbackEnvelope,
  ): Promise<CardsServiceOutcome<CardAuthorizationRecord>> {
    const verified = this.verifyEnvelope(envelope, 'AUTHORIZATION');
    if (!verified.ok) {
      return verified.result;
    }
    const replayed = this.store.authorizationByCallback(envelope.idempotencyKey);
    if (replayed) {
      return this.replayOk(replayed, ACTION_TYPES.AUTHORIZE_CARD_PURCHASE, asIntentId(`auth_replay_${envelope.idempotencyKey}`));
    }
    const request = this.requestFromPayload(envelope.payload);
    if (!request) {
      return this.reject(ACTION_TYPES.AUTHORIZE_CARD_PURCHASE, envelope.idempotencyKey, null, 'INVALID_CALLBACK', 'authorization payload is invalid');
    }
    const normalized = this.processor.processAuthorizationCallback(request);
    const card = this.store.getCard(normalized.cardId) ?? this.store.getCardByProcessorRef(normalized.processorCardRef);
    const account = card ? this.catalog.accounts.get(card.fundingAccountId) : undefined;
    const customer = account ? this.catalog.customers.get(account.ownerId) : undefined;
    const intent: AuthorizeCardPurchaseIntent = {
      id: asIntentId(`auth_int_${normalized.authorizationId}`),
      actionType: ACTION_TYPES.AUTHORIZE_CARD_PURCHASE,
      idempotencyKey: envelope.idempotencyKey,
      actorId: this.processorActorId,
      requestedAt: this.clock.now(),
      purpose: 'CARD_NETWORK',
      payload: {
        cardId: normalized.cardId,
        accountId: card?.fundingAccountId ?? asIntentId(normalized.cardId) as unknown as Account['id'],
        authorizationId: normalized.authorizationId,
        amount: normalized.amount,
        merchantCategory: normalized.merchantCategory,
        country: normalized.country,
        processorReference: normalized.processorReference,
      },
    };
    const fraud = evaluateFraud({
      subjectRef: `${normalized.cardId}:${normalized.merchantRef}`,
      actorId: this.processorActorId,
      sessionAssurance: null,
      deviceTrust: 'KNOWN',
      recentAuthChange: false,
      accountAgeDays: 30,
      beneficiaryAgeDays: null,
      amountMinor: normalized.amount.minorUnits,
      destinationRisk: normalized.country === 'XX' ? 'HIGH' : 'STANDARD',
      identityUsable: true,
      velocityTriggered: false,
      now: this.clock.now(),
    });
    const compliance: ComplianceFacts = {
      sanctionsOutcome: 'CLEAR',
      pepOutcome: 'CLEAR',
      adverseMediaOutcome: 'CLEAR',
      sanctionsFresh: true,
      pepFresh: true,
      adverseMediaFresh: true,
      requiredScreeningMissing: false,
      providerAvailable: true,
      outagePosture: null,
      amlCategory: 'STANDARD',
      fraudOutcome: fraud.outcome,
      velocityTriggered: false,
      hardBlock: fraud.outcome === 'BLOCK',
      stepUpRequired: fraud.outcome === 'STEP_UP',
      latestScreeningId: null,
      latestCaseId: null,
      policyVersionId: null,
    };
    const gated = this.gate(intent, account, customer, { amount: normalized.amount, compliance });
    if (gated.outcome !== 'ALLOWED') {
      const reason = fraud.outcome === 'BLOCK' ? 'FRAUD_BLOCK' : 'POLICY_BLOCK';
      const declined = this.recordAuthorization(normalized, card, 'DECLINE', reason, null, gated.result.decision, fraud.evaluationId);
      this.store.markAuthorizationCallback(envelope.idempotencyKey, declined);
      this.processor.respondAuthorization({ approved: false, externalReason: declined.externalReason });
      return { outcome: 'REJECTED', code: reason, message: declined.externalReason, decision: gated.result.decision };
    }
    const declined = this.precheckAuthorization(normalized, card, account);
    if (declined) {
      const record = this.recordAuthorization(normalized, card, 'DECLINE', declined, null, gated.decision, fraud.evaluationId);
      this.store.markAuthorizationCallback(envelope.idempotencyKey, record);
      this.processor.respondAuthorization({ approved: false, externalReason: record.externalReason });
      return { outcome: 'REJECTED', code: declined, message: record.externalReason, decision: gated.decision };
    }
    const program = this.store.getProgram(card!.programId);
    const expiresAt = addMs(this.clock.now(), program?.authorizationHoldTtlMs ?? 7n * 24n * 60n * 60n * 1000n);
    const holdIntent: CreateHoldIntent = {
      id: asIntentId(`hold_int_${normalized.authorizationId}`),
      actionType: ACTION_TYPES.CREATE_HOLD,
      idempotencyKey: `hold_${envelope.idempotencyKey}`,
      actorId: this.operationsActorId,
      requestedAt: this.clock.now(),
      purpose: 'CUSTOMER_HOLD',
      payload: {
        holdId: asHoldId(`hold_card_${normalized.authorizationId}`),
        accountId: card!.fundingAccountId,
        amount: normalized.amount,
        holdPurpose: 'CARD_AUTHORIZATION',
        expiresAt,
      },
    };
    const reserved = await this.holds.createHold(holdIntent);
    if (reserved.outcome !== 'COMPLETED') {
      const reason: AuthorizationReasonCode = reserved.outcome === 'REJECTED' && reserved.code === 'INSUFFICIENT_FUNDS'
        ? 'INSUFFICIENT_FUNDS'
        : 'POLICY_BLOCK';
      const record = this.recordAuthorization(normalized, card, 'DECLINE', reason, null, gated.decision, fraud.evaluationId);
      this.store.markAuthorizationCallback(envelope.idempotencyKey, record);
      return { outcome: 'REJECTED', code: reason, message: record.externalReason, decision: gated.decision };
    }
    const approved = this.recordAuthorization(
      normalized,
      card,
      'APPROVE',
      'APPROVED',
      reserved.value.id,
      gated.decision,
      fraud.evaluationId,
      expiresAt,
    );
    this.store.markAuthorizationCallback(envelope.idempotencyKey, approved);
    this.processor.respondAuthorization({ approved: true, externalReason: approved.externalReason });
    this.emit('CardAuthorizationApproved', 'card_authorization', approved.authorizationId, intent.id, gated.decision, {
      authorizationId: approved.authorizationId,
      cardId: approved.cardId,
      holdId: approved.holdId,
      amountMinorUnits: normalized.amount.minorUnits.toString(),
      currency: normalized.amount.currency,
    });
    this.evidence.seal('CARD_AUTHORIZATION_APPROVED', {
      intentId: intent.id,
      authorizationId: approved.authorizationId,
      holdId: approved.holdId,
      cardId: approved.cardId,
      kernelDecisionId: gated.decision.evidenceRecordId,
      fraudEvaluationId: fraud.evaluationId,
    });
    return { outcome: 'OK', value: approved, decision: gated.decision };
  }

  async ingestReversalCallback(envelope: ProcessorCallbackEnvelope): Promise<CardsServiceOutcome<CardAuthorizationRecord>> {
    const verified = this.verifyEnvelope(envelope, 'REVERSAL');
    if (!verified.ok) {
      return verified.result;
    }
    const authorizationId = String(envelope.payload.authorizationId ?? '');
    const existing = this.store.getAuthorization(authorizationId);
    if (!existing) {
      return this.reject(ACTION_TYPES.REVERSE_CARD_AUTHORIZATION, envelope.idempotencyKey, null, 'AUTHORIZATION_NOT_FOUND', 'authorization does not exist');
    }
    if (existing.state === 'REVERSED') {
      return this.replayOk(existing, ACTION_TYPES.REVERSE_CARD_AUTHORIZATION, asIntentId(`rev_replay_${authorizationId}`));
    }
    const card = this.store.getCard(existing.cardId);
    const account = card ? this.catalog.accounts.get(card.fundingAccountId) : undefined;
    const customer = account ? this.catalog.customers.get(account.ownerId) : undefined;
    const intent = {
      id: asIntentId(`rev_int_${authorizationId}`),
      actionType: ACTION_TYPES.REVERSE_CARD_AUTHORIZATION,
      idempotencyKey: envelope.idempotencyKey,
      actorId: this.processorActorId,
      requestedAt: this.clock.now(),
      purpose: 'CARD_NETWORK' as const,
      payload: {
        cardId: existing.cardId,
        accountId: card?.fundingAccountId ?? existing.request.cardId as unknown as Account['id'],
        authorizationId,
      },
    };
    const gated = this.gate(intent, account, customer);
    if (gated.outcome !== 'ALLOWED') {
      return gated.result;
    }
    if (existing.holdId) {
      const released = this.holds.releaseHold({
        id: asIntentId(`rel_int_${authorizationId}`),
        actionType: ACTION_TYPES.RELEASE_HOLD,
        idempotencyKey: `rel_${envelope.idempotencyKey}`,
        actorId: this.operationsActorId,
        requestedAt: this.clock.now(),
        purpose: 'CUSTOMER_HOLD',
        payload: { holdId: existing.holdId, accountId: card!.fundingAccountId },
      });
      if (released.outcome !== 'COMPLETED' && !(released.outcome === 'REJECTED' && released.code === 'HOLD_NOT_ACTIVE')) {
        return this.reject(intent.actionType, intent.id, gated.decision, 'HOLD_RELEASE_FAILED', 'could not release authorization hold');
      }
    }
    const reversed = freezeAuthorizationRecord({
      ...existing,
      state: 'REVERSED',
      updatedAt: this.clock.now(),
    });
    this.store.saveAuthorization(reversed);
    this.emit('CardAuthorizationReversed', 'card_authorization', reversed.authorizationId, intent.id, gated.decision, {
      authorizationId: reversed.authorizationId,
      cardId: reversed.cardId,
      holdId: reversed.holdId,
    });
    return { outcome: 'OK', value: reversed, decision: gated.decision };
  }

  async ingestClearingCallback(envelope: ProcessorCallbackEnvelope): Promise<CardsServiceOutcome<CardClearingRecord>> {
    const verified = this.verifyEnvelope(envelope, 'CLEARING');
    if (!verified.ok) {
      return verified.result;
    }
    const replayed = this.store.clearingByCallback(envelope.idempotencyKey);
    if (replayed) {
      return this.replayOk(replayed, ACTION_TYPES.CLEAR_CARD_TRANSACTION, asIntentId(`clr_replay_${envelope.idempotencyKey}`));
    }
    const clearingId = String(envelope.payload.clearingId ?? '');
    const authorizationId = typeof envelope.payload.authorizationId === 'string' ? envelope.payload.authorizationId : undefined;
    const amount = this.moneyFromPayload(envelope.payload);
    if (!clearingId || !amount) {
      return this.reject(ACTION_TYPES.CLEAR_CARD_TRANSACTION, envelope.idempotencyKey, null, 'INVALID_CALLBACK', 'clearing payload is invalid');
    }
    const auth = authorizationId ? this.store.getAuthorization(authorizationId) : undefined;
    const card = auth
      ? this.store.getCard(auth.cardId)
      : this.store.getCard(String(envelope.payload.cardId ?? '')) ?? this.store.getCardByProcessorRef(String(envelope.payload.processorCardRef ?? ''));
    const account = card ? this.catalog.accounts.get(card.fundingAccountId) : undefined;
    const customer = account ? this.catalog.customers.get(account.ownerId) : undefined;
    const intent: ClearCardTransactionIntent = {
      id: asIntentId(`clr_int_${clearingId}`),
      actionType: ACTION_TYPES.CLEAR_CARD_TRANSACTION,
      idempotencyKey: envelope.idempotencyKey,
      actorId: this.processorActorId,
      requestedAt: this.clock.now(),
      purpose: 'CARD_NETWORK',
      payload: {
        cardId: card?.cardId ?? asCardId(clearingId),
        accountId: card?.fundingAccountId ?? (asIntentId(clearingId) as unknown as Account['id']),
        clearingId,
        ...(authorizationId ? { authorizationId } : {}),
        amount,
        processorReference: String(envelope.payload.processorReference ?? clearingId),
      },
    };
    const gated = this.gate(intent, account, customer, { amount });
    if (gated.outcome !== 'ALLOWED') {
      return gated.result;
    }
    const program = card ? this.store.getProgram(card.programId) : undefined;
    const now = this.clock.now();
    const expired = auth?.expiresAt !== null && auth?.expiresAt !== undefined && auth.expiresAt <= now;
    const scenario = classifyClearing({
      authorizationAmount: auth?.request.amount ?? null,
      clearingAmount: amount,
      authorizationPresent: auth !== undefined,
      authorizationExpired: expired,
      overageToleranceMinor: program?.clearingOverageToleranceMinor ?? 0n,
    });
    if (scenario === 'OVERAGE_EXCEEDS_TOLERANCE') {
      const rejected = freezeClearing({
        clearingId: asCardClearingId(clearingId),
        cardId: card!.cardId,
        authorizationId: auth?.authorizationId ?? null,
        amount,
        scenario,
        state: 'REJECTED',
        processorReference: intent.payload.processorReference,
        settlementId: null,
        journalId: null,
        createdAt: now,
        updatedAt: now,
      });
      this.store.saveClearing(rejected);
      this.store.markClearingCallback(envelope.idempotencyKey, rejected);
      const recon = reconcileCardTransaction({
        subjectId: clearingId,
        ...(auth ? { authorization: auth } : {}),
        clearing: rejected,
        report: {
          clearingId,
          amountMinorUnits: amount.minorUnits.toString(),
          currency: amount.currency,
        },
        journals: this.ledger.listJournals(),
      });
      this.store.saveReconciliation(recon);
      return this.reject(intent.actionType, intent.id, gated.decision, 'CLEARING_MISMATCH', 'clearing exceeds simulation tolerance');
    }
    let journal: Journal | null = null;
    if (auth?.holdId && (scenario === 'EXACT' || scenario === 'OVERAGE_WITHIN_TOLERANCE')) {
      const captured = this.holds.captureHold({
        id: asIntentId(`cap_int_${clearingId}`),
        actionType: ACTION_TYPES.CAPTURE_HOLD,
        idempotencyKey: `cap_${envelope.idempotencyKey}`,
        actorId: this.operationsActorId,
        requestedAt: now,
        purpose: 'CUSTOMER_HOLD',
        payload: { holdId: auth.holdId, accountId: card!.fundingAccountId },
      });
      if (captured.outcome !== 'COMPLETED') {
        return this.reject(intent.actionType, intent.id, gated.decision, 'HOLD_CAPTURE_FAILED', 'canonical hold capture failed');
      }
      journal = postCardJournal(this.ledger, gated.authority, intent.actionType, settlementReclassPlan(amount));
    } else {
      if (auth?.holdId) {
        this.holds.releaseHold({
          id: asIntentId(`rel_clr_${clearingId}`),
          actionType: ACTION_TYPES.RELEASE_HOLD,
          idempotencyKey: `rel_clr_${envelope.idempotencyKey}`,
          actorId: this.operationsActorId,
          requestedAt: now,
          purpose: 'CUSTOMER_HOLD',
          payload: { holdId: auth.holdId, accountId: card!.fundingAccountId },
        });
      }
      journal = postCardJournal(this.ledger, gated.authority, intent.actionType, settlementDirectPlan(card!.fundingAccountId, amount));
    }
    const settled = freezeClearing({
      clearingId: asCardClearingId(clearingId),
      cardId: card!.cardId,
      authorizationId: auth?.authorizationId ?? null,
      amount,
      scenario,
      state: 'SETTLED',
      processorReference: intent.payload.processorReference,
      settlementId: asCardSettlementId(`setl_${clearingId}`),
      journalId: journal.id,
      createdAt: now,
      updatedAt: now,
    });
    this.store.saveClearing(settled);
    this.store.markClearingCallback(envelope.idempotencyKey, settled);
    if (auth) {
      this.store.saveAuthorization(freezeAuthorizationRecord({ ...auth, state: 'CLEARED', updatedAt: now }));
    }
    const recon = reconcileCardTransaction({
      subjectId: clearingId,
      ...(auth ? { authorization: auth } : {}),
      clearing: settled,
      report: {
        clearingId,
        ...(auth ? { authorizationId: auth.authorizationId } : {}),
        amountMinorUnits: amount.minorUnits.toString(),
        currency: amount.currency,
        ...(auth?.holdId ? { holdId: auth.holdId } : {}),
        journalId: journal.id,
      },
      journals: this.ledger.listJournals(),
    });
    this.store.saveReconciliation(recon);
    this.emit('CardClearingReceived', 'card_clearing', settled.clearingId, intent.id, gated.decision, {
      clearingId: settled.clearingId,
      cardId: settled.cardId,
      scenario: settled.scenario,
      amountMinorUnits: amount.minorUnits.toString(),
    });
    this.emit('CardTransactionSettled', 'card_clearing', settled.clearingId, intent.id, gated.decision, {
      clearingId: settled.clearingId,
      journalId: journal.id,
      settlementId: settled.settlementId,
      reconciliation: recon.status,
    });
    this.evidence.seal('CARD_TRANSACTION_SETTLED', {
      intentId: intent.id,
      clearingId: settled.clearingId,
      journalId: journal.id,
      holdId: auth?.holdId ?? null,
      cardId: settled.cardId,
    });
    return { outcome: 'OK', value: settled, decision: gated.decision };
  }

  ingestRefundCallback(envelope: ProcessorCallbackEnvelope): CardsServiceOutcome<CardRefundRecord> {
    const verified = this.verifyEnvelope(envelope, 'REFUND');
    if (!verified.ok) {
      return verified.result;
    }
    const replayed = this.store.refundByCallback(envelope.idempotencyKey);
    if (replayed) {
      return this.replayOk(replayed, ACTION_TYPES.REFUND_CARD_TRANSACTION, asIntentId(`rf_replay_${envelope.idempotencyKey}`));
    }
    const refundId = String(envelope.payload.refundId ?? '');
    const amount = this.moneyFromPayload(envelope.payload);
    const originalClearingId = typeof envelope.payload.originalClearingId === 'string' ? envelope.payload.originalClearingId : undefined;
    const clearing = originalClearingId ? this.store.getClearing(originalClearingId) : undefined;
    const card = clearing
      ? this.store.getCard(clearing.cardId)
      : this.store.getCard(String(envelope.payload.cardId ?? ''));
    const account = card ? this.catalog.accounts.get(card.fundingAccountId) : undefined;
    const customer = account ? this.catalog.customers.get(account.ownerId) : undefined;
    if (!refundId || !amount || !card) {
      return this.reject(ACTION_TYPES.REFUND_CARD_TRANSACTION, envelope.idempotencyKey, null, 'INVALID_CALLBACK', 'refund payload is invalid');
    }
    const intent: RefundCardTransactionIntent = {
      id: asIntentId(`rf_int_${refundId}`),
      actionType: ACTION_TYPES.REFUND_CARD_TRANSACTION,
      idempotencyKey: envelope.idempotencyKey,
      actorId: this.processorActorId,
      requestedAt: this.clock.now(),
      purpose: 'CARD_NETWORK',
      payload: {
        cardId: card.cardId,
        accountId: card.fundingAccountId,
        refundId,
        ...(originalClearingId ? { originalClearingId } : {}),
        amount,
        processorReference: String(envelope.payload.processorReference ?? refundId),
      },
    };
    const gated = this.gate(intent, account, customer, { amount });
    if (gated.outcome !== 'ALLOWED') {
      return gated.result;
    }
    const journal = postCardJournal(this.ledger, gated.authority, intent.actionType, refundPlan(card.fundingAccountId, amount));
    const refund = freezeRefund({
      refundId: asCardRefundId(refundId),
      cardId: card.cardId,
      originalClearingId: clearing?.clearingId ?? null,
      amount,
      processorReference: intent.payload.processorReference,
      journalId: journal.id,
      state: 'POSTED',
      createdAt: this.clock.now(),
    });
    this.store.saveRefund(refund);
    this.store.markRefundCallback(envelope.idempotencyKey, refund);
    this.emit('CardRefundReceived', 'card_refund', refund.refundId, intent.id, gated.decision, {
      refundId: refund.refundId,
      cardId: refund.cardId,
      journalId: journal.id,
      amountMinorUnits: amount.minorUnits.toString(),
    });
    this.evidence.seal('CARD_REFUND_POSTED', {
      intentId: intent.id,
      refundId: refund.refundId,
      journalId: journal.id,
      originalClearingId: refund.originalClearingId,
    });
    return { outcome: 'OK', value: refund, decision: gated.decision };
  }

  openDispute(intent: OpenCardDisputeIntent): CardsServiceOutcome<CardDispute> {
    const existing = this.store.getDispute(intent.payload.disputeId);
    if (existing) {
      return this.replayOk(existing, intent.actionType, intent.id);
    }
    const card = this.store.getCard(intent.payload.cardId);
    const account = this.catalog.accounts.get(intent.payload.accountId);
    const customer = account ? this.catalog.customers.get(account.ownerId) : undefined;
    const gated = this.gate(intent, account, customer, { amount: intent.payload.amount });
    if (gated.outcome !== 'ALLOWED') {
      return gated.result;
    }
    if (!card) {
      return this.reject(intent.actionType, intent.id, gated.decision, 'CARD_NOT_FOUND', 'card does not exist');
    }
    const now = this.clock.now();
    const dispute = freezeDispute({
      disputeId: asDisputeId(intent.payload.disputeId),
      cardId: card.cardId,
      customerId: card.customerId,
      transactionRef: asCardClearingId(intent.payload.transactionRef),
      reasonCategory: intent.payload.reasonCategory as DisputeReasonCategory,
      processorReference: `sim_disp_${intent.payload.disputeId}`,
      amount: intent.payload.amount,
      evidenceRefs: Object.freeze([`sim_evidence_${intent.payload.disputeId}`]),
      deadlineAt: addMs(now, 30n * 24n * 60n * 60n * 1000n),
      state: 'OPEN',
      history: Object.freeze([{ from: 'OPEN', to: 'OPEN', at: now, note: 'opened' }]),
      provisionalJournalId: null,
      finalJournalId: null,
      createdAt: now,
      updatedAt: now,
    });
    this.store.saveDispute(dispute);
    this.emit('CardDisputeOpened', 'card_dispute', dispute.disputeId, intent.id, gated.decision, {
      disputeId: dispute.disputeId,
      cardId: dispute.cardId,
      transactionRef: dispute.transactionRef,
    });
    return { outcome: 'OK', value: dispute, decision: gated.decision };
  }

  decideDispute(intent: DecideCardDisputeIntent): CardsServiceOutcome<CardDispute> {
    const dispute = this.store.getDispute(intent.payload.disputeId);
    const card = this.store.getCard(intent.payload.cardId);
    const account = this.catalog.accounts.get(intent.payload.accountId);
    const customer = account ? this.catalog.customers.get(account.ownerId) : undefined;
    const gated = this.gate(intent, account, customer);
    if (gated.outcome !== 'ALLOWED') {
      return gated.result;
    }
    if (!dispute || !card) {
      return this.reject(intent.actionType, intent.id, gated.decision, 'DISPUTE_NOT_FOUND', 'dispute does not exist');
    }
    const now = this.clock.now();
    let current = dispute;
    if (current.state === 'OPEN') {
      const submitted = transitionDispute(current, 'SUBMITTED', now, 'simulation submit');
      if (isErr(submitted)) {
        return this.reject(intent.actionType, intent.id, gated.decision, submitted.error.code, 'illegal dispute transition');
      }
      current = submitted.value;
      const review = transitionDispute(current, 'UNDER_REVIEW', now, 'simulation review');
      if (isErr(review)) {
        return this.reject(intent.actionType, intent.id, gated.decision, review.error.code, 'illegal dispute transition');
      }
      current = review.value;
    }
    const to = intent.payload.outcome;
    let provisionalJournalId = current.provisionalJournalId;
    let finalJournalId = current.finalJournalId;
    if (to === 'WON') {
      const provisional = postCardJournal(this.ledger, gated.authority, intent.actionType, disputeProvisionalCreditPlan(card.fundingAccountId, current.amount));
      const final = postCardJournal(this.ledger, gated.authority, intent.actionType, disputeFinalChargebackPlan(current.amount));
      provisionalJournalId = provisional.id;
      finalJournalId = final.id;
    }
    if (to === 'LOST' && current.provisionalJournalId) {
      const reversal = postCardJournal(this.ledger, gated.authority, intent.actionType, disputeProvisionalReversalPlan(card.fundingAccountId, current.amount));
      finalJournalId = reversal.id;
    }
    const decided = transitionDispute(current, to, now, `simulation ${to}`, {
      provisionalJournalId,
      finalJournalId,
    });
    if (isErr(decided)) {
      return this.reject(intent.actionType, intent.id, gated.decision, decided.error.code, 'illegal dispute transition');
    }
    this.store.saveDispute(decided.value);
    this.emit('CardDisputeDecided', 'card_dispute', decided.value.disputeId, intent.id, gated.decision, {
      disputeId: decided.value.disputeId,
      outcome: decided.value.state,
    });
    return { outcome: 'OK', value: decided.value, decision: gated.decision };
  }

  assessFee(intent: AssessCardFeeIntent): CardsServiceOutcome<ReturnType<typeof freezeCardFee>> {
    const card = this.store.getCard(intent.payload.cardId);
    const account = this.catalog.accounts.get(intent.payload.accountId);
    const customer = account ? this.catalog.customers.get(account.ownerId) : undefined;
    const gated = this.gate(intent, account, customer, { amount: intent.payload.amount });
    if (gated.outcome !== 'ALLOWED') {
      return gated.result;
    }
    if (!card) {
      return this.reject(intent.actionType, intent.id, gated.decision, 'CARD_NOT_FOUND', 'card does not exist');
    }
    const customerJournal = postCardJournal(this.ledger, gated.authority, intent.actionType, customerFeePlan(card.fundingAccountId, intent.payload.amount));
    postCardJournal(this.ledger, gated.authority, intent.actionType, feePlan(intent.payload.amount));
    const fee = freezeCardFee({
      feeId: asCardFeeId(`cfee_${intent.id}`),
      cardId: card.cardId,
      feeType: intent.payload.feeType as CardFeeType,
      amount: intent.payload.amount,
      journalId: customerJournal.id,
      pricingNote: 'SIMULATION_EXPLICIT_AMOUNT_ONLY',
      createdAt: this.clock.now(),
    });
    this.store.saveFee(fee);
    this.evidence.seal('CARD_FEE_ASSESSED', { intentId: intent.id, feeId: fee.feeId, journalId: customerJournal.id });
    return { outcome: 'OK', value: fee, decision: gated.decision };
  }

  history(cardId: string): readonly CardHistoryEntry[] {
    return cardTransactionHistory({
      authorizations: this.store.listAuthorizationsByCard(cardId),
      clearings: this.store.listClearingsByCard(cardId),
      refunds: this.store.listRefundsByCard(cardId),
    });
  }

  available(accountId: Account['id']): ReturnType<CardHoldGateway['projectAvailable']> {
    const account = this.catalog.accounts.get(accountId);
    if (!account) {
      throw new Error('funding account does not exist');
    }
    return this.holds.projectAvailable(account);
  }

  injectMismatchedReport(subjectId: string, report: ProcessorCardReport): CardReconciliationResult {
    const clearing = this.store.getClearing(subjectId);
    const authorization = this.store.getAuthorization(subjectId);
    const result = reconcileCardTransaction({
      subjectId,
      ...(authorization ? { authorization } : {}),
      ...(clearing ? { clearing } : {}),
      report,
      journals: this.ledger.listJournals(),
    });
    this.store.saveReconciliation(result);
    return result;
  }

  private lifecycle(
    intent: CardIntent & { readonly payload: { readonly cardId: string; readonly accountId: Account['id'] } },
    to: Card['status'],
    eventType: string,
    evidenceType: string,
    after: (card: Card) => void,
  ): CardsServiceOutcome<Card> {
    const card = this.store.getCard(intent.payload.cardId);
    const account = this.catalog.accounts.get(intent.payload.accountId);
    const customer = account ? this.catalog.customers.get(account.ownerId) : undefined;
    const gated = this.gate(intent, account, customer);
    if (gated.outcome !== 'ALLOWED') {
      return gated.result;
    }
    if (!card) {
      return this.reject(intent.actionType, intent.id, gated.decision, 'CARD_NOT_FOUND', 'card does not exist');
    }
    if (card.status === to) {
      return { outcome: 'OK', value: card, decision: gated.decision, replay: true };
    }
    const next = transitionCard(card, to, this.clock.now());
    if (isErr(next)) {
      return this.reject(intent.actionType, intent.id, gated.decision, next.error.code, `${next.error.from} cannot become ${next.error.to}`);
    }
    after(next.value);
    this.store.saveCard(next.value);
    this.emit(eventType, 'card', next.value.cardId, intent.id, gated.decision, {
      cardId: next.value.cardId,
      status: next.value.status,
    });
    this.evidence.seal(evidenceType, { intentId: intent.id, cardId: next.value.cardId, status: next.value.status });
    return { outcome: 'OK', value: next.value, decision: gated.decision };
  }

  private precheckAuthorization(
    request: CardAuthorizationRequest,
    card: Card | undefined,
    account: Account | undefined,
  ): AuthorizationReasonCode | null {
    if (!card) {
      return 'CARD_NOT_ACTIVE';
    }
    if (card.status === 'CLOSED' || card.status === 'EXPIRED') {
      return 'CARD_CLOSED';
    }
    if (card.status === 'FROZEN' || card.status === 'SUSPENDED' || card.status === 'PENDING') {
      return card.status === 'FROZEN' ? 'CARD_FROZEN' : 'CARD_NOT_ACTIVE';
    }
    if (!account) {
      return 'POLICY_BLOCK';
    }
    if (request.currency !== card.currency || request.amount.currency !== card.currency) {
      return 'CURRENCY_NOT_SUPPORTED';
    }
    const program = this.store.getProgram(card.programId);
    if (!program || !program.simulationEnabled) {
      return 'PROGRAM_DISABLED';
    }
    const position = this.holds.projectAvailable(account);
    if (position.available.cmp(request.amount) < 0) {
      return 'INSUFFICIENT_FUNDS';
    }
    const dayPrefix = this.clock.now().slice(0, 10);
    const controls = evaluateCardControls({
      controls: card.controls,
      cardStatus: card.status,
      amount: request.amount,
      merchantCategory: request.merchantCategory,
      country: request.country,
      ecommerce: request.ecommerce,
      cashAtm: request.cashAtm,
      dailySpentMinor: this.store.dailyApprovedMinor(card.cardId, dayPrefix),
    });
    if (controls.outcome === 'DECLINE') {
      return controls.reason;
    }
    return null;
  }

  private recordAuthorization(
    request: CardAuthorizationRequest,
    card: Card | undefined,
    decision: 'APPROVE' | 'DECLINE',
    reason: AuthorizationReasonCode,
    holdId: FundsHold['id'] | null,
    kernel: AuthorizationDecision | null,
    fraudEvaluationId: string | null,
    expiresAt: CardAuthorizationRecord['expiresAt'] = null,
  ): CardAuthorizationRecord {
    const now = this.clock.now();
    const record = freezeAuthorizationRecord({
      authorizationId: request.authorizationId,
      cardId: card?.cardId ?? request.cardId,
      request: freezeAuthorizationRequest(request),
      decision,
      reasonCode: reason,
      holdId,
      state: decision === 'APPROVE' ? 'APPROVED' : 'DECLINED',
      externalReason: externalAuthorizationReason(reason),
      fraudEvaluationId,
      policyVersionId: kernel?.policySnapshot?.versionId ?? null,
      kernelDecisionId: kernel?.evidenceRecordId ?? null,
      expiresAt,
      createdAt: now,
      updatedAt: now,
    });
    this.store.saveAuthorization(record);
    this.store.markAuthorizationCallback(request.processorReference, record);
    if (decision === 'DECLINE') {
      this.emit('CardAuthorizationDeclined', 'card_authorization', record.authorizationId, kernel?.intentId ?? record.authorizationId, kernel ?? this.emptyDecision(ACTION_TYPES.AUTHORIZE_CARD_PURCHASE, record.authorizationId), {
        authorizationId: record.authorizationId,
        cardId: record.cardId,
        reasonCode: record.reasonCode,
        externalReason: record.externalReason,
      });
    }
    return record;
  }

  private requestFromPayload(payload: Readonly<Record<string, unknown>>): CardAuthorizationRequest | null {
    const amount = this.moneyFromPayload(payload);
    const cardId = typeof payload.cardId === 'string' ? payload.cardId : '';
    const authorizationId = typeof payload.authorizationId === 'string' ? payload.authorizationId : '';
    const processorCardRef = typeof payload.processorCardRef === 'string' ? payload.processorCardRef : '';
    if (!amount || !cardId || !authorizationId || !processorCardRef) {
      return null;
    }
    return freezeAuthorizationRequest({
      authorizationId: asCardAuthorizationId(authorizationId),
      cardId: asCardId(cardId),
      processorCardRef: asProcessorCardReference(processorCardRef),
      merchantRef: asMerchantReference(String(payload.merchantRef ?? 'sim_merchant')),
      merchantCategory: String(payload.merchantCategory ?? '5411'),
      amount,
      currency: asCurrencyCode(amount.currency),
      country: String(payload.country ?? 'US'),
      requestedAt: this.clock.now(),
      cardPresent: payload.cardPresent === true,
      ecommerce: payload.ecommerce !== false,
      recurring: payload.recurring === true,
      cashAtm: payload.cashAtm === true,
      processorReference: String(payload.processorReference ?? authorizationId),
    });
  }

  private moneyFromPayload(payload: Readonly<Record<string, unknown>>): Money | null {
    const minor = payload.amountMinorUnits;
    const currency = payload.currency;
    if ((typeof minor !== 'string' && typeof minor !== 'bigint') || typeof currency !== 'string') {
      return null;
    }
    try {
      return Money.fromMinorUnits(typeof minor === 'bigint' ? minor : BigInt(minor), currency);
    } catch {
      return null;
    }
  }

  private verifyEnvelope(
    envelope: ProcessorCallbackEnvelope,
    eventType: ProcessorCallbackEnvelope['eventType'],
  ): { readonly ok: true } | { readonly ok: false; readonly result: CardsServiceOutcome<never> } {
    if (envelope.eventType !== eventType) {
      return {
        ok: false,
        result: this.reject(eventType, envelope.idempotencyKey, null, 'INVALID_CALLBACK', 'callback event type mismatch'),
      };
    }
    const nowMs = BigInt(Date.parse(this.clock.now()));
    const verified = verifyProcessorCallback({
      envelope,
      secrets: this.secrets,
      secretRef: PROCESSOR_SECRET,
      nowMs,
      replay: this.replay,
      expectedProviderId: this.expectedProviderId,
    });
    if (!verified.ok) {
      this.evidence.seal('CARD_CALLBACK_REJECTED', {
        code: verified.error.code,
        eventType,
        posted: false,
      });
      return {
        ok: false,
        result: this.reject(eventType, envelope.idempotencyKey, null, verified.error.code, verified.error.message),
      };
    }
    return { ok: true };
  }

  private gate(
    intent: CardIntent,
    account: Account | undefined,
    customer: Customer | undefined,
    extra: Partial<KernelFacts> = {},
  ):
    | { readonly outcome: 'ALLOWED'; readonly decision: AuthorizationDecision; readonly authority: ExecutionAuthority }
    | { readonly outcome: 'REFUSED'; readonly result: CardsServiceOutcome<never> } {
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
      ...(extra.amount ? { amount: extra.amount } : {}),
      ...(extra.compliance ? { compliance: extra.compliance } : {}),
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
  ): CardsServiceOutcome<never> {
    const evidence = this.evidence.seal(`${actionType}_REJECTED`, { intentId, code, message, posted: false });
    return { outcome: 'REJECTED', code, message, decision, evidenceId: evidence.evidenceId };
  }

  private replayOk<T>(value: T, actionType: string, intentId: string): CardsServiceOutcome<T> {
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
