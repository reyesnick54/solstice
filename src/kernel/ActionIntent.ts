import type { Money } from "../money/Money.ts";

/**
 * Existing ActionIntent interface. Every customer-touching action enters
 * the Compliance Kernel as one of these. New action types add a payload
 * that conforms to this envelope; they do not bypass the envelope.
 */
export interface ActionIntent<TPayload = unknown> {
  readonly actionType: string;
  readonly payload: TPayload;
  readonly idempotencyKey: string;
  readonly actorId: string;
  readonly requestedAt: string;
}

export const ActionType = {
  POST_DEPOSIT: "POST_DEPOSIT",
} as const;

export type ActionType = (typeof ActionType)[keyof typeof ActionType];

/**
 * POST_DEPOSIT payload. Amount is Money (bigint minor units) only.
 */
export interface PostDepositPayload {
  readonly customerAccountId: string;
  readonly amount: Money;
  readonly memo?: string;
}

export type PostDepositIntent = ActionIntent<PostDepositPayload>;
