import type { AccountId } from '../../domain/src/account.ts';
import type { CurrencyCode } from '../../domain/src/currency.ts';
import type { CustomerId } from '../../domain/src/customer.ts';
import type { UtcInstant } from '../../domain/src/time.ts';
import { err, ok, type Result } from '../../domain/src/result.ts';
import { assertNoSensitiveCardData, SYNTHETIC_CARD_DISPLAY } from './pci-boundary.ts';
import type { CardControls } from './controls.ts';
import type { CardId, CardProgramId, ProcessorCardReference } from './ids.ts';
import {
  WALLET_PROVISIONING_STATUSES,
  type WalletProvisioningStatus,
} from './wallet/provisioning.ts';

export const CARD_FORM_FACTORS = ['VIRTUAL', 'PHYSICAL'] as const;
export type CardFormFactor = (typeof CARD_FORM_FACTORS)[number];

/**
 * Product type. SunRey cards are debit-funded from a customer account.
 * This is not a credit, charge, or lending product.
 */
export const CARD_TYPES = ['DEBIT'] as const;
export type CardType = (typeof CARD_TYPES)[number];

/**
 * Controlled lifecycle. User actions request a change; provider/backend
 * confirmation is authoritative. EXPIRED remains a terminal operational
 * state from the original simulation model.
 */
export const CARD_STATUSES = [
  'REQUESTED',
  'PENDING',
  'ACTIVE',
  'FROZEN',
  'SUSPENDED',
  'REPLACED',
  'CLOSED',
  'EXPIRED',
] as const;
export type CardStatus = (typeof CARD_STATUSES)[number];

const ALLOWED_TRANSITIONS: Readonly<Record<CardStatus, readonly CardStatus[]>> = {
  REQUESTED: ['PENDING', 'ACTIVE', 'CLOSED'],
  PENDING: ['ACTIVE', 'CLOSED'],
  ACTIVE: ['FROZEN', 'SUSPENDED', 'REPLACED', 'CLOSED', 'EXPIRED'],
  FROZEN: ['ACTIVE', 'CLOSED', 'REPLACED'],
  SUSPENDED: ['ACTIVE', 'CLOSED', 'REPLACED'],
  REPLACED: ['CLOSED'],
  CLOSED: [],
  EXPIRED: ['CLOSED'],
};

/**
 * Expiry metadata safe for backend/frontend. Month/year only.
 * Never a full track or PAN.
 */
export type CardExpiryMetadata = {
  readonly month: number;
  readonly year: number;
};

export type Card = {
  readonly cardId: CardId;
  readonly customerId: CustomerId;
  readonly fundingAccountId: AccountId;
  readonly currency: CurrencyCode;
  readonly programId: CardProgramId;
  readonly processorCardRef: ProcessorCardReference;
  readonly providerReference: ProcessorCardReference;
  readonly cardType: CardType;
  readonly formFactor: CardFormFactor;
  readonly status: CardStatus;
  readonly last4: string | null;
  readonly expiry: CardExpiryMetadata | null;
  readonly walletProvisioningStatus: WalletProvisioningStatus;
  readonly controls: CardControls;
  readonly displayHint: typeof SYNTHETIC_CARD_DISPLAY;
  readonly requestedByActorId: string;
  readonly replacedByCardId: CardId | null;
  readonly createdAt: UtcInstant;
  readonly activatedAt: UtcInstant | null;
  readonly updatedAt: UtcInstant;
};

export type IllegalCardTransition = {
  readonly code: 'ILLEGAL_CARD_TRANSITION';
  readonly from: CardStatus;
  readonly to: CardStatus;
};

export function canTransitionCard(from: CardStatus, to: CardStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function freezeCard(card: Card): Card {
  assertNoSensitiveCardData(card, 'card');
  if ('balance' in card) {
    throw new TypeError('Card must not own a balance');
  }
  if (card.last4 !== null && !/^[0-9]{4}$/.test(card.last4)) {
    throw new TypeError('last4 must be four digits or null');
  }
  if (card.expiry !== null) {
    if (card.expiry.month < 1 || card.expiry.month > 12 || card.expiry.year < 2000) {
      throw new TypeError('expiry metadata is invalid');
    }
  }
  if (!(WALLET_PROVISIONING_STATUSES as readonly string[]).includes(card.walletProvisioningStatus)) {
    throw new TypeError('walletProvisioningStatus is invalid');
  }
  return Object.freeze({
    ...card,
    cardType: 'DEBIT',
    controls: Object.freeze({ ...card.controls }),
    expiry: card.expiry === null ? null : Object.freeze({ ...card.expiry }),
    displayHint: SYNTHETIC_CARD_DISPLAY,
    providerReference: card.providerReference ?? card.processorCardRef,
  });
}

export function transitionCard(
  card: Card,
  to: CardStatus,
  now: UtcInstant,
  patch: Partial<Pick<Card, 'controls' | 'activatedAt' | 'replacedByCardId' | 'walletProvisioningStatus'>> = {},
): Result<Card, IllegalCardTransition> {
  if (!canTransitionCard(card.status, to)) {
    return err({ code: 'ILLEGAL_CARD_TRANSITION', from: card.status, to });
  }
  return ok(
    freezeCard({
      ...card,
      ...patch,
      status: to,
      updatedAt: now,
      activatedAt: to === 'ACTIVE' ? (patch.activatedAt ?? now) : card.activatedAt,
    }),
  );
}

export function cardCanAuthorize(card: Card): card is Card & { readonly status: 'ACTIVE' } {
  return card.status === 'ACTIVE';
}
