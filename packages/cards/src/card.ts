import type { AccountId } from '../../domain/src/account.ts';
import type { CurrencyCode } from '../../domain/src/currency.ts';
import type { CustomerId } from '../../domain/src/customer.ts';
import type { UtcInstant } from '../../domain/src/time.ts';
import { err, ok, type Result } from '../../domain/src/result.ts';
import { assertNoSensitiveCardData, SYNTHETIC_CARD_DISPLAY } from './pci-boundary.ts';
import type { CardControls } from './controls.ts';
import type { CardId, CardProgramId, ProcessorCardReference } from './ids.ts';

export const CARD_FORM_FACTORS = ['VIRTUAL', 'PHYSICAL'] as const;
export type CardFormFactor = (typeof CARD_FORM_FACTORS)[number];

export const CARD_STATUSES = ['PENDING', 'ACTIVE', 'FROZEN', 'SUSPENDED', 'CLOSED', 'EXPIRED'] as const;
export type CardStatus = (typeof CARD_STATUSES)[number];

const ALLOWED_TRANSITIONS: Readonly<Record<CardStatus, readonly CardStatus[]>> = {
  PENDING: ['ACTIVE', 'CLOSED'],
  ACTIVE: ['FROZEN', 'SUSPENDED', 'CLOSED', 'EXPIRED'],
  FROZEN: ['ACTIVE', 'CLOSED'],
  SUSPENDED: ['ACTIVE', 'CLOSED'],
  CLOSED: [],
  EXPIRED: ['CLOSED'],
};

export type Card = {
  readonly cardId: CardId;
  readonly customerId: CustomerId;
  readonly fundingAccountId: AccountId;
  readonly currency: CurrencyCode;
  readonly programId: CardProgramId;
  readonly processorCardRef: ProcessorCardReference;
  readonly formFactor: CardFormFactor;
  readonly status: CardStatus;
  readonly controls: CardControls;
  readonly displayHint: typeof SYNTHETIC_CARD_DISPLAY;
  readonly requestedByActorId: string;
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
  return Object.freeze({
    ...card,
    controls: Object.freeze({ ...card.controls }),
    displayHint: SYNTHETIC_CARD_DISPLAY,
  });
}

export function transitionCard(
  card: Card,
  to: CardStatus,
  now: UtcInstant,
  patch: Partial<Pick<Card, 'controls' | 'activatedAt'>> = {},
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
