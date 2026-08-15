import type { Clock } from '../../../config/src/clock.ts';
import type { Account } from '../../../domain/src/account.ts';
import type { Customer } from '../../../domain/src/customer.ts';
import { isErr, isOk } from '../../../domain/src/result.ts';
import type { EvidenceVault } from '../../../evidence/src/vault.ts';
import type { DomainEventLog } from '../../../events/src/events.ts';
import { actionTypesFromCapabilities, type IdentityService } from '../../../identity/src/index.ts';
import { asDeviceId } from '../../../identity/src/ids.ts';
import { evaluateFraud } from '../../../kernel/src/compliance/fraud.ts';
import type { ComplianceKernel } from '../../../kernel/src/kernel.ts';
import type { KernelFacts } from '../../../kernel/src/proofs.ts';
import { asIntentId } from '../../../permissions/src/action-intent.ts';
import {
  ACTION_TYPES,
  type CardIntent,
  type ProvisionCardToWalletIntent,
  type SuspendWalletTokenIntent,
} from '../../../permissions/src/action-types.ts';
import type { AuthorizationDecision } from '../../../permissions/src/decision.ts';
import type { AuthorityIssuer, ExecutionAuthority } from '../../../permissions/src/execution-authority.ts';
import { validateIntentStructure, type StructuralCatalog } from '../../../permissions/src/structural.ts';
import { secretRef, type SecretProvider } from '../../../security/src/secrets.ts';
import type { Card } from '../card.ts';
import { asNetworkTokenReference } from '../ids.ts';
import type { CardStore } from '../store.ts';
import { freezeNetworkToken } from '../token.ts';
import { walletAdapterFor } from './adapters.ts';
import {
  InMemoryWalletCallbackReplayStore,
  verifyWalletCallback,
  type WalletCallbackEnvelope,
  type WalletCallbackReplayStore,
} from './callback.ts';
import { evaluateWalletEligibility, type WalletEligibilityResult } from './eligibility.ts';
import { asDevicePaymentTokenId } from './ids.ts';
import type { WalletProvisioningPort } from './port.ts';
import { WalletStore } from './store.ts';
import {
  freezeDevicePaymentToken,
  tokenBoundToDevice,
  transitionDevicePaymentToken,
  type DevicePaymentToken,
  type WalletProvider,
} from './token.ts';

const WALLET_SECRET = secretRef('simulation', 'wallet-provider-callback');

export type WalletServiceOutcome<T> =
  | { readonly outcome: 'OK'; readonly value: T; readonly decision: AuthorizationDecision; readonly replay?: boolean }
  | { readonly outcome: 'KERNEL_REFUSED'; readonly decision: AuthorizationDecision }
  | {
      readonly outcome: 'REJECTED';
      readonly code: string;
      readonly message: string;
      readonly decision: AuthorizationDecision | null;
      readonly evidenceId?: string;
    };

export type WalletCatalogPorts = {
  readonly customers: { get(id: Customer['id']): Customer | undefined };
  readonly accounts: {
    get(id: Account['id']): Account | undefined;
  };
  readonly products: StructuralCatalog['products'];
  readonly legalEntities: StructuralCatalog['legalEntities'];
};

export class WalletService {
  private readonly kernel: ComplianceKernel;
  private readonly issuer: AuthorityIssuer;
  private readonly evidence: EvidenceVault;
  private readonly events: DomainEventLog;
  private readonly clock: Clock;
  private readonly catalog: WalletCatalogPorts;
  private readonly identity: IdentityService;
  private readonly secrets: SecretProvider;
  private readonly cards: CardStore;
  readonly store: WalletStore;
  private readonly replay: WalletCallbackReplayStore;
  private readonly operationsActorId: string;
  private readonly adapters: Readonly<Record<WalletProvider, WalletProvisioningPort>>;

  constructor(input: {
    readonly kernel: ComplianceKernel;
    readonly issuer: AuthorityIssuer;
    readonly evidence: EvidenceVault;
    readonly events: DomainEventLog;
    readonly clock: Clock;
    readonly catalog: WalletCatalogPorts;
    readonly identity: IdentityService;
    readonly secrets: SecretProvider;
    readonly cards: CardStore;
    readonly operationsActorId: string;
    readonly store?: WalletStore;
    readonly replay?: WalletCallbackReplayStore;
    readonly adapters?: Partial<Record<WalletProvider, WalletProvisioningPort>>;
  }) {
    this.kernel = input.kernel;
    this.issuer = input.issuer;
    this.evidence = input.evidence;
    this.events = input.events;
    this.clock = input.clock;
    this.catalog = input.catalog;
    this.identity = input.identity;
    this.secrets = input.secrets;
    this.cards = input.cards;
    this.operationsActorId = input.operationsActorId;
    this.store = input.store ?? new WalletStore();
    this.replay = input.replay ?? new InMemoryWalletCallbackReplayStore();
    this.adapters = {
      APPLE_WALLET: input.adapters?.APPLE_WALLET ?? walletAdapterFor('APPLE_WALLET'),
      GOOGLE_WALLET: input.adapters?.GOOGLE_WALLET ?? walletAdapterFor('GOOGLE_WALLET'),
    };
  }

  evaluateEligibility(intent: ProvisionCardToWalletIntent): WalletEligibilityResult {
    return this.eligibilityFor(intent);
  }

  provisionToWallet(intent: ProvisionCardToWalletIntent): WalletServiceOutcome<DevicePaymentToken> | WalletServiceOutcome<WalletEligibilityResult> {
    const existing = this.store.tokenByIdempotency(intent.idempotencyKey);
    if (existing) {
      return this.replayOk(existing, intent.actionType, intent.id);
    }
    const eligibility = this.eligibilityFor(intent);
    this.store.saveAttempt({
      attemptId: intent.id,
      tokenId: intent.payload.tokenId,
      cardId: intent.payload.cardId,
      deviceId: intent.payload.deviceId,
      walletProvider: intent.payload.walletProvider,
      outcome: eligibility.outcome,
      reasons: eligibility.reasons,
      createdAt: this.clock.now(),
    });
    if (eligibility.outcome === 'STEP_UP_REQUIRED') {
      this.emit('WalletProvisioningStepUpRequired', 'wallet_token', intent.payload.tokenId, intent.id, this.emptyDecision(intent.actionType, intent.id), {
        tokenId: intent.payload.tokenId,
        cardId: intent.payload.cardId,
        deviceId: intent.payload.deviceId,
        walletProvider: intent.payload.walletProvider,
        status: 'STEP_UP_REQUIRED',
      });
      this.evidence.seal('WALLET_STEP_UP_REQUIRED', {
        intentId: intent.id,
        tokenId: intent.payload.tokenId,
        cardId: intent.payload.cardId,
        deviceId: intent.payload.deviceId,
        reasons: eligibility.reasons,
      });
      return { outcome: 'OK', value: eligibility, decision: this.emptyDecision(intent.actionType, intent.id) };
    }
    if (eligibility.outcome !== 'ELIGIBLE') {
      return this.reject(intent.actionType, intent.id, null, eligibility.outcome, eligibility.reasons.join(','));
    }
    const card = this.cards.getCard(intent.payload.cardId);
    const account = card ? this.catalog.accounts.get(card.fundingAccountId) : undefined;
    const customer = account ? this.catalog.customers.get(account.ownerId) : undefined;
    const gated = this.gate(intent, account, customer);
    if (gated.outcome !== 'ALLOWED') {
      return gated.result;
    }
    const deviceId = asDeviceId(intent.payload.deviceId);
    const conflicting = this.store
      .listTokensByCard(intent.payload.cardId)
      .find((token) => token.walletProvider === intent.payload.walletProvider && token.deviceId !== deviceId && token.status !== 'DELETED');
    if (conflicting && conflicting.tokenId === intent.payload.tokenId) {
      return this.reject(intent.actionType, intent.id, gated.decision, 'DEVICE_REBIND_FORBIDDEN', 'a token cannot move between devices');
    }
    const network = this.cards.listTokensByCard(intent.payload.cardId)[0];
    const adapter = this.adapters[intent.payload.walletProvider];
    const provisioned = adapter.provision({
      tokenId: asDevicePaymentTokenId(intent.payload.tokenId),
      cardId: card!.cardId,
      processorCardRef: card!.processorCardRef,
      deviceId: intent.payload.deviceId,
      walletProvider: intent.payload.walletProvider,
      networkTokenReference: network?.tokenRef ?? asNetworkTokenReference(`sim_ntok_${intent.payload.tokenId}`),
    });
    const now = this.clock.now();
    const facts = this.identity.identityFactsFor(intent.actorId);
    const token = freezeDevicePaymentToken({
      tokenId: asDevicePaymentTokenId(intent.payload.tokenId),
      cardId: card!.cardId,
      identityId: facts.subjectId ?? intent.actorId,
      customerId: card!.customerId,
      deviceId,
      walletProvider: intent.payload.walletProvider,
      networkTokenReference: provisioned.networkTokenReference,
      providerReference: provisioned.providerReference,
      assuranceLevel: facts.authenticationAssurance ?? 'UNKNOWN',
      provisioningMethod: 'IN_APP',
      status: provisioned.status,
      createdAt: now,
      updatedAt: now,
      activatedAt: null,
    });
    this.store.saveToken(token);
    this.store.markTokenIdempotency(intent.idempotencyKey, token);
    this.emit('WalletProvisioningRequested', 'wallet_token', token.tokenId, intent.id, gated.decision, {
      tokenId: token.tokenId,
      cardId: token.cardId,
      deviceId: token.deviceId,
      walletProvider: token.walletProvider,
      status: token.status,
    });
    this.evidence.seal('WALLET_PROVISIONING_REQUESTED', {
      intentId: intent.id,
      kernelDecisionId: gated.decision.evidenceRecordId,
      policyVersionId: gated.decision.policySnapshot?.versionId ?? null,
      identityId: token.identityId,
      deviceId: token.deviceId,
      cardId: token.cardId,
      tokenId: token.tokenId,
      providerResult: provisioned.status,
    });
    return { outcome: 'OK', value: token, decision: gated.decision };
  }

  ingestWalletCallback(envelope: WalletCallbackEnvelope): WalletServiceOutcome<DevicePaymentToken> {
    const tokenHint =
      this.store.getToken(typeof envelope.payload.tokenId === 'string' ? envelope.payload.tokenId : '') ??
      this.store.getTokenByProviderRef(
        typeof envelope.payload.providerReference === 'string' ? envelope.payload.providerReference : '',
      );
    const expectedProviderId =
      tokenHint?.walletProvider === 'GOOGLE_WALLET'
        ? 'sim-google-wallet'
        : tokenHint?.walletProvider === 'APPLE_WALLET'
          ? 'sim-apple-wallet'
          : envelope.providerId === 'sim-google-wallet' || envelope.providerId === 'sim-apple-wallet'
            ? envelope.providerId
            : 'sim-apple-wallet';
    const nowMs = BigInt(Date.parse(this.clock.now()));
    const verified = verifyWalletCallback({
      envelope,
      secrets: this.secrets,
      secretRef: WALLET_SECRET,
      nowMs,
      replay: this.replay,
      expectedProviderId,
    });
    if (!verified.ok) {
      this.evidence.seal('WALLET_CALLBACK_REJECTED', {
        code: verified.error.code,
        eventType: envelope.eventType,
        posted: false,
      });
      return this.reject(envelope.eventType, envelope.idempotencyKey, null, verified.error.code, verified.error.message);
    }
    const replayed = this.store.callbackByKey(envelope.idempotencyKey);
    if (replayed) {
      return this.replayOk(replayed, envelope.eventType, asIntentId(`wallet_replay_${envelope.idempotencyKey}`));
    }
    const tokenId = typeof envelope.payload.tokenId === 'string' ? envelope.payload.tokenId : '';
    const providerRefEarly = typeof envelope.payload.providerReference === 'string' ? envelope.payload.providerReference : '';
    const existing = this.store.getToken(tokenId) ?? this.store.getTokenByProviderRef(providerRefEarly);
    const cardForGate = existing ? this.cards.getCard(existing.cardId) : undefined;
    const accountForGate = cardForGate ? this.catalog.accounts.get(cardForGate.fundingAccountId) : undefined;
    const customerForGate = accountForGate ? this.catalog.customers.get(accountForGate.ownerId) : undefined;
    const callbackIntent: SuspendWalletTokenIntent = {
      id: asIntentId(`wallet_cb_${envelope.idempotencyKey}`),
      actionType: ACTION_TYPES.SUSPEND_WALLET_TOKEN,
      idempotencyKey: `wallet_cb_${envelope.idempotencyKey}`,
      actorId: this.operationsActorId,
      requestedAt: this.clock.now(),
      purpose: 'CUSTOMER_WALLET',
      payload: {
        tokenId: existing?.tokenId ?? tokenId,
        accountId: accountForGate?.id ?? (existing?.cardId as unknown as Account['id']),
        deviceId: existing?.deviceId ?? 'unknown',
        reason: envelope.eventType,
      },
    };
    const gatedCallback = this.gate(callbackIntent, accountForGate, customerForGate);
    if (gatedCallback.outcome !== 'ALLOWED') {
      return gatedCallback.result;
    }
    const providerRef = typeof envelope.payload.providerReference === 'string' ? envelope.payload.providerReference : '';
    const token = this.store.getToken(tokenId) ?? this.store.getTokenByProviderRef(providerRef);
    if (!token) {
      return this.reject(envelope.eventType, envelope.idempotencyKey, null, 'TOKEN_NOT_FOUND', 'wallet token does not exist');
    }
    const callbackDevice = typeof envelope.payload.deviceId === 'string' ? envelope.payload.deviceId : token.deviceId;
    if (!tokenBoundToDevice(token, asDeviceId(callbackDevice))) {
      return this.reject(envelope.eventType, envelope.idempotencyKey, null, 'DEVICE_REBIND_FORBIDDEN', 'token cannot move between devices');
    }
    const nextStatus =
      envelope.eventType === 'TOKEN_ACTIVATED'
        ? 'ACTIVE'
        : envelope.eventType === 'TOKEN_SUSPENDED'
          ? 'SUSPENDED'
          : 'DELETED';
    const adapter = this.adapters[token.walletProvider];
    adapter.updateStatus({ providerReference: token.providerReference, status: nextStatus });
    const next = transitionDevicePaymentToken(token, nextStatus, this.clock.now());
    if (isErr(next)) {
      return this.reject(envelope.eventType, envelope.idempotencyKey, null, next.error.code, `${next.error.from} cannot become ${next.error.to}`);
    }
    this.store.saveToken(next.value);
    this.store.markCallback(envelope.idempotencyKey, next.value);
    const network = this.cards.getToken(next.value.networkTokenReference);
    if (network) {
      this.cards.saveToken(
        freezeNetworkToken({
          ...network,
          deviceRef: next.value.deviceId,
          status: nextStatus === 'ACTIVE' ? 'ACTIVE' : nextStatus === 'SUSPENDED' ? 'SUSPENDED' : 'DELETED',
          assurance: next.value.assuranceLevel,
        }),
      );
    }
    const eventType =
      nextStatus === 'ACTIVE' ? 'WalletTokenActivated' : nextStatus === 'SUSPENDED' ? 'WalletTokenSuspended' : 'WalletTokenDeleted';
    this.emit(eventType, 'wallet_token', next.value.tokenId, envelope.idempotencyKey, this.emptyDecision(envelope.eventType, envelope.idempotencyKey), {
      tokenId: next.value.tokenId,
      cardId: next.value.cardId,
      deviceId: next.value.deviceId,
      walletProvider: next.value.walletProvider,
      status: next.value.status,
    });
    this.evidence.seal(`WALLET_TOKEN_${nextStatus}`, {
      tokenId: next.value.tokenId,
      cardId: next.value.cardId,
      deviceId: next.value.deviceId,
      providerResult: envelope.eventType,
    });
    return { outcome: 'OK', value: next.value, decision: this.emptyDecision(envelope.eventType, envelope.idempotencyKey) };
  }

  onIdentityDeviceTrustChanged(event: {
    readonly payload: { readonly deviceId?: string; readonly trustState?: string; readonly identityId?: string };
  }): readonly WalletServiceOutcome<DevicePaymentToken>[] {
    const deviceId = event.payload.deviceId;
    const trustState = event.payload.trustState;
    if (!deviceId || (trustState !== 'BLOCKED' && trustState !== 'REVIEW_REQUIRED')) {
      return [];
    }
    const results: WalletServiceOutcome<DevicePaymentToken>[] = [];
    for (const token of this.store.listTokensByDevice(deviceId)) {
      if (token.status !== 'ACTIVE' && token.status !== 'PENDING_VERIFICATION') {
        continue;
      }
      const card = this.cards.getCard(token.cardId);
      const intent: SuspendWalletTokenIntent = {
        id: asIntentId(`suspend_wallet_${token.tokenId}_${deviceId}`),
        actionType: ACTION_TYPES.SUSPEND_WALLET_TOKEN,
        idempotencyKey: `suspend_wallet_${token.tokenId}_${deviceId}`,
        actorId: this.operationsActorId,
        requestedAt: this.clock.now(),
        purpose: 'CUSTOMER_WALLET',
        payload: {
          tokenId: token.tokenId,
          accountId: card?.fundingAccountId ?? (token.cardId as unknown as Account['id']),
          deviceId,
          reason: `identity_device_${trustState.toLowerCase()}`,
        },
      };
      results.push(this.suspendToken(intent));
    }
    return results;
  }

  suspendToken(intent: SuspendWalletTokenIntent): WalletServiceOutcome<DevicePaymentToken> {
    const existing = this.store.tokenByIdempotency(intent.idempotencyKey);
    if (existing) {
      return this.replayOk(existing, intent.actionType, intent.id);
    }
    const token = this.store.getToken(intent.payload.tokenId);
    const card = token ? this.cards.getCard(token.cardId) : undefined;
    const account = card ? this.catalog.accounts.get(card.fundingAccountId) : undefined;
    const customer = account ? this.catalog.customers.get(account.ownerId) : undefined;
    const gated = this.gate(intent, account, customer);
    if (gated.outcome !== 'ALLOWED') {
      return gated.result;
    }
    if (!token) {
      return this.reject(intent.actionType, intent.id, gated.decision, 'TOKEN_NOT_FOUND', 'wallet token does not exist');
    }
    if (!tokenBoundToDevice(token, asDeviceId(intent.payload.deviceId))) {
      return this.reject(intent.actionType, intent.id, gated.decision, 'DEVICE_REBIND_FORBIDDEN', 'token is bound to a different device');
    }
    this.adapters[token.walletProvider].updateStatus({
      providerReference: token.providerReference,
      status: 'SUSPENDED',
    });
    const next = transitionDevicePaymentToken(token, 'SUSPENDED', this.clock.now());
    if (isErr(next)) {
      return this.reject(intent.actionType, intent.id, gated.decision, next.error.code, `${next.error.from} cannot become ${next.error.to}`);
    }
    this.store.saveToken(next.value);
    this.store.markTokenIdempotency(intent.idempotencyKey, next.value);
    this.emit('WalletTokenSuspended', 'wallet_token', next.value.tokenId, intent.id, gated.decision, {
      tokenId: next.value.tokenId,
      cardId: next.value.cardId,
      deviceId: next.value.deviceId,
      status: next.value.status,
    });
    this.evidence.seal('WALLET_TOKEN_SUSPENDED', {
      intentId: intent.id,
      tokenId: next.value.tokenId,
      deviceId: next.value.deviceId,
      reason: intent.payload.reason,
    });
    return { outcome: 'OK', value: next.value, decision: gated.decision };
  }

  authorizationBlockedByCard(card: Card | undefined): boolean {
    return !card || card.status !== 'ACTIVE';
  }

  private eligibilityFor(intent: ProvisionCardToWalletIntent): WalletEligibilityResult {
    const card = this.cards.getCard(intent.payload.cardId);
    const program = card ? this.cards.getProgram(card.programId) : undefined;
    const facts = this.identity.identityFactsFor(intent.actorId);
    const device = this.identity.getDevice(asDeviceId(intent.payload.deviceId));
    const fraud = evaluateFraud({
      subjectRef: `wallet:${intent.payload.cardId}:${intent.payload.deviceId}`,
      actorId: intent.actorId,
      sessionAssurance: facts.authenticationAssurance,
      deviceTrust: device?.trustState ?? null,
      recentAuthChange: false,
      accountAgeDays: 30,
      beneficiaryAgeDays: null,
      amountMinor: null,
      destinationRisk: 'STANDARD',
      identityUsable: facts.identityStatus === 'ACTIVE',
      velocityTriggered: false,
      now: this.clock.now(),
    });
    return evaluateWalletEligibility({
      identity: facts,
      deviceTrust: device?.trustState ?? null,
      card,
      program,
      walletProvider: intent.payload.walletProvider,
      fraudOutcome: fraud.outcome,
      complianceClear: facts.kycState === 'VERIFIED',
      jurisdictionPermitted: true,
    });
  }

  private gate(
    intent: CardIntent,
    account: Account | undefined,
    customer: Customer | undefined,
  ):
    | { readonly outcome: 'ALLOWED'; readonly decision: AuthorizationDecision; readonly authority: ExecutionAuthority }
    | { readonly outcome: 'REFUSED'; readonly result: WalletServiceOutcome<never> } {
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
  ): WalletServiceOutcome<never> {
    const evidence = this.evidence.seal(`${actionType}_REJECTED`, { intentId, code, message, posted: false });
    return { outcome: 'REJECTED', code, message, decision, evidenceId: evidence.evidenceId };
  }

  private replayOk<T>(value: T, actionType: string, intentId: string): WalletServiceOutcome<T> {
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
