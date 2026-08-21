import { evaluateStepUp } from '../../../packages/identity/src/step-up.ts';
import type { IdentityService } from '../../../packages/identity/src/service.ts';
import { asIntentId } from '../../../packages/permissions/src/action-intent.ts';
import { ACTION_TYPES, type RequestCardIntent } from '../../../packages/permissions/src/action-types.ts';
import { SIMULATION_GB_VIRTUAL_PROGRAM, SIMULATION_US_VIRTUAL_PROGRAM } from '../../../packages/cards/src/program.ts';
import {
  toConsumerCard,
  toConsumerActivity,
  type ConsumerCardResource,
} from '../../../packages/cards/src/product/consumer.ts';
import type { CardsService, CardsServiceOutcome } from '../../../packages/cards/src/service.ts';
import type { Card } from '../../../packages/cards/src/card.ts';
import type { CardControls } from '../../../packages/cards/src/controls.ts';
import type { WalletProvisioningStatus } from '../../../packages/cards/src/wallet/provisioning.ts';
import { summarizeWalletProvisioningStatus, walletStatusFromEligibility } from '../../../packages/cards/src/wallet/provisioning.ts';
import { evaluateWalletEligibility } from '../../../packages/cards/src/wallet/eligibility.ts';

export type ConsumerCardDetail = {
  readonly card: ConsumerCardResource;
  readonly fundingAccountId: string;
  readonly available: { readonly currency: string; readonly minorUnits: string };
  readonly held: { readonly currency: string; readonly minorUnits: string };
  readonly recentTransactions: readonly {
    readonly id: string;
    readonly kind: string;
    readonly lifecycle: string;
    readonly merchant: string | null;
    readonly amountMinorUnits: string;
    readonly currency: string;
    readonly occurredAt: string;
  }[];
  readonly wallet: {
    readonly status: WalletProvisioningStatus;
    readonly apple: WalletProvisioningStatus;
    readonly google: WalletProvisioningStatus;
    readonly certification: 'NOT_CERTIFIED';
    readonly productionReady: false;
  };
};

export type ConsumerCardsOutcome<T> =
  | { readonly ok: true; readonly value: T; readonly replay?: boolean }
  | { readonly ok: false; readonly code: string; readonly message: string; readonly httpStatus: number };

/**
 * Application facade for the Consumer BFF. Orchestrates Kernel-gated
 * CardsService calls. Not a second card model.
 */
export class ConsumerCardsFacade {
  private readonly cards: CardsService;
  private readonly identity: IdentityService;
  private readonly nowFn: () => string;

  constructor(cards: CardsService, identity: IdentityService, nowFn: () => string) {
    this.cards = cards;
    this.identity = identity;
    this.nowFn = nowFn;
  }

  list(customerId: string): readonly ConsumerCardResource[] {
    return this.cards.listCards(customerId).map(toConsumerCard);
  }

  detail(customerId: string, cardId: string): ConsumerCardsOutcome<ConsumerCardDetail> {
    const card = this.cards.getCard(cardId);
    if (!card) {
      return fail('NOT_FOUND', 'card does not exist', 404);
    }
    if (card.customerId !== customerId) {
      return fail('RESOURCE_NOT_OWNED', 'card is not owned by the authenticated customer', 403);
    }
    const position = this.cards.available(card.fundingAccountId);
    const wallet = this.walletView(card);
    return {
      ok: true,
      value: Object.freeze({
        card: toConsumerCard({ ...card, walletProvisioningStatus: wallet.status }),
        fundingAccountId: card.fundingAccountId,
        available: Object.freeze({
          currency: position.available.currency,
          minorUnits: position.available.minorUnits.toString(),
        }),
        held: Object.freeze({
          currency: position.held.currency,
          minorUnits: position.held.minorUnits.toString(),
        }),
        recentTransactions: toConsumerActivity(this.cards.activity(card.cardId)).slice(-20),
        wallet,
      }),
    };
  }

  issue(input: {
    readonly actorId: string;
    readonly customerId: string;
    readonly accountId: string;
    readonly form: 'VIRTUAL' | 'PHYSICAL';
    readonly cardId: string;
    readonly idempotencyKey: string;
    readonly requestId: string;
  }): ConsumerCardsOutcome<ConsumerCardResource> {
    const stepped = this.requireStepUp(input.actorId, input.requestId);
    if (stepped) {
      return stepped;
    }
    const program =
      this.cards.store.getProgram(SIMULATION_GB_VIRTUAL_PROGRAM.programId) ?? SIMULATION_GB_VIRTUAL_PROGRAM;
    const us = this.cards.store.getProgram(SIMULATION_US_VIRTUAL_PROGRAM.programId);
    void us;
    const intent: RequestCardIntent = {
      id: asIntentId(`bff_issue_${input.requestId}`),
      actionType: ACTION_TYPES.REQUEST_CARD,
      idempotencyKey: input.idempotencyKey,
      actorId: input.actorId,
      requestedAt: this.nowFn() as RequestCardIntent['requestedAt'],
      purpose: 'CUSTOMER_CARD',
      payload: {
        cardId: input.cardId,
        accountId: input.accountId as RequestCardIntent['payload']['accountId'],
        ownerId: input.customerId as RequestCardIntent['payload']['ownerId'],
        programId: program.programId,
        formFactor: input.form,
      },
    };
    const requested = this.cards.requestCard(intent);
    if (requested.outcome !== 'OK') {
      return fromService(requested);
    }
    if (input.form === 'VIRTUAL' && requested.value.status === 'PENDING') {
      const activated = this.cards.activateCard({
        id: asIntentId(`bff_act_${input.requestId}`),
        actionType: ACTION_TYPES.ACTIVATE_CARD,
        idempotencyKey: `act_${input.idempotencyKey}`,
        actorId: input.actorId,
        requestedAt: this.nowFn() as RequestCardIntent['requestedAt'],
        purpose: 'CUSTOMER_CARD',
        payload: { cardId: requested.value.cardId, accountId: requested.value.fundingAccountId },
      });
      if (activated.outcome !== 'OK') {
        return fromService(activated);
      }
      return { ok: true, value: toConsumerCard(activated.value) };
    }
    return requested.replay === true
      ? { ok: true, value: toConsumerCard(requested.value), replay: true }
      : { ok: true, value: toConsumerCard(requested.value) };
  }

  freeze(input: {
    readonly actorId: string;
    readonly customerId: string;
    readonly cardId: string;
    readonly requestId: string;
  }): ConsumerCardsOutcome<ConsumerCardResource> {
    return this.lifecycle(input, ACTION_TYPES.FREEZE_CARD, (card) =>
      this.cards.freezeCard({
        id: asIntentId(`bff_fz_${input.requestId}`),
        actionType: ACTION_TYPES.FREEZE_CARD,
        idempotencyKey: `fz_${input.requestId}`,
        actorId: input.actorId,
        requestedAt: this.nowFn() as RequestCardIntent['requestedAt'],
        purpose: 'CUSTOMER_CARD',
        payload: { cardId: card.cardId, accountId: card.fundingAccountId },
      }),
    );
  }

  unfreeze(input: {
    readonly actorId: string;
    readonly customerId: string;
    readonly cardId: string;
    readonly requestId: string;
  }): ConsumerCardsOutcome<ConsumerCardResource> {
    return this.lifecycle(input, ACTION_TYPES.UNFREEZE_CARD, (card) =>
      this.cards.unfreezeCard({
        id: asIntentId(`bff_ufz_${input.requestId}`),
        actionType: ACTION_TYPES.UNFREEZE_CARD,
        idempotencyKey: `ufz_${input.requestId}`,
        actorId: input.actorId,
        requestedAt: this.nowFn() as RequestCardIntent['requestedAt'],
        purpose: 'CUSTOMER_CARD',
        payload: { cardId: card.cardId, accountId: card.fundingAccountId },
      }),
    );
  }

  updateControls(input: {
    readonly actorId: string;
    readonly customerId: string;
    readonly cardId: string;
    readonly requestId: string;
    readonly patch: Partial<{
      readonly frozen: boolean;
      readonly onlineTransactions: boolean;
      readonly internationalTransactions: boolean;
      readonly cashWithdrawal: boolean;
      readonly contactless: boolean;
      readonly blockedMerchantCategories: readonly string[];
      readonly blockedCountries: readonly string[];
      readonly transactionLimitMinor: string | null;
      readonly dailyLimitMinor: string | null;
    }>;
  }): ConsumerCardsOutcome<ConsumerCardResource> {
    const stepped = this.requireStepUp(input.actorId, input.requestId);
    if (stepped) {
      return stepped;
    }
    const owned = this.owned(input.customerId, input.cardId);
    if (!owned.ok) {
      return owned;
    }
    const controls: Partial<CardControls> = {
      ...(input.patch.frozen !== undefined ? { frozen: input.patch.frozen } : {}),
      ...(input.patch.onlineTransactions !== undefined ? { ecommerceEnabled: input.patch.onlineTransactions } : {}),
      ...(input.patch.internationalTransactions !== undefined
        ? { internationalEnabled: input.patch.internationalTransactions }
        : {}),
      ...(input.patch.cashWithdrawal !== undefined ? { cashAtmEnabled: input.patch.cashWithdrawal } : {}),
      ...(input.patch.contactless !== undefined ? { contactlessEnabled: input.patch.contactless } : {}),
      ...(input.patch.blockedMerchantCategories
        ? { blockedMerchantCategories: input.patch.blockedMerchantCategories }
        : {}),
      ...(input.patch.blockedCountries ? { blockedCountries: input.patch.blockedCountries } : {}),
      ...(input.patch.transactionLimitMinor !== undefined
        ? {
            transactionAmountLimitMinor:
              input.patch.transactionLimitMinor === null ? null : BigInt(input.patch.transactionLimitMinor),
          }
        : {}),
      ...(input.patch.dailyLimitMinor !== undefined
        ? { dailyAmountLimitMinor: input.patch.dailyLimitMinor === null ? null : BigInt(input.patch.dailyLimitMinor) }
        : {}),
    };
    const updated = this.cards.updateControls({
      id: asIntentId(`bff_ctl_${input.requestId}`),
      actionType: ACTION_TYPES.UPDATE_CARD_CONTROLS,
      idempotencyKey: `ctl_${input.requestId}`,
      actorId: input.actorId,
      requestedAt: this.nowFn() as RequestCardIntent['requestedAt'],
      purpose: 'CUSTOMER_CARD',
      payload: { cardId: owned.value.cardId, accountId: owned.value.fundingAccountId, controls },
    });
    return updated.outcome === 'OK' ? { ok: true, value: toConsumerCard(updated.value) } : fromService(updated);
  }

  walletStatus(customerId: string, cardId: string): ConsumerCardsOutcome<ConsumerCardDetail['wallet']> {
    const owned = this.owned(customerId, cardId);
    if (!owned.ok) {
      return owned;
    }
    return { ok: true, value: this.walletView(owned.value) };
  }

  private lifecycle(
    input: { readonly actorId: string; readonly customerId: string; readonly cardId: string; readonly requestId: string },
    _action: string,
    run: (card: Card) => CardsServiceOutcome<Card>,
  ): ConsumerCardsOutcome<ConsumerCardResource> {
    void _action;
    const stepped = this.requireStepUp(input.actorId, input.requestId);
    if (stepped) {
      return stepped;
    }
    const owned = this.owned(input.customerId, input.cardId);
    if (!owned.ok) {
      return owned;
    }
    const result = run(owned.value);
    if (result.outcome !== 'OK') {
      return fromService(result);
    }
    return result.replay === true
      ? { ok: true, value: toConsumerCard(result.value), replay: true }
      : { ok: true, value: toConsumerCard(result.value) };
  }

  private owned(customerId: string, cardId: string): ConsumerCardsOutcome<Card> {
    const card = this.cards.getCard(cardId);
    if (!card) {
      return fail('NOT_FOUND', 'card does not exist', 404);
    }
    if (card.customerId !== customerId) {
      return fail('RESOURCE_NOT_OWNED', 'card is not owned by the authenticated customer', 403);
    }
    return { ok: true, value: card };
  }

  private requireStepUp(actorId: string, requestId: string): ConsumerCardsOutcome<never> | null {
    const session = this.identity.activeSessionForActor(actorId);
    if (!session) {
      return fail('SESSION_INVALID', 'no active session', 401);
    }
    const decision = evaluateStepUp(session, 'HIGH_ASSURANCE');
    if (!decision.ok) {
      return fail(decision.error.code, decision.error.message, 401);
    }
    if (decision.value.required) {
      return fail('STEP_UP_REQUIRED', 'sensitive card actions require high-assurance step-up', 403);
    }
    void requestId;
    return null;
  }

  private walletView(card: Card): ConsumerCardDetail['wallet'] {
    const facts = this.identity.identityFactsFor(card.requestedByActorId);
    const program = this.cards.store.getProgram(card.programId);
    const eligibility = evaluateWalletEligibility({
      identity: facts,
      deviceTrust: 'TRUSTED',
      card,
      program,
      walletProvider: 'APPLE_WALLET',
      fraudOutcome: 'ALLOW',
      complianceClear: true,
      jurisdictionPermitted: true,
    });
    const eligibilityStatus = walletStatusFromEligibility(eligibility.outcome);
    const status = summarizeWalletProvisioningStatus({
      eligibility: card.status === 'ACTIVE' ? eligibilityStatus : 'NOT_ELIGIBLE',
      tokens: [],
    });
    return Object.freeze({
      status,
      apple: status,
      google: status,
      certification: 'NOT_CERTIFIED',
      productionReady: false,
    });
  }
}

function fromService<T>(result: CardsServiceOutcome<T>): ConsumerCardsOutcome<never> {
  if (result.outcome === 'KERNEL_REFUSED') {
    return fail(result.decision.status, 'compliance kernel refused the card action', 403);
  }
  if (result.outcome === 'REJECTED') {
    return fail(result.code, result.message, result.code === 'CARD_NOT_FOUND' ? 404 : 400);
  }
  return fail('UNEXPECTED', 'card action did not complete', 400);
}

function fail(code: string, message: string, httpStatus: number): ConsumerCardsOutcome<never> {
  return { ok: false, code, message, httpStatus };
}
