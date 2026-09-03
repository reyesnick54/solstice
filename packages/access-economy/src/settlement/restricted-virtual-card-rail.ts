// @ts-nocheck
/**
 * Restricted virtual-card Access payment rail.
 *
 * Funds virtual cards in fiat only. Never loads SR/MR onto cards.
 * Requires funding reservation before card activation.
 */

import { randomUUID } from 'node:crypto';

import type { UtcInstant } from '../../../domain/src/time.ts';
import {
  buildAccessCardControls,
  validateAccessCardControls,
  validateSecurityDepositConfiguration,
} from './card-controls.ts';
import type { RestrictedCardIssuerPort } from './issuer-port.ts';
import { AccessSettlementReconciliationStore } from './reconciliation.ts';
import {
  ACCESS_PAYMENT_RAIL_CAPABILITIES,
  RESTRICTED_CARD_RAIL_ID,
  type AccessCardLifecycleEvent,
  type AccessPaymentRailStatus,
} from './taxonomy.ts';
import type {
  AccessCardAuthorizationRecord,
  AccessCardCaptureRecord,
  AccessCardLifecycleEventRecord,
  AccessPaymentRail,
  AccessSettlementReconciliation,
  AccessVirtualCardRecord,
  AccessVirtualCardRequest,
  AuthorizationValidationResult,
  CaptureResult,
  DisableCardResult,
  FundingReservationVerifier,
  RefundResult,
  VirtualCardCreationResult,
  VoidResult,
} from './types.ts';

export type RestrictedVirtualCardAccessRailOptions = {
  readonly issuer: RestrictedCardIssuerPort;
  readonly fundingVerifier: FundingReservationVerifier;
  readonly store?: AccessSettlementReconciliationStore;
  readonly programId?: string;
};

export class RestrictedVirtualCardAccessRail implements AccessPaymentRail {
  readonly railId = RESTRICTED_CARD_RAIL_ID;
  readonly capabilities = ACCESS_PAYMENT_RAIL_CAPABILITIES;
  readonly issuerProviderId: string;
  readonly controlSupport;

  private readonly issuer: RestrictedCardIssuerPort;
  private readonly fundingVerifier: FundingReservationVerifier;
  private readonly store: AccessSettlementReconciliationStore;
  private readonly programId: string;
  private readonly lifecycleEvents: AccessCardLifecycleEventRecord[] = [];

  constructor(options: RestrictedVirtualCardAccessRailOptions) {
    this.issuer = options.issuer;
    this.fundingVerifier = options.fundingVerifier;
    this.store = options.store ?? new AccessSettlementReconciliationStore();
    this.programId = options.programId ?? 'sunrey-access-restricted-virtual';
    this.issuerProviderId = options.issuer.providerId;
    this.controlSupport = options.issuer.controlSupport;
  }

  get status(): AccessPaymentRailStatus {
    switch (this.issuer.lifecycle) {
      case 'SIMULATED':
        return 'READY';
      case 'SANDBOX':
        return 'SANDBOX';
      case 'PRODUCTION':
        return 'BLOCKED_PENDING_PROVIDER';
    }
  }

  async createVirtualCard(request: AccessVirtualCardRequest): Promise<VirtualCardCreationResult> {
    const depositCheck = validateSecurityDepositConfiguration(request);
    if (!depositCheck.ok) {
      return {
        ok: false,
        code: depositCheck.code,
        message: 'security deposits must be user-funded on a separate instrument',
      };
    }

    if ((request.tokenConversionContributionMinorUnits ?? 0n) > 0n) {
      return {
        ok: false,
        code: 'TOKEN_FUNDING_FORBIDDEN',
        message: 'virtual cards are funded in fiat only; SR/MR loading is forbidden',
      };
    }

    const totalFunding =
      request.accessPoolContributionMinorUnits + request.userFiatContributionMinorUnits;
    if (
      !this.fundingVerifier.isReserved({
        fundingReservationId: request.fundingReservationId,
        accessTransactionId: request.accessTransactionId,
        amountMinorUnits: totalFunding,
        currency: request.currency,
      })
    ) {
      return {
        ok: false,
        code: 'FUNDING_NOT_RESERVED',
        message: 'funding must be reserved before card issuance',
      };
    }

    const controls = buildAccessCardControls(request, this.controlSupport);
    const cardId = `avc_${randomUUID()}`;
    const issued = this.issuer.issueRestrictedCard({
      cardId,
      programId: this.programId,
      controls,
    });

    if (!issued.ok) {
      return {
        ok: false,
        code: issued.code,
        message: `card issuance failed: ${issued.code}`,
      };
    }

    const now = request.validFrom;
    const card: AccessVirtualCardRecord = Object.freeze({
      cardId,
      providerCardId: issued.metadata.processorCardRef,
      accessTransactionId: request.accessTransactionId,
      settlementId: request.settlementId,
      providerId: request.providerId,
      last4: issued.metadata.last4,
      status: 'ACTIVE',
      controls,
      fundingReservationId: request.fundingReservationId,
      issuerProviderId: this.issuerProviderId,
      authorizedAmountMinorUnits: 0n,
      capturedAmountMinorUnits: 0n,
      createdAt: now,
      updatedAt: now,
    });
    this.store.saveCard(card);
    this.recordEvent('CARD_CREATED', card, { settlementId: request.settlementId }, now);
    return { ok: true, card };
  }

  validateAuthorization(input: {
    readonly cardId: string;
    readonly settlementId: string;
    readonly merchantId: string;
    readonly merchantCategory: string;
    readonly country: string;
    readonly amountMinorUnits: bigint;
    readonly currency: string;
    readonly incremental?: boolean;
    readonly now: UtcInstant;
    readonly securityDepositAttempt?: boolean;
  }): AuthorizationValidationResult {
    const card = this.store.getCard(input.cardId);
    if (!card || card.settlementId !== input.settlementId) {
      return { ok: false, code: 'CARD_DISABLED', message: 'card not found for settlement' };
    }

    const existingAuths = this.store.listAuthorizationsForCard(input.cardId);
    const approvedAuths = existingAuths.filter((a) => a.status === 'APPROVED');
    const aggregate = approvedAuths.reduce((sum, a) => sum + a.amountMinorUnits, 0n);

    const controlResult = validateAccessCardControls({
      controls: card.controls,
      cardStatus: card.status,
      merchantId: input.merchantId,
      merchantCategory: input.merchantCategory,
      country: input.country,
      amountMinorUnits: input.amountMinorUnits,
      currency: input.currency,
      now: input.now,
      aggregateAuthorizedMinorUnits: aggregate,
      authorizationCount: approvedAuths.length,
      securityDepositAttempt: input.securityDepositAttempt,
    });

    const authorizationId = `auth_${randomUUID()}`;
    const processorReference = `pref_${randomUUID()}`;

    if (!controlResult.allowed) {
      const declined: AccessCardAuthorizationRecord = Object.freeze({
        authorizationId,
        cardId: input.cardId,
        settlementId: input.settlementId,
        merchantId: input.merchantId,
        merchantCategory: input.merchantCategory,
        country: input.country,
        amountMinorUnits: input.amountMinorUnits,
        currency: input.currency,
        status: 'DECLINED',
        declineReason: controlResult.code,
        processorReference,
        incremental: input.incremental ?? false,
        createdAt: input.now,
      });
      this.store.saveAuthorization(declined);
      this.recordEvent(
        'AUTHORIZATION_DECLINED',
        card,
        { authorizationId, reason: controlResult.code },
        input.now,
      );
      return { ok: false, code: controlResult.code, message: `authorization declined: ${controlResult.code}` };
    }

    const approved: AccessCardAuthorizationRecord = Object.freeze({
      authorizationId,
      cardId: input.cardId,
      settlementId: input.settlementId,
      merchantId: input.merchantId,
      merchantCategory: input.merchantCategory,
      country: input.country,
      amountMinorUnits: input.amountMinorUnits,
      currency: input.currency,
      status: 'APPROVED',
      declineReason: null,
      processorReference,
      incremental: input.incremental ?? false,
      createdAt: input.now,
    });
    this.store.saveAuthorization(approved);

    const updatedCard: AccessVirtualCardRecord = Object.freeze({
      ...card,
      status: 'AUTHORIZED',
      authorizedAmountMinorUnits: aggregate + input.amountMinorUnits,
      updatedAt: input.now,
    });
    this.store.updateCard(updatedCard);
    this.recordEvent('AUTHORIZATION_APPROVED', updatedCard, { authorizationId }, input.now);

    if (card.controls.singleUse) {
      this.disableCardInternal(updatedCard, 'single-use exhausted', input.now);
    }

    return { ok: true, authorization: approved };
  }

  capture(input: {
    readonly authorizationId: string;
    readonly amountMinorUnits: bigint;
    readonly now: UtcInstant;
  }): CaptureResult {
    const auth = this.store.getAuthorization(input.authorizationId);
    if (!auth || auth.status !== 'APPROVED') {
      return { ok: false, code: 'CARD_DISABLED', message: 'authorization not found or not approved' };
    }
    const card = this.store.getCard(auth.cardId);
    if (!card) {
      return { ok: false, code: 'CARD_DISABLED', message: 'card not found' };
    }
    if (input.amountMinorUnits > auth.amountMinorUnits) {
      return { ok: false, code: 'AMOUNT_EXCEEDS_LIMIT', message: 'capture exceeds authorization' };
    }

    const capture: AccessCardCaptureRecord = Object.freeze({
      captureId: `cap_${randomUUID()}`,
      authorizationId: input.authorizationId,
      cardId: auth.cardId,
      settlementId: auth.settlementId,
      amountMinorUnits: input.amountMinorUnits,
      currency: auth.currency,
      processorReference: `capref_${randomUUID()}`,
      createdAt: input.now,
    });
    this.store.saveCapture(capture);

    const updatedCard: AccessVirtualCardRecord = Object.freeze({
      ...card,
      status: 'CAPTURED',
      capturedAmountMinorUnits: card.capturedAmountMinorUnits + input.amountMinorUnits,
      updatedAt: input.now,
    });
    this.store.updateCard(updatedCard);
    this.recordEvent('CAPTURED', updatedCard, { captureId: capture.captureId }, input.now);
    return { ok: true, capture };
  }

  voidAuthorization(input: { readonly authorizationId: string; readonly now: UtcInstant }): VoidResult {
    const auth = this.store.getAuthorization(input.authorizationId);
    if (!auth) {
      return { ok: false, code: 'CARD_DISABLED', message: 'authorization not found' };
    }
    const card = this.store.getCard(auth.cardId);
    if (card) {
      this.recordEvent('REVERSED', card, { authorizationId: input.authorizationId }, input.now);
    }
    return { ok: true, authorizationId: input.authorizationId };
  }

  refund(input: {
    readonly captureId: string;
    readonly amountMinorUnits: bigint;
    readonly now: UtcInstant;
  }): RefundResult {
    const capture = this.store.getCapture(input.captureId);
    if (!capture) {
      return { ok: false, code: 'CARD_DISABLED', message: 'capture not found' };
    }
    const card = this.store.getCard(capture.cardId);
    if (card) {
      this.recordEvent('REFUNDED', card, { captureId: input.captureId, amount: String(input.amountMinorUnits) }, input.now);
    }
    return { ok: true, refundId: `ref_${randomUUID()}`, amountMinorUnits: input.amountMinorUnits };
  }

  getCardStatus(cardId: string): AccessVirtualCardRecord | undefined {
    return this.store.getCard(cardId);
  }

  disableCard(input: {
    readonly cardId: string;
    readonly reason: string;
    readonly now: UtcInstant;
  }): DisableCardResult {
    const card = this.store.getCard(input.cardId);
    if (!card) {
      return { ok: false, code: 'CARD_DISABLED', message: 'card not found' };
    }
    const disabled = this.disableCardInternal(card, input.reason, input.now);
    return { ok: true, card: disabled };
  }

  reconcile(settlementId: string, now: UtcInstant): AccessSettlementReconciliation | undefined {
    const card = this.store.getCardBySettlement(settlementId);
    if (!card) {
      return undefined;
    }
    return this.store.reconcile({
      accessTransactionId: card.accessTransactionId,
      settlementId,
      providerAmountMinorUnits: card.controls.maximumAmountMinorUnits,
      currency: card.controls.currency,
      now,
    });
  }

  listLifecycleEvents(): readonly AccessCardLifecycleEventRecord[] {
    return this.lifecycleEvents;
  }

  getStore(): AccessSettlementReconciliationStore {
    return this.store;
  }

  private disableCardInternal(
    card: AccessVirtualCardRecord,
    reason: string,
    now: UtcInstant,
  ): AccessVirtualCardRecord {
    this.issuer.disableCard(card.providerCardId);
    const disabled: AccessVirtualCardRecord = Object.freeze({
      ...card,
      status: 'DISABLED',
      updatedAt: now,
    });
    this.store.updateCard(disabled);
    this.recordEvent('CARD_DISABLED', disabled, { reason }, now);
    return disabled;
  }

  private recordEvent(
    eventType: AccessCardLifecycleEvent,
    card: AccessVirtualCardRecord,
    payload: Readonly<Record<string, unknown>>,
    now: UtcInstant,
  ): void {
    this.lifecycleEvents.push(
      Object.freeze({
        eventId: `evt_${randomUUID()}`,
        cardId: card.cardId,
        settlementId: card.settlementId,
        eventType,
        payload,
        evidenceReference: `evidence:${eventType}:${card.cardId}`,
        createdAt: now,
      }),
    );
  }
}
