/**
 * ActionIntent envelope. Every consequential action enters the Compliance
 * Kernel as one of these. New action types add a payload that conforms to
 * this envelope; they do not bypass the envelope.
 *
 * `intentId` is the idempotency key. The same intent id submitted twice
 * must produce exactly one consequential state change.
 */
export interface ActionIntent<TPayload = unknown> {
  readonly actionType: string;
  readonly payload: TPayload;
  readonly intentId: string;
  readonly idempotencyKey: string;
  readonly actorId: string;
  readonly requestedAt: string;
}

export const ActionType = {
  OPEN_ACCOUNT: 'OPEN_ACCOUNT',
} as const;

export type ActionTypeName = (typeof ActionType)[keyof typeof ActionType];

export const ACCOUNT_CLASSES = [
  'INSURED_DEPOSIT',
  'INVESTMENT_ASSET',
  'DIGITAL_ASSET',
  'REWARD',
  'PENDING_EARNING',
] as const;

export type AccountClass = (typeof ACCOUNT_CLASSES)[number];

export interface OpenAccountPayload {
  readonly accountId: string;
  readonly ownerId: string;
  readonly accountClass: AccountClass;
  readonly productId: string;
  readonly legalEntityId: string;
  readonly jurisdiction: string;
  readonly currency: string;
  readonly purpose: string;
}

export type OpenAccountIntent = ActionIntent<OpenAccountPayload>;

export function openAccountIntent(
  input: Omit<OpenAccountIntent, 'actionType' | 'idempotencyKey'> & {
    readonly intentId: string;
  },
): OpenAccountIntent {
  return Object.freeze({
    actionType: ActionType.OPEN_ACCOUNT,
    payload: Object.freeze({ ...input.payload }),
    intentId: input.intentId,
    idempotencyKey: input.intentId,
    actorId: input.actorId,
    requestedAt: input.requestedAt,
  });
}
