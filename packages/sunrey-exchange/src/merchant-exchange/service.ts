import type { Clock } from '../../../config/src/clock.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';
import type { DomainEventLog } from '../../../events/src/events.ts';
import { Money } from '../../../money/src/money.ts';

import {
  checkMerchantOfferRate,
  checkSelfDealing,
  checkUserIntentRate,
  checkWithdrawRepost,
  createRateLimitState,
  DEFAULT_ABUSE_CONTROLS,
  type AbuseControlConfig,
  type RateLimitState,
} from './abuse.ts';
import { computeEconomicAttribution } from './attribution.ts';
import { evaluateMerchantEligibility, filterEligibleMerchants } from './eligibility.ts';
import { emitMerchantExchangeEvent } from './events.ts';
import { assertFulfillmentTransition } from './fulfillment.ts';
import {
  asMerchantExchangeMerchantId,
  asMerchantOfferId,
  asMerchantPurchaseId,
  asPurchaseIntentId,
  newMerchantOfferId,
  newMerchantPurchaseId,
  newPurchaseIntentId,
} from './ids.ts';
import { toMerchantVisibleIntent } from './privacy.ts';
import type { MerchantPaymentPort, MerchantRegistryPort } from './ports.ts';
import { rankOffers } from './ranking.ts';
import { mapPaymentBoundary, nextSettlementStatus } from './settlement.ts';
import { MerchantExchangeStore } from './store.ts';
import {
  assertIntentTransition,
  intentAcceptsOffers,
  intentAcceptsSelection,
  isTerminalIntentStatus,
} from './state-machine.ts';
import type {
  FulfillmentStatus,
  PurchaseCategory,
  PurchaseIntentStatus,
} from './taxonomy.ts';
import type {
  AcceptedOfferSnapshot,
  MerchantExchangeProfile,
  MerchantOffer,
  MerchantPurchase,
  PurchaseIntent,
  PurchaseIntentPreferences,
  PurchaseIntentRequiredCriteria,
  RankedOfferList,
  SunReyBenefitReference,
} from './types.ts';
import { merchantOfferVisibility } from './visibility.ts';
import { verifyPurchaseIntent } from './verification.ts';
import {
  computeOfferContentHash,
  validateMerchantOffer,
  verifyOfferImmutability,
} from './validation.ts';

export type MerchantExchangeOutcome<T> =
  | { readonly outcome: 'OK'; readonly value: T }
  | { readonly outcome: 'REJECTED'; readonly code: string; readonly message: string };

export type CreateIntentInput = {
  readonly userId: string;
  readonly required: PurchaseIntentRequiredCriteria;
  readonly specifications?: Readonly<Record<string, string>>;
  readonly locationConstraint: PurchaseIntent['locationConstraint'];
  readonly deliveryConstraint: PurchaseIntent['deliveryConstraint'];
  readonly budgetMinorUnits?: string;
  readonly desiredPurchaseTime?: UtcInstant | null;
  readonly preferences?: PurchaseIntentPreferences;
  readonly privacyPolicy?: PurchaseIntent['privacyPolicy'];
  readonly expiresAt: UtcInstant;
  readonly submit?: boolean;
};

export type SubmitOfferInput = {
  readonly merchantId: string;
  readonly intentId: string;
  readonly priceMinorUnits: string;
  readonly currency: string;
  readonly discountMinorUnits?: string;
  readonly deliveryTerms: string;
  readonly availability: string;
  readonly warranty?: string | null;
  readonly serviceTerms?: string | null;
  readonly incentives?: readonly string[];
  readonly sunReyBenefit?: SunReyBenefitReference;
  readonly expiresAt: UtcInstant;
};

export type SelectOfferInput = {
  readonly userId: string;
  readonly intentId: string;
  readonly offerId: string;
  readonly authorizationContext: string;
};

export class MerchantExchangeService {
  readonly store: MerchantExchangeStore;
  private readonly clock: Clock;
  private readonly events: DomainEventLog;
  private readonly payment: MerchantPaymentPort;
  private readonly registry: MerchantRegistryPort;
  private readonly abuseConfig: AbuseControlConfig;
  private readonly rateLimits: RateLimitState;
  private readonly supportedCategories: readonly PurchaseCategory[];
  private readonly supportedRegions: readonly string[];

  constructor(input: {
    readonly clock: Clock;
    readonly events: DomainEventLog;
    readonly payment: MerchantPaymentPort;
    readonly registry: MerchantRegistryPort;
    readonly store?: MerchantExchangeStore;
    readonly abuseConfig?: AbuseControlConfig;
    readonly supportedCategories?: readonly PurchaseCategory[];
    readonly supportedRegions?: readonly string[];
  }) {
    this.clock = input.clock;
    this.events = input.events;
    this.payment = input.payment;
    this.registry = input.registry;
    this.store = input.store ?? new MerchantExchangeStore();
    this.abuseConfig = input.abuseConfig ?? DEFAULT_ABUSE_CONTROLS;
    this.rateLimits = createRateLimitState();
    this.supportedCategories = input.supportedCategories ?? ['ELECTRONICS', 'HOME_GOODS', 'GROCERIES', 'APPAREL', 'SERVICES', 'HEALTH_WELLNESS', 'TRAVEL_EXPERIENCE', 'OTHER'];
    this.supportedRegions = input.supportedRegions ?? ['US', 'GB', 'CA', 'AU', 'DE'];
  }

  // ── Intent lifecycle ──────────────────────────────────────────────

  createIntent(input: CreateIntentInput): MerchantExchangeOutcome<PurchaseIntent> {
    const now = this.clock.now();
    const rateCheck = checkUserIntentRate(this.rateLimits, input.userId, now, this.abuseConfig);
    if (!rateCheck.allowed) {
      return reject(rateCheck.reason ?? 'RATE_LIMIT', 'intent creation rate limit exceeded');
    }

    let budget: Money | null = null;
    if (input.budgetMinorUnits) {
      try {
        budget = Money.fromMinorUnits(BigInt(input.budgetMinorUnits), input.required.currency);
      } catch {
        return reject('INVALID_BUDGET', 'budget is malformed');
      }
    }

    const intent: PurchaseIntent = Object.freeze({
      intentId: newPurchaseIntentId(),
      userId: input.userId,
      required: Object.freeze({ ...input.required }),
      specifications: Object.freeze({ ...(input.specifications ?? {}) }),
      locationConstraint: Object.freeze({ ...input.locationConstraint }),
      deliveryConstraint: Object.freeze({ ...input.deliveryConstraint }),
      budget,
      desiredPurchaseTime: input.desiredPurchaseTime ?? null,
      preferences: Object.freeze({ ...(input.preferences ?? {}) }),
      verificationState: 'UNVERIFIED',
      privacyPolicy: Object.freeze(
        input.privacyPolicy ?? {
          sharePostalPrefix: true,
          shareDeliveryWindow: true,
          shareBudgetRange: true,
          merchantVisibility: 'SEALED' as const,
        },
      ),
      expiresAt: input.expiresAt,
      status: input.submit ? 'SUBMITTED' : 'DRAFT',
      createdAt: now,
      updatedAt: now,
      version: 1,
    });

    this.store.saveIntent(intent);
    emitMerchantExchangeEvent(this.events, 'MerchantExchangeIntentCreated', intent.intentId, { intentId: intent.intentId, userId: intent.userId, status: intent.status }, now);

    if (input.submit) {
      return this.verifyAndOpen(intent.intentId, input.userId);
    }
    return ok(intent);
  }

  submitIntent(userId: string, intentId: string): MerchantExchangeOutcome<PurchaseIntent> {
    const intent = this.store.getIntent(asPurchaseIntentId(intentId));
    if (!intent) return reject('NOT_FOUND', 'intent not found');
    if (intent.userId !== userId) return reject('FORBIDDEN', 'not intent owner');
    if (intent.status !== 'DRAFT') return reject('INVALID_STATE', 'only DRAFT intents can be submitted');

    const transitioned = this.transitionIntent(intent, 'SUBMITTED');
    this.store.saveIntent(transitioned);
    return this.verifyAndOpen(transitioned.intentId, userId);
  }

  private verifyAndOpen(intentId: PurchaseIntentId, userId: string): MerchantExchangeOutcome<PurchaseIntent> {
    const intent = this.store.getIntent(intentId)!;
    const now = this.clock.now();

    const verification = verifyPurchaseIntent({
      intent,
      authenticatedUserId: userId,
      supportedCategories: this.supportedCategories,
      supportedRegions: this.supportedRegions,
      now,
      rateLimitClear: true,
      fraudClear: true,
    });

    if (!verification.verified) {
      const failed = this.transitionIntent(
        { ...intent, verificationState: 'REJECTED' },
        'FAILED',
      );
      this.store.saveIntent(failed);
      emitMerchantExchangeEvent(this.events, 'MerchantExchangePurchaseFailed', intentId, { intentId, reason: verification.reasons.join(',') }, now);
      return reject('VERIFICATION_FAILED', verification.reasons.join('; '));
    }

    let current = this.transitionIntent(
      { ...intent, verificationState: 'VERIFIED', updatedAt: now },
      'VERIFIED',
    );
    this.store.saveIntent(current);
    emitMerchantExchangeEvent(this.events, 'MerchantExchangeIntentVerified', intentId, { intentId, status: 'VERIFIED' }, now);

    current = this.transitionIntent(current, 'MATCHING');
    this.store.saveIntent(current);

    const merchants = this.resolveMerchants();
    const eligible = filterEligibleMerchants(merchants, current, now);
    for (const merchant of eligible) {
      emitMerchantExchangeEvent(this.events, 'MerchantExchangeMerchantMatched', intentId, {
        intentId,
        merchantId: merchant.merchantId,
      }, now);
    }

    current = this.transitionIntent(current, 'OPEN_FOR_OFFERS');
    this.store.saveIntent(current);
    emitMerchantExchangeEvent(this.events, 'MerchantExchangeIntentOpened', intentId, { intentId, status: 'OPEN_FOR_OFFERS' }, now);

    return ok(current);
  }

  getIntent(userId: string, intentId: string): MerchantExchangeOutcome<PurchaseIntent> {
    const intent = this.store.getIntent(asPurchaseIntentId(intentId));
    if (!intent) return reject('NOT_FOUND', 'intent not found');
    if (intent.userId !== userId) return reject('FORBIDDEN', 'not intent owner');
    return ok(intent);
  }

  getMerchantVisibleIntent(merchantId: string, intentId: string): MerchantExchangeOutcome<ReturnType<typeof toMerchantVisibleIntent>> {
    const intent = this.store.getIntent(asPurchaseIntentId(intentId));
    if (!intent) return reject('NOT_FOUND', 'intent not found');
    if (!intentAcceptsOffers(intent.status) && intent.status !== 'OFFER_SELECTION') {
      return reject('INTENT_NOT_OPEN', 'intent is not open for offers');
    }
    const merchant = this.store.getMerchant(asMerchantExchangeMerchantId(merchantId));
    const eligibility = evaluateMerchantEligibility({ merchant, intent, now: this.clock.now() });
    if (eligibility.outcome !== 'ELIGIBLE') {
      return reject('INELIGIBLE', eligibility.reasons.join('; '));
    }
    return ok(toMerchantVisibleIntent(intent));
  }

  // ── Offer lifecycle ─────────────────────────────────────────────────

  submitOffer(input: SubmitOfferInput): MerchantExchangeOutcome<MerchantOffer> {
    const now = this.clock.now();
    const intent = this.store.getIntent(asPurchaseIntentId(input.intentId));
    if (!intent) return reject('NOT_FOUND', 'intent not found');

    const merchantId = asMerchantExchangeMerchantId(input.merchantId);
    const merchant = this.store.getMerchant(merchantId);
    const eligibility = evaluateMerchantEligibility({ merchant, intent, now });

    const rateCheck = checkMerchantOfferRate(this.rateLimits, input.merchantId, now, this.abuseConfig);
    if (!rateCheck.allowed) {
      return reject(rateCheck.reason ?? 'RATE_LIMIT', 'merchant offer rate limit exceeded');
    }

    const registryEntry = this.registry.getMerchant(merchantId);
    const selfDealing = checkSelfDealing(intent.userId, registryEntry?.ownerUserId ?? null);
    if (!selfDealing.allowed) {
      return reject('SELF_DEALING', 'merchant cannot bid on own intent');
    }

    let price: Money;
    try {
      price = Money.fromMinorUnits(BigInt(input.priceMinorUnits), input.currency);
    } catch {
      return reject('MALFORMED_PRICE', 'price is malformed');
    }

    const discountMinorUnits = BigInt(input.discountMinorUnits ?? '0');
    const existingCount = this.store.offersByMerchantForIntent(merchantId, intent.intentId).length;

    const offerBase = {
      offerId: newMerchantOfferId(),
      intentId: intent.intentId,
      merchantId,
      price,
      discountMinorUnits,
      deliveryTerms: input.deliveryTerms,
      availability: input.availability,
      warranty: input.warranty ?? null,
      serviceTerms: input.serviceTerms ?? null,
      incentives: Object.freeze([...(input.incentives ?? [])]),
      sunReyBenefit: Object.freeze(
        input.sunReyBenefit ?? { benefitKind: 'NONE' as const, benefitReference: null, description: null },
      ),
      expiresAt: input.expiresAt,
      version: 1,
    };

    const validation = validateMerchantOffer({
      intent,
      offer: { ...offerBase, status: 'SUBMITTED', submittedAt: now },
      eligibility,
      now,
      existingOffersByMerchant: existingCount,
      maxOffersPerMerchant: this.abuseConfig.maxOffersPerMerchantPerIntent,
    });

    if (!validation.valid) {
      return reject('VALIDATION_FAILED', validation.reasons.join('; '));
    }

    const offer: MerchantOffer = Object.freeze({
      ...offerBase,
      status: 'ACTIVE',
      submittedAt: now,
      contentHash: computeOfferContentHash({ ...offerBase, status: 'ACTIVE', submittedAt: now }),
    });

    this.store.saveOffer(offer);
    emitMerchantExchangeEvent(this.events, 'MerchantExchangeOfferSubmitted', offer.offerId, {
      offerId: offer.offerId,
      intentId: offer.intentId,
      merchantId: offer.merchantId,
      offerVersion: offer.version,
      contentHash: offer.contentHash,
    }, now);

    return ok(offer);
  }

  withdrawOffer(merchantId: string, offerId: string): MerchantExchangeOutcome<MerchantOffer> {
    const now = this.clock.now();
    const offer = this.store.getOffer(asMerchantOfferId(offerId));
    if (!offer) return reject('NOT_FOUND', 'offer not found');
    if (offer.merchantId !== asMerchantExchangeMerchantId(merchantId)) {
      return reject('FORBIDDEN', 'not offer owner');
    }
    if (offer.status !== 'ACTIVE') return reject('INVALID_STATE', 'only ACTIVE offers can be withdrawn');

    const withdrawCheck = checkWithdrawRepost(this.rateLimits, merchantId, now, this.abuseConfig);
    if (!withdrawCheck.allowed) {
      return reject(withdrawCheck.reason ?? 'RATE_LIMIT', 'withdraw/repost limit exceeded');
    }

    const withdrawn: MerchantOffer = Object.freeze({ ...offer, status: 'WITHDRAWN' });
    this.store.saveOffer(withdrawn);
    emitMerchantExchangeEvent(this.events, 'MerchantExchangeOfferUpdated', offerId, {
      offerId,
      status: 'WITHDRAWN',
    }, now);
    return ok(withdrawn);
  }

  getMerchantOffers(merchantId: string, intentId: string): MerchantExchangeOutcome<ReturnType<typeof merchantOfferVisibility>> {
    const intent = this.store.getIntent(asPurchaseIntentId(intentId));
    if (!intent) return reject('NOT_FOUND', 'intent not found');
    const allOffers = this.store.offersForIntent(intent.intentId);
    return ok(merchantOfferVisibility(merchantId, allOffers));
  }

  // ── Ranking & selection ───────────────────────────────────────────

  getRankedOffers(userId: string, intentId: string): MerchantExchangeOutcome<RankedOfferList> {
    const intent = this.store.getIntent(asPurchaseIntentId(intentId));
    if (!intent) return reject('NOT_FOUND', 'intent not found');
    if (intent.userId !== userId) return reject('FORBIDDEN', 'not intent owner');
    if (!intentAcceptsSelection(intent.status)) {
      return reject('INVALID_STATE', 'intent not in selection phase');
    }

    const offers = this.store.activeOffersForIntent(intent.intentId);
    const expired = offers.filter((o) => o.expiresAt <= this.clock.now());
    for (const offer of expired) {
      const expiredOffer: MerchantOffer = Object.freeze({ ...offer, status: 'EXPIRED' });
      this.store.saveOffer(expiredOffer);
      emitMerchantExchangeEvent(this.events, 'MerchantExchangeOfferExpired', offer.offerId, { offerId: offer.offerId }, this.clock.now());
    }

    const active = offers.filter((o) => o.expiresAt > this.clock.now() && o.status === 'ACTIVE');
    return ok(rankOffers({ intent, offers: active, now: this.clock.now() }));
  }

  selectOffer(input: SelectOfferInput): MerchantExchangeOutcome<MerchantPurchase> {
    const now = this.clock.now();
    const intent = this.store.getIntent(asPurchaseIntentId(input.intentId));
    if (!intent) return reject('NOT_FOUND', 'intent not found');
    if (intent.userId !== input.userId) return reject('FORBIDDEN', 'not intent owner');
    if (!intentAcceptsSelection(intent.status)) {
      return reject('INVALID_STATE', 'intent not accepting selection');
    }

    const offer = this.store.getOffer(asMerchantOfferId(input.offerId));
    if (!offer) return reject('NOT_FOUND', 'offer not found');
    if (offer.intentId !== intent.intentId) return reject('INTENT_MISMATCH', 'offer does not match intent');
    if (offer.status !== 'ACTIVE') return reject('OFFER_NOT_ACTIVE', 'offer is not active');
    if (offer.expiresAt <= now) {
      const expired: MerchantOffer = Object.freeze({ ...offer, status: 'EXPIRED' });
      this.store.saveOffer(expired);
      emitMerchantExchangeEvent(this.events, 'MerchantExchangeOfferExpired', offer.offerId, { offerId: offer.offerId }, now);
      return reject('OFFER_EXPIRED', 'offer has expired');
    }

    const snapshot: AcceptedOfferSnapshot = Object.freeze({
      offerId: offer.offerId,
      offerVersion: offer.version,
      contentHash: offer.contentHash,
      offer: Object.freeze({ ...offer }),
      acceptedAt: now,
      authorizationContext: input.authorizationContext,
    });

    if (!verifyOfferImmutability(snapshot)) {
      return reject('INTEGRITY_FAILURE', 'offer integrity check failed');
    }

    this.store.saveAcceptedSnapshot(snapshot);
    const selectedOffer: MerchantOffer = Object.freeze({ ...offer, status: 'SELECTED' });
    this.store.saveOffer(selectedOffer);

    let currentIntent = intent;
    if (currentIntent.status === 'OPEN_FOR_OFFERS') {
      currentIntent = this.transitionIntent(currentIntent, 'OFFER_SELECTION');
      this.store.saveIntent(currentIntent);
    }

    emitMerchantExchangeEvent(this.events, 'MerchantExchangeOfferSelected', offer.offerId, {
      offerId: offer.offerId,
      intentId: intent.intentId,
      offerVersion: offer.version,
      contentHash: offer.contentHash,
      authorizationContext: input.authorizationContext,
    }, now);

    const purchase: MerchantPurchase = Object.freeze({
      purchaseId: newMerchantPurchaseId(),
      intentId: intent.intentId,
      userId: input.userId,
      acceptedOffer: snapshot,
      authorizationStatus: 'AWAITING_USER_AUTHORIZATION',
      fulfillmentStatus: null,
      settlementStatus: 'NOT_STARTED',
      paymentReference: null,
      createdAt: now,
      updatedAt: now,
    });
    this.store.savePurchase(purchase);

    computeEconomicAttribution({ intent, purchase, eventKind: 'OFFER_SELECTED', now });
    return ok(purchase);
  }

  // ── Authorization & payment ─────────────────────────────────────────

  authorizePurchase(userId: string, purchaseId: string): MerchantExchangeOutcome<MerchantPurchase> {
    const now = this.clock.now();
    const purchase = this.store.getPurchase(asMerchantPurchaseId(purchaseId));
    if (!purchase) return reject('NOT_FOUND', 'purchase not found');
    if (purchase.userId !== userId) return reject('FORBIDDEN', 'not purchase owner');

    const intent = this.store.getIntent(purchase.intentId)!;

    if (!verifyOfferImmutability(purchase.acceptedOffer)) {
      return reject('OFFER_MODIFIED', 'accepted offer has been modified after selection');
    }

    if (purchase.authorizationStatus !== 'AWAITING_USER_AUTHORIZATION') {
      return reject('INVALID_STATE', 'purchase not awaiting authorization');
    }

    const paymentResult = this.payment.requestAuthorization({
      purchase,
      intent,
      userId,
      now,
    });
    const resolved = paymentResult instanceof Promise ? null : paymentResult;
    if (!resolved) {
      return reject('ASYNC_PAYMENT', 'async payment port not supported in sync flow');
    }

    let updated: MerchantPurchase;
    switch (resolved.outcome) {
      case 'PROVIDER_UNAVAILABLE': {
        updated = Object.freeze({
          ...purchase,
          authorizationStatus: 'PAYMENT_UNAVAILABLE',
          updatedAt: now,
        });
        this.store.savePurchase(updated);
        return reject('PAYMENT_UNAVAILABLE', 'payment provider is not available');
      }
      case 'PENDING_USER_AUTHORIZATION': {
        updated = Object.freeze({ ...purchase, authorizationStatus: 'AWAITING_USER_AUTHORIZATION', updatedAt: now });
        this.store.savePurchase(updated);
        return reject('PENDING_AUTHORIZATION', 'user authorization still required');
      }
      case 'REJECTED': {
        updated = Object.freeze({ ...purchase, authorizationStatus: 'FAILED', updatedAt: now });
        this.store.savePurchase(updated);
        emitMerchantExchangeEvent(this.events, 'MerchantExchangePurchaseFailed', purchaseId, { purchaseId, reason: resolved.reason }, now);
        return reject('AUTHORIZATION_REJECTED', resolved.reason);
      }
      case 'AUTHORIZED': {
        updated = Object.freeze({
          ...purchase,
          authorizationStatus: 'AUTHORIZED',
          paymentReference: resolved.paymentReference,
          updatedAt: now,
        });
        this.store.savePurchase(updated);

        let currentIntent = this.transitionIntent(intent, 'AUTHORIZED');
        this.store.saveIntent(currentIntent);

        emitMerchantExchangeEvent(this.events, 'MerchantExchangePurchaseAuthorized', purchaseId, {
          purchaseId,
          intentId: intent.intentId,
          authorizationContext: purchase.acceptedOffer.authorizationContext,
        }, now);

        computeEconomicAttribution({ intent: currentIntent, purchase: updated, eventKind: 'PURCHASE_AUTHORIZED', now });
        return ok(updated);
      }
    }
  }

  // ── Fulfillment & settlement ────────────────────────────────────────

  startFulfillment(purchaseId: string): MerchantExchangeOutcome<MerchantPurchase> {
    const now = this.clock.now();
    const purchase = this.store.getPurchase(asMerchantPurchaseId(purchaseId));
    if (!purchase) return reject('NOT_FOUND', 'purchase not found');
    if (purchase.authorizationStatus !== 'AUTHORIZED' && purchase.authorizationStatus !== 'PAYMENT_SUBMITTED') {
      return reject('NOT_AUTHORIZED', 'purchase not authorized');
    }

    const intent = this.store.getIntent(purchase.intentId)!;
    const currentIntent = this.transitionIntent(intent, 'FULFILLMENT');
    this.store.saveIntent(currentIntent);

    const updated: MerchantPurchase = Object.freeze({
      ...purchase,
      fulfillmentStatus: 'ORDERED',
      settlementStatus: nextSettlementStatus(purchase.settlementStatus, 'PAYMENT_AUTHORIZED') ?? purchase.settlementStatus,
      updatedAt: now,
    });
    this.store.savePurchase(updated);
    emitMerchantExchangeEvent(this.events, 'MerchantExchangePurchaseStarted', purchaseId, { purchaseId, status: 'ORDERED' }, now);
    return ok(updated);
  }

  transitionFulfillment(
    purchaseId: string,
    to: FulfillmentStatus,
    actorMerchantId?: string,
  ): MerchantExchangeOutcome<MerchantPurchase> {
    const now = this.clock.now();
    const purchase = this.store.getPurchase(asMerchantPurchaseId(purchaseId));
    if (!purchase) return reject('NOT_FOUND', 'purchase not found');
    if (!purchase.fulfillmentStatus) return reject('INVALID_STATE', 'fulfillment not started');

    if (actorMerchantId && purchase.acceptedOffer.offer.merchantId !== asMerchantExchangeMerchantId(actorMerchantId)) {
      return reject('FORBIDDEN', 'not fulfilling merchant');
    }

    const transition = assertFulfillmentTransition(purchaseId, purchase.fulfillmentStatus, to);
    if (!transition.ok) {
      return reject('ILLEGAL_TRANSITION', `cannot transition from ${purchase.fulfillmentStatus} to ${to}`);
    }

    const updated: MerchantPurchase = Object.freeze({
      ...purchase,
      fulfillmentStatus: to,
      updatedAt: now,
    });
    this.store.savePurchase(updated);

    if (to === 'COMPLETED' || to === 'DELIVERED') {
      emitMerchantExchangeEvent(this.events, 'MerchantExchangePurchaseCompleted', purchaseId, { purchaseId, status: to }, now);
      computeEconomicAttribution({
        intent: this.store.getIntent(purchase.intentId)!,
        purchase: updated,
        eventKind: 'PURCHASE_COMPLETED',
        now,
      });
    }
    return ok(updated);
  }

  completeSettlement(purchaseId: string): MerchantExchangeOutcome<MerchantPurchase> {
    const now = this.clock.now();
    const purchase = this.store.getPurchase(asMerchantPurchaseId(purchaseId));
    if (!purchase) return reject('NOT_FOUND', 'purchase not found');
    if (!purchase.paymentReference) {
      return reject('NO_PAYMENT', 'settlement requires confirmed payment');
    }
    if (purchase.fulfillmentStatus !== 'COMPLETED' && purchase.fulfillmentStatus !== 'DELIVERED') {
      return reject('FULFILLMENT_INCOMPLETE', 'fulfillment must be complete before settlement');
    }

    const boundary = mapPaymentBoundary(purchase, this.payment.providerAvailable);
    if (!boundary.providerAvailable) {
      return reject('PAYMENT_UNAVAILABLE', 'payment provider unavailable for settlement');
    }

    let settlementStatus = purchase.settlementStatus;
    settlementStatus = nextSettlementStatus(settlementStatus, 'PAYMENT_CONFIRMED') ?? settlementStatus;
    settlementStatus = nextSettlementStatus(settlementStatus, 'SETTLEMENT_QUEUED') ?? settlementStatus;
    settlementStatus = nextSettlementStatus(settlementStatus, 'SETTLED') ?? settlementStatus;

    const updated: MerchantPurchase = Object.freeze({
      ...purchase,
      settlementStatus,
      updatedAt: now,
    });
    this.store.savePurchase(updated);

    const intent = this.store.getIntent(purchase.intentId)!;
    const settledIntent = this.transitionIntent(intent, 'SETTLED');
    this.store.saveIntent(settledIntent);

    emitMerchantExchangeEvent(this.events, 'MerchantExchangeSettlementCompleted', purchaseId, { purchaseId }, now);
    computeEconomicAttribution({ intent: settledIntent, purchase: updated, eventKind: 'SETTLEMENT_COMPLETED', now });
    return ok(updated);
  }

  getPurchase(userId: string, purchaseId: string): MerchantExchangeOutcome<MerchantPurchase> {
    const purchase = this.store.getPurchase(asMerchantPurchaseId(purchaseId));
    if (!purchase) return reject('NOT_FOUND', 'purchase not found');
    if (purchase.userId !== userId) return reject('FORBIDDEN', 'not purchase owner');
    return ok(purchase);
  }

  registerMerchant(profile: MerchantExchangeProfile): void {
    this.store.registerMerchant(profile);
  }

  // ── Internal helpers ────────────────────────────────────────────────

  private transitionIntent(intent: PurchaseIntent, to: PurchaseIntentStatus): PurchaseIntent {
    const result = assertIntentTransition(intent.intentId, intent.status, to);
    if (!result.ok) {
      throw new TypeError(`illegal intent transition: ${intent.status} → ${to}`);
    }
    if (isTerminalIntentStatus(intent.status)) {
      throw new TypeError(`intent ${intent.intentId} is terminal`);
    }
    return Object.freeze({
      ...intent,
      status: to,
      updatedAt: this.clock.now(),
      version: intent.version + 1,
    });
  }

  private resolveMerchants(): readonly MerchantExchangeProfile[] {
    return this.store.listMerchants();
  }
}

function ok<T>(value: T): MerchantExchangeOutcome<T> {
  return Object.freeze({ outcome: 'OK', value });
}

function reject<T>(code: string, message: string): MerchantExchangeOutcome<T> {
  return Object.freeze({ outcome: 'REJECTED', code, message });
}
